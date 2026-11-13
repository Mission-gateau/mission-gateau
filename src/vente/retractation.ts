import { createHash } from "node:crypto";
import { remplir } from "../engine/texte";
import { EXPEDITEUR } from "../contenu/emails";
import { RETRACTATION } from "../contenu/retractation";
import type { FicheVendeur } from "../contenu/vendeur";
import { emailDeLAcheteur } from "./commande";
import {
  accuseDeReception,
  courrielEnHtml,
  courrielEnTexte,
  type DocumentCourriel,
  type Remboursement,
  type SuiteDonnee,
} from "./courriels";
import {
  ClesDeMarqueEpuisees,
  RelectureDeLaMarqueImpossible,
  ecrireLaMarque,
  issueDUneRetractationBattue,
  issueDeLEcriture,
  type EcritureDeMarque,
} from "./course";
import { dateAParis, heureAParis } from "./dates";
import type { Declaration } from "./declaration";
import { delaiExpire, dernierJourDuDelai } from "./delai";
import type { Dependances } from "./dependances";
import { adresseDEnvoi, sansDoublon } from "./envoi";
import { heureIllisible, marqueRetenue } from "./examen";
import { codesErreur, journal } from "./journal";
import { CLES, estUneCommande, lireSuivi } from "./metadonnees";
import { etatApresUnRemboursement, etatDuRemboursement, remboursementEchoue, type EtatDuRemboursement } from "./remboursement";
import { limiteDeDebit, type ClientStripe, type PaiementLu } from "./stripe";

/**
 * La fonction « Renoncer au contrat ici » (articles L221-21 et D221-5 du Code
 * de la consommation), côté serveur.
 *
 * Une déclaration n'est reçue — traitée, enregistrée s'il y a lieu, accusée
 * par e-mail — que si elle désigne un paiement abouti de cette boutique
 * retrouvé chez Stripe : par la session Checkout quand le lien de la page de
 * la commande la donne (la recherche de Stripe peut ne pas encore connaître
 * un paiement de moins d'une minute), sinon par la recherche sur la
 * référence. Sinon, ou si un appel à Stripe échoue avant que la déclaration
 * soit enregistrée, rien n'est envoyé (l'écriture a pu s'appliquer malgré
 * tout : voir apresUnEchecDEcriture), et la page propose d'envoyer la
 * déclaration par e-mail, depuis la messagerie de la personne.
 *
 * Chaque e-mail de cette fonction est compté, par commande : elle n'envoie
 * jamais que l'accusé de la déclaration qui enregistre la rétractation (clé
 * `accuse-<référence>`) et, pour les autres déclarations, les accusés n° 1 à
 * 3 (clés `accuse-<référence>-1` à `-3`). Aucune autre clé :
 * - la déclaration qui enregistre la rétractation reçoit son accusé ; une
 *   fois parti, `retractation_accuse` retient son identifiant et la suite
 *   qu'il annonçait, et une déclaration identique (même empreinte) n'appelle
 *   plus jamais Resend : la page réaffiche exactement l'accusé parti, à la
 *   même heure. Tant que l'accusé n'est pas enregistré, une déclaration
 *   identique redemande l'envoi sous la même clé ;
 * - toute autre déclaration (rétractation déjà enregistrée par une
 *   déclaration différente, commande déjà téléchargée, délai expiré) reçoit
 *   l'accusé n° n, n = `accuses` + 1 ; au-delà de trois, l'accusé s'affiche
 *   sans partir.
 *
 * Une heure illisible sur le paiement retrouvé (src/vente/examen.ts), à la
 * lecture initiale comme à toute relecture qui décide : la commande est « à
 * examiner ». Rien n'est écrit (ni `retractation`, ni `course`), rien n'est
 * remboursé, et la déclaration reçoit, comme une autre déclaration, l'accusé
 * n° n qui annonce l'examen par le vendeur, dans le même plafond.
 *
 * Premier téléchargement et rétractation qui se croisent : voir
 * src/vente/course.ts. Les journaux ne portent jamais ni nom ni adresse ;
 * seulement, quand le vendeur peut avoir à agir, la référence de la commande.
 */

/** Trois accusés au plus par commande pour les déclarations qui n'enregistrent pas la rétractation. */
export const PLAFOND_ACCUSES = 3;

/** Ce que la page dit d'une déclaration non transmise : aucune commande payée, ou Stripe injoignable. */
export type CauseNonTransmise = "introuvable" | "indisponible";

/**
 * Ce que le journal en dit : aucune commande payée (`introuvable`), écriture
 * de `retractation` impossible (erreur 5xx, ou toutes les clés de la marque
 * épuisées : `ecriture_impossible`), débit limité par Stripe
 * (`stripe_limite`), ou toute autre panne (`stripe_indisponible`).
 */
export type CauseDuJournal = "introuvable" | "ecriture_impossible" | "stripe_limite" | "stripe_indisponible";

export type EnvoiAccuse =
  | { etat: "envoye"; adresse: string; saisie: string; remplacee: boolean }
  | { etat: "echec" }
  /** Trois accusés ont déjà été envoyés ou tentés pour cette commande : celui-ci s'affiche sans partir. */
  | { etat: "plafond" }
  /**
   * L'accusé n'est pas parti, et rien ne garantit qu'il puisse partir sans
   * dépasser le plafond (écriture du compteur incertaine, clé en cours chez
   * Resend) : il s'affiche sans partir.
   */
  | { etat: "non_envoye" }
  /**
   * Resend a déjà reçu, sous la clé de cet accusé, une requête au contenu
   * différent (un accusé parti, ou un envoi en échec, avant que la suite
   * change) : cet accusé a peut-être déjà été envoyé.
   */
  | { etat: "incertain" };

/** Pause imposée avant « Réessayer » après une écriture impossible, en secondes. */
export const ATTENTE_APRES_ECRITURE_IMPOSSIBLE = 60;

export type ReponseRetractation =
  /** Aucune commande payée retrouvée, ou Stripe en panne avant l'enregistrement : rien n'est envoyé. */
  | {
      issue: "non_transmise";
      cause: CauseNonTransmise;
      message: string;
      date: string;
      heure: string;
      mailto: string;
      /** Secondes pendant lesquelles « Réessayer » reste grisé : 60 après une écriture impossible, sinon 0. */
      attente: number;
    }
  /**
   * L'accusé, parti ou non. Quand il n'est pas parti, `mailto` ouvre la
   * messagerie de la personne avec sa déclaration, à l'heure de réception
   * d'origine ; `droitAPreserver` est vrai pour une déclaration « arrivée en
   * même temps » que le premier téléchargement que rien d'autre ne garde :
   * la page l'invite à l'envoyer au vendeur, sans proposer de nouvel essai
   * (qui la referait à une heure nouvelle).
   */
  | { issue: "accuse"; accuse: DocumentCourriel; envoi: EnvoiAccuse; mailto: string | null; droitAPreserver: boolean }
  /**
   * Déclaration identique à celle qui a enregistré la rétractation, dont
   * l'accusé est déjà parti : l'accusé parti, sans nouvel e-mail ; null s'il a
   * été envoyé à la main par le vendeur (son contenu n'est pas connu).
   */
  | { issue: "deja_accusee"; date: string; heure: string; accuse: DocumentCourriel | null }
  /** Resend traite déjà la même clé, et rien n'est encore enregistré : le bouton d'e-mail reste proposé. */
  | { issue: "en_cours"; message: string; mailto: string };

/**
 * L'empreinte d'une déclaration : les 16 premiers caractères hexadécimaux du
 * SHA-256 de ses champs normalisés (nom, prénom, référence, e-mail).
 */
export function empreinteDeDeclaration(declaration: Declaration): string {
  return createHash("sha256")
    .update(JSON.stringify([declaration.nom, declaration.prenom, declaration.reference, declaration.email]))
    .digest("hex")
    .slice(0, 16);
}

/** La clé de l'accusé de la déclaration qui enregistre la rétractation : une seule par commande. */
export function cleDAccuse(reference: string): string {
  return `accuse-${reference}`;
}

/** La clé du n-ième accusé des autres déclarations, n de 1 à 3. */
export function cleDAccuseNumero(reference: string, numero: number): string {
  return `accuse-${reference}-${numero}`;
}

/**
 * La clé d'idempotence, chez Stripe, de l'écriture `accuses` = n : chaque
 * valeur n'est écrite qu'une fois, et toujours après la valeur n - 1 (ou
 * après que sa clé a été prise) : une écriture en retard est rejouée sans
 * effet, et le compteur ne recule jamais.
 */
export function cleDuCompteur(reference: string, numero: number): string {
  return `accuses-${reference}-${numero}`;
}

/**
 * La valeur de `retractation_accuse` : l'identifiant de l'accusé chez Resend,
 * puis la suite qu'il annonçait (`<id>|retractee|<remboursement>`,
 * `<id>|telechargee`, `<id>|simultanee` ou `<id>|manuelle`), pour qu'une
 * déclaration identique réaffiche exactement l'accusé parti, même si le
 * remboursement ou la course ont changé depuis. Le vendeur, qui envoie un
 * accusé à la main, y écrit `manuel`.
 */
export function valeurDeLAccuse(id: string, suite: SuiteDonnee): string {
  return suite.type === "retractee" ? `${id}|retractee|${suite.remboursement}` : `${id}|${suite.type}`;
}

const REMBOURSEMENTS: ReadonlySet<string> = new Set<Remboursement>(["effectue", "demande", "a_venir", "litige"]);

/** La suite qu'annonçait l'accusé parti, relue dans `retractation_accuse` ; null si elle n'y est pas. */
function suiteDeLAccuseParti(valeur: string, paiement: PaiementLu): SuiteDonnee | null {
  const [, type, remboursement] = valeur.split("|");
  const telechargeLe = lireSuivi(paiement.metadonnees).telechargement;
  switch (type) {
    case "retractee":
      return remboursement && REMBOURSEMENTS.has(remboursement)
        ? { type: "retractee", remboursement: remboursement as Remboursement, montant: paiement.montant }
        : null;
    case "telechargee":
    case "simultanee":
      return telechargeLe ? { type, le: telechargeLe } : null;
    case "manuelle":
      return { type: "manuelle" };
    default:
      return null;
  }
}

/** Une seule clé par commande pour son remboursement ; la tâche quotidienne y ajoute le jour de sa tentative. */
export function cleDeRemboursement(reference: string, jour?: string): string {
  return jour ? `retractation-${reference}-${jour}` : `retractation-${reference}`;
}

/** Le remboursement tel que l'accusé le décrit : lu sur les remboursements, ou paiement contesté. */
function remboursementAffiche(paiement: PaiementLu): Remboursement {
  const etat = etatDuRemboursement(paiement);
  if (etat !== "a_venir") return etat;
  return paiement.litige ? "litige" : "a_venir";
}

/**
 * Le lien qui ouvre la messagerie de la personne, vers l'e-mail du vendeur,
 * l'objet et le corps remplis avec sa déclaration : aucun e-mail ne part de
 * ce site, et elle garde sa propre preuve d'envoi.
 */
export function lienDeDeclarationParEmail(declaration: Declaration, faiteLe: Date, fiche: FicheVendeur): string {
  const { courriel } = RETRACTATION;
  const objet = remplir(courriel.objet, { ref: declaration.reference });
  const corps = [
    courriel.declaration,
    "",
    remplir(courriel.nom, { nom: declaration.nom }),
    remplir(courriel.prenom, { prenom: declaration.prenom }),
    remplir(courriel.reference, { ref: declaration.reference }),
    remplir(courriel.email, { email: declaration.email }),
    remplir(courriel.faiteLe, { date: dateAParis(faiteLe), heure: heureAParis(faiteLe) }),
  ].join("\n");
  return `mailto:${fiche.email.trim()}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;
}

interface Contexte {
  declaration: Declaration;
  recueLe: Date;
  reference: string;
  empreinte: string;
  /** Le paiement tel que Stripe l'a rendu à l'arrivée de la déclaration. */
  paiement: PaiementLu;
  client: ClientStripe;
  deps: Dependances;
}

export async function traiterDeclaration(
  entree: { declaration: Declaration; sessionId: string | null },
  deps: Dependances,
): Promise<ReponseRetractation> {
  const { declaration, sessionId } = entree;
  const recueLe = deps.maintenant();
  const { client } = deps;

  // Sans client Stripe (la production sans clé réelle), aucune commande ne
  // peut être retrouvée : la déclaration n'est pas transmise.
  if (!client) return nonTransmise("introuvable", declaration, recueLe, deps.fiche);
  let paiement: PaiementLu | null;
  try {
    paiement = await paiementDeLaDeclaration(client, declaration.reference, sessionId);
  } catch (erreur) {
    return nonTransmise(limiteDeDebit(erreur) ? "stripe_limite" : "stripe_indisponible", declaration, recueLe, deps.fiche);
  }
  if (!paiement) return nonTransmise("introuvable", declaration, recueLe, deps.fiche);

  const contexte: Contexte = {
    declaration,
    recueLe,
    reference: declaration.reference,
    empreinte: empreinteDeDeclaration(declaration),
    paiement,
    client,
    deps,
  };
  return jugerLaDeclaration(contexte, paiement);
}

/**
 * Le paiement abouti de cette boutique que désigne la déclaration, lu à jour
 * chez Stripe ; null si aucun ne correspond. La session n'est retenue que si
 * elle porte la même référence ; sinon, la recherche décide. La session ne
 * porte pas `boutique` : c'est sur le paiement qu'elle est vérifiée.
 */
async function paiementDeLaDeclaration(
  client: ClientStripe,
  reference: string,
  sessionId: string | null,
): Promise<PaiementLu | null> {
  let paiement: PaiementLu | null = null;
  if (sessionId) {
    const session = await client.lireSession(sessionId);
    if (session && session.metadonnees[CLES.reference] === reference && session.paiement) paiement = session.paiement;
  }
  paiement ??= await client.paiementParReference(reference);
  if (!paiement || paiement.statut !== "succeeded" || !estUneCommande(paiement.metadonnees, reference)) return null;
  return paiement;
}

/** Une déclaration jugée sur le paiement tel qu'il vient d'être lu. */
function jugerLaDeclaration(c: Contexte, paiement: PaiementLu): Promise<ReponseRetractation> {
  if (heureIllisible(paiement.metadonnees)) return aExaminer(c, paiement);
  const suivi = lireSuivi(paiement.metadonnees);
  if (suivi.retractation && suivi.empreinteRetractation === c.empreinte) return accuserLaRetractation(c, paiement);
  const retractable =
    !suivi.retractation && !suivi.telechargement && !delaiExpire(new Date(paiement.payeLe * 1000), c.recueLe);
  return retractable ? enregistrerLaRetractation(c, paiement) : accuserUneAutreDeclaration(c, paiement);
}

/**
 * Une heure illisible : la commande est « à examiner ». Rien n'est écrit ni
 * remboursé ; la déclaration reçoit l'accusé qui annonce l'examen par le
 * vendeur (suite `manuelle`), dans le plafond des autres déclarations.
 */
function aExaminer(c: Contexte, paiement: PaiementLu): Promise<ReponseRetractation> {
  journal({ route: "retractation", evenement: "heure_illisible", reference: c.reference });
  return accuserUneAutreDeclaration(c, paiement);
}

function nonTransmise(cause: CauseDuJournal, declaration: Declaration, recueLe: Date, fiche: FicheVendeur): ReponseRetractation {
  // La référence extraite et l'heure, jamais un nom ni une adresse : le vendeur
  // peut ainsi honorer une déclaration faite pendant une panne, ou juste après
  // un paiement que la recherche de Stripe ne voyait pas encore.
  journal({
    route: "retractation",
    evenement: "declaration_non_transmise",
    cause,
    reference: declaration.reference,
    heure: recueLe.toISOString(),
  });
  const affichee: CauseNonTransmise = cause === "introuvable" ? "introuvable" : "indisponible";
  return {
    issue: "non_transmise",
    cause: affichee,
    message: RETRACTATION.nonTransmise[affichee],
    date: dateAParis(recueLe),
    heure: heureAParis(recueLe),
    mailto: lienDeDeclarationParEmail(declaration, recueLe, fiche),
    // Dix tentatives pendant une même panne d'écriture épuiseraient les dix clés de la marque pour 24 heures.
    attente: cause === "ecriture_impossible" ? ATTENTE_APRES_ECRITURE_IMPOSSIBLE : 0,
  };
}

/**
 * La rétractation est valable : `retractation` et l'empreinte sont écrites
 * d'abord, une seule fois (la livraison est aussitôt bloquée), puis la
 * décision se prend sur le paiement renvoyé par cette écriture ; le
 * remboursement ne vient qu'ensuite, et seulement si la rétractation
 * l'emporte. Si une autre déclaration l'a écrite juste avant, celle-ci est
 * jugée sur le paiement relu, sans rien écraser. Si l'écriture échoue, une
 * relecture dit si elle s'est appliquée malgré tout.
 */
async function enregistrerLaRetractation(c: Contexte, paiement: PaiementLu): Promise<ReponseRetractation> {
  let ecriture: EcritureDeMarque;
  try {
    ecriture = await ecrireLaMarque(c.client, paiement, c.reference, "retractation", {
      [CLES.retractation]: c.recueLe.toISOString(),
      [CLES.empreinteRetractation]: c.empreinte,
    });
  } catch (erreur) {
    return apresUnEchecDEcriture(c, paiement, erreur);
  }
  // Une autre requête écrit la marque en ce moment même (409 de Stripe) : un échec d'écriture comme un autre.
  if (ecriture.issue === "en_cours") {
    return apresUnEchecDEcriture(c, paiement, Object.assign(new Error("Une autre requête écrit la marque."), { statusCode: 409 }));
  }
  if (ecriture.issue === "deja_ecrite") return jugerLaDeclaration(c, ecriture.apres);

  let apres = ecriture.apres;
  // Une heure illisible apparue entre la lecture et l'écriture : ni `course`, ni remboursement.
  if (heureIllisible(apres.metadonnees)) return aExaminer(c, apres);
  if (issueDeLEcriture("retractation", apres.metadonnees) === "perd") {
    // Le premier téléchargement a été écrit avant : il l'emporte, sans remboursement.
    try {
      apres = await c.client.modifierMetadonnees(apres.id, { [CLES.course]: "telechargement" });
      journal({ route: "retractation", evenement: "course_perdue", reference: c.reference });
    } catch {
      // Sans `course`, la commande est « à examiner » : l'accusé annonce l'examen par le vendeur.
      journal({ route: "retractation", evenement: "course_non_enregistree", reference: c.reference });
    }
  } else {
    journal({ route: "retractation", evenement: "retractation_enregistree" });
  }
  return accuserLaRetractation(c, apres);
}

/**
 * L'écriture de `retractation` a échoué. Une relecture dit ce qui est
 * enregistré : la marque de cette déclaration (l'écriture s'est appliquée,
 * sa réponse s'est perdue) — la course se décide alors sur cette relecture,
 * sans écrire `course` ; une autre marque — c'est une autre déclaration ;
 * rien, ou la relecture échoue aussi — la déclaration n'est pas transmise,
 * et aucun e-mail ne part.
 */
async function apresUnEchecDEcriture(c: Contexte, paiement: PaiementLu, erreur: unknown): Promise<ReponseRetractation> {
  let frais: PaiementLu | null = null;
  try {
    frais = await c.client.lirePaiement(paiement.id);
  } catch {
    frais = null;
  }
  if (frais) {
    if (heureIllisible(frais.metadonnees)) return aExaminer(c, frais);
    const suivi = lireSuivi(frais.metadonnees);
    if (suivi.retractation && suivi.empreinteRetractation === c.empreinte) {
      journal({ route: "retractation", evenement: "enregistree_malgre_l_echec", reference: c.reference });
      return accuserLaRetractation(c, frais);
    }
    if (suivi.retractation || suivi.telechargement) return accuserUneAutreDeclaration(c, frais);
  }
  return nonTransmise(causeDeLEchec(erreur), c.declaration, c.recueLe, c.deps.fiche);
}

function statutHttp(erreur: unknown): number | null {
  const statut = typeof erreur === "object" && erreur !== null ? (erreur as { statusCode?: unknown }).statusCode : undefined;
  return typeof statut === "number" ? statut : null;
}

function causeDeLEchec(erreur: unknown): CauseDuJournal {
  // La relecture qui suit le refus d'une clé a échoué : une panne de lecture.
  if (erreur instanceof RelectureDeLaMarqueImpossible) return limiteDeDebit(erreur.erreur) ? "stripe_limite" : "stripe_indisponible";
  if (limiteDeDebit(erreur)) return "stripe_limite";
  if (erreur instanceof ClesDeMarqueEpuisees) return "ecriture_impossible";
  return (statutHttp(erreur) ?? 0) >= 500 ? "ecriture_impossible" : "stripe_indisponible";
}

/**
 * La suite donnée à la déclaration qui a enregistré la rétractation, lue sur
 * le paiement : la marque qui l'emporte décide (voir src/vente/course.ts).
 */
async function suiteDeLaRetractation(c: Contexte, paiement: PaiementLu, retracteeLe: Date): Promise<SuiteDonnee> {
  switch (marqueRetenue(paiement.metadonnees)) {
    case "retractation":
      return suiteDuRemboursement(c, paiement);
    case "telechargement":
      return suiteDUneRetractationBattue(retracteeLe, lireSuivi(paiement.metadonnees).telechargement!);
    default:
      // Les deux marques sans `course`, ou une heure illisible : le vendeur examine la commande.
      return { type: "manuelle" };
  }
}

/** Reçue avant le début du premier téléchargement qui l'a emporté : le vendeur tranche. Sinon, le droit avait pris fin. */
function suiteDUneRetractationBattue(recueLe: Date, telechargeLe: Date): SuiteDonnee {
  return { type: issueDUneRetractationBattue(recueLe, telechargeLe), le: telechargeLe };
}

/**
 * Rembourse ce qui reste du paiement (clé `retractation-<référence>`) : tout,
 * ou le reste d'un remboursement partiel fait hors rétractation. Rien s'il
 * est déjà remboursé en totalité, fait ou demandé, s'il est contesté (Stripe
 * n'accepte aucun remboursement hors de la procédure de contestation), ou si
 * un remboursement a déjà échoué (la tâche quotidienne le retente, sous une
 * autre clé). L'accusé donne le montant payé, et ne dit « effectué » qu'une
 * fois tout le montant remboursé.
 */
async function suiteDuRemboursement(c: Contexte, paiement: PaiementLu): Promise<Extract<SuiteDonnee, { type: "retractee" }>> {
  const montant = paiement.montant;
  const affiche = remboursementAffiche(paiement);
  if (affiche !== "a_venir" || remboursementEchoue(paiement)) {
    return { type: "retractee", remboursement: affiche, montant };
  }
  const fait = await rembourserSansPanne(c.deps, paiement, cleDeRemboursement(c.reference));
  return { type: "retractee", remboursement: fait, montant };
}

/**
 * Rembourse ce qui reste du paiement : Stripe, sans montant donné, rembourse
 * le montant qui n'est pas encore remboursé. Rend l'état du paiement après ce
 * remboursement (à venir s'il a échoué).
 */
export async function rembourserSansPanne(deps: Dependances, paiement: PaiementLu, cle: string): Promise<EtatDuRemboursement> {
  if (!deps.client) return "a_venir";
  const reference = paiement.metadonnees[CLES.reference] ?? "";
  try {
    const resultat = await deps.client.rembourser(paiement.id, cle, { [CLES.reference]: reference, motif: "retractation" });
    return etatApresUnRemboursement(paiement, resultat);
  } catch (erreur) {
    journal({ route: "retractation", evenement: "remboursement_impossible", ...codesErreur(erreur) });
    return "a_venir";
  }
}

/**
 * La suite donnée à une déclaration qui n'enregistre pas la rétractation, lue
 * sur le paiement. Reçue après la fin du délai, elle n'est jamais « arrivée en
 * même temps » : le droit s'était éteint au premier téléchargement s'il avait
 * commencé avant la fin du délai ; sinon, le délai était expiré.
 */
function suiteDUneAutreDeclaration(paiement: PaiementLu, recueLe: Date): SuiteDonnee {
  const suivi = lireSuivi(paiement.metadonnees);
  const payeLe = new Date(paiement.payeLe * 1000);
  switch (marqueRetenue(paiement.metadonnees)) {
    case "retractation":
      return {
        type: "deja_retractee",
        le: suivi.retractation!,
        recueLe,
        remboursement: remboursementAffiche(paiement),
        montant: paiement.montant,
      };
    case "telechargement": {
      const telechargeLe = suivi.telechargement!;
      if (delaiExpire(payeLe, recueLe)) {
        return delaiExpire(payeLe, telechargeLe)
          ? { type: "expiree", dernierJour: dernierJourDuDelai(payeLe) }
          : { type: "telechargee", le: telechargeLe };
      }
      // Même trouvé déjà écrit, le premier téléchargement a pu commencer après la réception de cette déclaration.
      return suiteDUneRetractationBattue(recueLe, telechargeLe);
    }
    case "a_examiner":
      return { type: "manuelle" };
    case null:
      return { type: "expiree", dernierJour: dernierJourDuDelai(payeLe) };
  }
}

type ResultatDEnvoi =
  | { type: "envoye"; id: string; envoi: Extract<EnvoiAccuse, { etat: "envoye" }> }
  | { type: "conflit"; raison: "en_cours" | "requete_differente" }
  | { type: "echec" };

/**
 * Envoie un accusé : à l'adresse saisie, en copie cachée à l'adresse de
 * l'acheteur chez Stripe si elle diffère, et au vendeur. Aucun ne voit
 * l'adresse de l'autre, et la réponse ne dit pas si l'adresse saisie est
 * celle de l'acheteur.
 */
async function envoyer(c: Contexte, accuse: DocumentCourriel, cle: string): Promise<ResultatDEnvoi> {
  const { env, fiche, email } = c.deps;
  if (!email) {
    journal({ route: "retractation", evenement: "accuse_non_envoye", code: "sans_cle", reference: c.reference });
    return { type: "echec" };
  }
  const saisie = adresseDEnvoi(c.declaration.email, env, fiche);
  const acheteur = await emailSansPanne(c.deps, c.paiement);
  const acheteurEnCopie = acheteur ? [adresseDEnvoi(acheteur, env, fiche).adresse] : [];
  const resultat = await email.envoyer(
    {
      de: EXPEDITEUR,
      a: [saisie.adresse],
      copieCachee: sansDoublon([saisie.adresse, ...acheteurEnCopie, fiche.email.trim()]).slice(1),
      repondreA: fiche.email.trim(),
      objet: accuse.objet,
      texte: courrielEnTexte(accuse),
      html: courrielEnHtml(accuse),
      piecesJointes: [],
    },
    cle,
  );
  if (resultat.ok) {
    return {
      type: "envoye",
      id: resultat.id,
      envoi: { etat: "envoye", adresse: saisie.adresse, saisie: c.declaration.email, remplacee: saisie.remplacee },
    };
  }
  if (resultat.raison === "en_cours" || resultat.raison === "requete_differente") {
    journal({ route: "retractation", evenement: "accuse_en_conflit", code: resultat.code, reference: c.reference });
    return { type: "conflit", raison: resultat.raison };
  }
  journal({ route: "retractation", evenement: "accuse_non_envoye", code: resultat.code, reference: c.reference });
  return { type: "echec" };
}

async function emailSansPanne(deps: Dependances, paiement: PaiementLu): Promise<string | null> {
  if (!deps.client) return paiement.emailDuDebit;
  try {
    return await emailDeLAcheteur(deps.client, paiement);
  } catch {
    return paiement.emailDuDebit;
  }
}

/**
 * Resend traite en ce moment une requête de même clé : « en cours de
 * traitement », avec le bouton d'e-mail à l'heure de réception d'origine, et
 * la référence au journal.
 */
function enCours(c: Contexte, recueLe: Date): ReponseRetractation {
  journal({ route: "retractation", evenement: "accuse_non_envoye", code: "en_cours", reference: c.reference });
  return { issue: "en_cours", message: RETRACTATION.enCours, mailto: lienDeDeclarationParEmail(c.declaration, recueLe, c.deps.fiche) };
}

/**
 * L'accusé qui n'est pas parti : affiché tel quel, avec le bouton d'e-mail à
 * l'heure de réception d'origine de cette déclaration. Aucun e-mail de plus.
 */
function accuseNonParti(
  c: Contexte,
  accuse: DocumentCourriel,
  envoi: Exclude<EnvoiAccuse, { etat: "envoye" }>,
  recueLe: Date,
  droitAPreserver = false,
): ReponseRetractation {
  return { issue: "accuse", accuse, envoi, mailto: lienDeDeclarationParEmail(c.declaration, recueLe, c.deps.fiche), droitAPreserver };
}

/** L'accusé déjà parti, reconstruit à l'identique d'après la suite gardée dans `retractation_accuse`. */
function dejaAccusee(c: Contexte, paiement: PaiementLu, retracteeLe: Date, valeur: string): ReponseRetractation {
  const suite = suiteDeLAccuseParti(valeur, paiement);
  const accuse = suite ? accuseDeReception({ declaration: c.declaration, recueLe: retracteeLe, suite, fiche: c.deps.fiche }) : null;
  return { issue: "deja_accusee", date: dateAParis(retracteeLe), heure: heureAParis(retracteeLe), accuse };
}

/**
 * L'accusé de la déclaration qui a enregistré la rétractation (ou d'une
 * déclaration identique) : clé `accuse-<référence>`, à l'heure enregistrée
 * dans `retractation`, avec la suite lue sur le paiement. Une fois parti,
 * `retractation_accuse` retient son identifiant et la suite qu'il annonçait ;
 * ensuite, plus aucun appel à Resend : la page réaffiche l'accusé parti.
 */
async function accuserLaRetractation(c: Contexte, paiement: PaiementLu): Promise<ReponseRetractation> {
  const suivi = lireSuivi(paiement.metadonnees);
  const retracteeLe = suivi.retractation!;
  if (suivi.accuseRetractation) {
    journal({ route: "retractation", evenement: "declaration_identique" });
    return dejaAccusee(c, paiement, retracteeLe, suivi.accuseRetractation);
  }
  const suite = await suiteDeLaRetractation(c, paiement, retracteeLe);
  const accuse = accuseDeReception({ declaration: c.declaration, recueLe: retracteeLe, suite, fiche: c.deps.fiche });
  const resultat = await envoyer(c, accuse, cleDAccuse(c.reference));
  if (resultat.type === "envoye") {
    try {
      await c.client.modifierMetadonnees(paiement.id, { [CLES.accuseRetractation]: valeurDeLAccuse(resultat.id, suite) });
    } catch {
      journal({ route: "retractation", evenement: "accuse_non_enregistre", reference: c.reference });
    }
    return { issue: "accuse", accuse, envoi: resultat.envoi, mailto: null, droitAPreserver: false };
  }
  if (resultat.type === "echec") return accuseNonParti(c, accuse, { etat: "echec" }, retracteeLe);
  // 409 : la même clé est en cours chez Resend, ou a déjà servi à un autre
  // contenu. On relit le paiement : si l'accusé y est enregistré, la page le
  // réaffiche ; sinon, rien d'autre ne part, et la page affiche l'accusé
  // recalculé avec le bouton d'e-mail.
  try {
    const frais = await c.client.lirePaiement(paiement.id);
    const relu = frais ? lireSuivi(frais.metadonnees) : null;
    if (frais && relu?.accuseRetractation && relu.empreinteRetractation === c.empreinte) {
      return dejaAccusee(c, frais, retracteeLe, relu.accuseRetractation);
    }
  } catch {
    // Rien de sûr : la suite dépend de ce que Resend a répondu.
  }
  if (resultat.raison === "en_cours") return enCours(c, retracteeLe);
  // La clé a servi à un autre contenu (un envoi en échec avant que la suite change, ou un accusé parti sans
  // que `retractation_accuse` s'écrive) : l'accusé est peut-être parti, jamais « échec ».
  journal({ route: "retractation", evenement: "accuse_non_envoye", code: "incertain", reference: c.reference });
  return accuseNonParti(c, accuse, { etat: "incertain" }, retracteeLe);
}

/**
 * Une déclaration qui n'enregistre rien : nouvelle, avec sa propre heure de
 * réception, et accusée par e-mail dans la limite de trois par commande.
 * L'e-mail n° n (n = `accuses` + 1) part sous la clé `accuse-<référence>-<n>`.
 * Parti, `accuses` passe à n, au mieux. Si Resend dit que la clé du n° n a
 * déjà servi pour une autre requête, ce numéro compte comme parti : `accuses`
 * = n est écrit, puis le n° n + 1 est essayé — mais seulement si Stripe a
 * sûrement pris la clé de cette écriture : succès (ou réponse rejouée), ou
 * réponse 500, que Stripe garde sous la clé. Toute autre réponse (429, 409
 * d'une requête de même clé encore en cours, autre erreur 5xx, réseau coupé)
 * ne le garantit pas : l'accusé s'affiche alors sans partir, avec le bouton
 * d'e-mail, et rien d'autre ne part. La valeur n est ainsi toujours écrite, ou sa clé
 * prise, avant que n + 1 puisse l'être : une écriture en retard est rejouée
 * sans effet, et le compteur ne recule pas.
 */
async function accuserUneAutreDeclaration(c: Contexte, paiement: PaiementLu): Promise<ReponseRetractation> {
  const suite = suiteDUneAutreDeclaration(paiement, c.recueLe);
  const accuse = accuseDeReception({ declaration: c.declaration, recueLe: c.recueLe, suite, fiche: c.deps.fiche });
  // Reçue avant le début du premier téléchargement, mais lue après son écriture : rien ne la garde chez Stripe.
  // Si son accusé ne part pas, la page invite à l'envoyer au vendeur, sans nouvel essai (il serait à une heure nouvelle).
  const droitAPreserver = suite.type === "simultanee";
  const nonParti = (envoi: Exclude<EnvoiAccuse, { etat: "envoye" }>) => accuseNonParti(c, accuse, envoi, c.recueLe, droitAPreserver);
  for (let numero = lireSuivi(paiement.metadonnees).accuses + 1; ; numero += 1) {
    if (numero > PLAFOND_ACCUSES) {
      journal({ route: "retractation", evenement: "accuse_au_plafond" });
      return nonParti({ etat: "plafond" });
    }
    const resultat = await envoyer(c, accuse, cleDAccuseNumero(c.reference, numero));
    if (resultat.type === "envoye") {
      await compterLAccuse(c, paiement.id, numero);
      journal({ route: "retractation", evenement: "accuse_envoye", numero });
      return { issue: "accuse", accuse, envoi: resultat.envoi, mailto: null, droitAPreserver: false };
    }
    if (resultat.type === "echec") return nonParti({ etat: "echec" });
    if (resultat.raison === "en_cours") return droitAPreserver ? nonParti({ etat: "non_envoye" }) : enCours(c, c.recueLe);
    // Ce numéro est déjà parti pour une autre requête : il compte, et l'on passe au suivant, sa clé prise.
    // Sinon (l'écart du lot 7, gardé), l'accusé s'affiche sans partir, sans décision de plus sur le compteur.
    if (!(await compterLAccuse(c, paiement.id, numero))) {
      journal({ route: "retractation", evenement: "accuse_non_envoye", code: "compteur_non_ecrit", reference: c.reference });
      return nonParti({ etat: "non_envoye" });
    }
  }
}

/**
 * Écrit `accuses` = n sous la clé `accuses-<référence>-<n>`, au mieux : ni un
 * échec ni une réponse rejouée ne déclenchent d'e-mail ni ne changent la
 * réponse. Rend vrai quand Stripe a sûrement pris la clé : l'écriture a
 * abouti (ou sa réponse a été rejouée), ou Stripe a répondu 500, réponse
 * qu'il garde sous la clé.
 */
async function compterLAccuse(c: Contexte, idPaiement: string, numero: number): Promise<boolean> {
  try {
    await c.client.modifierMetadonnees(idPaiement, { [CLES.accuses]: String(numero) }, cleDuCompteur(c.reference, numero));
    return true;
  } catch (erreur) {
    journal({ route: "retractation", evenement: "accuses_non_enregistre", reference: c.reference });
    return statutHttp(erreur) === 500;
  }
}
