import { marqueGagnante, type Gagnante } from "./course";
import { heuresIllisibles } from "./metadonnees";

/**
 * Une heure illisible rend la commande « à examiner » : la règle, écrite ici
 * une seule fois, et suivie par la page de la commande, la route du kit, la
 * tâche quotidienne et la fonction de rétractation.
 *
 * Une marque horodatée (`retractation`, `telechargement`, `examinee`)
 * présente mais illisible — écrite à la main hors ISO 8601 complet, ou à une
 * date qui n'existe pas (voir src/vente/metadonnees.ts) — ne compte jamais
 * comme absente : tant qu'il en reste une, le kit n'est pas livré, aucune
 * marque ni aucune `course` n'est écrite par la fonction de rétractation,
 * rien n'est remboursé automatiquement, et le vendeur examine la commande
 * (la liste quotidienne la signale, rubrique `heures_illisibles`). Le
 * protocole de la course (src/vente/course.ts) ne change pas : cette règle
 * passe avant lui.
 */

/** Vrai si le paiement porte au moins une marque horodatée présente et illisible. */
export function heureIllisible(metadonnees: Record<string, string>): boolean {
  return heuresIllisibles(metadonnees).length > 0;
}

/**
 * La marque retenue pour décider : « a_examiner » dès qu'une heure est
 * illisible, sinon la marque gagnante de la course.
 */
export function marqueRetenue(metadonnees: Record<string, string>): Gagnante {
  return heureIllisible(metadonnees) ? "a_examiner" : marqueGagnante(metadonnees);
}
