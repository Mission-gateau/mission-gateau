import type { Configuration } from "../engine/types";
import { chiffrer, dechiffrer, decouper } from "./chiffrement";

/**
 * Ce que Stripe garde d'une commande, dans les métadonnées du paiement.
 *
 * En clair : la référence, la version du kit, la graine, le pays déclaré, la
 * version des CGV acceptée et l'heure des deux accords. Chiffrée : la
 * configuration complète, découpée en morceaux pour tenir dans les limites de
 * Stripe. Aucune donnée saisie par le parent n'y figure en clair.
 */

/** Limites des métadonnées Stripe : 50 clés, 40 caractères par clé, 500 par valeur. */
export const LIMITES_METADONNEES = { cles: 50, longueurCle: 40, longueurValeur: 500 } as const;

export const CLES = {
  reference: "ref",
  versionKit: "version_kit",
  graine: "graine",
  pays: "pays",
  versionCgv: "cgv",
  accordCgv: "accord_cgv",
  accordAccesImmediat: "accord_acces_immediat",
  /** « chiffree » tant que la configuration est là, « effacee » ensuite. */
  etatConfiguration: "config",
  nombreMorceaux: "config_morceaux",
} as const;

const PREFIXE_MORCEAU = "config_";
const MOTIF_MORCEAU = /^config_\d+$/;

export const CONFIGURATION_CHIFFREE = "chiffree";
export const CONFIGURATION_EFFACEE = "effacee";

export interface Commande {
  reference: string;
  versionKit: string;
  graine: string;
  pays: string;
  versionCgv: string;
  /** Heure du serveur, ISO 8601, au moment où les deux accords sont reçus. */
  accordCgv: string;
  accordAccesImmediat: string;
}

/** Ce qui est authentifié avec la configuration chiffrée. */
function contexte(commande: Pick<Commande, "reference" | "versionKit" | "graine">): string {
  return `${commande.reference}|${commande.versionKit}|${commande.graine}`;
}

export function metadonneesDuPaiement(
  commande: Commande,
  configuration: Configuration,
  cleStripe: string,
): Record<string, string> {
  const bloc = chiffrer(JSON.stringify(configuration), cleStripe, contexte(commande));
  const morceaux = decouper(bloc, LIMITES_METADONNEES.longueurValeur);
  const metadonnees: Record<string, string> = {
    [CLES.reference]: commande.reference,
    [CLES.versionKit]: commande.versionKit,
    [CLES.graine]: commande.graine,
    [CLES.pays]: commande.pays,
    [CLES.versionCgv]: commande.versionCgv,
    [CLES.accordCgv]: commande.accordCgv,
    [CLES.accordAccesImmediat]: commande.accordAccesImmediat,
    [CLES.etatConfiguration]: CONFIGURATION_CHIFFREE,
    [CLES.nombreMorceaux]: String(morceaux.length),
  };
  morceaux.forEach((morceau, index) => {
    metadonnees[`${PREFIXE_MORCEAU}${index}`] = morceau;
  });
  return metadonnees;
}

/** Les dépassements des limites de Stripe. Vide quand tout tient. */
export function depassementsDeMetadonnees(metadonnees: Record<string, string>): string[] {
  const problemes: string[] = [];
  const cles = Object.keys(metadonnees);
  if (cles.length > LIMITES_METADONNEES.cles) {
    problemes.push(`${cles.length} clés pour ${LIMITES_METADONNEES.cles} au plus`);
  }
  for (const cle of cles) {
    if (cle.length > LIMITES_METADONNEES.longueurCle || /[[\]]/.test(cle)) problemes.push(`clé « ${cle} »`);
    if (metadonnees[cle]!.length > LIMITES_METADONNEES.longueurValeur) {
      problemes.push(`valeur de « ${cle} » : ${metadonnees[cle]!.length} caractères`);
    }
  }
  return problemes;
}

/** Relit la partie en clair d'une commande. Null si une clé manque. */
export function lireCommande(metadonnees: Record<string, string>): Commande | null {
  const commande: Commande = {
    reference: metadonnees[CLES.reference] ?? "",
    versionKit: metadonnees[CLES.versionKit] ?? "",
    graine: metadonnees[CLES.graine] ?? "",
    pays: metadonnees[CLES.pays] ?? "",
    versionCgv: metadonnees[CLES.versionCgv] ?? "",
    accordCgv: metadonnees[CLES.accordCgv] ?? "",
    accordAccesImmediat: metadonnees[CLES.accordAccesImmediat] ?? "",
  };
  return Object.values(commande).every((valeur) => valeur !== "") ? commande : null;
}

export type LectureConfiguration =
  | { etat: "lue"; configuration: unknown }
  | { etat: "effacee" }
  | { etat: "illisible" };

/**
 * Recolle et déchiffre la configuration. « illisible » couvre un morceau
 * manquant, un contenu altéré, une autre clé ou un autre contexte.
 */
export function lireConfiguration(metadonnees: Record<string, string>, cleStripe: string): LectureConfiguration {
  if (metadonnees[CLES.etatConfiguration] === CONFIGURATION_EFFACEE) return { etat: "effacee" };
  const commande = lireCommande(metadonnees);
  const nombre = Number(metadonnees[CLES.nombreMorceaux]);
  if (!commande || !Number.isInteger(nombre) || nombre < 1 || nombre > LIMITES_METADONNEES.cles) {
    return { etat: "illisible" };
  }
  const morceaux: string[] = [];
  for (let index = 0; index < nombre; index += 1) {
    const morceau = metadonnees[`${PREFIXE_MORCEAU}${index}`];
    if (!morceau) return { etat: "illisible" };
    morceaux.push(morceau);
  }
  const clair = dechiffrer(morceaux.join(""), cleStripe, contexte(commande));
  if (clair === null) return { etat: "illisible" };
  try {
    return { etat: "lue", configuration: JSON.parse(clair) as unknown };
  } catch {
    return { etat: "illisible" };
  }
}

/** La configuration chiffrée est-elle encore présente ? */
export function configurationPresente(metadonnees: Record<string, string>): boolean {
  return Object.keys(metadonnees).some((cle) => MOTIF_MORCEAU.test(cle) || cle === CLES.nombreMorceaux);
}

/**
 * Les métadonnées à envoyer pour effacer la configuration : chaque morceau
 * reçoit une valeur vide, ce qui supprime la clé chez Stripe, et l'état passe
 * à « effacee ». Tout le reste de la commande est gardé.
 */
export function metadonneesDEffacement(metadonnees: Record<string, string>): Record<string, string> {
  const effacement: Record<string, string> = { [CLES.etatConfiguration]: CONFIGURATION_EFFACEE };
  for (const cle of Object.keys(metadonnees)) {
    if (MOTIF_MORCEAU.test(cle) || cle === CLES.nombreMorceaux) effacement[cle] = "";
  }
  return effacement;
}
