import { z } from "zod";

export const expenseCategories = [
    "Pond Preparation",
    "Seed Cost",
    "Electricity",
    "Generator & Diesel",
    "Labour",
    "Maintenance",
    "Salaries"
];

export const paymentModes = [
    "CASH",
    "UPI"
];

const baseExpenseSchema = z.object({

    tankId: z.string().optional(),

    siteId: z.string().optional(),

    category: z.enum(expenseCategories),

    description: z.string().optional(),

    amount: z.number().positive("Amount must be greater than 0"),

    paymentMode: z.enum(paymentModes),

    date: z.string(),

    notes: z.string().optional()

});

export const createExpenseSchema = baseExpenseSchema.superRefine((data, ctx) => {

    if (data.category === "Seed Cost") {

        if (!data.tankId || data.tankId.trim() === "") {

            ctx.addIssue({

                code: z.ZodIssueCode.custom,

                path: ["tankId"],

                message: "Tank is required for Seed Cost"

            });

        }

    } else {

        if (!data.siteId || data.siteId.trim() === "") {

            ctx.addIssue({

                code: z.ZodIssueCode.custom,

                path: ["siteId"],

                message: "Site is required"

            });

        }

    }

});

export const updateExpenseSchema = baseExpenseSchema.partial();