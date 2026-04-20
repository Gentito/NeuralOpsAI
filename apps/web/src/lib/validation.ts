import { z } from "zod"

export const requestPrioritySchema = z.enum(["low", "medium", "high", "urgent"])

export const requestCreateSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().min(10).max(20000),
  category: z.string().trim().min(2).max(64),
  priority: requestPrioritySchema.default("medium"),
  preferredDeadline: z.string().trim().min(1).optional(),
  budget: z.number().nonnegative().optional(),
  contactEmail: z.string().trim().email().optional(),
  contactPhone: z.string().trim().min(5).max(32).optional()
})

export const uploadPrepareSchema = z.object({
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  size: z.number().int().positive().max(25 * 1024 * 1024)
})

