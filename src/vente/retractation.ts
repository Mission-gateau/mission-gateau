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
import { issueDeLEcriture, marqueGagnante } from "./course";
import { dateAParis, heureAParis } from "./dates";
import type { Declaration } from "./declaration";
import { delaiExpire, dernierJourDuDelai } from "./delai";
import type { Dependances } from "./dependances";
import { adresseDEnvoi, sansDoublon } from "./envoi";
import { codesErreur, journal } from "./journal";
import { CLES, lireSuivi } from "./metadonnees";
import { limiteDeDebit, type ClientStripe, type PaiementLu } from "./stripe";

/**
 * La fonction « Renoncer au contrat ici » (articles L221-21 et D221-5 du Code
 * de la consommation), côté serveur.
 *
 * Une déclaration n'est reçue — traitée, enregistrée s'il y a lieu, accusée
 * par e-mail — que si elle désigne un paiement abouti retrouvé chez Stripe :
 * par la session Checkout quand le lien de la page de la commande la donne
 * (la recherche de Stripe peut ne pas encore connaître un paiement de moins
 * d'une minute), sinon par la recherche sur la référence. Sinon, rien n'est
 * enregistré ni envoyé, et la page propose d'envoyer la déclaration par
 * e-mail, depuis la messagerie de la personne. Personne ne peut plus faire
 * écrire ce site à une adresse quelconque sans une commande payée.
 *
 * Une fois la commande retrouvée :
 * - la déclaration qui enregistre la rétractation reçoit toujours son accusé,
 *   sous la clé `accuse-<référence>`. Son empreinte est écrite avec
 *   `retractation` : une déclaration identique reçue ensuite (« Renvoyer »)
 *   reçoit exactement le même accusé, à la même heure, sous la même clé ;
 * - toute autre déclaration (rétractation déjà enregistrée par une autre
 *   déclaration, commande déjà téléchargée, délai expiré) reçoit un accusé
 *   par e-mail dans la limite de trois par commande (`accuses`), sous la clé
 *   `accuse-<référence>-<n>` ; au-delà, l'accusé s'affiche sans partir ;
 * - si une écriture ou une relecture chez Stripe échoue, l'accusé part quand
 *   même, avec le statut « traitée à la main par le vendeur » ; aucun
 *   remboursement automatique.
 *
 * Premier téléchargement et rétractation qui se croisent : voir
 * src/vente/course.ts. Les journaux ne portent jamais ni nom ni adresse ;
 * seulement, quand le vendeur peut avoir à agir, la référence de la commande.
 */

/** Trois accusés au plus par commande pour les déclarations qui n'enregistrent pas la rétractation. */
export const PLAFOND_ACCUSES = 3;

export type CauseNonTransmise = "introuvable" | "indisponible";

export type EnvoiAccuse =
  | { etat: "envoye"; adresse: string; saisie: string; remplacee: boolean }
  | { etat: "echec" }
  /** Trois accusés sont déjà partis pour cette commande : celui-ci s'affiche sans partir. */
  | { etat: "plafond" };

export type ReponseRetractation =
  /** Aucune commande payée retrouvée, ou Stripe injoignable : rien n'est enregistré ni envoyé. */
  | { issue: "non_transmise"; cause: CauseNonTransmise; message: string; date: string; heure: string; mailto: string }
  | { issue: "accuse"; accuse: DocumentCourriel; envoi: EnvoiAccuse }
  /** Cette déclaration est déjà enregistrée, et son accusé est déjà parti. */
  | { issue: "deja_accusee"; date: string; heure: string }
  /** Resend traite déjà la même clé, et rien n'est encore enregistré. */
  | { issue: "en_cours"; message: string };

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

/** La clé d'un accusé « traitée à la main » : propre à cette déclaration, reçue à cette heure. */
export function cleDAccuseManuel(reference: string, empreinte: string, recueLe: Date): string {
  const suffixe = createHash("sha256").update(`${empreinte}|${recueLe.toISOString()}`).digest("hex").slice(0, 16);
  return `accuse-${reference}-manuel-${suffixe}`;
}

/** Une seule clé par commande pour son remboursement ; la tâche quotidienne y ajoute le jour de sa tentative. */
export function cleDeRemboursement(reference: string, jour?: string): string {
  return jour ? `retractation-${reference}-${jour}` : `retractation-${reference}`;
}

function etatDuRemboursement(paiement: PaiementLu): Remboursement {
  if (paiement.rembourseEnTotalite) return "effectue";
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
  const suivi = lireSuivi(paiement.metadonnees);
  if (suivi.retractation && suivi.empreinteRetractation === contexte.empreinte) {
    return renvoyerLAccuseDeLaRetractation(contexte, suivi.retractation);
  }
  const retractable =
    !suivi.retractation && !suivi.telechargement && !delaiExpire(new Date(paiement.payeLe * 1000), recueLe);
  return retractable ? enregistrerLaRetractation(contexte) : accuserUneAutreDeclaration(contexte);
}

/**
 * Le paiement abouti que désigne la déclaration, lu à jour chez Stripe ; null
 * si aucun ne correspond. La session n'est retenue que si elle porte la même
 * référence ; sinon, la recherche décide.
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
  if (!paiement || paiement.statut !== "succeeded" || paiement.metadonnees[CLES.reference] !== reference) return null;
  return paiement;
}

function nonTransmise(
  cause: "introuvable" | "stripe_indisponible" | "stripe_limite",
  declaration: Declaration,
  recueLe: Date,
  fiche: FicheVendeur,
): ReponseRetractation {
  // Le vendeur peut ainsi honorer une déclaration faite pendant une panne.
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
  };
}

/**
 * La rétractation est valable : `retractation` et l'empreinte sont écrites
 * d'abord (la livraison est aussitôt bloquée), puis la décision se prend sur
 * le paiement renvoyé par cette écriture ; le remboursement ne vient
 * qu'ensuite, et seulement si la rétractation l'emporte.
 */
async function enregistrerLaRetractation(c: Contexte): Promise<ReponseRetractation> {
  let apres: PaiementLu;
  try {
    apres = await c.client.modifierMetadonnees(c.paiement.id, {
      [CLES.retractation]: c.recueLe.toISOString(),
      [CLES.empreinteRetractation]: c.empreinte,
    });
  } catch {
    // Rien ne bloque la livraison : la déclaration part au vendeur, à traiter à la main.
    journal({ route: "retractation", evenement: "enregistrement_impossible", reference: c.reference });
    return accuserSansEnregistrement(c, { type: "manuelle" });
  }

  if (issueDeLEcriture("retractation", apres.metadonnees) === "perd") {
    // Le premier téléchargement a été écrit avant : il l'emporte, sans remboursement.
    const telechargeLe = lireSuivi(apres.metadonnees).telechargement!;
    let suite: SuiteDonnee;
    try {
      apres = await c.client.modifierMetadonnees(c.paiement.id, { [CLES.course]: "telechargement" });
      suite = suiteDUneRetractationBattue(c.recueLe, telechargeLe);
      journal({ route: "retractation", evenement: "course_perdue", reference: c.reference });
    } catch {
      journal({ route: "retractation", evenement: "course_non_enregistree", reference: c.reference });
      suite = { type: "manuelle" };
    }
    return accuserLaRetractation(c, apres, c.recueLe, suite);
  }

  const suite = await suiteDuRemboursement(c, apres);
  journal({ route: "retractation", evenement: "retractation_enregistree", remboursement: suite.remboursement });
  return accuserLaRetractation(c, apres, c.recueLe, suite);
}

/**
 * Une déclaration identique à celle qui a enregistré la rétractation : le
 * même accusé, à l'heure enregistrée, sous la même clé, hors plafond.
 */
async function renvoyerLAccuseDeLaRetractation(c: Contexte, retracteeLe: Date): Promise<ReponseRetractation> {
  const gagnante = marqueGagnante(c.paiement.metadonnees);
  let suite: SuiteDonnee;
  if (gagnante === "retractation") suite = await suiteDuRemboursement(c, c.paiement);
  else if (gagnante === "telechargement") {
    suite = suiteDUneRetractationBattue(retracteeLe, lireSuivi(c.paiement.metadonnees).telechargement!);
  } else suite = { type: "manuelle" };
  journal({ route: "retractation", evenement: "declaration_identique" });
  return accuserLaRetractation(c, c.paiement, retracteeLe, suite);
}

/** Reçue avant le début du premier téléchargement qui l'a emporté : le vendeur tranche. Sinon, le droit avait pris fin. */
function suiteDUneRetractationBattue(recueLe: Date, telechargeLe: Date): SuiteDonnee {
  return recueLe.getTime() < telechargeLe.getTime()
    ? { type: "simultanee", le: telechargeLe }
    : { type: "telechargee", le: telechargeLe };
}

/** Rembourse la totalité du paiement, sauf s'il l'est déjà ou s'il est contesté. Clé : `retractation-<référence>`. */
async function suiteDuRemboursement(
  c: Contexte,
  paiement: PaiementLu,
): Promise<Extract<SuiteDonnee, { type: "retractee" }>> {
  const montant = paiement.montant;
  if (paiement.rembourseEnTotalite) return { type: "retractee", remboursement: "effectue", montant };
  if (paiement.litige) return { type: "retractee", remboursement: "litige", montant };
  const fait = await rembourserSansPanne(c.deps, paiement, cleDeRemboursement(c.reference));
  return { type: "retractee", remboursement: fait ? "effectue" : "a_venir", montant };
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

/** La suite donnée à une déclaration qui n'enregistre pas la rétractation, lue sur le paiement. */
function suiteDUneAutreDeclaration(paiement: PaiementLu, recueLe: Date): SuiteDonnee {
  const suivi = lireSuivi(paiement.metadonnees);
  switch (marqueGagnante(paiement.metadonnees)) {
    case "retractation":
      return {
        type: "deja_retractee",
        le: suivi.retractation!,
        recueLe,
        remboursement: etatDuRemboursement(paiement),
        montant: paiement.montant,
      };
    case "telechargement":
      return { type: "telechargee", le: suivi.telechargement! };
    case "a_examiner":
      return { type: "manuelle" };
    case null:
      return { type: "expiree", dernierJour: dernierJourDuDelai(new Date(paiement.payeLe * 1000)) };
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
    journal({ route: "retractation", evenement: "accuse_en_conflit", code: resultat.code });
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

function enCours(): ReponseRetractation {
  return { issue: "en_cours", message: RETRACTATION.enCours };
}

/**
 * L'accusé de la déclaration qui a écrit `retractation` : clé
 * `accuse-<référence>`, hors plafond. Une fois parti, `retractation_accuse`
 * retient son identifiant.
 */
async function accuserLaRetractation(
  c: Contexte,
  paiement: PaiementLu,
  recueLe: Date,
  suite: SuiteDonnee,
): Promise<ReponseRetractation> {
  const accuse = accuseDeReception({ declaration: c.declaration, recueLe, suite, fiche: c.deps.fiche });
  const resultat = await envoyer(c, accuse, cleDAccuse(c.reference));
  if (resultat.type === "envoye") {
    try {
      await c.client.modifierMetadonnees(paiement.id, { [CLES.accuseRetractation]: resultat.id });
    } catch {
      journal({ route: "retractation", evenement: "accuse_non_enregistre", reference: c.reference });
    }
    return { issue: "accuse", accuse, envoi: resultat.envoi };
  }
  if (resultat.type === "echec") return { issue: "accuse", accuse, envoi: { etat: "echec" } };
  // 409 : la même clé est en cours chez Resend, ou a déjà servi. On relit le
  // paiement et on répond selon ce qui est enregistré.
  try {
    const frais = await c.client.lirePaiement(paiement.id);
    const suivi = frais ? lireSuivi(frais.metadonnees) : null;
    if (suivi?.retractation && suivi.accuseRetractation) {
      return { issue: "deja_accusee", date: dateAParis(suivi.retractation), heure: heureAParis(suivi.retractation) };
    }
  } catch {
    // Rien de sûr à dire : la déclaration est en cours de traitement.
  }
  return enCours();
}

/** Un accusé « traitée à la main », quand rien n'a pu être enregistré : hors plafond, sous une clé propre à la déclaration. */
async function accuserSansEnregistrement(c: Contexte, suite: SuiteDonnee): Promise<ReponseRetractation> {
  const accuse = accuseDeReception({ declaration: c.declaration, recueLe: c.recueLe, suite, fiche: c.deps.fiche });
  const resultat = await envoyer(c, accuse, cleDAccuseManuel(c.reference, c.empreinte, c.recueLe));
  if (resultat.type === "envoye") return { issue: "accuse", accuse, envoi: resultat.envoi };
  if (resultat.type === "echec") return { issue: "accuse", accuse, envoi: { etat: "echec" } };
  return enCours();
}

/**
 * Une déclaration qui n'enregistre rien : nouvelle, avec sa propre heure de
 * réception, et accusée par e-mail dans la limite de trois par commande.
 * L'e-mail n° n (n = `accuses` + 1) part sous la clé `accuse-<référence>-<n>`,
 * puis `accuses` passe à n. Resend n'envoie qu'une fois une même clé : même
 * avec des déclarations simultanées, trois accusés au plus partent.
 */
async function accuserUneAutreDeclaration(c: Contexte): Promise<ReponseRetractation> {
  let paiement = c.paiement;
  for (let tentative = 0; tentative < 2; tentative += 1) {
    const accuse = accuseDeReception({
      declaration: c.declaration,
      recueLe: c.recueLe,
      suite: suiteDUneAutreDeclaration(paiement, c.recueLe),
      fiche: c.deps.fiche,
    });
    const numero = lireSuivi(paiement.metadonnees).accuses + 1;
    if (numero > PLAFOND_ACCUSES) {
      journal({ route: "retractation", evenement: "accuse_au_plafond" });
      return { issue: "accuse", accuse, envoi: { etat: "plafond" } };
    }
    const resultat = await envoyer(c, accuse, cleDAccuseNumero(c.reference, numero));
    if (resultat.type === "envoye") {
      try {
        await c.client.modifierMetadonnees(paiement.id, { [CLES.accuses]: String(numero) });
      } catch {
        journal({ route: "retractation", evenement: "accuses_non_enregistre", reference: c.reference });
      }
      journal({ route: "retractation", evenement: "accuse_envoye", numero });
      return { issue: "accuse", accuse, envoi: resultat.envoi };
    }
    if (resultat.type === "echec") return { issue: "accuse", accuse, envoi: { etat: "echec" } };
    if (tentative > 0) break;
    // 409 : on relit le paiement et on décide sur ce qui est enregistré.
    try {
      const frais = await c.client.lirePaiement(paiement.id);
      if (!frais) break;
      paiement = frais;
      if (resultat.raison === "requete_differente" && lireSuivi(frais.metadonnees).accuses < numero) {
        // La clé de ce numéro a déjà servi : cet accusé compte, même si son compteur n'a pas été écrit.
        paiement = await c.client.modifierMetadonnees(frais.id, { [CLES.accuses]: String(numero) });
      }
    } catch {
      break;
    }
    // Rien n'est encore enregistré pour ce numéro : un autre envoi est en cours.
    if (lireSuivi(paiement.metadonnees).accuses < numero) break;
  }
  return enCours();
}
