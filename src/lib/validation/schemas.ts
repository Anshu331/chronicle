import { z } from "zod";

const vectorClockSchema = z
  .record(z.string().max(64), z.number().int().min(0).max(1_000_000))
  .refine((obj) => Object.keys(obj).length <= 100, "Too many clock entries");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200).default("Untitled Document"),
});

export const updateDocumentMetaSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});

export const operationSchema = z.object({
  id: z.string().min(1).max(64),
  documentId: z.string().min(1).max(64),
  clientId: z.string().min(1).max(64),
  clock: vectorClockSchema,
  type: z.enum(["insert", "delete"]),
  position: z.number().int().min(0).max(500_000),
  text: z.string().max(50_000).optional(),
  length: z.number().int().min(0).max(50_000).optional(),
  userId: z.string().min(1).max(64),
  timestamp: z.number().int().min(0),
});

export const syncPayloadSchema = z.object({
  documentId: z.string().min(1).max(64),
  clientId: z.string().min(1).max(64),
  clientClock: vectorClockSchema,
  operations: z.array(operationSchema).max(500),
});

export const createVersionSchema = z.object({
  label: z.string().trim().max(100).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(500_000).optional(),
  clock: vectorClockSchema.optional(),
});

export const restoreVersionSchema = z.object({
  versionId: z.string().min(1).max(64),
});

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["editor", "viewer"]),
});

export const updateMemberSchema = z.object({
  memberId: z.string().min(1).max(64),
  role: z.enum(["editor", "viewer"]),
});

export const removeMemberSchema = z.object({
  memberId: z.string().min(1).max(64),
});

export const aiRequestSchema = z.object({
  documentId: z.string().min(1).max(64),
  action: z.enum(["summarize", "improve", "expand", "tone"]),
  content: z.string().max(100_000),
  tone: z.enum(["professional", "casual", "academic"]).default("professional"),
});

export const MAX_SYNC_BODY_BYTES = 512_000;

export function validateBodySize(body: string): boolean {
  return Buffer.byteLength(body, "utf8") <= MAX_SYNC_BODY_BYTES;
}
