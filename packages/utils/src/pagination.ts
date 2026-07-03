export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface NormalizedPagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function normalizePagination(page?: number, pageSize?: number): NormalizedPagination {
  const normalizedPage = Math.max(page ?? DEFAULT_PAGE, 1);
  const normalizedPageSize = Math.min(Math.max(pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    skip: (normalizedPage - 1) * normalizedPageSize,
    take: normalizedPageSize,
  };
}
