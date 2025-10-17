export const generateCacheKey = (prefix: string, query: object): string => {
  const sortedQuery: { [key: string]: any } = {};

  // Get the keys, sort them, and build a new object.
  Object.keys(query)
    .sort()
    .forEach(key => {
      sortedQuery[key] = (query as any)[key];
    });

  return `${prefix}:${JSON.stringify(sortedQuery)}`;
};
