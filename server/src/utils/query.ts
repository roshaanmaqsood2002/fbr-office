export const paging = (q: Record<string, unknown>, max = 50) => ({
  page: Math.max(1, Number(q.page) || 1),
  limit: Math.min(max, Math.max(1, Number(q.limit) || 20)),
});

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const str = (v: unknown) => (v ? String(v).slice(0, 80) : undefined);