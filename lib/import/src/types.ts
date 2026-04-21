/* WEB-TO-DESKTOP NOTE: Pure-TS module, usable from web API server and a future Electron build. */

export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type SkippedRow = {
  row_number: number;
  reason: string;
  raw_data: Record<string, unknown>;
};

export type ImportReport = {
  total: number;
  imported: number;
  skipped_existing: number;
  skipped_error: number;
  skipped_rows: SkippedRow[];
  encoding?: string;
  encoding_note?: string;
  dry_run: boolean;
};

export const PRODUCT_TYPE_CODES = ["VR", "FA", "AU", "SD", "EN"] as const;
export type ProductTypeCode = (typeof PRODUCT_TYPE_CODES)[number];
