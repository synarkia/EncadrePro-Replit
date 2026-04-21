import iconv from "iconv-lite";

/* WEB-TO-DESKTOP NOTE: Encoding detection runs on Buffers, identical in Node + Electron main. */

export type DecodeResult = {
  text: string;
  encoding: string;
  /** Human-readable French note for the report when we fall back. */
  note?: string;
};

const REPLACEMENT_RATIO_THRESHOLD = 0.05;

/**
 * Try UTF-8 first; if the resulting string contains > REPLACEMENT_RATIO_THRESHOLD
 * U+FFFD replacement characters, fall back to ISO-8859-1 (the most common
 * encoding for older FileMaker/macOS exports in France).
 */
export function decodeBuffer(buffer: Buffer): DecodeResult {
  // Strip UTF-8 BOM if present.
  const stripped =
    buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf
      ? buffer.subarray(3)
      : buffer;

  const utf8 = stripped.toString("utf8");
  const total = utf8.length || 1;
  const replacements = (utf8.match(/\uFFFD/g) ?? []).length;

  if (replacements / total <= REPLACEMENT_RATIO_THRESHOLD) {
    return { text: utf8, encoding: "UTF-8" };
  }

  // Fall back to ISO-8859-1 (Latin-1) — covers most legacy FileMaker exports.
  const latin1 = iconv.decode(stripped, "iso-8859-1");
  return {
    text: latin1,
    encoding: "ISO-8859-1",
    note: "Encodage détecté : ISO-8859-1 (fichier Mac hérité)",
  };
}
