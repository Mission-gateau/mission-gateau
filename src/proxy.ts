import { NextResponse, type NextRequest } from "next/server";
import { NOINDEX, cheminRefuse, enTeteRobots, productionMaintenant } from "./site/referencement";

/**
 * Avant chaque requête : d'abord, une adresse dont le chemin, tel qu'il
 * arrive, contient un `%` (un caractère codé : `%2F`, `%5C`, `%65`…) ou une
 * barre oblique inversée reçoit aussitôt une 404 `noindex`, sans aller plus
 * loin — sur Vercel, `/creer%2F`, `/creer%5C`, `/cr%65er`… faisaient chercher
 * au serveur un module « creer%2F » introuvable (500). La partie après `?`
 * n'est pas lue. Ensuite, l'en-tête `X-Robots-Tag`, selon l'environnement
 * (lu à l'exécution) et le chemin. Voir src/site/referencement.ts.
 */
export function proxy(requete: NextRequest): NextResponse {
  if (cheminRefuse(cheminBrut(requete.url)) || cheminRefuse(requete.nextUrl.pathname)) {
    return new NextResponse("Page introuvable.\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": NOINDEX, "Cache-Control": "no-store" },
    });
  }
  const reponse = NextResponse.next();
  const entete = enTeteRobots(requete.nextUrl.pathname, productionMaintenant());
  if (entete) reponse.headers.set("X-Robots-Tag", entete);
  return reponse;
}

/** Le chemin tel qu'il est arrivé, sans l'origine, la requête ni le fragment. */
function cheminBrut(adresse: string): string {
  const sansOrigine = adresse.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "");
  return sansOrigine.split(/[?#]/, 1)[0] ?? "";
}

export const config = {
  // Les fichiers du build (scripts, feuilles de style) n'ont rien à dire aux moteurs.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
