import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import feedService from '../services/feedService';
import { useAuth } from './AuthContext';
import { emitDataMutation, subscribeToSyncBus } from '../utils/syncBus';

const FeedContext = createContext(null);

export const FeedProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [feedLogs, setFeedLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFeedLogs = useCallback(async (isSilent = false) => {
    if (!isAuthenticated) {
      setFeedLogs([]);
      return;
    }
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const res = await feedService.getFeeds();
      const list = res.data || res || [];
      const normalized = (Array.isArray(list) ? list : []).map((f) => {
        const cropObj = f.crop || {};
        const tankObj = cropObj.tank || {};
        const tankId = String(f.tankId || cropObj.tankId || tankObj.id || '');
        const cropId = String(f.cropId || cropObj.id || '');
        const rawDate = f.date || f.feedingDate;
        const feedingDate = rawDate ? (typeof rawDate === 'string' ? rawDate.split('T')[0] : new Date(rawDate).toISOString().split('T')[0]) : '';

        return {
          ...f,
          id: String(f.id),
          tankId,
          cropId,
          date: rawDate,
          feedingDate,
          quantityKg: parseFloat(f.quantity ?? f.quantityKg ?? 0),
          feedCost: parseFloat(f.totalCost ?? f.feedCost ?? (f.quantity * f.costPerKg) ?? 0),
          tankName: tankObj.tankName || f.tankName || 'Tank',
          cropName: cropObj.cropName || f.cropName || 'Crop',
        };
      });
      setFeedLogs(normalized);
    } catch (err) {
      console.error('Error fetching feed logs:', err);
      setError(err.message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchFeedLogs();
  }, [fetchFeedLogs, token]);

  // Subscribe to sync bus events for cascading feed cleanup & reactive updates
  useEffect(() => {
    const unsubscribe = subscribeToSyncBus((detail) => {
      if (detail.action === 'DELETE') {
        if (detail.entityType === 'SITE' && detail.payload?.siteId) {
          setFeedLogs((prev) => prev.filter((f) => String(f.crop?.tank?.siteId || f.siteId) !== String(detail.payload.siteId)));
        } else if (detail.entityType === 'TANK' && detail.payload?.tankId) {
          setFeedLogs((prev) => prev.filter((f) => String(f.crop?.tankId || f.tankId) !== String(detail.payload.tankId)));
        }
        fetchFeedLogs(true);
      } else if (['SITE', 'TANK', 'CROP', 'FEED'].includes(detail.entityType)) {
        fetchFeedLogs(true);
      }
    });
    return unsubscribe;
  }, [fetchFeedLogs]);

  const addFeedLog = async (newFeedData) => {
    const payload = {
      tankId: newFeedData.tankId,
      date: newFeedData.feedingDate || newFeedData.date || new Date().toISOString().split('T')[0],
      feedType: newFeedData.feedType,
      feedBrand: newFeedData.feedBrand,
      feedSize: newFeedData.feedSize || 'Standard',
      quantity: parseFloat(newFeedData.quantityKg || newFeedData.quantity),
      costPerKg: parseFloat(newFeedData.costPerKg || (newFeedData.feedCost / newFeedData.quantityKg) || 100),
      notes: newFeedData.notes || undefined,
    };

    const res = await feedService.createFeed(payload);
    const created = res.data || res;

    const rawDate = created.date || payload.date;
    const feedingDate = typeof rawDate === 'string' ? rawDate.split('T')[0] : new Date(rawDate).toISOString().split('T')[0];

    const normalized = {
      ...created,
      id: String(created.id),
      tankId: String(newFeedData.tankId || created.crop?.tankId || ''),
      cropId: String(created.cropId || created.crop?.id || ''),
      date: rawDate,
      feedingDate,
      quantityKg: parseFloat(created.quantity ?? payload.quantity),
      feedCost: parseFloat(created.totalCost ?? (payload.quantity * payload.costPerKg)),
      tankName: newFeedData.tankName || 'Tank',
      cropName: newFeedData.cropName || 'Crop',
    };
    setFeedLogs((prev) => [normalized, ...prev]);
    emitDataMutation('FEED', 'CREATE', normalized);
    fetchFeedLogs(true);
    return normalized;
  };

  const updateFeedLog = async (id, updatedData) => {
    const targetId = String(id);
    const payload = {
      ...(updatedData.feedingDate || updatedData.date ? { date: updatedData.feedingDate || updatedData.date } : {}),
      ...(updatedData.feedType ? { feedType: updatedData.feedType } : {}),
      ...(updatedData.feedBrand ? { feedBrand: updatedData.feedBrand } : {}),
      ...(updatedData.feedSize ? { feedSize: updatedData.feedSize } : {}),
      ...(updatedData.quantityKg || updatedData.quantity
        ? { quantity: parseFloat(updatedData.quantityKg || updatedData.quantity) }
        : {}),
      ...(updatedData.costPerKg ? { costPerKg: parseFloat(updatedData.costPerKg) } : {}),
      ...(updatedData.notes !== undefined ? { notes: updatedData.notes } : {}),
    };

    const res = await feedService.updateFeed(targetId, payload);
    const updated = res.data || res;

    const rawDate = updated.date || updatedData.feedingDate || updatedData.date;
    const feedingDate = rawDate ? (typeof rawDate === 'string' ? rawDate.split('T')[0] : new Date(rawDate).toISOString().split('T')[0]) : '';

    const normalized = {
      ...updated,
      id: targetId,
      tankId: String(updated.crop?.tankId || updated.crop?.tank?.id || updatedData.tankId || ''),
      cropId: String(updated.cropId || updated.crop?.id || ''),
      date: rawDate,
      feedingDate,
      quantityKg: parseFloat(updated.quantity ?? updatedData.quantityKg ?? 0),
      feedCost: parseFloat(updated.totalCost ?? updatedData.feedCost ?? 0),
      tankName: updated.crop?.tank?.tankName || 'Tank',
      cropName: updated.crop?.cropName || 'Crop',
    };
    setFeedLogs((prev) => prev.map((log) => (String(log.id) === targetId ? { ...log, ...normalized } : log)));
    emitDataMutation('FEED', 'UPDATE', normalized);
    fetchFeedLogs(true);
    return normalized;
  };

  const deleteFeedLog = async (id, password) => {
    if (!id) return;
    const targetId = String(id);
    await feedService.deleteFeed(targetId, password);
    setFeedLogs((prev) => prev.filter((log) => String(log.id) !== targetId));
    emitDataMutation('FEED', 'DELETE', { id: targetId });
    fetchFeedLogs(true);
  };

  const getFeedLogById = (id) => {
    if (!id) return null;
    return feedLogs.find((log) => String(log.id) === String(id));
  };

  // Analytics Computation
  const analytics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    const todaysFeedKg = feedLogs.reduce((acc, log) => {
      if (log.feedingDate === todayStr) {
        return acc + (parseFloat(log.quantityKg) || 0);
      }
      return acc;
    }, 0);

    const totalFeedUsedKg = feedLogs.reduce((acc, log) => acc + (parseFloat(log.quantityKg) || 0), 0);

    const uniqueDates = new Set(feedLogs.map((log) => log.feedingDate));
    const dayCount = uniqueDates.size || 1;
    const avgFeedPerDayKg = totalFeedUsedKg / dayCount;

    const totalFeedCostRupees = feedLogs.reduce((acc, log) => acc + (parseFloat(log.feedCost) || 0), 0);

    return {
      todaysFeedKg,
      totalFeedUsedKg,
      avgFeedPerDayKg: avgFeedPerDayKg.toFixed(1),
      totalFeedCostRupees,
    };
  }, [feedLogs]);

  return (
    <FeedContext.Provider
      value={{
        feedLogs,
        loading,
        error,
        fetchFeedLogs,
        addFeedLog,
        updateFeedLog,
        deleteFeedLog,
        getFeedLogById,
        analytics,
      }}
    >
      {children}
    </FeedContext.Provider>
  );
};

export const useFeed = () => {
  const context = useContext(FeedContext);
  if (!context) {
    throw new Error('useFeed must be used within a FeedProvider');
  }
  return context;
};

export default FeedContext;
