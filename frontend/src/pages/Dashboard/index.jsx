import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  UtensilsCrossed,
  Receipt,
  FileSpreadsheet,
  ArrowRight,
  Waves,
  Sprout,
  CheckCircle2,
  MapPin,
  Maximize2,
  Calendar,
  Layers,
  FileText,
  Building2,
  Tag,
  IndianRupee,
  ShieldAlert,
  Info
} from 'lucide-react';

import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';
import dashboardService from '../../services/dashboardService';
import { useAuth } from '../../context/AuthContext';
import { useTanks } from '../../context/TankContext';
import { useCrops } from '../../context/CropContext';
import { usePondLeases } from '../../context/PondLeaseContext';
import { useHarvests } from '../../context/HarvestContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, user, farm: authFarm } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Contexts for real-time consistent data fetching & reactive updates
  const { tanks = [], loading: tanksLoading } = useTanks();
  const { crops = [], loading: cropsLoading } = useCrops();
  const { leases = [], loading: leasesLoading } = usePondLeases();
  const { harvests = [] } = useHarvests();

  // Review Modals State
  const [isTankReviewOpen, setIsTankReviewOpen] = useState(false);
  const [isActiveCropsReviewOpen, setIsActiveCropsReviewOpen] = useState(false);
  const [isCompletedCropsReviewOpen, setIsCompletedCropsReviewOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboard() {
      if (!isAuthenticated) return;
      try {
        setLoading(true);
        const res = await dashboardService.getDashboard();
        if (isMounted) {
          setDashboardData(res.data || res);
        }
      } catch (err) {
        console.log('Dashboard fetch status:', err.message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user]);

  const stats = dashboardData?.statistics || {};
  const farm = dashboardData?.farm || authFarm || {};

  const hasFarmConfigured = Boolean(farm?.farmName || authFarm?.farmName || tanks.length > 0 || stats.totalTanks > 0);

  // Filter Active Crops vs Completed Crops dynamically
  const activeCropsList = useMemo(() => {
    return (crops || []).filter((c) => c.rawStatus === 'ACTIVE' || c.status === 'Active' || c.status === 'ACTIVE');
  }, [crops]);

  const completedCropsList = useMemo(() => {
    return (crops || []).filter((c) => c.rawStatus === 'COMPLETED' || c.status === 'Completed' || c.status === 'COMPLETED');
  }, [crops]);

  // Dynamic counts using real database context and backend stats fallback
  const totalTanksCount = tanks.length > 0 ? tanks.length : (stats.totalTanks ?? 0);
  const activeCropsCount = activeCropsList.length > 0 ? activeCropsList.length : (stats.activeCrops ?? 0);
  const completedCropsCount = completedCropsList.length > 0 ? completedCropsList.length : (stats.completedCrops ?? 0);

  // Calculate FCR Ratio across all completed crops
  const completedBatchesFcr = useMemo(() => {
    let totalFeed = 0;
    let totalHarvest = 0;
    (completedCropsList || []).forEach((crop) => {
      const feedSum = (crop.feedEntries || []).reduce((sum, f) => sum + (parseFloat(f.quantity) || 0), 0);
      const cropHarvests = (harvests || []).filter((h) => String(h.cropId || h.crop?.id) === String(crop.id));
      const fallbackHarvests = cropHarvests.length > 0 ? cropHarvests : (crop.harvests || []);
      const harvestSum = fallbackHarvests.reduce((sum, h) => sum + (parseFloat(h.harvestWeight || h.production || 0)), 0);
      totalFeed += feedSum;
      totalHarvest += harvestSum;
    });
    if (totalHarvest > 0) {
      return (totalFeed / totalHarvest).toFixed(2);
    }
    return (stats.fcrRatio !== undefined && stats.fcrRatio !== null) ? Number(stats.fcrRatio).toFixed(2) : '0.00';
  }, [completedCropsList, harvests, stats.fcrRatio]);

  // SIMPLIFIED 3 CARDS ONLY (Total Tanks / Ponds, Active Crops, Completed Batches)
  const farmSummaryCards = [
    {
      id: 'tanks',
      title: 'TOTAL TANKS / PONDS',
      value: totalTanksCount,
      description: farm.farmName ? `${farm.farmName} (${farm.totalAcres || 0} Acres)` : 'Configured farm ponds',
      icon: Waves,
      bgColor: 'bg-teal-50 text-teal-700 border-teal-200',
      action: () => setIsTankReviewOpen(true),
    },
    {
      id: 'activeCrops',
      title: 'ACTIVE CROPS',
      value: activeCropsCount,
      description: `${activeCropsCount} active culture batches`,
      icon: Sprout,
      bgColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      action: () => setIsActiveCropsReviewOpen(true),
    },
    {
      id: 'completedBatches',
      title: 'COMPLETED BATCHES',
      value: completedCropsCount,
      description: `${completedCropsCount} ${completedCropsCount === 1 ? 'batch' : 'batches'} completed`,
      fcrValue: completedBatchesFcr,
      icon: CheckCircle2,
      bgColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      action: () => setIsCompletedCropsReviewOpen(true),
    },
  ];

  // Quick Actions Modules (Stocking, Feed, Expenses, Reports)
  const quickActions = [
    { label: 'Stocking Management', path: '/stocking', icon: Boxes, isHighlighted: true },
    { label: 'Feed Management', path: '/feed', icon: UtensilsCrossed, isHighlighted: true },
    { label: 'Expenses', path: '/expenses', icon: Receipt, isHighlighted: true },
    { label: 'Reports', path: '/reports', icon: FileSpreadsheet, isHighlighted: true },
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. WELCOME SECTION */}
      <div className="relative rounded-2xl bg-gradient-to-r from-teal-900 via-primary to-teal-800 text-white p-5 sm:p-6 shadow-md overflow-hidden border border-teal-700/40">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Welcome to AquaTrack
            </h1>
            <p className="text-xs sm:text-sm text-teal-100/90 max-w-xl">
              {hasFarmConfigured
                ? `Centralized operational overview for ${farm.farmName || 'your farm'}.`
                : 'Complete your farm setup to begin managing your operations.'}
            </p>
          </div>

          <div className="shrink-0">
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/farm-setup')}
              icon={<ArrowRight className="w-4 h-4 text-primary" />}
              iconPosition="right"
              className="bg-white text-primary hover:bg-teal-50 font-bold px-6 py-2.5 text-sm shadow-md border-none transition-transform hover:scale-105"
            >
              {hasFarmConfigured ? 'Manage Farm' : 'Create Farm Profile'}
            </Button>
          </div>
        </div>
      </div>

      {/* 2. QUICK ACTIONS (Directly below Welcome section) */}
      <div className="bg-surface border border-border/80 rounded-2xl p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
            Quick Actions
          </h2>
          <span className="text-[11px] text-text-secondary">Direct access to active modules</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => navigate(action.path)}
                className="flex flex-col items-center justify-center p-3.5 rounded-xl transition-all text-center group cursor-pointer border bg-primary-light/30 border-primary/30 hover:border-primary/60 hover:bg-primary-light/50 shadow-2xs"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2 shadow-2xs border transition-transform group-hover:scale-105 bg-primary-light text-primary border-primary/30">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs leading-tight transition-colors font-bold text-primary">
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. FARM SUMMARY - SIMPLIFIED TO 3 SUMMARY CARDS ONLY */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
            Farm Summary
          </h2>
          <span className="text-[11px] text-text-secondary font-medium">
            {loading ? 'Loading...' : 'Operational Overview'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {farmSummaryCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.id}
                hoverEffect={true}
                padding="compact"
                onClick={stat.action}
                className="flex flex-col justify-between border-border/70 shadow-2xs hover:shadow-md cursor-pointer transition-all hover:border-primary/40 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider group-hover:text-primary transition-colors">
                      {stat.title}
                    </span>
                    <span className="text-3xl font-extrabold text-text-primary mt-1.5 tracking-tight">
                      {loading ? '...' : stat.value}
                    </span>
                  </div>

                  <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center shrink-0 border shadow-2xs transition-transform group-hover:scale-110`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                {stat.id === 'completedBatches' && (
                  <div className="mt-2.5 flex items-center justify-between bg-cyan-50/80 px-2.5 py-1.5 rounded-lg border border-cyan-200/70">
                    <span className="text-[10px] font-bold uppercase text-cyan-900 tracking-wider">
                      FCR Ratio
                    </span>
                    <span className="text-xs font-extrabold text-cyan-800">
                      {loading ? '...' : (stat.fcrValue || '0.00')}
                    </span>
                  </div>
                )}

                <div className="mt-3.5 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs text-text-secondary">
                  <span className="truncate font-medium">{stat.description}</span>
                  <span className="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    View Details &rarr;
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. TOTAL TANKS / PONDS REVIEW MODAL                          */}
      {/* ============================================================ */}
      <Modal
        isOpen={isTankReviewOpen}
        onClose={() => setIsTankReviewOpen(false)}
        title="Farm Tanks & Ponds Review"
        description="Complete detailed list of all configured farm tanks, pond acres, and tank-wise pond lease records."
        size="xl"
      >
        <div className="space-y-4">
          {tanks.length > 0 ? (
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              {tanks.map((tank) => {
                // Find pond lease associated with this tank
                const tankLease = (tank.pondLeases && tank.pondLeases.length > 0)
                  ? tank.pondLeases[0]
                  : (leases || []).find((l) => String(l.tankId) === String(tank.id));

                // Find active crop associated with this tank
                const activeCropForTank = activeCropsList.find((c) => String(c.tankId) === String(tank.id));

                const siteName = tank.site?.siteName || tank.siteName || 'Site';
                const siteLocation = tank.site?.location || '';
                const displayLocation = siteLocation ? `${siteName} (${siteLocation})` : siteName;

                return (
                  <div
                    key={tank.id}
                    className="p-4 rounded-xl bg-surface border border-border/80 shadow-2xs hover:border-primary/40 transition-all space-y-3"
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                          <Waves className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-text-primary">
                            {tank.tankName || tank.name}
                          </h4>
                          <span className="text-[11px] text-text-secondary flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-primary" /> {displayLocation}
                          </span>
                        </div>
                      </div>

                      <Badge variant={activeCropForTank ? 'success' : 'neutral'} size="sm">
                        {activeCropForTank ? `Active Crop (Batch #${activeCropForTank.batchNumber || activeCropForTank.cropName})` : 'Available / Idle'}
                      </Badge>
                    </div>

                    {/* Tank Specifications Grid (Acres & Hatchery/Unit) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {/* ACRES DISPLAY */}
                      <div className="p-2.5 rounded-lg bg-background border border-border/60">
                        <span className="text-[10px] uppercase font-bold text-text-secondary block flex items-center gap-1">
                          <Maximize2 className="w-3 h-3 text-primary" /> Acres
                        </span>
                        <span className="text-sm font-bold text-text-primary mt-0.5 block">
                          {tank.area ? `${tank.area} Acres` : 'N/A'}
                        </span>
                      </div>

                      {/* HATCHERY / UNIT */}
                      <div className="p-2.5 rounded-lg bg-background border border-border/60">
                        <span className="text-[10px] uppercase font-bold text-text-secondary block">
                          Hatchery / Unit
                        </span>
                        <span className="text-sm font-semibold text-text-primary mt-0.5 block truncate" title={tank.hatcheryName || 'Not specified'}>
                          {tank.hatcheryName ? `${tank.hatcheryName}${tank.hatcheryUnit ? ` (${tank.hatcheryUnit})` : ''}` : 'Not specified'}
                        </span>
                      </div>
                    </div>

                    {/* POND LEASE INFORMATION SECTION (TANK-WISE) */}
                    <div className="p-3 rounded-xl bg-primary-light/20 border border-primary/20 text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-primary" /> Pond Lease Details
                        </span>
                      </div>

                      {tankLease ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-surface p-2.5 rounded-lg border border-border/50">
                          <div>
                            <span className="text-[10px] font-semibold text-text-secondary block uppercase">
                              Pond Lease Amount
                            </span>
                            <span className="text-xs font-bold text-emerald-700">
                              ₹{(parseFloat(tankLease.totalLeaseAmount) || 0).toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-semibold text-text-secondary block uppercase">
                              Start Date
                            </span>
                            <span className="text-xs font-medium text-text-primary">
                              {formatDate(tankLease.leaseStartDate)}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-semibold text-text-secondary block uppercase">
                              End Date
                            </span>
                            <span className="text-xs font-medium text-text-primary">
                              {formatDate(tankLease.leaseEndDate)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] font-medium text-text-secondary italic py-0.5">
                          No pond lease recorded for this tank.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No Tanks Found"
              description="No tanks or ponds have been configured for this farm profile yet."
              actionLabel="Add New Tank"
              onAction={() => {
                setIsTankReviewOpen(false);
                navigate('/tanks');
              }}
            />
          )}

          <div className="flex items-center justify-end pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTankReviewOpen(false)}
            >
              Close Review
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* 5. ACTIVE CROPS REVIEW MODAL                                 */}
      {/* ============================================================ */}
      <Modal
        isOpen={isActiveCropsReviewOpen}
        onClose={() => setIsActiveCropsReviewOpen(false)}
        title="Active Crop Batches Review"
        description="Currently active aquaculture crop culture batches running in farm tanks."
        size="xl"
      >
        <div className="space-y-4">
          {activeCropsList.length > 0 ? (
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              {activeCropsList.map((crop) => {
                const stockingDateObj = crop.stockingDate ? new Date(crop.stockingDate) : null;
                const daysRunning = stockingDateObj && !isNaN(stockingDateObj.getTime())
                  ? Math.max(0, Math.floor((new Date() - stockingDateObj) / (1000 * 60 * 60 * 24)))
                  : 0;

                return (
                  <div
                    key={crop.id}
                    className="p-4 rounded-xl bg-surface border border-border/80 shadow-2xs hover:border-emerald-500/40 transition-all space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                          <Sprout className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-text-primary">
                            Batch #{crop.batchNumber || crop.cropName}
                          </h4>
                          <span className="text-[11px] text-text-secondary flex items-center gap-1">
                            <Waves className="w-3 h-3 text-primary" /> {crop.tankName || crop.tank?.tankName || 'Tank'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="primary" size="sm">
                          Day {daysRunning} (DOC)
                        </Badge>
                        <Badge variant="success" size="sm">
                          Active
                        </Badge>
                      </div>
                    </div>

                    {/* Active Crop Attributes Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-background border border-border/60">
                        <span className="text-[10px] uppercase font-bold text-text-secondary block">
                          Seed Variety
                        </span>
                        <span className="text-sm font-bold text-text-primary mt-0.5 block truncate">
                          {crop.seedVariety || 'N/A'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-background border border-border/60">
                        <span className="text-[10px] uppercase font-bold text-text-secondary block">
                          Seed Quantity
                        </span>
                        <span className="text-sm font-bold text-emerald-700 mt-0.5 block">
                          {crop.seedQuantity !== null && crop.seedQuantity !== undefined
                            ? String(crop.seedQuantity)
                            : 'N/A'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-background border border-border/60">
                        <span className="text-[10px] uppercase font-bold text-text-secondary block">
                          Stocking Date
                        </span>
                        <span className="text-sm font-semibold text-text-primary mt-0.5 block">
                          {formatDate(crop.stockingDate)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-background border border-border/60">
                        <span className="text-[10px] uppercase font-bold text-text-secondary block">
                          Batch Number
                        </span>
                        <span className="text-sm font-semibold text-text-primary mt-0.5 block truncate">
                          {crop.batchNumber || 'N/A'}
                        </span>
                      </div>
                    </div>

                    {crop.notes && (
                      <div className="p-2.5 rounded-lg bg-background border border-border/60 text-xs">
                        <span className="text-[10px] font-bold uppercase text-text-secondary block mb-0.5">
                          Notes / Remarks
                        </span>
                        <p className="text-text-secondary">{crop.notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No Active Crops"
              description="No active aquaculture crops are currently running in your farm tanks."
              actionLabel="Register New Crop"
              onAction={() => {
                setIsActiveCropsReviewOpen(false);
                navigate('/crops');
              }}
            />
          )}

          <div className="flex items-center justify-end pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsActiveCropsReviewOpen(false)}
            >
              Close Review
            </Button>
          </div>
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* 6. COMPLETED BATCHES REVIEW MODAL                            */}
      {/* ============================================================ */}
      <Modal
        isOpen={isCompletedCropsReviewOpen}
        onClose={() => setIsCompletedCropsReviewOpen(false)}
        title="Completed Crop Batches Review"
        description="Historical log of all successfully completed and harvested crop batches."
        size="xl"
      >
        <div className="space-y-4">
          {completedCropsList.length > 0 ? (
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              {completedCropsList.map((crop) => {
                const cropHarvests = (harvests || []).filter(
                  (h) => String(h.cropId || h.crop?.id) === String(crop.id)
                );
                const fallbackHarvests = cropHarvests.length > 0 ? cropHarvests : (crop.harvests || []);

                const finalHarvest = fallbackHarvests.find((h) => h.harvestType === 'FINAL');
                const latestHarvest = fallbackHarvests[0];
                const completionDate = finalHarvest?.harvestDate || latestHarvest?.harvestDate || crop.expectedHarvestDate || crop.updatedAt;

                // 1. Total Shrimp Count from all harvest registrations up to final harvest
                const totalShrimpCount = fallbackHarvests.reduce(
                  (acc, h) => acc + (parseFloat(h.shrimpCount) || 0),
                  0
                );
                const shrimpCountDisplay = totalShrimpCount > 0
                  ? `${totalShrimpCount.toLocaleString('en-IN')} Count`
                  : (crop.seedQuantity ? `${crop.seedQuantity.toLocaleString('en-IN')} Count` : 'N/A');

                // 2. Revenue & Expenses calculation
                const totalRevenue = fallbackHarvests.reduce(
                  (acc, h) => acc + (parseFloat(h.revenue) || ((parseFloat(h.harvestWeight || h.production || 0)) * (parseFloat(h.sellingPrice) || 0))),
                  0
                );

                const totalHarvestExpenses = fallbackHarvests.reduce(
                  (acc, h) => acc + (parseFloat(h.harvestExpense) || 0) + (parseFloat(h.transportationCost) || 0),
                  0
                );

                // Feed, Medicines, & Direct Expenses
                const feedCost = (crop.feedEntries || []).reduce((acc, f) => acc + (parseFloat(f.totalCost) || 0), 0);
                const directExpenseCost = (crop.expenses || []).reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
                const medicineCost = (crop.medicines || []).reduce((acc, m) => acc + (parseFloat(m.cost) || 0), 0);

                // 3. Allocated Pond Lease for crop culture duration
                const cropTankPondLeases = crop.tank?.pondLeases || (leases || []).filter((l) => String(l.tankId) === String(crop.tankId));
                const cropStartDate = crop.stockingDate ? new Date(crop.stockingDate) : null;
                const cropEndDate = completionDate ? new Date(completionDate) : new Date();

                let allocatedPondLeaseCost = 0;
                if (
                  Array.isArray(cropTankPondLeases) &&
                  cropTankPondLeases.length > 0 &&
                  cropStartDate &&
                  !isNaN(cropStartDate.getTime()) &&
                  cropEndDate &&
                  !isNaN(cropEndDate.getTime())
                ) {
                  const startNorm = new Date(cropStartDate);
                  const endNorm = new Date(cropEndDate);
                  startNorm.setUTCHours(0, 0, 0, 0);
                  endNorm.setUTCHours(0, 0, 0, 0);

                  cropTankPondLeases.forEach((lease) => {
                    const leaseStart = new Date(lease.leaseStartDate);
                    const leaseEnd = new Date(lease.leaseEndDate);
                    leaseStart.setUTCHours(0, 0, 0, 0);
                    leaseEnd.setUTCHours(0, 0, 0, 0);

                    if (leaseEnd >= leaseStart) {
                      const totalLeaseDays = Math.round((leaseEnd.getTime() - leaseStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      const dailyLeaseCost = totalLeaseDays > 0 ? ((parseFloat(lease.totalLeaseAmount) || 0) / totalLeaseDays) : 0;

                      const overlapStart = startNorm > leaseStart ? startNorm : leaseStart;
                      const overlapEnd = endNorm < leaseEnd ? endNorm : leaseEnd;

                      if (overlapStart <= overlapEnd) {
                        const overlappingDays = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        allocatedPondLeaseCost += Math.max(0, overlappingDays) * dailyLeaseCost;
                      }
                    }
                  });
                }

                allocatedPondLeaseCost = Math.round(allocatedPondLeaseCost);

                // Total Crop Expenses (Includes Feed, Medicines, General Expenses, Pond Lease & Harvest Expenses)
                const totalCropExpenses = Math.round(feedCost + directExpenseCost + medicineCost + allocatedPondLeaseCost + totalHarvestExpenses);

                // Net Profit = Total Revenue - Total Crop Expenses
                const netProfit = Math.round(totalRevenue - totalCropExpenses);

                // Cumulative Feed Weight (Sum of feed quantities for this completed crop)
                const cropFeedEntries = crop.feedEntries || [];
                const cumulativeFeedWeight = cropFeedEntries.reduce(
                  (acc, f) => acc + (parseFloat(f.quantity) || 0),
                  0
                );

                // Total Harvest Weight (Sum of harvest weights for this completed crop)
                const totalHarvestWeight = fallbackHarvests.reduce(
                  (acc, h) => acc + (parseFloat(h.harvestWeight || h.production || 0)),
                  0
                );

                // FCR Ratio = Cumulative Feed Weight / Total Harvest Weight
                const batchFcrRatio = totalHarvestWeight > 0
                  ? (cumulativeFeedWeight / totalHarvestWeight).toFixed(2)
                  : '0.00';

                return (
                  <div
                    key={crop.id}
                    className="p-4 rounded-xl bg-surface border border-border/80 shadow-2xs hover:border-cyan-500/40 transition-all space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-text-primary">
                            Batch #{crop.batchNumber || crop.cropName}
                          </h4>
                          <span className="text-[11px] text-text-secondary flex items-center gap-1">
                            <Waves className="w-3 h-3 text-primary" /> {crop.tankName || crop.tank?.tankName || 'Tank'}
                          </span>
                        </div>
                      </div>

                      <Badge variant="neutral" size="sm" className="bg-slate-100 text-slate-700 border-slate-200">
                        Completed
                      </Badge>
                    </div>

                    {/* Completed Batch Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-background border border-border/60">
                        <span className="text-[10px] uppercase font-bold text-text-secondary block">
                          Seed Variety
                        </span>
                        <span className="text-sm font-bold text-text-primary mt-0.5 block truncate">
                          {crop.seedVariety || 'N/A'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-background border border-border/60">
                        <span className="text-[10px] uppercase font-bold text-text-secondary block">
                          Seed Quantity
                        </span>
                        <span className="text-sm font-bold text-cyan-800 mt-0.5 block">
                          {crop.seedQuantity !== null && crop.seedQuantity !== undefined
                            ? String(crop.seedQuantity)
                            : 'N/A'}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-background border border-border/60">
                        <span className="text-[10px] uppercase font-bold text-text-secondary block">
                          Stocking Date
                        </span>
                        <span className="text-sm font-semibold text-text-primary mt-0.5 block">
                          {formatDate(crop.stockingDate)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-background border border-border/60">
                        <span className="text-[10px] uppercase font-bold text-text-secondary block">
                          Completion Date
                        </span>
                        <span className="text-sm font-semibold text-text-primary mt-0.5 block">
                          {formatDate(completionDate)}
                        </span>
                      </div>
                    </div>

                    {/* Financial & Harvest Performance Summary Cards */}
                    <div className="p-3 rounded-xl bg-cyan-50/50 border border-cyan-200/60 text-xs space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-cyan-900 block tracking-wider">
                        Financial & Harvest Details
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                        {/* 1. SHRIMP COUNT */}
                        <div className="bg-surface p-2.5 rounded-lg border border-cyan-100 flex flex-col justify-center">
                          <span className="text-[10px] font-semibold text-text-secondary uppercase block">
                            Shrimp Count
                          </span>
                          <span className="font-extrabold text-sm text-cyan-800 mt-0.5">
                            {shrimpCountDisplay}
                          </span>
                        </div>

                        {/* 2. FCR RATIO */}
                        <div className="bg-surface p-2.5 rounded-lg border border-cyan-200 flex flex-col justify-center bg-cyan-50/60" title={`Cumulative Feed: ${cumulativeFeedWeight} kg / Total Harvest: ${totalHarvestWeight} kg`}>
                          <span className="text-[10px] font-bold text-cyan-900 uppercase block tracking-wider">
                            FCR Ratio
                          </span>
                          <span className="font-extrabold text-sm text-cyan-800 mt-0.5">
                            {batchFcrRatio}
                          </span>
                        </div>

                        {/* 3. TOTAL CROP EXPENSES */}
                        <div className="bg-surface p-2.5 rounded-lg border border-cyan-100 flex flex-col justify-center" title="Includes Feed, Medicines, General Expenses, Pond Lease & Harvest Expenses">
                          <span className="text-[10px] font-semibold text-text-secondary uppercase block">
                            Total Expenses
                          </span>
                          <span className="font-extrabold text-sm text-amber-700 mt-0.5">
                            ₹{totalCropExpenses.toLocaleString('en-IN')}
                          </span>
                        </div>

                        {/* 4. ALLOCATED POND LEASE */}
                        <div className="bg-surface p-2.5 rounded-lg border border-cyan-100 flex flex-col justify-center">
                          <span className="text-[10px] font-semibold text-text-secondary uppercase block">
                            Allocated Pond Lease
                          </span>
                          <span className="font-extrabold text-xs text-slate-700 mt-0.5">
                            {allocatedPondLeaseCost > 0
                              ? `₹${allocatedPondLeaseCost.toLocaleString('en-IN')}`
                              : '₹0'}
                          </span>
                        </div>

                        {/* 5. NET PROFIT */}
                        <div className="bg-surface p-2.5 rounded-lg border border-cyan-100 flex flex-col justify-center">
                          <span className="text-[10px] font-semibold text-text-secondary uppercase block">
                            Net Profit
                          </span>
                          <span className={`font-extrabold text-sm mt-0.5 ${netProfit >= 0 ? 'text-emerald-700' : 'text-danger'}`}>
                            ₹{netProfit.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No Completed Batches"
              description="No crop culture batches have been marked completed or harvested yet."
            />
          )}

          <div className="flex items-center justify-end pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCompletedCropsReviewOpen(false)}
            >
              Close Review
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
