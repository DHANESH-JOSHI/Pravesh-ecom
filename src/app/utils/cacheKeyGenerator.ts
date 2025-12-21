export const generateCacheKey = (prefix: string, query: Record<string, any>): string => {
  const normalize = (value: any): string => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'number') return String(Number(value));
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) {
      const normalizedArray = value.map((v) => normalize(v)).filter((v) => v !== '');
      return normalizedArray.join(',');
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value).sort();
      const normalizedObj: Record<string, any> = {};
      for (const k of keys) {
        const norm = normalize(value[k]);
        if (norm !== '') normalizedObj[k] = norm;
      }
      return JSON.stringify(normalizedObj);
    }
    return String(value);
  };

  const parts = Object.keys(query)
    .sort()
    .map((key) => {
      const val = normalize(query[key]);
      if (val === '') return '';
      return `${key}=${val}`;
    })
    .filter(Boolean)
    .join('&');

  if (!parts) return prefix;
  return `${prefix}?${parts}`;
};
