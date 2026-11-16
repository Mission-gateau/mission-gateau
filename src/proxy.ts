import { NextResponse, type NextRequest } from "next/server";
import { NOINDEX, cheminAvecBarreInversee, enTeteRobots, productionMaintenant } from "./site/referencement";

/**
 * Avant chaque requête : d'abord, une adresse dont le chemin contient une
 * barre oblique inversée (`\`, ou codée `%5C` / `%5c`) reçoit aussitôt une
 * 404 `noindex`, sans aller plus loin — des robots appellent `/creer%5C`,
 * `/cgv%5C`… et le serveur cherchait alors un module « creer\ » introuvable
 * (500). Ensuite, l'en-tête `X-Robots-Tag`, selon l'environnement (lu à
 * l'exécution) et le chemin. Voir src/site/referencement.ts.
 */
export function proxy(requete: NextRequest): NextResponse {
  if (cheminAvecBarreInversee(requete.nextUrl.pathname) || cheminAvecBarreInversee(cheminBrut(requete.url))) {
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
