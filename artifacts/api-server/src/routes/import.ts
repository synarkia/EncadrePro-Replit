import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { sql, inArray } from "drizzle-orm";
import { db, fournisseursTable, clientsTable, produitsTable } from "@workspace/db";
import {
  parseFile,
  mapFournisseurRow,
  mapClientRow,
  mapProduitRow,
  buildFournisseurIndex,
  type ImportReport,
  type SkippedRow,
  type ProductTypeCode,
} from "@workspace/import";

/* WEB-TO-DESKTOP NOTE: Routes are HTTP-only; an Electron build will reuse the
 * `@workspace/import` package directly without going through Express. */

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = /\.(csv|xlsx|xls)$/i.test(file.originalname);
    if (!ok) {
      cb(new Error("Format non supporté. Utilisez .csv ou .xlsx."));
      return;
    }
    cb(null, true);
  },
});

function isDryRun(req: Request): boolean {
  const v = (req.query.dry_run ?? req.body?.dry_run ?? "").toString().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function emptyReport(dry_run: boolean, encoding: string, encoding_note?: string): ImportReport {
  return {
    total: 0,
    imported: 0,
    skipped_existing: 0,
    skipped_error: 0,
    skipped_rows: [],
    encoding,
    encoding_note,
    dry_run,
  };
}

// ─── POST /api/import/fournisseurs ───────────────────────────────────────────
router.post("/import/fournisseurs", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "Fichier manquant (champ 'file')" });
    return;
  }
  const dry_run = isDryRun(req);
  const parsed = parseFile(req.file.originalname, req.file.buffer);
  const report = emptyReport(dry_run, parsed.encoding, parsed.encoding_note);
  report.total = parsed.rows.length;

  const valid: { line: number; raw: Record<string, string>; insert: ReturnType<typeof mapFournisseurRow> extends { ok: true; value: infer V } ? V : never }[] = [];
  parsed.rows.forEach((row, i) => {
    const result = mapFournisseurRow(row, i + 2);
    if (!result.ok) {
      report.skipped_error++;
      report.skipped_rows.push({ row_number: i + 2, reason: result.error, raw_data: row });
    } else {
      valid.push({ line: i + 2, raw: row, insert: result.value });
    }
  });

  if (dry_run) {
    // Estimate dedup against current DB without touching it transactionally.
    if (valid.length === 0) {
      res.json(report);
      return;
    }
    const names = Array.from(new Set(valid.map((v) => v.insert.nom)));
    const existing = await db
      .select({ nom: fournisseursTable.nom, version_tarif: fournisseursTable.version_tarif })
      .from(fournisseursTable)
      .where(inArray(fournisseursTable.nom, names));
    const existingSet = new Set(existing.map((e) => `${e.nom}::${e.version_tarif ?? ""}`));
    for (const v of valid) {
      const key = `${v.insert.nom}::${v.insert.version_tarif ?? ""}`;
      if (existingSet.has(key)) {
        report.skipped_existing++;
        report.skipped_rows.push({ row_number: v.line, reason: "Déjà présent (nom + version_tarif)", raw_data: v.raw });
      } else {
        report.imported++;
      }
    }
    res.json(report);
    return;
  }

  // Real import — single transaction.
  try {
    await db.transaction(async (tx) => {
      if (valid.length === 0) return;
      const names = Array.from(new Set(valid.map((v) => v.insert.nom)));
      const existing = await tx
        .select({ nom: fournisseursTable.nom, version_tarif: fournisseursTable.version_tarif })
        .from(fournisseursTable)
        .where(inArray(fournisseursTable.nom, names));
      const existingSet = new Set(existing.map((e) => `${e.nom}::${e.version_tarif ?? ""}`));

      const toInsert: typeof valid = [];
      for (const v of valid) {
        const key = `${v.insert.nom}::${v.insert.version_tarif ?? ""}`;
        if (existingSet.has(key)) {
          report.skipped_existing++;
          report.skipped_rows.push({ row_number: v.line, reason: "Déjà présent (nom + version_tarif)", raw_data: v.raw });
        } else {
          toInsert.push(v);
          existingSet.add(key); // de-dupe within the file too
        }
      }
      if (toInsert.length > 0) {
        await tx.insert(fournisseursTable).values(toInsert.map((v) => v.insert));
        report.imported = toInsert.length;
      }
    });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: "Échec de l'import (transaction annulée)", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─── POST /api/import/clients ────────────────────────────────────────────────
router.post("/import/clients", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "Fichier manquant (champ 'file')" });
    return;
  }
  const dry_run = isDryRun(req);
  const parsed = parseFile(req.file.originalname, req.file.buffer);
  const report = emptyReport(dry_run, parsed.encoding, parsed.encoding_note);
  report.total = parsed.rows.length;

  const valid: { line: number; raw: Record<string, string>; insert: ReturnType<typeof mapClientRow> extends { ok: true; value: infer V } ? V : never }[] = [];
  parsed.rows.forEach((row, i) => {
    const result = mapClientRow(row, i + 2);
    if (!result.ok) {
      report.skipped_error++;
      report.skipped_rows.push({ row_number: i + 2, reason: result.error, raw_data: row });
    } else {
      valid.push({ line: i + 2, raw: row, insert: result.value });
    }
  });

  if (dry_run) {
    if (valid.length === 0) {
      res.json(report);
      return;
    }
    const names = Array.from(new Set(valid.map((v) => v.insert.nom)));
    const existing = await db.select({ nom: clientsTable.nom }).from(clientsTable).where(inArray(clientsTable.nom, names));
    const existingSet = new Set(existing.map((e) => e.nom));
    for (const v of valid) {
      if (existingSet.has(v.insert.nom)) {
        report.skipped_existing++;
        report.skipped_rows.push({ row_number: v.line, reason: "Déjà présent (nom)", raw_data: v.raw });
      } else {
        report.imported++;
      }
    }
    res.json(report);
    return;
  }

  try {
    await db.transaction(async (tx) => {
      if (valid.length === 0) return;
      const names = Array.from(new Set(valid.map((v) => v.insert.nom)));
      const existing = await tx.select({ nom: clientsTable.nom }).from(clientsTable).where(inArray(clientsTable.nom, names));
      const existingSet = new Set(existing.map((e) => e.nom));
      const toInsert: typeof valid = [];
      for (const v of valid) {
        if (existingSet.has(v.insert.nom)) {
          report.skipped_existing++;
          report.skipped_rows.push({ row_number: v.line, reason: "Déjà présent (nom)", raw_data: v.raw });
        } else {
          toInsert.push(v);
          existingSet.add(v.insert.nom);
        }
      }
      if (toInsert.length > 0) {
        await tx.insert(clientsTable).values(toInsert.map((v) => v.insert));
        report.imported = toInsert.length;
      }
    });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: "Échec de l'import (transaction annulée)", detail: err instanceof Error ? err.message : String(err) });
  }
});

// ─── POST /api/import/produits ───────────────────────────────────────────────
router.post("/import/produits", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "Fichier manquant (champ 'file')" });
    return;
  }
  const dry_run = isDryRun(req);
  const forcedTypeRaw = (req.query.type ?? req.body?.type ?? "").toString().toUpperCase();
  const forcedType: ProductTypeCode | undefined = (["VR", "FA", "AU", "SD", "EN"] as const).includes(forcedTypeRaw as ProductTypeCode)
    ? (forcedTypeRaw as ProductTypeCode)
    : undefined;

  const parsed = parseFile(req.file.originalname, req.file.buffer);
  const report = emptyReport(dry_run, parsed.encoding, parsed.encoding_note);
  report.total = parsed.rows.length;

  // Always need fournisseur index for lookup. Read once, no transaction needed for dry-run.
  const fournisseurRows = await db
    .select({ id: fournisseursTable.id, nom: fournisseursTable.nom, version_tarif: fournisseursTable.version_tarif })
    .from(fournisseursTable);
  const fournisseurIndex = buildFournisseurIndex(fournisseurRows);

  const valid: { line: number; raw: Record<string, string>; insert: ReturnType<typeof mapProduitRow> extends { ok: true; value: infer V } ? V : never }[] = [];
  parsed.rows.forEach((row, i) => {
    const result = mapProduitRow(row, i + 2, fournisseurIndex, forcedType);
    if (!result.ok) {
      report.skipped_error++;
      report.skipped_rows.push({ row_number: i + 2, reason: result.error, raw_data: row });
    } else {
      valid.push({ line: i + 2, raw: row, insert: result.value });
    }
  });

  const partitionDedup = async (
    runner: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0],
  ): Promise<typeof valid> => {
    const refs = valid.map((v) => v.insert.ref_legacy).filter((r): r is string => !!r);
    let existingRefs = new Set<string>();
    if (refs.length > 0) {
      const existing = await runner.select({ ref_legacy: produitsTable.ref_legacy }).from(produitsTable).where(inArray(produitsTable.ref_legacy, refs));
      existingRefs = new Set(existing.map((e) => e.ref_legacy).filter((r): r is string => !!r));
    }
    const toInsert: typeof valid = [];
    for (const v of valid) {
      const ref = v.insert.ref_legacy;
      if (ref && existingRefs.has(ref)) {
        report.skipped_existing++;
        report.skipped_rows.push({ row_number: v.line, reason: `Déjà présent (ref_legacy='${ref}')`, raw_data: v.raw });
      } else {
        toInsert.push(v);
        if (ref) existingRefs.add(ref);
      }
    }
    return toInsert;
  };

  if (dry_run) {
    if (valid.length === 0) {
      res.json(report);
      return;
    }
    const toInsert = await partitionDedup(db);
    report.imported = toInsert.length;
    res.json(report);
    return;
  }

  try {
    await db.transaction(async (tx) => {
      if (valid.length === 0) return;
      const toInsert = await partitionDedup(tx);
      if (toInsert.length > 0) {
        await tx.insert(produitsTable).values(toInsert.map((v) => v.insert));
        report.imported = toInsert.length;
      }
    });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: "Échec de l'import (transaction annulée)", detail: err instanceof Error ? err.message : String(err) });
  }
});

// Multer error handler (file-too-large / wrong format).
router.use((err: unknown, _req: Request, res: Response, _next: (e?: unknown) => void) => {
  const message = err instanceof Error ? err.message : String(err);
  res.status(400).json({ error: message });
});

export default router;
// Avoid unused-warning on SkippedRow in some builds; kept exported via type re-use above.
export type { SkippedRow };
