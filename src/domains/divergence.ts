// Shared divergence type definitions for both backend and frontend
export const DIVERGENCE_TYPES = ['time_lag', 'structural', 'opposite'] as const;

export const TYPE_LABELS = {
  time_lag: '時間差',
  structural: '結構背離',
  opposite: '完全反向',
} as const;

export type DivergenceType = (typeof DIVERGENCE_TYPES)[number];
