import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import expenseService from '../services/expenseService';
import { useAuth } from './AuthContext';
import { emitDataMutation, subscribeToSyncBus } from '../utils/syncBus';

const ExpenseContext = createContext(null);

/**
 * Maps frontend payment mode selections (e.g. 'UPI / Net Banking', 'UPI', 'Net Banking')
 * to the exact enum string required by the backend API contract ('CASH' | 'UPI').
 */
const mapPaymentModeToApi = (mode) => {
  if (!mode) return 'CASH';
  const upper = String(mode).toUpperCase().trim();
  if (upper.includes('UPI') || upper.includes('NET') || upper.includes('BANK') || upper.includes('ONLINE')) {
    return 'UPI';
  }
  return 'CASH';
};

/**
 * Normalizes backend payment mode strings ('CASH', 'UPI') to user-friendly UI display labels.
 */
const normalizePaymentModeForUi = (mode) => {
  if (!mode) return 'Cash';
  const upper = String(mode).toUpperCase().trim();
  if (upper === 'UPI' || upper.includes('NET') || upper.includes('BANK')) {
    return 'UPI / Net Banking';
  }
  return 'Cash';
};

export const ExpenseProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchExpenses = useCallback(async (isSilent = false) => {
    if (!isAuthenticated) {
      setExpenses([]);
      return;
    }
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const res = await expenseService.getExpenses();
      const list = res.data || res || [];
      const normalized = (Array.isArray(list) ? list : []).map((item) => ({
        ...item,
        id: String(item.id),
        tankId: String(item.crop?.tankId || item.crop?.tank?.id || item.tankId || ''),
        date: item.date ? new Date(item.date).toISOString().split('T')[0] : item.date,
        paymentModeDisplay: normalizePaymentModeForUi(item.paymentMode),
        tankName: item.crop?.tank?.tankName || item.crop?.tank?.name || item.tankName || 'Tank',
      }));
      setExpenses(normalized);
    } catch (err) {
      console.error('Error fetching expenses:', err);
      setError(err.message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses, token]);

  // Subscribe to sync bus events for cascading cleanup & re-fetching
  useEffect(() => {
    const unsubscribe = subscribeToSyncBus((detail) => {
      if (detail.action === 'DELETE') {
        if (detail.entityType === 'TANK' && detail.payload?.tankId) {
          setExpenses((prev) => prev.filter((e) => String(e.tankId) !== String(detail.payload.tankId)));
        } else if (detail.entityType === 'CROP' && detail.payload?.cropId) {
          setExpenses((prev) => prev.filter((e) => String(e.cropId) !== String(detail.payload.cropId)));
        }
        fetchExpenses(true);
      } else if (['SITE', 'TANK', 'CROP', 'EXPENSE'].includes(detail.entityType)) {
        fetchExpenses(true);
      }
    });
    return unsubscribe;
  }, [fetchExpenses]);

  const addExpense = async (newExpenseData) => {
    const payload = {
      ...(newExpenseData.tankId ? { tankId: newExpenseData.tankId } : {}),
      ...(newExpenseData.siteId ? { siteId: newExpenseData.siteId } : {}),
      category: newExpenseData.category,
      description: newExpenseData.description || `${newExpenseData.category} expense`,
      amount: parseFloat(newExpenseData.amount),
      paymentMode: mapPaymentModeToApi(newExpenseData.paymentMode),
      date: newExpenseData.date || new Date().toISOString().split('T')[0],
      notes: newExpenseData.notes || undefined,
    };

    const res = await expenseService.createExpense(payload);
    await fetchExpenses(true);
    emitDataMutation('EXPENSE', 'CREATE', res);
    return res;
  };

  const updateExpense = async (id, updatedData) => {
    const targetId = String(id);
    const payload = {
      ...(updatedData.category ? { category: updatedData.category } : {}),
      ...(updatedData.description ? { description: updatedData.description } : {}),
      ...(updatedData.amount ? { amount: parseFloat(updatedData.amount) } : {}),
      ...(updatedData.paymentMode ? { paymentMode: mapPaymentModeToApi(updatedData.paymentMode) } : {}),
      ...(updatedData.date ? { date: updatedData.date } : {}),
      ...(updatedData.notes !== undefined ? { notes: updatedData.notes } : {}),
    };

    const res = await expenseService.updateExpense(targetId, payload);
    const updated = res.data || res;
    const normalized = {
      ...updated,
      id: targetId,
      tankId: String(updated.crop?.tankId || updated.crop?.tank?.id || updatedData.tankId || ''),
      date: updated.date ? new Date(updated.date).toISOString().split('T')[0] : updatedData.date,
      paymentModeDisplay: normalizePaymentModeForUi(updated.paymentMode || updatedData.paymentMode),
      tankName: updated.crop?.tank?.tankName || updated.crop?.tank?.name || 'Tank',
    };
    setExpenses((prev) => prev.map((item) => (String(item.id) === targetId ? { ...item, ...normalized } : item)));
    emitDataMutation('EXPENSE', 'UPDATE', normalized);
    return normalized;
  };

  const deleteExpense = async (id, password) => {
    if (!id) return;
    const targetId = String(id);
    await expenseService.deleteExpense(targetId, password);
    setExpenses((prev) => prev.filter((item) => String(item.id) !== targetId));
    emitDataMutation('EXPENSE', 'DELETE', { id: targetId });
  };

  const getExpenseById = (id) => {
    return expenses.find((item) => String(item.id) === String(id));
  };

  return (
    <ExpenseContext.Provider
      value={{
        expenses,
        loading,
        error,
        fetchExpenses,
        addExpense,
        updateExpense,
        deleteExpense,
        getExpenseById,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpense = () => {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpense must be used within an ExpenseProvider');
  }
  return context;
};

// Export useExpenses alias for 100% backward compatibility
export const useExpenses = useExpense;

export default ExpenseContext;
