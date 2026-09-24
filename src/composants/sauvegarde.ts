import { graineValide } from "@/engine/alea";
import { schemaConfiguration } from "@/engine/configuration";
import type { Configuration } from "@/engine/types";

/**
 * Le formulaire et l'aperçu, gardés le temps du paiement.
 *
 * Juste avant de partir chez Stripe, l'onglet garde dans son sessionStorage
 * les réponses, la configuration et la graine de l'aperçu, et le pays : si
 * le parent annule, il retrouve tout sur /creer sans rien ressaisir. Rien
 * n'est gardé ailleurs, rien ne quitte le navigateur, et tout est effacé une
 * fois la commande payée, quand le parent compose un autre jeu, ou à la
 * fermeture de l'onglet.
 */

const CLE = "mission-gateau:commande-en-cours";
const EVENEMENT = "mission-gateau:sauvegarde";

export interface Sauvegarde {
  version: 1;
  brouillon: unknown;
  configuration: Configuration;
  graine: string;
  pays: string;
}

function stockage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function prevenir(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENEMENT));
}

export function sauvegarder(sauvegarde: Omit<Sauvegarde, "version">): void {
  try {
    stockage()?.setItem(CLE, JSON.stringify({ version: 1, ...sauvegarde }));
  } catch {
    // Stockage plein ou refusé : le parent devra seulement recomposer son jeu s'il annule.
  }
  prevenir();
}

export function oublierSauvegarde(): void {
  try {
    stockage()?.removeItem(CLE);
  } catch {
    // Rien à faire : sans stockage, il n'y a rien à effacer.
  }
  prevenir();
}

/** Pour useSyncExternalStore : la chaîne brute, stable d'un rendu à l'autre. */
export function lireSauvegardeBrute(): string | null {
  try {
    return stockage()?.getItem(CLE) ?? null;
  } catch {
    return null;
  }
}

export function lireSauvegardeCoteServeur(): null {
  return null;
}

export function abonnerSauvegarde(rappel: () => void): () => void {
  window.addEventListener(EVENEMENT, rappel);
  return () => window.removeEventListener(EVENEMENT, rappel);
}

/** Relit une sauvegarde ; tout ce qui n'est pas exactement attendu est ignoré. */
export function analyserSauvegarde(brut: string | null): Sauvegarde | null {
  if (!brut) return null;
  try {
    const valeur = JSON.parse(brut) as Partial<Sauvegarde> | null;
    if (!valeur || valeur.version !== 1) return null;
    const analyse = schemaConfiguration.safeParse(valeur.configuration);
    if (!analyse.success || typeof valeur.graine !== "string" || !graineValide(valeur.graine)) return null;
    return {
      version: 1,
      brouillon: valeur.brouillon,
      configuration: analyse.data as Configuration,
      graine: valeur.graine,
      pays: typeof valeur.pays === "string" ? valeur.pays : "",
    };
  } catch {
    return null;
  }
}
