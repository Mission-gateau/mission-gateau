import { CACHETTES } from "@/engine/cachettes";
import type { Configuration, Duree, IdTheme } from "@/engine/types";

export const TOUTES_CACHETTES = CACHETTES.map((c) => c.id);

export const THEMES: IdTheme[] = ["pirates", "agents", "dinosaures"];
/** Un âge par format. */
export const AGES = [5, 8, 11];
export const DUREES: Duree[] = [30, 45, 60];

export function configuration(partiel: Partial<Configuration> = {}): Configuration {
  return {
    theme: "pirates",
    age: 8,
    prenom: "Camille",
    nombreEnfants: 8,
    duree: 45,
    cachettes: TOUTES_CACHETTES,
    ...partiel,
  };
}

/** Graines stables, pour que les échecs soient reproductibles. */
export function graines(nombre: number, prefixe = "g"): string[] {
  return Array.from({ length: nombre }, (_, i) => `${prefixe}${String(i).padStart(4, "0")}`);
}

/** Nombre de pages d'un PDF, lu dans l'arbre des pages. */
export function compterPages(pdf: Buffer): number {
  const texte = pdf.toString("latin1");
  const comptes = [...texte.matchAll(/\/Count (\d+)/g)].map((m) => Number(m[1]));
  if (comptes.length === 0) throw new Error("PDF sans arbre de pages");
  return Math.max(...comptes);
}
