/**
 * Database utility helpers for EncadrePro
 * WEB-TO-DESKTOP NOTE: In Electron, the DB adapter will be better-sqlite3
 * which returns rows directly — remove the .rows accessor.
 */
import { sql as drizzleSql, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Execute a raw SQL query and return typed rows array.
 * Drizzle node-postgres returns QueryResult with .rows; this unwraps it.
 */
export async function execRows<T extends Record<string, unknown>>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  // node-postgres driver wraps rows in QueryResult.rows
  return (result as unknown as { rows: T[] }).rows;
}

export { drizzleSql as sql };

/**
 * Convert all Date instances in an object (shallow) to ISO strings.
 * Required because Drizzle/pg returns Date objects but Zod schemas expect strings.
 * WEB-TO-DESKTOP NOTE: better-sqlite3 stores dates as text, so this helper
 * can be a no-op in the Electron version.
 */
export function serializeDates<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = v instanceof Date ? v.toISOString() : v;
  }
  return result as T;
}
