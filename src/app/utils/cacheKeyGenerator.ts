export const generateCacheKey = (prefix: string, query: Record<string, any>): string => {
  const sortedKeys = Object.keys(query).sort().map((key) => {
    const val = query[key];
    if (val === undefined || val === null) return '';
    if (Array.isArray(val)) return `${key}=${val.map(v => `${v}`).join(',')}`;
    return `${key}=${query[key]}`;
  }).join('&')
  return `${prefix}:${sortedKeys}`;
};
