import { z } from 'zod';

const divergenceType = z.enum(['time_lag', 'structural', 'opposite']);

const baseFields = {
  start_time: z.number().int(),
  end_time: z.number().int(),
  type: divergenceType,
  notes: z.string().max(1000),
  tags: z.string().max(200),
};

export const createRecordSchema = z
  .object({
    ...baseFields,
    notes: z.string().max(1000).default(''),
    tags: z.string().max(200).default(''),
  })
  .refine((d) => d.start_time < d.end_time, { message: 'start_time must be before end_time' });

export const updateRecordSchema = z
  .object(baseFields)
  .partial()
  .refine(
    (d) => d.start_time === undefined || d.end_time === undefined || d.start_time < d.end_time,
    { message: 'start_time must be before end_time' },
  );

export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;

export const listRecordsQuerySchema = z.object({
  type: z.enum(['time_lag', 'structural', 'opposite']).optional(),
  tag: z.string().trim().max(200).optional(),
});
export type ListRecordsQuery = z.infer<typeof listRecordsQuerySchema>;

const ingestKline = z.object({
  open_time: z.number().int().min(0),
  open: z.number().finite().positive(),
  high: z.number().finite().positive(),
  low: z.number().finite().positive(),
  close: z.number().finite().positive(),
  volume: z.number().finite().nonnegative(),
});

export const ingestSchema = z.object({
  symbol: z.enum(['BTCUSDT', 'ETHUSDT']),
  klines: z.array(ingestKline).min(1).max(1000),
});

export type IngestInput = z.infer<typeof ingestSchema>;

export function validationMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`.trim())
    .join('; ');
}