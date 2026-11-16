import { reponseDuFlux } from "@/epingles/flux";

// L'heure est lue à chaque requête : le flux ne montre que les articles déjà publiés.
export const dynamic = "force-dynamic";

/** Le flux RSS du tableau Pinterest « idees-anniversaire » (voir src/epingles/flux.ts). */
export function GET(): Response {
  return reponseDuFlux("idees-anniversaire");
}
