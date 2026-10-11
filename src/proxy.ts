import { NextResponse, type NextRequest } from "next/server";
import { enTeteRobots, productionMaintenant } from "./site/referencement";

/**
 * Avant chaque requête : l'en-tête `X-Robots-Tag`, selon l'environnement
 * (lu à l'exécution) et le chemin. Voir src/site/referencement.ts.
 */
export function proxy(requete: NextRequest): NextResponse {
  const reponse = NextResponse.next();
  const entete = enTeteRobots(requete.nextUrl.pathname, productionMaintenant());
  if (entete) reponse.headers.set("X-Robots-Tag", entete);
  return reponse;
}

export const config = {
  // Les fichiers du build (scripts, feuilles de style) n'ont rien à dire aux moteurs.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
