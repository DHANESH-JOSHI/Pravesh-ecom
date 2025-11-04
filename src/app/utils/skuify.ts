export const skuify = (text: string) => {
  if (!text) return `SKU${Date.now()}`;
  const cleaned = text
    .toString()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return cleaned.substring(0, 10) || `SKU${Date.now()}`;
};