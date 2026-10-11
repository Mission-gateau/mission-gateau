import { track } from "@vercel/analytics";

/**
 * La mesure d'audience (Vercel Web Analytics), côté navigateur.
 *
 * Le composant `MesureDAudience` n'est rendu qu'en production : ailleurs,
 * `window.va` n'existe pas et `track` ne fait rien. Aucune adresse e-mail,
 * aucun identifiant de session Stripe, aucune référence de commande, aucun
 * prénom ni détail de la fête ne part jamais.
 */

/** Les paramètres d'adresse gardés : la provenance d'un lien (?utm_source=pinterest, ?utm_source=instagram…). */
const PARAMETRES_GARDES = /^utm_(source|medium|campaign|content|term)$/;

/**
 * L'adresse telle qu'elle part chez Vercel : une page de commande devient
 * `/commande/[ref]` et /renoncer reste `/renoncer`, sans aucun paramètre ;
 * ailleurs, seuls les paramètres `utm_*` restent, et jamais le fragment.
 */
export function adresseMesuree(adresse: string): string {
  const url = new URL(adresse);
  if (url.pathname.startsWith("/commande/")) return `${url.origin}/commande/[ref]`;
  if (url.pathname === "/renoncer" || url.pathname.startsWith("/renoncer/")) return `${url.origin}/renoncer`;
  const gardes = new URLSearchParams();
  for (const [cle, valeur] of url.searchParams) if (PARAMETRES_GARDES.test(cle)) gardes.append(cle, valeur);
  url.search = gardes.toString();
  url.hash = "";
  return url.toString();
}

/** Le filtre `beforeSend` de Web Analytics : chaque événement part avec son adresse nettoyée. */
export function avantEnvoi<E extends { url: string }>(evenement: E): E | null {
  try {
    return { ...evenement, url: adresseMesuree(evenement.url) };
  } catch {
    // Une adresse illisible ne part pas.
    return null;
  }
}

/**
 * Le compteur anonyme des aperçus : l'événement `apercu`, avec l'âge fêté et
 * la durée choisis, rien d'autre. Les événements personnalisés ne sont
 * enregistrés qu'avec l'offre Pro de Vercel : avec l'offre Hobby, l'appel est
 * fait et Vercel ne le compte pas.
 */
export function compterLApercu(age: number, duree: number): void {
  try {
    track("apercu", { age, duree });
  } catch {
    // La mesure ne doit jamais gêner l'aperçu.
  }
}
