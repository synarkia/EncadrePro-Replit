/**
 * Concurrency e2e test for POST /api/devis/:id/convertir.
 *
 * Proves that N simultaneous conversions of the same devis create exactly
 * one facture (and at most one facture d'acompte), with one HTTP 201
 * "winner" and N-1 HTTP 200 idempotent replays.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run test:convert-idempotency
 *
 * Optional env:
 *   API_BASE      — defaults to http://localhost:80
 *   PARALLELISM   — defaults to 5
 *   ACOMPTE       — "1" to test the acompte path (also creates 1 FA), default off
 *
 * Picks an existing brouillon devis with non-zero total_ttc, or fails
 * loudly if none exists. Does NOT roll back the created facture — the
 * test is idempotent on its own (re-running it picks a fresh devis).
 */
import { Client } from "pg";

const API_BASE = process.env.API_BASE ?? "http://localhost:80";
const PARALLELISM = Number(process.env.PARALLELISM ?? "5");
const WITH_ACOMPTE = process.env.ACOMPTE === "1";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`✗ ASSERT: ${msg}`);
    process.exit(1);
  }
}

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const pickRes = await pg.query<{ id: number; numero: string; total_ttc: string }>(
    `SELECT id, numero, total_ttc
       FROM devis
      WHERE statut != 'converti'
        AND facture_id IS NULL
        AND total_ttc > 0
   ORDER BY id DESC
      LIMIT 1`,
  );
  if (pickRes.rows.length === 0) {
    console.error("✗ No eligible brouillon devis with total_ttc > 0 found.");
    console.error("  Create one in the UI before running this test.");
    process.exit(2);
  }
  const devis = pickRes.rows[0];
  console.log(`▶ Devis cible: id=${devis.id} numero=${devis.numero} total_ttc=${devis.total_ttc}`);
  console.log(`▶ Parallelism=${PARALLELISM}, acompte=${WITH_ACOMPTE}`);

  const body = WITH_ACOMPTE
    ? JSON.stringify({
        acompte_montant: Math.min(100, Number(devis.total_ttc)),
        mode_paiement: "cb",
        date_echeance: new Date().toISOString().slice(0, 10),
      })
    : JSON.stringify({});

  const calls = Array.from({ length: PARALLELISM }, (_, i) =>
    fetch(`${API_BASE}/api/devis/${devis.id}/convertir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }).then(async (r) => {
      const json = (await r.json()) as { id?: number; numero?: string; facture_acompte?: { id: number; numero: string } | null };
      return { i, status: r.status, id: json.id, numero: json.numero, faNumero: json.facture_acompte?.numero ?? null };
    }),
  );
  const results = await Promise.all(calls);

  console.log("▶ Réponses:");
  for (const r of results) {
    console.log(`   req${r.i}: HTTP ${r.status}  facture_id=${r.id}  numero=${r.numero}  fa=${r.faNumero}`);
  }

  // Assertions ───────────────────────────────────────────────────────────
  const created = results.filter((r) => r.status === 201);
  const replayed = results.filter((r) => r.status === 200);
  assert(created.length === 1, `Expected exactly 1 HTTP 201 winner, got ${created.length}`);
  assert(
    replayed.length === PARALLELISM - 1,
    `Expected ${PARALLELISM - 1} HTTP 200 replays, got ${replayed.length}`,
  );

  const ids = new Set(results.map((r) => r.id));
  assert(ids.size === 1, `Expected all responses to point to the same facture id, got ${[...ids].join(",")}`);
  const winnerId = [...ids][0];

  const factureRows = await pg.query<{ count: string }>(
    `SELECT count(*)::int AS count FROM factures WHERE devis_id = $1`,
    [devis.id],
  );
  assert(
    Number(factureRows.rows[0].count) === 1,
    `Expected exactly 1 facture row in DB for devis ${devis.id}, got ${factureRows.rows[0].count}`,
  );

  const faRows = await pg.query<{ count: string }>(
    `SELECT count(*)::int AS count FROM factures_acompte WHERE devis_id = $1`,
    [devis.id],
  );
  const expectedFa = WITH_ACOMPTE ? 1 : 0;
  assert(
    Number(faRows.rows[0].count) === expectedFa,
    `Expected ${expectedFa} facture_acompte row(s) for devis ${devis.id}, got ${faRows.rows[0].count}`,
  );

  // Replay-after-commit (single sequential call on the now-converted devis).
  const replay = await fetch(`${API_BASE}/api/devis/${devis.id}/convertir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const replayJson = (await replay.json()) as { id?: number };
  assert(replay.status === 200, `Replay-after-commit expected HTTP 200, got ${replay.status}`);
  assert(replayJson.id === winnerId, `Replay-after-commit returned different facture id`);

  await pg.end();

  console.log("\n✓ PASS");
  console.log(`  - 1 facture created (id=${winnerId}), ${PARALLELISM - 1} idempotent replays`);
  console.log(`  - ${expectedFa} facture d'acompte created`);
  console.log(`  - Replay after commit returns same facture (HTTP 200)`);
}

main().catch((err) => {
  console.error("✗ Test crashed:", err);
  process.exit(1);
});
