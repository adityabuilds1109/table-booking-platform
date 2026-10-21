import { z } from 'zod';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
// Upper bound on `page` keeps page * pageSize far below the 32-bit integer Prisma/Postgres use for OFFSET.
const MAX_PAGE = 100_000;

// Query-string values are always strings, so z.coerce.number() converts them first.
// A missing value takes the default; "", "abc" and repeated params (?page=1&page=2) are rejected.
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type PaginationQuery = z.output<typeof paginationQuerySchema>;

// Prisma's `skip`/`take` arguments for a 1-based page.
export function toSkipTake({ page, pageSize }: PaginationQuery): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export type Page<T> = { data: T[]; page: number; pageSize: number; total: number; totalPages: number };

export function toPage<T>(data: T[], total: number, { page, pageSize }: PaginationQuery): Page<T> {
  return { data, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
