import prisma from "../config/prisma.js";

import { getUserFarm } from "../utils/farm.helpers.js";

export const getDashboard = async (userId) => {

    const farm = await getUserFarm(userId);

    const tanks = await prisma.tank.findMany({
        where: {
            site: {
                farmId: farm.id
            }
        }
    });

    const activeCrops = await prisma.crop.findMany({
        where: {
            tank: {
                site: {
                    farmId: farm.id
                }
            },
            status: "ACTIVE"
        },
        include: {
            tank: true
        }
    });

    const completedCrops = await prisma.crop.findMany({
        where: {
            tank: {
                site: {
                    farmId: farm.id
                }
            },
            status: "COMPLETED"
        },
        include: {
            feedEntries: true,
            harvests: true
        }
    });

    let totalCompletedFeedWeight = 0;
    let totalCompletedHarvestWeight = 0;

    completedCrops.forEach(crop => {
        const feedSum = (crop.feedEntries || []).reduce(
            (sum, item) => sum + (item.quantity || 0),
            0
        );
        const harvestSum = (crop.harvests || []).reduce(
            (sum, item) => sum + (item.harvestWeight || item.production || 0),
            0
        );
        totalCompletedFeedWeight += feedSum;
        totalCompletedHarvestWeight += harvestSum;
    });

    const fcrRatio = totalCompletedHarvestWeight > 0
        ? Number((totalCompletedFeedWeight / totalCompletedHarvestWeight).toFixed(2))
        : 0;

    const feedEntries = await prisma.feedEntry.findMany({
        where: {
            crop: {
                tank: {
                    site: {
                        farmId: farm.id
                    }
                }
            }
        }
    });

    const expenses = await prisma.expense.findMany({
        where: {
            crop: {
                tank: {
                    site: {
                        farmId: farm.id
                    }
                }
            }
        }
    });

    const medicines = await prisma.medicine.findMany({
        where: {
            tank: {
                site: {
                    farmId: farm.id
                }
            }
        }
    });

    const harvests = await prisma.harvest.findMany({
        where: {
            crop: {
                tank: {
                    site: {
                        farmId: farm.id
                    }
                }
            }
        }
    });

    const totalFeedCost = feedEntries.reduce(
        (sum, item) => sum + item.totalCost,
        0
    );

    const totalExpenseCost = expenses.reduce(
        (sum, item) => sum + item.amount,
        0
    );

    const totalMedicineCost = medicines.reduce(
        (sum, item) => sum + item.cost,
        0
    );

    const totalRevenue = harvests.reduce(
        (sum, item) => sum + item.revenue,
        0
    );

    const totalProfit = harvests.reduce(
        (sum, item) => sum + item.profit,
        0
    );

    const cropOverview = activeCrops.map(crop => {

        const today = new Date();

        const daysRunning = Math.floor(

            (today - crop.stockingDate) /

            (1000 * 60 * 60 * 24)

        );

        const daysRemaining = Math.max(

            crop.cropDuration - daysRunning,

            0

        );

        return {

            cropId: crop.id,

            cropName: crop.cropName,

            tankName: crop.tank.tankName,

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
            totalTanks: tanks.length,
            activeCrops: activeCrops.length,
            completedCrops: completedCrops.length,
            fcrRatio,
            totalCompletedFeedWeight,
            totalCompletedHarvestWeight
        },

        finance: {

            totalFeedCost,

            totalExpenseCost,

            totalMedicineCost,

            totalRevenue,

            totalProfit

        },

        counts: {

            feedEntries: feedEntries.length,

            expenses: expenses.length,

            medicines: medicines.length,

            harvests: harvests.length

        },

        activeCropOverview: cropOverview

    };

};