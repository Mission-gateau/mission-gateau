import type { Configuration } from "../engine/types";
import { chiffrer, dechiffrer, decouper } from "./chiffrement";

/**
 * Ce que Stripe garde d'une commande, dans les métadonnées du paiement.
 *
 * En clair : la boutique, la référence, la version du kit, la graine, le pays
 * déclaré, la version des CGV acceptée et l'heure des deux accords, puis, au
 * fil de la commande, l'heure de l'envoi de la confirmation (et son
 * identifiant chez Resend), celle du premier téléchargement, celle de la
 * rétractation (avec l'empreinte de la déclaration qui l'a enregistrée et
 * l'identifiant de son accusé de réception), la marque qui l'a emporté quand
 * téléchargement et rétractation se sont croisés, le nombre des autres
 * accusés de réception envoyés, et l'heure à laquelle le vendeur a répondu
 * au client d'une commande qu'il a dû examiner. Chiffrée : la configuration
 * complète, découpée en morceaux pour tenir dans les limites de Stripe. Aucune
 * donnée saisie par le parent n'y figure en clair.
 *
 * C'est tout l'état d'une commande : le site n'a pas de base de données.
 */

/** Limites des métadonnées Stripe : 50 clés, 40 caractères par clé, 500 par valeur. */
export const LIMITES_METADONNEES = { cles: 50, longueurCle: 40, longueurValeur: 500 } as const;

/** La valeur de `boutique` : les paiements de ce site, et d'aucun autre produit du même compte Stripe. */
export const BOUTIQUE = "mission-gateau";

export const CLES = {
  /** Toujours « mission-gateau » : la tâche quotidienne ne touche qu'aux paiements qui la portent. */
  boutique: "boutique",
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
  /**
   * Empreinte de la déclaration qui a enregistré la rétractation : les 16
   * premiers caractères hexadécimaux du SHA-256 de ses champs normalisés.
   * Une déclaration identique reçue ensuite reçoit exactement le même accusé.
   */
  empreinteRetractation: "retractation_empreinte",
  /** Identifiant, chez Resend, de l'accusé de réception de cette déclaration. */
  accuseRetractation: "retractation_accuse",
  /**
   * Quand un premier téléchargement et une rétractation se sont croisés : la
   * marque qui l'a emporté (« telechargement » ou « retractation »), écrite
   * par la route qui a perdu (voir src/vente/course.ts).
   */
  course: "course",
  /** Nombre des accusés de réception envoyés aux autres déclarations (3 au plus). */
  accuses: "accuses",
  /**
   * Écrite à la main par le vendeur, date et heure ISO 8601 complètes, après
   * avoir répondu au client d'une commande « arrivée en même temps » ou d'un
   * paiement contesté : la commande quitte ces rubriques de la liste
   * quotidienne des commandes à traiter (voir src/vente/aTraiter.ts).
   */
  examinee: "examinee",
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
  CLES.empreinteRetractation,
  CLES.accuseRetractation,
  CLES.course,
  CLES.accuses,
  CLES.examinee,
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
    [CLES.boutique]: BOUTIQUE,
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

/**
 * Un paiement de cette boutique, qui porte cette référence : un paiement
 * d'un autre produit du même compte Stripe n'est jamais une commande.
 */
export function estUneCommande(metadonnees: Record<string, string>, reference: string): boolean {
  return metadonnees[CLES.reference] === reference && metadonnees[CLES.boutique] === BOUTIQUE;
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

/** Les deux marques qui peuvent se croiser : le premier téléchargement et la rétractation. */
export type Marque = "telechargement" | "retractation";

/** Ce qui est arrivé à une commande après son paiement. */
export interface Suivi {
  /** Envoi de l'e-mail de confirmation. */
  confirmation: Date | null;
  /** Premier téléchargement : l'exécution du contrat a commencé. */
  telechargement: Date | null;
  /** Réception de la déclaration de rétractation. */
  retractation: Date | null;
  /** Empreinte de la déclaration qui a enregistré la rétractation. */
  empreinteRetractation: string | null;
  /** Identifiant de l'accusé de réception de la rétractation, une fois parti. */
  accuseRetractation: string | null;
  /** La marque qui l'a emporté, quand les deux existent ; null si elle n'est pas écrite. */
  course: Marque | null;
  /** Accusés de réception envoyés aux autres déclarations. */
  accuses: number;
  /** Réponse du vendeur au client d'une commande qu'il a dû examiner. */
  examinee: Date | null;
}

/**
 * Une heure écrite par le site, ou par le vendeur dans le tableau de bord de
 * Stripe (rétractation reçue par e-mail ou par courrier, réponse à une
 * commande examinée) : toujours la date et l'heure complètes, ISO 8601 avec
 * le fuseau (par exemple `2026-10-02T09:15:00+02:00`), jamais une date seule,
 * qui se lirait minuit UTC et fausserait la comparaison avec le premier
 * téléchargement. Une valeur illisible compte comme absente.
 */
function lireHeure(valeur: string | undefined): Date | null {
  if (!valeur) return null;
  const heure = new Date(valeur);
  return Number.isNaN(heure.getTime()) ? null : heure;
}

/** Un compteur écrit par le site : un entier positif, sinon zéro. */
function lireCompteur(valeur: string | undefined): number {
  const nombre = Number(valeur);
  return Number.isInteger(nombre) && nombre > 0 ? nombre : 0;
}

export function lireSuivi(metadonnees: Record<string, string>): Suivi {
  const course = metadonnees[CLES.course];
  return {
    confirmation: lireHeure(metadonnees[CLES.confirmation]),
    telechargement: lireHeure(metadonnees[CLES.telechargement]),
    retractation: lireHeure(metadonnees[CLES.retractation]),
    empreinteRetractation: metadonnees[CLES.empreinteRetractation] || null,
    accuseRetractation: metadonnees[CLES.accuseRetractation] || null,
    course: course === "telechargement" || course === "retractation" ? course : null,
    accuses: lireCompteur(metadonnees[CLES.accuses]),
    examinee: lireHeure(metadonnees[CLES.examinee]),
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
