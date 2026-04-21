import Papa from "papaparse";
import * as XLSX from "xlsx";
import { decodeBuffer, type DecodeResult } from "./encoding.js";

/* WEB-TO-DESKTOP NOTE: Pure-TS parsers, no Express/DOM coupling. */

export type ParseResult = {
  rows: Record<string, string>[];
  encoding: string;
  encoding_note?: string;
};

/**
 * Parse a CSV buffer. Auto-detects delimiter (Papa). Returns header → cell map per row.
 * Trims headers and cell values; empty strings preserved (mappers convert them to null).
 */
export function parseCsvBuffer(buffer: Buffer): ParseResult {
  const decoded: DecodeResult = decodeBuffer(buffer);
  const result = Papa.parse<Record<string, string>>(decoded.text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });
  return {
    rows: result.data as Record<string, string>[],
    encoding: decoded.encoding,
    encoding_note: decoded.note,
  };
}

/**
 * Parse the first sheet of an XLSX buffer. All cells coerced to strings so the
 * downstream mapper logic is uniform with CSV input.
 */
export function parseXlsxBuffer(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return { rows: [], encoding: "XLSX (no sheet)" };
  const sheet = wb.Sheets[firstSheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
    blankrows: false,
  });
  // Normalise to Record<string,string> with trimmed keys + values.
  const rows: Record<string, string>[] = json.map((r) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) {
      out[k.trim()] = v == null ? "" : String(v).trim();
    }
    return out;
  });
  return { rows, encoding: "XLSX (UTF-8)" };
}

/** Dispatch by file extension. Falls back to CSV on unknown extensions. */
export function parseFile(filename: string, buffer: Buffer): ParseResult {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "xlsx" || ext === "xls") return parseXlsxBuffer(buffer);
  return parseCsvBuffer(buffer);
}
