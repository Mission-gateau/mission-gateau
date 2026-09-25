/**
 * Les journaux de la vente : des noms d'événements et des compteurs, jamais
 * de prénom, de donnée de la fête, d'adresse e-mail ni de contenu chiffré.
 */

/** Un journal d'une ligne, fait de noms d'événements et de compteurs. */
export function journal(entree: Record<string, string | number>): void {
  console.info(JSON.stringify(entree));
}

/** Le type et le code d'une erreur Stripe, jamais son message, qui pourrait citer une valeur envoyée. */
export function codesErreur(erreur: unknown): Record<string, string> {
  const codes: Record<string, string> = {};
  if (erreur && typeof erreur === "object") {
    for (const champ of ["type", "code"] as const) {
      const valeur = (erreur as Record<string, unknown>)[champ];
      if (typeof valeur === "string" && /^[A-Za-z_]{1,60}$/.test(valeur)) codes[champ] = valeur;
    }
  }
  return codes;
}
