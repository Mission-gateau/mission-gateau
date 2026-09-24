import { DUREE_DE_VALIDITE_MS } from "./commande";
import { configurationPresente, metadonneesDEffacement } from "./metadonnees";
import type { ClientStripe } from "./stripe";

/** Ce que la tâche d'effacement écrit dans les journaux : des compteurs, rien d'autre. */
export interface BilanEffacement {
  /** Paiements (PaymentIntents) : la copie que lit la livraison. */
  paiementsExamines: number;
  paiementsEffaces: number;
  paiementsRecents: number;
  paiementsDejaEffaces: number;
  /** Débits (Charges) : la copie que Stripe y a faite à la création du débit. */
  debitsExamines: number;
  debitsEffaces: number;
  debitsRecents: number;
  debitsDejaEffaces: number;
  erreurs: number;
}

export function bilanVide(): BilanEffacement {
  return {
    paiementsExamines: 0,
    paiementsEffaces: 0,
    paiementsRecents: 0,
    paiementsDejaEffaces: 0,
    debitsExamines: 0,
    debitsEffaces: 0,
    debitsRecents: 0,
    debitsDejaEffaces: 0,
    erreurs: 0,
  };
}

/** Au plus 20 pages de 100 objets par passage et par sorte : la tâche reprend le lendemain. */
const PAGES_PAR_PASSAGE = 20;

/**
 * Lit toutes les pages d'une recherche avant de rien effacer : effacer en
 * cours de lecture changerait les résultats et ferait sauter des objets d'une
 * page à l'autre.
 */
async function toutesLesPages<T extends { id: string }>(
  lirePage: (page: string | null) => Promise<{ objets: T[]; pageSuivante: string | null }>,
): Promise<T[]> {
  const trouves = new Map<string, T>();
  let page: string | null = null;
  for (let passage = 0; passage < PAGES_PAR_PASSAGE; passage += 1) {
    const resultat = await lirePage(page);
    for (const objet of resultat.objets) trouves.set(objet.id, objet);
    page = resultat.pageSuivante;
    if (!page) break;
  }
  return [...trouves.values()];
}

/**
 * Efface la configuration chiffrée des paiements de plus de 30 jours.
 *
 * Stripe garde la configuration à deux endroits : sur le paiement
 * (PaymentIntent), que lit la livraison, et sur chaque débit (Charge), où il
 * l'a recopiée à la création du débit sans plus jamais la mettre à jour. Les
 * deux copies sont effacées. La commande elle-même — montant, date, e-mail,
 * facture, référence, accords — reste chez Stripe.
 *
 * Un objet plus récent n'est jamais touché, même si la recherche de Stripe le
 * renvoyait par erreur : son âge est revérifié ici, à partir du débit réussi
 * pour un paiement. Un objet déjà effacé est simplement compté. La tâche peut
 * donc tourner autant de fois qu'on veut sans dégât.
 */
export async function effacerLesConfigurationsAnciennes(
  client: ClientStripe,
  maintenant: Date,
): Promise<BilanEffacement> {
  const bilan = bilanVide();
  const limite = Math.floor((maintenant.getTime() - DUREE_DE_VALIDITE_MS) / 1000);

  const paiements = await toutesLesPages(async (page) => {
    const resultat = await client.paiementsAvecConfiguration(limite, page);
    return { objets: resultat.paiements, pageSuivante: resultat.pageSuivante };
  });
  for (const paiement of paiements) {
    bilan.paiementsExamines += 1;
    if (paiement.payeLe >= limite || paiement.cree >= limite) {
      bilan.paiementsRecents += 1;
      continue;
    }
    if (!configurationPresente(paiement.metadonnees)) {
      bilan.paiementsDejaEffaces += 1;
      continue;
    }
    try {
      await client.modifierMetadonnees(paiement.id, metadonneesDEffacement(paiement.metadonnees));
      bilan.paiementsEffaces += 1;
    } catch {
      bilan.erreurs += 1;
    }
  }

  const debits = await toutesLesPages(async (page) => {
    const resultat = await client.debitsAvecConfiguration(limite, page);
    return { objets: resultat.debits, pageSuivante: resultat.pageSuivante };
  });
  for (const debit of debits) {
    bilan.debitsExamines += 1;
    if (debit.cree >= limite) {
      bilan.debitsRecents += 1;
      continue;
    }
    if (!configurationPresente(debit.metadonnees)) {
      bilan.debitsDejaEffaces += 1;
      continue;
    }
    try {
      await client.modifierMetadonneesDuDebit(debit.id, metadonneesDEffacement(debit.metadonnees));
      bilan.debitsEffaces += 1;
    } catch {
      bilan.erreurs += 1;
    }
  }
  return bilan;
}
