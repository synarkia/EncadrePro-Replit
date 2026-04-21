#!/usr/bin/env node
// End-to-end test runner for the import endpoints.
// Usage:  node scripts/test-import.mjs [base_url]
// Default base_url: http://localhost:8080

import { readFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:8080";
const ROOT = path.join(import.meta.dirname, "..", "test-data", "import");

async function postFile(endpoint, filename, { dryRun = false, type } = {}) {
  const buf = await readFile(path.join(ROOT, filename));
  const blob = new Blob([buf], { type: filename.endsWith(".xlsx") ? "application/octet-stream" : "text/csv" });
  const fd = new FormData();
  fd.append("file", blob, filename);
  const url = new URL(`${BASE}${endpoint}`);
  if (dryRun) url.searchParams.set("dry_run", "true");
  if (type) url.searchParams.set("type", type);
  const res = await fetch(url, { method: "POST", body: fd });
  return { status: res.status, body: await res.json() };
}

function printReport(label, r) {
  console.log(`\n══════ ${label} ══════`);
  console.log(`HTTP ${r.status}`);
  if (r.body.error) {
    console.log("ERROR:", r.body);
    return;
  }
  const b = r.body;
  console.log(`encoding         : ${b.encoding}${b.encoding_note ? ` — ${b.encoding_note}` : ""}`);
  console.log(`dry_run          : ${b.dry_run}`);
  console.log(`total            : ${b.total}`);
  console.log(`imported         : ${b.imported}`);
  console.log(`skipped_existing : ${b.skipped_existing}`);
  console.log(`skipped_error    : ${b.skipped_error}`);
  if (b.skipped_rows?.length) {
    console.log("skipped_rows:");
    for (const sr of b.skipped_rows) {
      console.log(`  • L${sr.row_number}: ${sr.reason}`);
    }
  }
}

async function main() {
  console.log(`Target API: ${BASE}\n`);

  // ── 1. Fournisseurs : dry-run, then real, then real-again (full dedup) ──
  printReport("Fournisseurs — DRY RUN", await postFile("/api/import/fournisseurs", "fournisseurs.csv", { dryRun: true }));
  printReport("Fournisseurs — IMPORT (1st)", await postFile("/api/import/fournisseurs", "fournisseurs.csv"));
  printReport("Fournisseurs — IMPORT (2nd, must be 100% skipped)", await postFile("/api/import/fournisseurs", "fournisseurs.csv"));

  // ── 2. Clients : dry-run, then real, then real-again ──
  printReport("Clients — DRY RUN", await postFile("/api/import/clients", "clients.csv", { dryRun: true }));
  printReport("Clients — IMPORT (1st)", await postFile("/api/import/clients", "clients.csv"));
  printReport("Clients — IMPORT (2nd, must be 100% skipped)", await postFile("/api/import/clients", "clients.csv"));

  // ── 3. Produits : dry-run, then real, then real-again ──
  printReport("Produits — DRY RUN", await postFile("/api/import/produits", "produits.csv", { dryRun: true }));
  printReport("Produits — IMPORT (1st)", await postFile("/api/import/produits", "produits.csv"));
  printReport("Produits — IMPORT (2nd, must be 100% skipped)", await postFile("/api/import/produits", "produits.csv"));
}

main().catch((e) => {
  console.error("Test runner failed:", e);
  process.exit(1);
});
