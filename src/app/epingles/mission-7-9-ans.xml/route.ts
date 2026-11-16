import { reponseDuFlux } from "@/epingles/flux";

// L'heure est lue à chaque requête : le flux ne montre que les articles déjà publiés.
export const dynamic = "force-dynamic";

/** Le flux RSS du tableau Pinterest « mission-7-9-ans » (voir src/epingles/flux.ts). */
export function GET(): Response {
  return reponseDuFlux("mission-7-9-ans");
}
