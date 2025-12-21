export const CacheTTL = {
  SHORT: 600,   // 10 minutes
  MEDIUM: 900,  // 15 minutes
  LONG: 1800,   // 30 minutes
  XLONG: 3600,  // 1 hour
} as const;

export type CacheTTLKey = keyof typeof CacheTTL;

export function getTTL(key: CacheTTLKey, fallback: number = CacheTTL.SHORT): number {
  return CacheTTL[key] ?? fallback;
}