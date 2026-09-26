import { timingSafeEqual } from "node:crypto";
import { etatDuPaiement } from "./commande";
import { envoyerLaConfirmation } from "./confirmation";
import { marqueGagnante } from "./course";
import type { Dependances } from "./dependances";
import { bilanVide, effacerLesConfigurationsAnciennes, toutesLesPages, type BilanEffacement } from "./effacement";
import type { Environnement } from "./environnement";
import { journal } from "./journal";
import { BOUTIQUE, CLES, lireSuivi } from "./metadonnees";
import { cleDeRemboursement, rembourserSansPanne } from "./retractation";
import type { ClientStripe, PaiementLu } from "./stripe";

/**
 * La tâche quotidienne (cron Vercel, déclaré dans vercel.json), en trois
 * phases, chacune écrivant sa ligne de journal dès qu'elle finit : un
 * dépassement de durée ne fait pas perdre les compteurs des phases déjà
 * faites.
 * 1. `effacement` : la configuration chiffrée des paiements de plus de 30
 *    jours, comme avant ;
 * 2. `confirmations` : la confirmation des commandes payées depuis plus d'une
 *    heure qui n'en ont pas — sauf celles rétractées, remboursées, en litige
 *    ou à examiner — pour l'acheteur qui n'est pas revenu sur le site, sans
 *    jamais en envoyer deux (voir src/vente/confirmation.ts) ;
 * 3. `remboursements` : le remboursement des rétractations qui l'ont emporté
 *    (voir src/vente/course.ts) et ne sont pas encore remboursées, hors
 *    litige.
 *
 * Les phases 2 et 3 ne voient que les paiements de cette boutique
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
  remboursementsReussis: number;
  remboursementsEchoues: number;
  /** Rétractations qui ont perdu la course, ou croisements à examiner : jamais remboursées ici. */
  remboursementsExclus: number;
  erreurs: number;
}

export interface BilanTache {
  effacement: BilanEffacement;
  confirmations: BilanConfirmations;
  remboursements: BilanRemboursements;
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
      remboursementsEchoues: 0,
      remboursementsExclus: 0,
      erreurs: 0,
    },
  };
}

export function erreursDeLaTache(bilan: BilanTache): number {
  return bilan.effacement.erreurs + bilan.confirmations.erreurs + bilan.remboursements.erreurs;
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
  try {
    try {
      paiements = await paiementsDeLaBoutique(client, maintenant);
    } catch {
      bilan.confirmations.erreurs += 1;
    }
    await confirmerLesOubliees(paiements, deps, cleStripe, maintenant, bilan.confirmations);
  } finally {
    noter("confirmations", bilan.confirmations);
  }

  try {
    await rembourserLesRetractations(paiements, deps, client, maintenant, bilan.remboursements);
  } finally {
    noter("remboursements", bilan.remboursements);
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
      if (paiement.rembourseEnTotalite || paiement.litige || marqueGagnante(paiement.metadonnees) !== null) {
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
        if (["retractee", "remboursee", "litige", "a_examiner"].includes(etat.etat)) bilan.confirmationsExclues += 1;
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
 * qui l'a emporté se rembourse (voir src/vente/course.ts). Une tentative par
 * jour et par commande : la clé d'idempotence porte le jour, et Stripe ne
 * rembourse jamais au-delà du montant payé.
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
      if (paiement.rembourseEnTotalite || paiement.litige) continue;
      const frais = await client.lirePaiement(paiement.id);
      if (!frais) {
        bilan.erreurs += 1;
        continue;
      }
      if (frais.rembourseEnTotalite || frais.litige) continue;
      if (marqueGagnante(frais.metadonnees) !== "retractation") {
        bilan.remboursementsExclus += 1;
        continue;
      }
      bilan.remboursementsRetentes += 1;
      const reference = frais.metadonnees[CLES.reference]!;
      if (await rembourserSansPanne(deps, frais, cleDeRemboursement(reference, jour))) bilan.remboursementsReussis += 1;
      else bilan.remboursementsEchoues += 1;
    } catch {
      bilan.erreurs += 1;
    }
  }
}
