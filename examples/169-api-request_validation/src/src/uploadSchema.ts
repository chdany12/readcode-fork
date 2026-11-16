import { z } from "zod";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
const MAX_PATH_LENGTH = 1024;

const pathSegment = z
  .string()
  .min(1)
  .max(255)
  .refine((s) => s !== "." && s !== "..", "relative segments are not allowed")
  .refine((s) => !/[\u0000-\u001f\\]/.test(s), "control characters and backslashes are not allowed");

export const filePath = z
  .string()
  .max(MAX_PATH_LENGTH)
  .transform((p) => p.normalize("NFC"))
  .refine((p) => p.startsWith("/"), "path must be absolute within the drive")
  .refine((p) => !p.endsWith("/") , "path must name a file")
  .refine(
    (p) => p.slice(1).split("/").every((seg) => pathSegment.safeParse(seg).success),
    "path contains an invalid segment",
  );

export const startUploadSchema = z
  .object({
    path: filePath,
    sizeBytes: z.number().int().nonnegative().max(MAX_UPLOAD_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/, "sha256 must be 64 lowercase hex characters"),
    baseRevision: z.number().int().nonnegative().nullable(),
    modifiedAt: z.string().datetime({ offset: true }),
    conflictPolicy: z.enum(["fail", "keep_both", "overwrite"]).default("fail"),
  })
  .strict();

export type StartUploadRequest = z.infer<typeof startUploadSchema>;
