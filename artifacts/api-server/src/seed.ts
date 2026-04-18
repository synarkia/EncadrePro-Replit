/**
 * Seed script for EncadrePro
 * Populates demo products, atelier settings, and sample data
 * Run: pnpm --filter @workspace/api-server tsx src/seed.ts
 *
 * WEB-TO-DESKTOP NOTE: seed runs against shared schema; usable from both web and Electron build.
 */
import { db, atelierTable, produitsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding EncadrePro database...");

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

  const existingProducts = await db.select().from(produitsTable);
  if (existingProducts.length === 0) {
    /* type_code: VR=verre/plexi, FA=façonnage, AU=autres composants, SD=service direct, EN=encadrement */
    const produits = [
      // Encadrement (EN) — moulures
      { reference: "BAG-001", designation: "Baguette bois naturel 20mm", type_code: "EN", pricing_mode: "linear_meter", unite: "ml", unite_calcul: "metre_lineaire", prix_ht: 4.50, taux_tva: 20 },
      { reference: "BAG-002", designation: "Baguette aluminium argenté 15mm", type_code: "EN", pricing_mode: "linear_meter", unite: "ml", unite_calcul: "metre_lineaire", prix_ht: 6.80, taux_tva: 20 },
      { reference: "BAG-003", designation: "Baguette dorée patinée 30mm", type_code: "EN", pricing_mode: "linear_meter", unite: "ml", unite_calcul: "metre_lineaire", prix_ht: 9.20, taux_tva: 20 },
      // Verres (VR)
      { reference: "VER-001", designation: "Verre clair 2mm", type_code: "VR", pricing_mode: "square_meter", unite: "m²", unite_calcul: "metre_carre", prix_ht: 18.00, taux_tva: 20 },
      { reference: "VER-002", designation: "Verre antireflet musée", type_code: "VR", pricing_mode: "square_meter", unite: "m²", unite_calcul: "metre_carre", prix_ht: 42.00, taux_tva: 20 },
      { reference: "VER-003", designation: "Plexi anti-UV 3mm", type_code: "VR", pricing_mode: "square_meter", unite: "m²", unite_calcul: "metre_carre", prix_ht: 28.50, taux_tva: 20 },
      // Autres composants (AU) — passe-partout, quincaillerie
      { reference: "PP-001", designation: "Passe-partout blanc 1.4mm", type_code: "AU", pricing_mode: "square_meter", unite: "m²", unite_calcul: "metre_carre", prix_ht: 12.00, taux_tva: 20 },
      { reference: "PP-002", designation: "Passe-partout ivoire 1.4mm", type_code: "AU", pricing_mode: "square_meter", unite: "m²", unite_calcul: "metre_carre", prix_ht: 12.50, taux_tva: 20 },
      { reference: "QUI-001", designation: "Kraft dos fermé", type_code: "AU", pricing_mode: "unit", unite: "pièce", unite_calcul: "unitaire", prix_ht: 1.20, taux_tva: 20 },
      { reference: "QUI-002", designation: "Suspension tableau (paire)", type_code: "AU", pricing_mode: "unit", unite: "pièce", unite_calcul: "unitaire", prix_ht: 0.80, taux_tva: 20 },
      // Façonnage (FA) — main d'œuvre
      { reference: "MO-001", designation: "Main d'œuvre encadrement", type_code: "FA", pricing_mode: "unit", unite: "heure", unite_calcul: "heure", prix_ht: 35.00, taux_tva: 10 },
      { reference: "MO-002", designation: "Découpe passe-partout", type_code: "FA", pricing_mode: "unit", unite: "heure", unite_calcul: "heure", prix_ht: 40.00, taux_tva: 10 },
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
