/**
 * Pays de résidence acceptés : les 27 pays de l'Union européenne, la Suisse,
 * Monaco et le Canada. Codes ISO 3166-1 alpha-2 ; les noms affichés vivent
 * dans src/contenu/vente.ts.
 */
export const PAYS_UNION_EUROPEENNE = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
  "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
] as const;

export const PAYS_ACCEPTES = [...PAYS_UNION_EUROPEENNE, "CH", "MC", "CA"] as const;

export type CodePays = (typeof PAYS_ACCEPTES)[number];

/** Choix proposé au parent quand son pays n'est pas dans la liste. */
export const AUTRE_PAYS = "AUTRE";

export const PAYS_PAR_DEFAUT: CodePays = "FR";

export function paysAccepte(code: unknown): code is CodePays {
  return typeof code === "string" && (PAYS_ACCEPTES as readonly string[]).includes(code);
}
