import type { Result } from "../types.js";
import { pickColumn, strOrNull } from "../normalize.js";

export const CLIENT_COLUMNS = {
  nom: ["Nom", "Raison sociale", "Client"],
  prenom: ["Prénom", "Prenom"],
  adresse: ["Adresse", "Rue"],
  code_postal: ["CP", "Code postal", "CodePostal"],
  ville: ["Ville", "Commune"],
  telephone: ["Téléphone", "Telephone", "Tel", "Tél", "Mobile"],
  email: ["Email", "E-mail", "Mail"],
  notes: ["Notes", "Remarques", "Commentaire", "Réf client", "Ref"],
} as const;

export type ClientInsert = {
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
  notes: string | null;
};

export function mapClientRow(
  row: Record<string, string>,
  _lineNumber: number,
): Result<ClientInsert, string> {
  const nom = pickColumn(row, CLIENT_COLUMNS.nom);
  if (!nom) return { ok: false, error: "Champ 'nom' manquant" };

  return {
    ok: true,
    value: {
      nom,
      prenom: strOrNull(pickColumn(row, CLIENT_COLUMNS.prenom)),
      adresse: strOrNull(pickColumn(row, CLIENT_COLUMNS.adresse)),
      code_postal: strOrNull(pickColumn(row, CLIENT_COLUMNS.code_postal)),
      ville: strOrNull(pickColumn(row, CLIENT_COLUMNS.ville)),
      telephone: strOrNull(pickColumn(row, CLIENT_COLUMNS.telephone)),
      email: strOrNull(pickColumn(row, CLIENT_COLUMNS.email)),
      notes: strOrNull(pickColumn(row, CLIENT_COLUMNS.notes)),
    },
  };
}
