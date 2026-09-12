import prisma from "../config/prisma.js";

import { getUserFarm } from "../utils/farm.helpers.js";

export const getDashboard = async (userId) => {
    const farm = await getUserFarm(userId);

    const farmWhere = { site: { farmId: farm.id } };
    const cropFarmWhere = { crop: { tank: farmWhere } };

    const [
        totalTanks,
        activeCrops,
        completedCrops,
        feedAgg,
        expenseAgg,
        medicineAgg,
        harvestAgg
    ] = await Promise.all([
        prisma.tank.count({
            where: farmWhere
        }),
        prisma.crop.findMany({
            where: {
                tank: farmWhere,
                status: "ACTIVE"
            },
            select: {
                id: true,
                cropName: true,
                stockingDate: true,
                expectedHarvestDate: true,
                cropDuration: true,
                tank: {
                    select: {
                        tankName: true
                    }
                }
            }
        }),
        prisma.crop.findMany({
            where: {
                tank: farmWhere,
                status: "COMPLETED"
            },
            select: {
                id: true,
                feedEntries: {
                    select: {
                        quantity: true
                    }
                },
                harvests: {
                    select: {
                        harvestWeight: true,
                        production: true
                    }
                }
            }
        }),
        prisma.feedEntry.aggregate({
            where: cropFarmWhere,
            _sum: { totalCost: true },
            _count: { _all: true }
        }),
        prisma.expense.aggregate({
            where: cropFarmWhere,
            _sum: { amount: true },
            _count: { _all: true }
        }),
        prisma.medicine.aggregate({
            where: { tank: farmWhere },
            _sum: { cost: true },
            _count: { _all: true }
        }),
        prisma.harvest.aggregate({
            where: cropFarmWhere,
            _sum: { revenue: true, profit: true },
            _count: { _all: true }
        })
    ]);

    let totalCompletedFeedWeight = 0;
    let totalCompletedHarvestWeight = 0;

    completedCrops.forEach(crop => {
        const feedSum = (crop.feedEntries || []).reduce(
            (sum, item) => sum + (parseFloat(item.quantity) || 0),
            0
        );
        const harvestSum = (crop.harvests || []).reduce(
            (sum, item) => sum + (parseFloat(item.harvestWeight || item.production) || 0),
            0
        );
        totalCompletedFeedWeight += feedSum;
        totalCompletedHarvestWeight += harvestSum;
    });

    const fcrRatio = (totalCompletedHarvestWeight > 0 && !isNaN(totalCompletedHarvestWeight))
        ? Number((totalCompletedFeedWeight / totalCompletedHarvestWeight).toFixed(2))
        : 0;

    const cropOverview = activeCrops.map(crop => {
        const today = new Date();
        const stockingDateObj = crop.stockingDate ? new Date(crop.stockingDate) : today;
        const daysRunning = Math.max(0, Math.floor(
            (today - stockingDateObj) / (1000 * 60 * 60 * 24)
        ));
        const daysRemaining = Math.max(
            (crop.cropDuration || 0) - daysRunning,
            0
        );

        return {
            cropId: crop.id,
            cropName: crop.cropName,
            tankName: crop.tank?.tankName || '',
            stockingDate: crop.stockingDate,
            expectedHarvestDate: crop.expectedHarvestDate,
            currentDay: daysRunning,
            daysRemaining
        };
    });

    return {
        farm: {
            id: farm.id,
            farmName: farm.farmName,
            ownerName: farm.ownerName,
            totalAcres: farm.totalAcres
        },
        statistics: {
            totalTanks,
            activeCrops: activeCrops.length,
            completedCrops: completedCrops.length,
            fcrRatio,
            totalCompletedFeedWeight,
            totalCompletedHarvestWeight
        },
        finance: {
            totalFeedCost: feedAgg._sum.totalCost || 0,
            totalExpenseCost: expenseAgg._sum.amount || 0,
            totalMedicineCost: medicineAgg._sum.cost || 0,
            totalRevenue: harvestAgg._sum.revenue || 0,
            totalProfit: harvestAgg._sum.profit || 0
        },
        counts: {
            feedEntries: feedAgg._count._all || 0,
            expenses: expenseAgg._count._all || 0,
            medicines: medicineAgg._count._all || 0,
            harvests: harvestAgg._count._all || 0
        },
        activeCropOverview: cropOverview
    };
};