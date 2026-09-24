import { DUREE_DE_VALIDITE_MS } from "./commande";
import { configurationPresente, metadonneesDEffacement } from "./metadonnees";
import type { ClientStripe, PaiementLu } from "./stripe";

/** Ce que la tâche d'effacement écrit dans les journaux : des compteurs, rien d'autre. */
export interface BilanEffacement {
  examines: number;
  effaces: number;
  recents: number;
  dejaEffaces: number;
  erreurs: number;
}

/** Au plus 20 pages de 100 paiements par passage : la tâche reprend le lendemain. */
const PAGES_PAR_PASSAGE = 20;

/**
 * Efface la configuration chiffrée des paiements de plus de 30 jours.
 *
 * La commande elle-même — montant, date, e-mail, facture, référence, accords —
 * reste chez Stripe ; seuls les morceaux chiffrés disparaissent. Un paiement
 * plus récent n'est jamais touché, même si la recherche de Stripe le
 * renvoyait par erreur : son âge est revérifié ici. Un paiement déjà effacé
 * est simplement compté. La tâche peut donc tourner autant de fois qu'on
 * veut sans dégât.
 */
export async function effacerLesConfigurationsAnciennes(
  client: ClientStripe,
  maintenant: Date,
): Promise<BilanEffacement> {
  const bilan: BilanEffacement = { examines: 0, effaces: 0, recents: 0, dejaEffaces: 0, erreurs: 0 };
  const limite = Math.floor((maintenant.getTime() - DUREE_DE_VALIDITE_MS) / 1000);

  // D'abord lire toutes les pages, ensuite seulement effacer : effacer en
  // cours de lecture changerait les résultats de la recherche et ferait
  // sauter des paiements d'une page à l'autre.
  const candidats = new Map<string, PaiementLu>();
  let page: string | null = null;
  for (let passage = 0; passage < PAGES_PAR_PASSAGE; passage += 1) {
    const resultat = await client.paiementsAvecConfiguration(limite, page);
    for (const paiement of resultat.paiements) candidats.set(paiement.id, paiement);
    page = resultat.pageSuivante;
    if (!page) break;
  }

  for (const paiement of candidats.values()) {
    bilan.examines += 1;
    if (paiement.cree >= limite) {
      bilan.recents += 1;
      continue;
    }
    if (!configurationPresente(paiement.metadonnees)) {
      bilan.dejaEffaces += 1;
      continue;
    }
    try {
      await client.modifierMetadonnees(paiement.id, metadonneesDEffacement(paiement.metadonnees));
      bilan.effaces += 1;
    } catch {
      bilan.erreurs += 1;
    }
  }
  return bilan;
}
