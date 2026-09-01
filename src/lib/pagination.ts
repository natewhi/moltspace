import { PAGINATION } from "./constants";

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
}

export function parsePageParams(query: Record<string, unknown>): PageParams {
  const page = clampInt(query.page, 1, 1, Number.MAX_SAFE_INTEGER);
  const limit = clampInt(query.limit, PAGINATION.defaultLimit, 1, PAGINATION.maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pageCount: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export function pageMeta(total: number, { page, limit }: PageParams): PageMeta {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    pageCount,
    hasPrev: page > 1,
    hasNext: page < pageCount,
  };
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(String(Array.isArray(raw) ? raw[0] : raw ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
