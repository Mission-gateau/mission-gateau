import { createHash } from "node:crypto";
import { z } from "zod";
import { EXPEDITEUR } from "../contenu/emails";
import { emailDeLAcheteur } from "./commande";
import {
  accuseDeReception,
  courrielEnHtml,
  courrielEnTexte,
  type Declaration,
  type DocumentCourriel,
  type SuiteDonnee,
} from "./courriels";
import { dateAParis, heureAParis } from "./dates";
import { delaiExpire, dernierJourDuDelai } from "./delai";
import type { Dependances } from "./dependances";
import { adresseDEnvoi, sansDoublon } from "./envoi";
import { codesErreur, journal } from "./journal";
import { CLES, lireSuivi } from "./metadonnees";
import { referenceValide } from "./reference";
import type { PaiementLu } from "./stripe";

/**
 * La fonction « Renoncer au contrat ici » (articles L221-21 et D221-5 du Code
 * de la consommation), côté serveur.
 *
 * L'heure de réception par le serveur est la date et l'heure de l'envoi de la
 * déclaration. La commande est cherchée par sa référence et jugée sur le
 * paiement lui-même, jamais sur l'état de la page de commande, qui répond
 * « expirée », « autre version » ou « illisible » avant toute question de
 * rétractation. Chaque déclaration reçoit un accusé de réception, sans délai,
 * à l'adresse saisie (et à celle de l'acheteur chez Stripe, en copie cachée,
 * si elle diffère), avec une copie cachée au vendeur. Une commande n'est
 * remboursée qu'une fois, et ne reçoit qu'un accusé de sa rétractation.
 */

/** Ce que le formulaire envoie. `champ_libre` est le piège à robots : un humain le laisse vide. */
export const schemaDeclaration = z
  .object({
    nom: z.string().trim().min(1).max(100),
    prenom: z.string().trim().min(1).max(100),
    reference: z.string().trim().min(1).max(300),
    email: z.string().trim().max(254).pipe(z.email()),
    champ_libre: z.string().max(500).optional(),
  })
  .strict();

/**
 * La référence d'une commande dans ce qu'a saisi l'acheteur : la référence
 * seule, ou le lien complet de la commande. Null si rien n'y ressemble.
 */
export function extraireReference(saisie: string): string | null {
  const propre = saisie.trim();
  if (referenceValide(propre)) return propre;
  const trouve = /\/commande\/([A-Za-z0-9_-]{22})(?![A-Za-z0-9_-])/.exec(propre);
  return trouve && referenceValide(trouve[1]) ? trouve[1] : null;
}

export type EtatRemboursement = "effectue" | "a_venir" | "litige";

export type EnvoiAccuse =
  | { etat: "envoye"; adresse: string; saisie: string; remplacee: boolean; copieAcheteur: boolean }
  | { etat: "echec" };

export type ReponseRetractation =
  | {
      issue: "accuse";
      accuse: DocumentCourriel;
      envoi: EnvoiAccuse;
    }
  | {
      issue: "deja_enregistree";
      date: string;
      heure: string;
      remboursement: EtatRemboursement;
    };

/** Une seule clé par commande pour l'accusé de sa rétractation : un seul e-mail. */
export function cleDAccuse(reference: string): string {
  return `accuse-${reference}`;
}

/** Une seule clé par commande pour son remboursement ; la tâche quotidienne y ajoute le jour de sa tentative. */
export function cleDeRemboursement(reference: string, jour?: string): string {
  return jour ? `retractation-${reference}-${jour}` : `retractation-${reference}`;
}

function etatDuRemboursement(paiement: PaiementLu): EtatRemboursement {
  if (paiement.rembourseEnTotalite) return "effectue";
  return paiement.litige ? "litige" : "a_venir";
}

export async function traiterDeclaration(declaration: Declaration, deps: Dependances): Promise<ReponseRetractation> {
  const recueLe = deps.maintenant();
  const reference = extraireReference(declaration.reference);
  const { client } = deps;

  let paiement: PaiementLu | null = null;
  if (reference && client) {
    try {
      const trouve = await client.paiementParReference(reference);
      if (trouve && trouve.statut === "succeeded" && trouve.metadonnees[CLES.reference] === reference) paiement = trouve;
    } catch {
      journal({ route: "retractation", evenement: "stripe_indisponible" });
    }
  }
  if (!paiement || !reference || !client) {
    journal({ route: "retractation", evenement: "declaration_non_reliee" });
    return accuser({ declaration, recueLe, suite: { type: "non_reliee" }, acheteur: null, cle: cleUnique(declaration, recueLe), deps });
  }

  const acheteur = await emailSansPanne(deps, paiement);
  const suivi = lireSuivi(paiement.metadonnees);

  // Rétractation déjà enregistrée : ni second remboursement, ni second e-mail.
  if (suivi.retractation) {
    if (suivi.accuseRetractation) {
      journal({ route: "retractation", evenement: "deja_enregistree" });
      return {
        issue: "deja_enregistree",
        date: dateAParis(suivi.retractation),
        heure: heureAParis(suivi.retractation),
        remboursement: etatDuRemboursement(paiement),
      };
    }
    // L'accusé de la rétractation enregistrée n'est pas encore parti : on le
    // (r)envoie, avec l'heure enregistrée et la même clé.
    const suite: SuiteDonnee = {
      type: "retractee",
      remboursement: etatDuRemboursement(paiement),
      montant: paiement.montant,
    };
    return accuserRetractation({ declaration, recueLe: suivi.retractation, suite, acheteur, paiement, reference, deps });
  }

  if (suivi.telechargement) {
    journal({ route: "retractation", evenement: "apres_telechargement" });
    const suite: SuiteDonnee = { type: "telechargee", le: suivi.telechargement };
    return accuser({ declaration, recueLe, suite, acheteur, cle: cleUnique(declaration, recueLe), deps });
  }

  const payeeLe = new Date(paiement.payeLe * 1000);
  if (delaiExpire(payeeLe, recueLe)) {
    journal({ route: "retractation", evenement: "delai_expire" });
    const suite: SuiteDonnee = { type: "expiree", dernierJour: dernierJourDuDelai(payeeLe) };
    return accuser({ declaration, recueLe, suite, acheteur, cle: cleUnique(declaration, recueLe), deps });
  }

  // La rétractation est valable : on l'enregistre d'abord (la livraison est
  // aussitôt bloquée), puis on rembourse.
  try {
    await client.modifierMetadonnees(paiement.id, { [CLES.retractation]: recueLe.toISOString() });
  } catch {
    // Sans cet enregistrement, rien ne bloque la livraison : la déclaration
    // part au vendeur pour être traitée à la main.
    journal({ route: "retractation", evenement: "enregistrement_impossible" });
    return accuser({ declaration, recueLe, suite: { type: "non_reliee" }, acheteur, cle: cleUnique(declaration, recueLe), deps });
  }

  let remboursement: SuiteDonnee & { type: "retractee" };
  if (paiement.rembourseEnTotalite) {
    remboursement = { type: "retractee", remboursement: "deja_rembourse", montant: paiement.montant };
  } else if (paiement.litige) {
    remboursement = { type: "retractee", remboursement: "litige", montant: paiement.montant };
  } else {
    const fait = await rembourserSansPanne(deps, paiement, cleDeRemboursement(reference));
    remboursement = { type: "retractee", remboursement: fait ? "effectue" : "a_venir", montant: paiement.montant };
  }
  journal({ route: "retractation", evenement: "retractation_enregistree", remboursement: remboursement.remboursement });
  return accuserRetractation({ declaration, recueLe, suite: remboursement, acheteur, paiement, reference, deps });
}

/** Rembourse la totalité du paiement ; vrai si Stripe l'a fait (ou le fait). */
export async function rembourserSansPanne(deps: Dependances, paiement: PaiementLu, cle: string): Promise<boolean> {
  if (!deps.client) return false;
  const reference = paiement.metadonnees[CLES.reference] ?? "";
  try {
    const resultat = await deps.client.rembourser(paiement.id, cle, { [CLES.reference]: reference, motif: "retractation" });
    return resultat.statut === "succeeded" || resultat.statut === "pending";
  } catch (erreur) {
    journal({ route: "retractation", evenement: "remboursement_impossible", ...codesErreur(erreur) });
    return false;
  }
}

async function emailSansPanne(deps: Dependances, paiement: PaiementLu): Promise<string | null> {
  if (!deps.client) return null;
  try {
    return await emailDeLAcheteur(deps.client, paiement);
  } catch {
    return paiement.emailDuDebit;
  }
}

/** Une clé propre à une déclaration : sa réception à la milliseconde près. */
function cleUnique(declaration: Declaration, recueLe: Date): string {
  const empreinte = createHash("sha256")
    .update(JSON.stringify([declaration.nom, declaration.prenom, declaration.reference, declaration.email, recueLe.toISOString()]))
    .digest("hex");
  return `accuse-${empreinte}`;
}

async function accuserRetractation(entree: {
  declaration: Declaration;
  recueLe: Date;
  suite: SuiteDonnee;
  acheteur: string | null;
  paiement: PaiementLu;
  reference: string;
  deps: Dependances;
}): Promise<ReponseRetractation> {
  const { reponse, idEnvoi } = await envoyerAccuse({ ...entree, cle: cleDAccuse(entree.reference) });
  // La marque de l'accusé : une nouvelle déclaration sur cette commande ne
  // renverra plus d'e-mail. Un envoi simultané de même clé la posera lui-même.
  if (idEnvoi && entree.deps.client) {
    try {
      await entree.deps.client.modifierMetadonnees(entree.paiement.id, { [CLES.accuseRetractation]: idEnvoi });
    } catch {
      journal({ route: "retractation", evenement: "accuse_non_enregistre" });
    }
  }
  return reponse;
}

async function accuser(entree: {
  declaration: Declaration;
  recueLe: Date;
  suite: SuiteDonnee;
  acheteur: string | null;
  cle: string;
  deps: Dependances;
}): Promise<ReponseRetractation> {
  return (await envoyerAccuse(entree)).reponse;
}

async function envoyerAccuse(entree: {
  declaration: Declaration;
  recueLe: Date;
  suite: SuiteDonnee;
  acheteur: string | null;
  cle: string;
  deps: Dependances;
}): Promise<{ reponse: ReponseRetractation; idEnvoi: string | null }> {
  const { declaration, recueLe, suite, acheteur, cle, deps } = entree;
  const { env, fiche, email } = deps;
  const accuse = accuseDeReception({ declaration, recueLe, suite, fiche });
  const saisie = adresseDEnvoi(declaration.email, env, fiche);
  const copieAcheteur = acheteur ? adresseDEnvoi(acheteur, env, fiche).adresse : null;
  const acheteurEnCopie = copieAcheteur !== null && copieAcheteur.toLowerCase() !== saisie.adresse.toLowerCase();
  // L'adresse saisie en destinataire ; l'acheteur (s'il diffère) et le
  // vendeur en copie cachée : aucun ne voit l'adresse de l'autre.
  const copies = sansDoublon([saisie.adresse, ...(acheteurEnCopie ? [copieAcheteur] : []), fiche.email.trim()]).slice(1);
  const echec = { reponse: { issue: "accuse", accuse, envoi: { etat: "echec" } } as ReponseRetractation, idEnvoi: null };
  if (!email) {
    journal({ route: "retractation", evenement: "envoi_sans_cle" });
    return echec;
  }
  const resultat = await email.envoyer(
    {
      de: EXPEDITEUR,
      a: [saisie.adresse],
      copieCachee: copies,
      repondreA: fiche.email.trim(),
      objet: accuse.objet,
      texte: courrielEnTexte(accuse),
      html: courrielEnHtml(accuse),
      piecesJointes: [],
    },
    cle,
  );
  // « En cours » : une requête simultanée de même clé envoie ce même e-mail.
  if (!resultat.ok && resultat.raison !== "en_cours") {
    journal({ route: "retractation", evenement: "accuse_non_envoye", code: resultat.code });
    return echec;
  }
  return {
    reponse: {
      issue: "accuse",
      accuse,
      envoi: {
        etat: "envoye",
        adresse: saisie.adresse,
        saisie: declaration.email,
        remplacee: saisie.remplacee,
        copieAcheteur: acheteurEnCopie,
      },
    },
    idEnvoi: resultat.ok ? resultat.id : null,
  };
}
