/**
 * Seed script for EncadrePro
 * Populates demo products, atelier settings, and sample data
 * Run: pnpm --filter @workspace/api-server tsx src/seed.ts
 */
import { db, atelierTable, produitsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding EncadrePro database...");

  // ─── Atelier settings ─────────────────────────────────────────────────────
  const [existingAtelier] = await db.select().from(atelierTable).where(eq(atelierTable.id, 1));
  if (!existingAtelier) {
    await db.insert(atelierTable).values({
      id: 1,
      nom: "Atelier Durand",
      siret: "12345678901234",
      adresse: "12 Rue de la Paix",
      telephone: "01 23 45 67 89",
      email: "contact@atelier-durand.fr",
      conditions_generales: "Devis valable 30 jours. Acompte de 30% à la commande. Solde à la livraison.",
      prefixe_devis: "DEV",
      prefixe_facture: "FAC",
      compteur_devis: 0,
      compteur_facture: 0,
      tva_defaut: 20,
    });
    console.log("  ✓ Atelier configuré");
  } else {
    console.log("  → Atelier déjà configuré, ignoré");
  }

  // ─── Produits catalogue ────────────────────────────────────────────────────
  const existingProducts = await db.select().from(produitsTable);
  if (existingProducts.length === 0) {
    const produits = [
      // Baguettes
      { reference: "BAG-001", designation: "Baguette bois naturel 20mm", categorie: "baguettes", unite_calcul: "metre_lineaire", prix_ht: 4.50, taux_tva: 20 },
      { reference: "BAG-002", designation: "Baguette aluminium argenté 15mm", categorie: "baguettes", unite_calcul: "metre_lineaire", prix_ht: 6.80, taux_tva: 20 },
      { reference: "BAG-003", designation: "Baguette dorée patinée 30mm", categorie: "baguettes", unite_calcul: "metre_lineaire", prix_ht: 9.20, taux_tva: 20 },
      // Verres
      { reference: "VER-001", designation: "Verre clair 2mm", categorie: "verres", unite_calcul: "metre_carre", prix_ht: 18.00, taux_tva: 20 },
      { reference: "VER-002", designation: "Verre antireflet musée", categorie: "verres", unite_calcul: "metre_carre", prix_ht: 42.00, taux_tva: 20 },
      { reference: "VER-003", designation: "Plexi anti-UV 3mm", categorie: "verres", unite_calcul: "metre_carre", prix_ht: 28.50, taux_tva: 20 },
      // Passe-partout
      { reference: "PP-001", designation: "Passe-partout blanc 1.4mm", categorie: "passe_partout", unite_calcul: "metre_carre", prix_ht: 12.00, taux_tva: 20 },
      { reference: "PP-002", designation: "Passe-partout ivoire 1.4mm", categorie: "passe_partout", unite_calcul: "metre_carre", prix_ht: 12.50, taux_tva: 20 },
      // Quincaillerie
      { reference: "QUI-001", designation: "Kraft dos fermé", categorie: "quincaillerie", unite_calcul: "unitaire", prix_ht: 1.20, taux_tva: 20 },
      { reference: "QUI-002", designation: "Suspension tableau (paire)", categorie: "quincaillerie", unite_calcul: "unitaire", prix_ht: 0.80, taux_tva: 20 },
      // Main d'oeuvre
      { reference: "MO-001", designation: "Main d'œuvre encadrement", categorie: "main_oeuvre", unite_calcul: "heure", prix_ht: 35.00, taux_tva: 10 },
      { reference: "MO-002", designation: "Découpe passe-partout", categorie: "main_oeuvre", unite_calcul: "heure", prix_ht: 40.00, taux_tva: 10 },
    ];

    for (const p of produits) {
      await db.insert(produitsTable).values(p);
    }
    console.log(`  ✓ ${produits.length} produits ajoutés au catalogue`);
  } else {
    console.log(`  → ${existingProducts.length} produits déjà présents, ignoré`);
  }

  console.log("✅ Seed terminé !");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Erreur pendant le seed:", err);
  process.exit(1);
});
