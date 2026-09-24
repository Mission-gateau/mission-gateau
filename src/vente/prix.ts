/** Le prix du jeu complet, en centimes d'euro. Un seul prix, un seul produit. */
export const MONTANT_CENTIMES = 1290;
export const DEVISE = "eur";

/**
 * « 12,90 € », à la française. L'espace avant le symbole est insécable : le
 * montant ne se coupe jamais de son unité en fin de ligne.
 */
export function formaterPrix(centimes: number): string {
  const euros = Math.floor(centimes / 100);
  const reste = String(centimes % 100).padStart(2, "0");
  return `${euros},${reste}\u00a0€`;
}

export const PRIX_AFFICHE = formaterPrix(MONTANT_CENTIMES);
