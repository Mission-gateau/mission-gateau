import type { DocumentLegal } from "../document";
import type { FicheVendeur } from "../vendeur";
import * as du20260924 from "./2026-09-24";
import * as du20260925 from "./2026-09-25";

/**
 * Les versions publiées des conditions générales de vente.
 *
 * Chaque version vit dans son propre fichier, indexée par son identifiant, et
 * n'est plus jamais modifiée une fois publiée : une commande garde dans ses
 * métadonnées l'identifiant de la version acceptée, et sa confirmation joint
 * le PDF de cette version-là, prix compris. /cgv affiche la version en
 * vigueur, la dernière de la liste.
 *
 * Pour changer les CGV : copier le dernier fichier sous un nouvel
 * identifiant (la date de publication), l'écrire, l'ajouter à la fin de
 * VERSIONS_CGV. Ne jamais retoucher une version déjà publiée.
 */

export interface VersionCgv {
  /** « 2026-09-25 » : ce que la commande garde dans ses métadonnées. */
  identifiant: string;
  /** « 25 septembre 2026 » : ce qu'affichent la page, la facture et le PDF. */
  libelle: string;
  /**
   * Date de création du PDF : celle de la version, toujours la même, pour que
   * le fichier joint à une confirmation soit identique d'un envoi à l'autre.
   */
  date: Date;
  /** L'article qui traite de la garantie légale de conformité, cité dans la confirmation. */
  articleGarantie: number;
  conditions(fiche: FicheVendeur, options: { prix: string | null }): DocumentLegal;
}

/** Ce qu'exporte le fichier d'une version. */
interface FichierDeVersion {
  IDENTIFIANT: string;
  LIBELLE: string;
  ARTICLE_GARANTIE: number;
  conditionsGenerales(fiche: FicheVendeur, options: { prix: string | null }): DocumentLegal;
}

function version(module: FichierDeVersion): VersionCgv {
  const [annee, mois, jour] = module.IDENTIFIANT.split("-").map(Number) as [number, number, number];
  return {
    identifiant: module.IDENTIFIANT,
    libelle: module.LIBELLE,
    date: new Date(Date.UTC(annee, mois - 1, jour)),
    articleGarantie: module.ARTICLE_GARANTIE,
    conditions: module.conditionsGenerales,
  };
}

export const VERSIONS_CGV: readonly VersionCgv[] = [version(du20260924), version(du20260925)];

/** La version en vigueur : celle que /cgv affiche et que les nouvelles commandes acceptent. */
export const VERSION_EN_VIGUEUR: VersionCgv = VERSIONS_CGV.at(-1)!;

/** L'identifiant et le libellé de la version en vigueur. */
export const VERSION_CGV = {
  identifiant: VERSION_EN_VIGUEUR.identifiant,
  libelle: VERSION_EN_VIGUEUR.libelle,
} as const;

/** La version dont une commande a gardé l'identifiant. Null si elle est inconnue. */
export function versionCgv(identifiant: string): VersionCgv | null {
  return VERSIONS_CGV.find((v) => v.identifiant === identifiant) ?? null;
}

/** Les conditions générales de vente en vigueur. */
export function conditionsGenerales(fiche: FicheVendeur, options: { prix: string | null }): DocumentLegal {
  return VERSION_EN_VIGUEUR.conditions(fiche, options);
}
