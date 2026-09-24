/**
 * Quitter le site pour la page de paiement de Stripe. Isolé dans son propre
 * module pour que les tests du formulaire puissent observer le départ.
 */
export function allerVers(adresse: string): void {
  window.location.assign(adresse);
}
