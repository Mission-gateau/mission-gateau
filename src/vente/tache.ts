import { timingSafeEqual } from "node:crypto";
import { etatDuPaiement } from "./commande";
import { envoyerLaConfirmation } from "./confirmation";
import type { Dependances } from "./dependances";
import { bilanVide, effacerLesConfigurationsAnciennes, toutesLesPages, type BilanEffacement } from "./effacement";
import type { Environnement } from "./environnement";
import { CLES, lireSuivi } from "./metadonnees";
import { cleDeRemboursement, rembourserSansPanne } from "./retractation";
import type { PaiementLu } from "./stripe";

/**
 * La tâche quotidienne (cron Vercel, déclaré dans vercel.json), en trois
 * temps :
 * 1. elle efface la configuration chiffrée des paiements de plus de 30 jours ;
 * 2. elle envoie la confirmation des commandes payées depuis plus d'une heure
 *    qui n'en ont pas — sauf celles rétractées, remboursées ou en litige —
 *    pour l'acheteur qui n'est pas revenu sur le site, sans jamais en envoyer
 *    deux (voir src/vente/confirmation.ts) ;
 * 3. elle retente le remboursement des rétractations enregistrées qui ne sont
 *    pas encore remboursées, hors litige.
 *
 * Elle n'agit que si la requête porte le secret de CRON_SECRET, que Vercel
 * envoie de lui-même. Ses compteurs ne partent que dans les journaux, et une
 * panne en cours de route ne fait pas perdre ceux déjà faits.
 */

export interface BilanTache extends BilanEffacement {
  paiementsAboutisExamines: number;
  confirmationsEnvoyees: number;
  confirmationsDejaFaites: number;
  confirmationsTropRecentes: number;
  confirmationsExclues: number;
  confirmationsEnCours: number;
  confirmationsEchouees: number;
  confirmationsImpossibles: number;
  remboursementsRetentes: number;
  remboursementsReussis: number;
  remboursementsEchoues: number;
}

export function bilanTacheVide(): BilanTache {
  return {
    ...bilanVide(),
    paiementsAboutisExamines: 0,
    confirmationsEnvoyees: 0,
    confirmationsDejaFaites: 0,
    confirmationsTropRecentes: 0,
    confirmationsExclues: 0,
    confirmationsEnCours: 0,
    confirmationsEchouees: 0,
    confirmationsImpossibles: 0,
    remboursementsRetentes: 0,
    remboursementsReussis: 0,
    remboursementsEchoues: 0,
  };
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

export async function tacheQuotidienne(deps: Dependances): Promise<BilanTache> {
  const bilan = bilanTacheVide();
  const { client } = deps;
  const cleStripe = deps.env.cleStripe;
  if (!client || !cleStripe) return bilan;
  const maintenant = deps.maintenant();

  await effacerLesConfigurationsAnciennes(client, maintenant, bilan);

  let paiements: PaiementLu[] = [];
  try {
    const depuis = Math.floor((maintenant.getTime() - FENETRE_DES_PAIEMENTS_MS) / 1000);
    paiements = await toutesLesPages(async (page) => {
      const resultat = await client.paiementsAboutisDepuis(depuis, page);
      return { objets: resultat.paiements, pageSuivante: resultat.pageSuivante };
    });
  } catch {
    bilan.erreurs += 1;
  }

  // Une tentative de remboursement par jour et par commande : la clé
  // d'idempotence porte le jour, et Stripe ne rembourse jamais au-delà du
  // montant payé.
  const jour = maintenant.toISOString().slice(0, 10);
  for (const paiement of paiements) {
    bilan.paiementsAboutisExamines += 1;
    const reference = paiement.metadonnees[CLES.reference];
    if (!reference || paiement.statut !== "succeeded") continue;
    try {
      const suivi = lireSuivi(paiement.metadonnees);
      if (suivi.retractation) {
        if (paiement.rembourseEnTotalite || paiement.litige) continue;
        bilan.remboursementsRetentes += 1;
        if (await rembourserSansPanne(deps, paiement, cleDeRemboursement(reference, jour))) bilan.remboursementsReussis += 1;
        else bilan.remboursementsEchoues += 1;
        continue;
      }
      if (suivi.confirmation) {
        bilan.confirmationsDejaFaites += 1;
        continue;
      }
      if (paiement.rembourseEnTotalite || paiement.litige) {
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
        if (etat.etat === "retractee" || etat.etat === "remboursee" || etat.etat === "litige") bilan.confirmationsExclues += 1;
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
      else bilan.confirmationsEchouees += 1;
    } catch {
      bilan.erreurs += 1;
    }
  }
  return bilan;
}
