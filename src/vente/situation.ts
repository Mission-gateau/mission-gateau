import type { FicheVendeur } from "../contenu/vendeur";
import { emailDeLAcheteur, type EtatCommande } from "./commande";
import { dateAParis, heureAParis, jourEnLettres } from "./dates";
import type { Dependances } from "./dependances";
import { adresseDEnvoi, adresseMasquee } from "./envoi";
import type { Environnement } from "./environnement";
import type { Refus } from "./etats";
import { formaterPrix } from "./prix";

/**
 * Ce que la page d'une commande affiche, préparé côté serveur. La page ne
 * reçoit jamais la configuration déchiffrée : seulement des dates déjà
 * écrites, l'adresse e-mail masquée et le nom de l'état.
 */
export type SituationCommande =
  | { type: "a_confirmer" }
  | {
      type: "confirmee";
      /** L'adresse où la confirmation est partie, masquée ; null si Stripe ne la donne pas. */
      destinataire: string | null;
      /** Hors production : l'adresse de test qui a reçu l'e-mail à la place de l'acheteur. */
      remplacement: { test: string; adresse: string } | null;
      /** Fin de validité du lien de téléchargement, à Paris. */
      validite: { date: string; heure: string };
      telechargement: { date: string; heure: string } | null;
      delai: { dernierJour: string; expire: boolean };
    }
  | {
      type: "retractee";
      date: string;
      heure: string;
      /** Remboursement effectué, demandé, à venir, ou paiement contesté auprès de la banque. */
      remboursement: "effectue" | "demande" | "a_venir" | "litige";
      montant: string;
    }
  | { type: "refus"; etat: Refus };

async function destinataireDeLaConfirmation(
  etat: Extract<EtatCommande, { etat: "payee" }>,
  deps: Dependances,
): Promise<string | null> {
  if (!deps.client) return etat.paiement.emailDuDebit;
  try {
    return await emailDeLAcheteur(deps.client, etat.paiement);
  } catch {
    return etat.paiement.emailDuDebit;
  }
}

function remplacement(adresse: string, env: Environnement, fiche: FicheVendeur): { test: string; adresse: string } | null {
  const envoi = adresseDEnvoi(adresse, env, fiche);
  return envoi.remplacee ? { test: envoi.adresse, adresse: adresseMasquee(adresse) } : null;
}

export async function situationDeLaCommande(etat: EtatCommande, deps: Dependances): Promise<SituationCommande> {
  switch (etat.etat) {
    case "payee": {
      if (!etat.suivi.confirmation) return { type: "a_confirmer" };
      const acheteur = await destinataireDeLaConfirmation(etat, deps);
      const envoi = acheteur ? adresseDEnvoi(acheteur, deps.env, deps.fiche) : null;
      const telechargement = etat.suivi.telechargement;
      return {
        type: "confirmee",
        destinataire: envoi ? adresseMasquee(envoi.adresse) : null,
        remplacement: acheteur ? remplacement(acheteur, deps.env, deps.fiche) : null,
        validite: { date: dateAParis(etat.expireLe), heure: heureAParis(etat.expireLe) },
        telechargement: telechargement ? { date: dateAParis(telechargement), heure: heureAParis(telechargement) } : null,
        delai: { dernierJour: jourEnLettres(etat.delai.dernierJour), expire: etat.delai.expire },
      };
    }
    case "retractee":
      return {
        type: "retractee",
        date: dateAParis(etat.retracteeLe),
        heure: heureAParis(etat.retracteeLe),
        remboursement: etat.remboursement !== "a_venir" ? etat.remboursement : etat.litige ? "litige" : "a_venir",
        montant: formaterPrix(etat.montant),
      };
    default:
      return { type: "refus", etat: etat.etat };
  }
}
