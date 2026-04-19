#!/usr/bin/env node
const BASE = "https://ecadre-pro-web.replit.app";

async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const FOURNISSEURS = [
  { nom: "NIELSEN" }, { nom: "GLASSOLUTIONS" }, { nom: "MACOCCO" },
  { nom: "RM DIFFUSION" }, { nom: "ATELIER" }, { nom: "SOGIMEX" },
  { nom: "CINDAR" }, { nom: "REVERCHON" },
];

const CLIENTS = [
  { nom: "O'CALLAGHAN-LOCKE", prenom: "Ryan", adresse: "12 rue Victor Hugo", code_postal: "69002", ville: "Lyon", telephone: "06 23 80 15 27", email: "ryan.ocl@example.fr" },
  { nom: "DUPONT", prenom: "Marie", adresse: "45 avenue Jean Jaurès", code_postal: "69007", ville: "Lyon", telephone: "04 72 00 00 00", email: null },
  { nom: "MARTIN", prenom: "Jean-Pierre", adresse: "8 place Bellecour", code_postal: "69002", ville: "Lyon", telephone: null, email: "jp.martin@example.fr" },
  { nom: "Galerie des Arts", prenom: null, adresse: "23 rue Mercière", code_postal: "69002", ville: "Lyon", telephone: "04 78 00 00 00", email: "contact@galeriedesarts.fr" },
  { nom: "Musée de Lyon", prenom: null, adresse: "1 place de la Confluence", code_postal: "69002", ville: "Lyon", telephone: null, email: "regie@musee-lyon.fr" },
];

const PRODUITS = [
  { ref: "8",   designation: "verre clair 10mm",                     fnom: "GLASSOLUTIONS", pauht: 48.80, coef: 2.6, type_code: "VR", pm: "square_meter", epaisseur_mm: 10, majo_epaisseur: 1.7, mini_fact_tn: 0.35, mini_fact_ta: 0.5, coef_marge_ta: 2.6, plus_value_ta_pct: 650 },
  { ref: "12",  designation: "Verre clair 2mm",                      fnom: "MACOCCO",       pauht: 25.00, coef: 2.6, type_code: "VR", pm: "square_meter", epaisseur_mm: 2,  majo_epaisseur: 1.0, mini_fact_tn: 0.35, mini_fact_ta: 0.5, coef_marge_ta: 2.6, plus_value_ta_pct: 400 },
  { ref: "61",  designation: "Miroir Gris Joint poli 4mm",           fnom: "MACOCCO",       pauht: 35.00, coef: 2.5, type_code: "VR", pm: "square_meter", epaisseur_mm: 4,  majo_epaisseur: 1.2, mini_fact_tn: 0.35, mini_fact_ta: 0.5, coef_marge_ta: 2.5, plus_value_ta_pct: 500 },
  { ref: "94",  designation: "Plexiglass extrudé Anti-reflet 2mm",   fnom: "CINDAR",        pauht: 60.00, coef: 2.0, type_code: "VR", pm: "square_meter", epaisseur_mm: 2,  majo_epaisseur: 1.0, mini_fact_tn: 0.5,  mini_fact_ta: 0.5, coef_marge_ta: 2.0, plus_value_ta_pct: 300 },
  { ref: "7",   designation: "Bords polis (mini 1ml)",               fnom: "ATELIER",       pauht: 13.50, coef: 1.0, type_code: "FA", pm: "linear_meter", fac_mm: 6 },
  { ref: "21",  designation: "Biseau talon brut demi-rond SUR DEVIS",fnom: "REVERCHON",     pauht: 35.00, coef: 1.0, type_code: "FA", pm: "linear_meter", fac_mm: 35 },
  { ref: "24",  designation: "Biseau talon poli",                    fnom: "REVERCHON",     pauht: 18.00, coef: 1.0, type_code: "FA", pm: "linear_meter", fac_mm: 6 },
  { ref: "27",  designation: "Chanfrein mini 1ml",                   fnom: "ATELIER",       pauht: 12.00, coef: 1.0, type_code: "FA", pm: "linear_meter", fac_mm: 6 },
  { ref: "20",  designation: "Aérateur à hélice 160mm",              fnom: "SOGIMEX",       pauht: 19.00, coef: 2.0, type_code: "AU", pm: "unit" },
  { ref: "25",  designation: "Couteau à mastic forme Boucher",       fnom: "SOGIMEX",       pauht: 8.50,  coef: 2.0, type_code: "AU", pm: "unit" },
  { ref: "75",  designation: "Bouton double Chromé Brillant",        fnom: "SOGIMEX",       pauht: 4.20,  coef: 2.0, type_code: "AU", pm: "unit" },
  { ref: "104", designation: "Silicone blanc neutre",                fnom: "SOGIMEX",       pauht: 6.00,  coef: 2.0, type_code: "AU", pm: "unit" },
  { ref: "826", designation: "Pose (1conf)",                         fnom: "ATELIER",       pauht: 120.00,coef: 1.0, type_code: "SD", pm: "unit" },
  { ref: "827", designation: "Pose en atelier 10mm",                 fnom: "ATELIER",       pauht: 150.00,coef: 1.0, type_code: "SD", pm: "unit" },
  { ref: "1086",designation: "Pénalité de retard",                   fnom: "ATELIER",       pauht: 50.00, coef: 1.0, type_code: "SD", pm: "unit" },
  { ref: "1089",designation: "Livraison grand volume",               fnom: "ATELIER",       pauht: 80.00, coef: 1.0, type_code: "SD", pm: "unit" },
  { ref: "420", designation: "Cadre Trafalia 334-03 Argent ancien",  fnom: "NIELSEN",       pauht: 21.41, coef: 2.5, type_code: "EN", pm: "linear_meter", cadre_or_accessoire: "cadre" },
  { ref: "365", designation: "Cadre alu 04-021 Noir mat",            fnom: "NIELSEN",       pauht: 18.00, coef: 2.5, type_code: "EN", pm: "linear_meter", cadre_or_accessoire: "cadre" },
  { ref: "448", designation: "Cadre 448 Orofina Art déco 20×30",     fnom: "RM DIFFUSION",  pauht: 45.00, coef: 2.0, type_code: "EN", pm: "unit",         cadre_or_accessoire: "cadre" },
  { ref: "304", designation: "Cadre Lodge 51,2×33,2",                fnom: "ATELIER",       pauht: 0.00,  coef: 1.0, type_code: "EN", pm: "unit",         cadre_or_accessoire: "cadre", vendu: true },
];

const uniteFor = (pm) => pm === "linear_meter" ? "metre_lineaire" : pm === "square_meter" ? "metre_carre" : "unitaire";

(async () => {
  console.log("→ Connecting to", BASE);

  // Fournisseurs
  const existingF = await api("GET", "/api/fournisseurs");
  const fByName = new Map(existingF.map(f => [f.nom, f.id]));
  let fIns = 0;
  for (const f of FOURNISSEURS) {
    if (fByName.has(f.nom)) continue;
    const created = await api("POST", "/api/fournisseurs", f);
    fByName.set(created.nom, created.id);
    fIns++;
  }
  console.log(`Fournisseurs: +${fIns} (total now ${fByName.size})`);

  // Clients
  const existingC = await api("GET", "/api/clients");
  const cKey = c => `${c.nom}|${c.prenom ?? ""}`.toLowerCase();
  const cExisting = new Set(existingC.map(cKey));
  let cIns = 0;
  for (const c of CLIENTS) {
    if (cExisting.has(cKey(c))) continue;
    await api("POST", "/api/clients", c);
    cIns++;
  }
  console.log(`Clients: +${cIns}`);

  // Produits
  const existingP = await api("GET", "/api/produits");
  const pByRef = new Set(existingP.map(p => p.ref_legacy).filter(Boolean));
  let pIns = 0;
  for (const p of PRODUITS) {
    if (pByRef.has(p.ref)) continue;
    const fId = fByName.get(p.fnom) ?? null;
    const prix_ht = Number((p.pauht * p.coef).toFixed(2));
    const body = {
      reference: p.ref,
      ref_legacy: p.ref,
      designation: p.designation,
      type_code: p.type_code,
      pricing_mode: p.pm,
      unite_calcul: uniteFor(p.pm),
      fournisseur_id: fId,
      prix_achat_ht: p.pauht,
      coefficient_marge: p.coef,
      prix_ht,
      taux_tva: 20,
      epaisseur_mm: p.epaisseur_mm ?? null,
      majo_epaisseur: p.majo_epaisseur ?? null,
      mini_fact_tn: p.mini_fact_tn ?? null,
      mini_fact_ta: p.mini_fact_ta ?? null,
      coef_marge_ta: p.coef_marge_ta ?? null,
      plus_value_ta_pct: p.plus_value_ta_pct ?? null,
      fac_mm: p.fac_mm ?? null,
      cadre_or_accessoire: p.cadre_or_accessoire ?? null,
      vendu: p.vendu ?? false,
    };
    try {
      await api("POST", "/api/produits", body);
      pIns++;
    } catch (e) {
      console.error(`  produit ${p.ref} failed:`, e.message.slice(0, 200));
    }
  }
  console.log(`Produits: +${pIns}`);

  console.log("✅ Seed done");
})().catch(e => { console.error("❌", e); process.exit(1); });
