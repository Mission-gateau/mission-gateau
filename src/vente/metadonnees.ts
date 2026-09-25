import type { Configuration } from "../engine/types";
import { chiffrer, dechiffrer, decouper } from "./chiffrement";

/**
 * Ce que Stripe garde d'une commande, dans les métadonnées du paiement.
 *
 * En clair : la référence, la version du kit, la graine, le pays déclaré, la
 * version des CGV acceptée et l'heure des deux accords, puis, au fil de la
 * commande, l'heure de l'envoi de la confirmation (et son identifiant chez
 * Resend), celle du premier téléchargement et celle de la rétractation (et
 * l'identifiant de son accusé de réception). Chiffrée : la configuration
 * complète, découpée en morceaux pour tenir dans les limites de Stripe. Aucune
 * donnée saisie par le parent n'y figure en clair.
 *
 * C'est tout l'état d'une commande : le site n'a pas de base de données.
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
  /** Heure du serveur à l'envoi de l'e-mail de confirmation, ISO 8601. */
  confirmation: "confirmation",
  /** Identifiant de cet e-mail chez Resend. */
  confirmationId: "confirmation_id",
  /** Heure du serveur au premier téléchargement : l'exécution a commencé. */
  telechargement: "telechargement",
  /** Heure de réception de la déclaration de rétractation, ISO 8601. */
  retractation: "retractation",
  /** Identifiant, chez Resend, de l'accusé de réception de cette déclaration. */
  accuseRetractation: "retractation_accuse",
} as const;

/**
 * Les clés écrites après le paiement. Elles comptent dès la création de la
 * commande : la commande doit pouvoir les recevoir toutes sans dépasser les
 * 50 clés de Stripe.
 */
export const CLES_APRES_PAIEMENT = [
  CLES.confirmation,
  CLES.confirmationId,
  CLES.telechargement,
  CLES.retractation,
  CLES.accuseRetractation,
] as const;

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

/**
 * Les dépassements des limites de Stripe. Vide quand tout tient. Les clés
 * écrites après le paiement sont comptées d'avance.
 */
export function depassementsDeMetadonnees(metadonnees: Record<string, string>): string[] {
  const problemes: string[] = [];
  const cles = Object.keys(metadonnees);
  const total = new Set([...cles, ...CLES_APRES_PAIEMENT]).size;
  if (total > LIMITES_METADONNEES.cles) {
    problemes.push(`${total} clés, dont celles écrites après le paiement, pour ${LIMITES_METADONNEES.cles} au plus`);
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

/** Ce qui est arrivé à une commande après son paiement. */
export interface Suivi {
  /** Envoi de l'e-mail de confirmation. */
  confirmation: Date | null;
  /** Premier téléchargement : l'exécution du contrat a commencé. */
  telechargement: Date | null;
  /** Réception de la déclaration de rétractation. */
  retractation: Date | null;
  /** Identifiant de l'accusé de réception de la rétractation, une fois parti. */
  accuseRetractation: string | null;
}

/**
 * Une heure écrite par le site (ISO 8601) ou, pour une rétractation reçue par
 * e-mail ou par courrier, par le vendeur dans le tableau de bord de Stripe
 * (une date ISO suffit). Une valeur illisible compte comme absente.
 */
function lireHeure(valeur: string | undefined): Date | null {
  if (!valeur) return null;
  const heure = new Date(valeur);
  return Number.isNaN(heure.getTime()) ? null : heure;
}

export function lireSuivi(metadonnees: Record<string, string>): Suivi {
  return {
    confirmation: lireHeure(metadonnees[CLES.confirmation]),
    telechargement: lireHeure(metadonnees[CLES.telechargement]),
    retractation: lireHeure(metadonnees[CLES.retractation]),
    accuseRetractation: metadonnees[CLES.accuseRetractation] || null,
  };
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
