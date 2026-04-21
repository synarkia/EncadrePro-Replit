import type { Result } from "../types.js";
import { pickColumn, strOrNull } from "../normalize.js";

/* WEB-TO-DESKTOP NOTE: Column-name lookup table is centralised here so it's trivial
 * to adapt when Thomas's real FileMaker headers arrive. */

export const FOURNISSEUR_COLUMNS = {
  nom: ["Nom", "Fournisseur", "Raison sociale"],
  version_tarif: ["Version", "Tarif", "Version tarif", "VersionTarif"],
  contact_email: ["Email", "E-mail", "Mail"],
  contact_tel: ["Téléphone", "Telephone", "Tel", "Tél"],
  contact_nom: ["Contact"],
  notes: ["Notes", "Remarques", "Commentaire"],
} as const;

export type FournisseurInsert = {
  nom: string;
  version_tarif: string | null;
  contact_email: string | null;
  contact_tel: string | null;
  contact_nom: string | null;
  notes: string | null;
};

export function mapFournisseurRow(
  row: Record<string, string>,
  _lineNumber: number,
): Result<FournisseurInsert, string> {
  const nom = pickColumn(row, FOURNISSEUR_COLUMNS.nom);
  if (!nom) return { ok: false, error: "Champ 'nom' manquant" };

  return {
    ok: true,
    value: {
      nom,
      version_tarif: strOrNull(pickColumn(row, FOURNISSEUR_COLUMNS.version_tarif)),
      contact_email: strOrNull(pickColumn(row, FOURNISSEUR_COLUMNS.contact_email)),
      contact_tel: strOrNull(pickColumn(row, FOURNISSEUR_COLUMNS.contact_tel)),
      contact_nom: strOrNull(pickColumn(row, FOURNISSEUR_COLUMNS.contact_nom)),
      notes: strOrNull(pickColumn(row, FOURNISSEUR_COLUMNS.notes)),
    },
  };
}
