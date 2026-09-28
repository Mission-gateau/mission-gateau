import { COMMANDE } from "../contenu/vente";
import type { NomEtat } from "./commande";

/**
 * Chaque cas où le jeu ne peut pas être livré, avec son titre et son texte :
 * les états d'une commande autres que « payée », plus la commande payée dont
 * la confirmation n'est pas encore partie.
 */
export type Refus = Exclude<NomEtat, "payee"> | "non_confirmee";

/** Compatibilité : les états sans livraison sont les refus. */
export type EtatSansLivraison = Refus;

const TEXTES_REFUS: Record<Refus, { titre: string; texte: string }> = {
  non_aboutie: COMMANDE.nonAboutie,
  introuvable: COMMANDE.introuvable,
  expiree: COMMANDE.expiree,
  remboursee: COMMANDE.remboursee,
  remboursement_demande: COMMANDE.remboursementDemande,
  retractee: COMMANDE.retractee,
  a_examiner: COMMANDE.aExaminer,
  litige: COMMANDE.litige,
  non_confirmee: COMMANDE.nonConfirmee,
  autre_version: COMMANDE.autreVersion,
  illisible: COMMANDE.illisible,
  indisponible: COMMANDE.indisponible,
};

export function texteDeLEtat(refus: Refus): { titre: string; texte: string } {
  const { titre, texte } = TEXTES_REFUS[refus];
  return { titre, texte };
}
