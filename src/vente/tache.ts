import { timingSafeEqual } from "node:crypto";
import { EXPEDITEUR } from "../contenu/emails";
import { candidatALaListe, cleDeLaListe, courrielDeLaListe, listeATraiter, listeIncomplete, tailleDeLaListe } from "./aTraiter";
import { etatDuPaiement } from "./commande";
import { envoyerLaConfirmation } from "./confirmation";
import { courrielEnHtml, courrielEnTexte } from "./courriels";
import { marqueRetenue } from "./examen";
import type { Dependances } from "./dependances";
import { bilanVide, effacerLesConfigurationsAnciennes, toutesLesPages, type BilanEffacement } from "./effacement";
import { adresseDEnvoi } from "./envoi";
import type { Environnement } from "./environnement";
import { journal } from "./journal";
import { BOUTIQUE, CLES, estUneCommande, lireSuivi } from "./metadonnees";
import { rembourseEnTotalite } from "./remboursement";
import { cleDeRemboursement, rembourserSansPanne } from "./retractation";
import type { ClientStripe, PaiementLu } from "./stripe";

/**
 * La tâche quotidienne (cron Vercel, déclaré dans vercel.json), en quatre
 * phases, chacune écrivant sa ligne de journal dès qu'elle finit, même en
 * échec : un dépassement de durée ne fait pas perdre les compteurs des phases
 * déjà faites.
 * 1. `effacement` : la configuration chiffrée des paiements de plus de 30
 *    jours, comme avant ;
 * 2. `confirmations` : la confirmation des commandes payées depuis plus d'une
 *    heure qui n'en ont pas — sauf celles rétractées, remboursées, en litige
 *    ou à examiner — pour l'acheteur qui n'est pas revenu sur le site, sans
 *    jamais en envoyer deux (voir src/vente/confirmation.ts) ;
 * 3. `remboursements` : le remboursement des rétractations qui l'ont emporté
 *    (voir src/vente/course.ts) et dont les remboursements faits ou demandés
 *    ne couvrent pas le montant payé (Stripe rembourse alors le reste ; un
 *    remboursement `failed` ou `canceled` est retenté), hors litige ;
 * 4. `a_traiter` : la liste des commandes qui attendent une action du
 *    vendeur, envoyée par e-mail au vendeur s'il y en a au moins une (voir
 *    src/vente/aTraiter.ts). Si la recherche ou une relecture a échoué, la
 *    liste part quand même, une ligne en tête disant qu'elle est incomplète.
 *
 * Les phases 2 à 4 ne voient que les paiements de cette boutique
 * (`boutique` = `mission-gateau`, exigé dans la recherche puis revérifié).
 * Elle n'agit que si la requête porte le secret de CRON_SECRET, que Vercel
 * envoie de lui-même. Ses compteurs ne partent que dans les journaux.
 */

export interface BilanConfirmations {
  paiementsAboutisExamines: number;
  confirmationsEnvoyees: number;
  confirmationsDejaFaites: number;
  confirmationsTropRecentes: number;
  confirmationsExclues: number;
  confirmationsEnCours: number;
  confirmationsEchouees: number;
  confirmationsNonEnregistrees: number;
  confirmationsImpossibles: number;
  erreurs: number;
}

export interface BilanRemboursements {
  retractationsExaminees: number;
  remboursementsRetentes: number;
  /** Remboursements effectués (`succeeded`). */
  remboursementsReussis: number;
  /** Remboursements demandés, pas encore réglés (`pending`, `requires_action`). */
  remboursementsDemandes: number;
  remboursementsEchoues: number;
  /** Rétractations qui ont perdu la course, ou croisements à examiner : jamais remboursées ici. */
  remboursementsExclus: number;
  erreurs: number;
}

export interface BilanATraiter {
  /** Paiements relus : ceux qui portent une rétractation ou une contestation. */
  commandesRelues: number;
  aExaminer: number;
  simultanees: number;
  accuseManquant: number;
  sansRemboursement: number;
  remboursementEnAttente: number;
  contestations: number;
  heuresIllisibles: number;
  /**
   * 1 si Resend a accepté la liste à ce passage : envoyée, ou déjà envoyée
   * sous la même clé (même liste, le même jour), auquel cas Resend rejoue sa
   * réponse sans second e-mail. Resend ne distingue pas les deux.
   */
  listeAcceptee: number;
  /** 1 si Resend a répondu 409 (liste déjà envoyée, ou envoi en cours) : compté, ce n'est pas une erreur. */
  listeEnConflit: number;
  erreurs: number;
}

export interface BilanTache {
  effacement: BilanEffacement;
  confirmations: BilanConfirmations;
  remboursements: BilanRemboursements;
  aTraiter: BilanATraiter;
}

export function bilanTacheVide(): BilanTache {
  return {
    effacement: bilanVide(),
    confirmations: {
      paiementsAboutisExamines: 0,
      confirmationsEnvoyees: 0,
      confirmationsDejaFaites: 0,
      confirmationsTropRecentes: 0,
      confirmationsExclues: 0,
      confirmationsEnCours: 0,
      confirmationsEchouees: 0,
      confirmationsNonEnregistrees: 0,
      confirmationsImpossibles: 0,
      erreurs: 0,
    },
    remboursements: {
      retractationsExaminees: 0,
      remboursementsRetentes: 0,
      remboursementsReussis: 0,
      remboursementsDemandes: 0,
      remboursementsEchoues: 0,
      remboursementsExclus: 0,
      erreurs: 0,
    },
    aTraiter: {
      commandesRelues: 0,
      aExaminer: 0,
      simultanees: 0,
      accuseManquant: 0,
      sansRemboursement: 0,
      remboursementEnAttente: 0,
      contestations: 0,
      heuresIllisibles: 0,
      listeAcceptee: 0,
      listeEnConflit: 0,
      erreurs: 0,
    },
  };
}

export function erreursDeLaTache(bilan: BilanTache): number {
  return bilan.effacement.erreurs + bilan.confirmations.erreurs + bilan.remboursements.erreurs + bilan.aTraiter.erreurs;
}

/** Une heure après le paiement : l'acheteur revenu sur le site a déjà reçu sa confirmation. */
export const DELAI_AVANT_CONFIRMATION_MS = 60 * 60 * 1000;

/**
 * Les paiements aboutis examinés : ceux des 45 derniers jours. Les 30 jours de
 * la livraison, plus le temps de rembourser une rétractation déclarée à la fin
 * du délai (14 jours, prorogés d'un week-end ou d'un jour férié).
 */
export const FENETRE_DES_PAIEMENTS_MS = 45 * 24 * 60 * 60 * 1000;

/** Le secret attendu, comparé en temps constant. Sans CRON_SECRET, rien n'est autorisé. */
export function tacheAutorisee(requete: Request, env: Environnement): boolean {
  if (!env.secretTache) return false;
  const recue = Buffer.from(requete.headers.get("authorization") ?? "", "utf8");
  const attendue = Buffer.from(`Bearer ${env.secretTache}`, "utf8");
  return recue.length === attendue.length && timingSafeEqual(recue, attendue);
}

function noter(phase: string, compteurs: object): void {
  journal({ tache: "quotidienne", phase, ...(compteurs as Record<string, number>) });
}

export async function tacheQuotidienne(deps: Dependances): Promise<BilanTache> {
  const bilan = bilanTacheVide();
  const { client } = deps;
  const cleStripe = deps.env.cleStripe;
  if (!client || !cleStripe) {
    journal({ tache: "quotidienne", sansCle: 1 });
    return bilan;
  }
  const maintenant = deps.maintenant();

  try {
    await effacerLesConfigurationsAnciennes(client, maintenant, bilan.effacement);
  } finally {
    noter("effacement", bilan.effacement);
  }

  let paiements: PaiementLu[] = [];
  let recherche = true;
  try {
    try {
      paiements = await paiementsDeLaBoutique(client, maintenant);
    } catch {
      recherche = false;
      bilan.confirmations.erreurs += 1;
    }
    await confirmerLesOubliees(paiements, deps, cleStripe, maintenant, bilan.confirmations);
  } finally {
    noter("confirmations", bilan.confirmations);
  }

  try {
    // Sans la recherche, aucune rétractation n'a pu être examinée : la phase le compte comme une erreur.
    if (!recherche) bilan.remboursements.erreurs += 1;
    await rembourserLesRetractations(paiements, deps, client, maintenant, bilan.remboursements);
  } finally {
    noter("remboursements", bilan.remboursements);
  }

  try {
    // Sans la recherche, la liste est incomplète : elle part quand même, en le disant, et la phase compte l'erreur.
    if (!recherche) bilan.aTraiter.erreurs += 1;
    await signalerLesCommandesATraiter(paiements, deps, client, maintenant, bilan.aTraiter, !recherche);
  } finally {
    noter("a_traiter", bilan.aTraiter);
  }
  return bilan;
}

/** Les paiements aboutis de cette boutique des 45 derniers jours. La recherche l'exige ; on le revérifie. */
async function paiementsDeLaBoutique(client: ClientStripe, maintenant: Date): Promise<PaiementLu[]> {
  const depuis = Math.floor((maintenant.getTime() - FENETRE_DES_PAIEMENTS_MS) / 1000);
  const trouves = await toutesLesPages(async (page) => {
    const resultat = await client.paiementsAboutisDepuis(depuis, page);
    return { objets: resultat.paiements, pageSuivante: resultat.pageSuivante };
  });
  return trouves.filter(
    (paiement) =>
      paiement.metadonnees[CLES.boutique] === BOUTIQUE && Boolean(paiement.metadonnees[CLES.reference]) && paiement.statut === "succeeded",
  );
}

async function confirmerLesOubliees(
  paiements: PaiementLu[],
  deps: Dependances,
  cleStripe: string,
  maintenant: Date,
  bilan: BilanConfirmations,
): Promise<void> {
  const client = deps.client!;
  for (const paiement of paiements) {
    bilan.paiementsAboutisExamines += 1;
    const reference = paiement.metadonnees[CLES.reference]!;
    try {
      if (lireSuivi(paiement.metadonnees).confirmation) {
        bilan.confirmationsDejaFaites += 1;
        continue;
      }
      if (rembourseEnTotalite(paiement) || paiement.litige || marqueRetenue(paiement.metadonnees) !== null) {
        bilan.confirmationsExclues += 1;
        continue;
      }
      if (maintenant.getTime() - paiement.payeLe * 1000 < DELAI_AVANT_CONFIRMATION_MS) {
        bilan.confirmationsTropRecentes += 1;
        continue;
      }
      // Relu à jour : la recherche de Stripe peut rendre des métadonnées périmées.
      const frais = await client.lirePaiement(paiement.id);
      if (!frais) {
        bilan.erreurs += 1;
        continue;
      }
      const etat = etatDuPaiement(frais, reference, cleStripe, maintenant);
      if (etat.etat !== "payee") {
        if (["retractee", "remboursee", "remboursement_demande", "litige", "a_examiner"].includes(etat.etat)) {
          bilan.confirmationsExclues += 1;
        }
        else bilan.confirmationsImpossibles += 1;
        continue;
      }
      if (etat.suivi.confirmation) {
        bilan.confirmationsDejaFaites += 1;
        continue;
      }
      const issue = await envoyerLaConfirmation(etat, deps, "tache");
      if (issue === "confirmee") bilan.confirmationsEnvoyees += 1;
      else if (issue === "en_cours") bilan.confirmationsEnCours += 1;
      else if (issue === "impossible") bilan.confirmationsImpossibles += 1;
      else if (issue === "non_enregistree") bilan.confirmationsNonEnregistrees += 1;
      else bilan.confirmationsEchouees += 1;
    } catch {
      bilan.erreurs += 1;
    }
  }
}

/**
 * Les rétractations à rembourser, relues à jour avant tout remboursement : la
 * recherche peut rendre des métadonnées périmées, et seule une rétractation
 * qui l'a emporté se rembourse (voir src/vente/course.ts). Un remboursement
 * n'est créé que si les remboursements faits ou demandés (`pending`,
 * `requires_action`, `succeeded`) ne couvrent pas le montant payé : Stripe
 * rembourse alors le reste (un remboursement partiel fait depuis le tableau
 * de bord est complété) ; un remboursement `failed` ou `canceled` est
 * retenté. Une commande dont une marque est illisible n'est jamais
 * remboursée ici. Une tentative par jour et par commande : la clé
 * d'idempotence porte le jour, et Stripe ne rembourse jamais au-delà du
 * montant payé.
 */
async function rembourserLesRetractations(
  paiements: PaiementLu[],
  deps: Dependances,
  client: ClientStripe,
  maintenant: Date,
  bilan: BilanRemboursements,
): Promise<void> {
  const jour = maintenant.toISOString().slice(0, 10);
  for (const paiement of paiements) {
    if (!lireSuivi(paiement.metadonnees).retractation) continue;
    bilan.retractationsExaminees += 1;
    try {
      if (rembourseEnTotalite(paiement) || paiement.litige) continue;
      const frais = await client.lirePaiement(paiement.id);
      if (!frais) {
        bilan.erreurs += 1;
        continue;
      }
      if (rembourseEnTotalite(frais) || frais.litige) continue;
      if (marqueRetenue(frais.metadonnees) !== "retractation") {
        bilan.remboursementsExclus += 1;
        continue;
      }
      bilan.remboursementsRetentes += 1;
      const reference = frais.metadonnees[CLES.reference]!;
      const etat = await rembourserSansPanne(deps, frais, cleDeRemboursement(reference, jour));
      if (etat === "effectue") bilan.remboursementsReussis += 1;
      else if (etat === "demande") bilan.remboursementsDemandes += 1;
      else bilan.remboursementsEchoues += 1;
    } catch {
      bilan.erreurs += 1;
    }
  }
}

/**
 * La liste des commandes à traiter (voir src/vente/aTraiter.ts), à l'issue
 * des remboursements : les paiements qui portent une rétractation ou une
 * contestation sont relus à jour, et la liste part au vendeur s'il y a au
 * moins une commande. La clé d'idempotence porte le jour de Paris et
 * l'empreinte de la liste : une liste inchangée ne repart pas.
 */
async function signalerLesCommandesATraiter(
  paiements: PaiementLu[],
  deps: Dependances,
  client: ClientStripe,
  maintenant: Date,
  bilan: BilanATraiter,
  rechercheEchouee = false,
): Promise<void> {
  const frais: PaiementLu[] = [];
  let relecturesEchouees = 0;
  for (const paiement of paiements) {
    if (!candidatALaListe(paiement)) continue;
    const reference = paiement.metadonnees[CLES.reference]!;
    try {
      const relu = await client.lirePaiement(paiement.id);
      bilan.commandesRelues += 1;
      if (!relu) relecturesEchouees += 1;
      else if (relu.statut === "succeeded" && estUneCommande(relu.metadonnees, reference)) frais.push(relu);
    } catch {
      relecturesEchouees += 1;
    }
  }
  bilan.erreurs += relecturesEchouees;
  const liste = listeATraiter(frais, maintenant, { rechercheEchouee, relecturesEchouees });
  bilan.aExaminer = liste.a_examiner.length;
  bilan.simultanees = liste.simultanees.length;
  bilan.accuseManquant = liste.accuse_manquant.length;
  bilan.sansRemboursement = liste.sans_remboursement.length;
  bilan.remboursementEnAttente = liste.remboursement_en_attente.length;
  bilan.contestations = liste.contestations.length;
  bilan.heuresIllisibles = liste.heures_illisibles.length;
  // Une liste vide mais incomplète part quand même : rien ne dit qu'il n'y a rien à traiter.
  if (tailleDeLaListe(liste) === 0 && !listeIncomplete(liste)) return;

  const { email, env, fiche } = deps;
  if (!email) {
    bilan.erreurs += 1;
    return;
  }
  const document = courrielDeLaListe(liste, maintenant);
  const vendeur = adresseDEnvoi(fiche.email.trim(), env, fiche).adresse;
  const resultat = await email.envoyer(
    {
      de: EXPEDITEUR,
      a: [vendeur],
      copieCachee: [],
      repondreA: fiche.email.trim(),
      objet: document.objet,
      texte: courrielEnTexte(document),
      html: courrielEnHtml(document),
      piecesJointes: [],
    },
    cleDeLaListe(document, maintenant),
  );
  // La ligne de journal de la phase compte l'issue : acceptée par Resend, en conflit (409, pas une erreur), ou en échec.
  if (resultat.ok) bilan.listeAcceptee = 1;
  else if (resultat.raison === "en_cours" || resultat.raison === "requete_differente") bilan.listeEnConflit = 1;
  else bilan.erreurs += 1;
}
