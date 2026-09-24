import { COMMANDE } from "../contenu/vente";
import type { NomEtat } from "./commande";

/** Le titre et le texte de chaque cas où le jeu ne peut pas être livré. */
const TEXTES_ETATS = {
  non_aboutie: COMMANDE.nonAboutie,
  introuvable: COMMANDE.introuvable,
  expiree: COMMANDE.expiree,
  remboursee: COMMANDE.remboursee,
  autre_version: COMMANDE.autreVersion,
  illisible: COMMANDE.illisible,
  indisponible: COMMANDE.indisponible,
} as const;

export type EtatSansLivraison = Exclude<NomEtat, "payee">;

export function texteDeLEtat(etat: EtatSansLivraison): { titre: string; texte: string } {
  return TEXTES_ETATS[etat];
}
