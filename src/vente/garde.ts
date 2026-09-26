import { REPONSES_COMMANDE } from "../contenu/vente";

/**
 * Le contrôle commun à toutes les routes POST du site (aperçu, commande,
 * confirmation, kit, rétractation), écrit une fois ici et appelé en tête de
 * chacune.
 *
 * - `Content-Type` doit être `application/json`, paramètres ignorés
 *   (`application/json; charset=utf-8` passe) : sinon 415. Un formulaire ou
 *   un `fetch` sans en-tête lancé depuis un autre site part en `text/plain`
 *   ou en formulaire, jamais en JSON sans l'accord du navigateur.
 * - 403 si le navigateur dit que la requête vient d'un autre site
 *   (`Sec-Fetch-Site: cross-site`), si `Origin` vaut `null`, ou si `Origin`
 *   est présent et que son hôte n'est pas celui de la requête : la première
 *   valeur de `x-forwarded-host`, sinon `host`, sinon l'hôte de l'adresse de
 *   la requête.
 *
 * Une page d'un autre site ne peut donc plus faire envoyer quoi que ce soit
 * par le navigateur de ses visiteurs. Une requête sans `Origin` (un outil en
 * ligne de commande, un test) reste possible : ce contrôle protège les
 * visiteurs, il ne remplace ni la validation des entrées ni la limitation du
 * débit.
 */

function refus(message: string, statut: number): Response {
  return Response.json({ erreur: message }, { status: statut, headers: { "Cache-Control": "no-store" } });
}

/** L'hôte que sert la requête, en minuscules. Null s'il ne peut pas être établi. */
export function hoteDeLaRequete(requete: Request): string | null {
  const transmis = requete.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (transmis) return transmis.toLowerCase();
  const hote = requete.headers.get("host")?.trim();
  if (hote) return hote.toLowerCase();
  try {
    return new URL(requete.url).host.toLowerCase() || null;
  } catch {
    return null;
  }
}

function memeOrigine(origine: string, requete: Request): boolean {
  let hote: string;
  try {
    hote = new URL(origine).host.toLowerCase();
  } catch {
    return false;
  }
  return hote !== "" && hote === hoteDeLaRequete(requete);
}

/** La réponse de refus, ou null si la requête peut être traitée. */
export function refusDeRequete(requete: Request): Response | null {
  const type = (requete.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (type !== "application/json") return refus(REPONSES_COMMANDE.formatRefuse, 415);

  if (requete.headers.get("sec-fetch-site")?.trim().toLowerCase() === "cross-site") {
    return refus(REPONSES_COMMANDE.origineRefusee, 403);
  }
  const origine = requete.headers.get("origin");
  if (origine !== null) {
    if (origine.trim() === "null" || !memeOrigine(origine.trim(), requete)) {
      return refus(REPONSES_COMMANDE.origineRefusee, 403);
    }
  }
  return null;
}
