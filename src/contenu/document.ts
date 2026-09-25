/**
 * Les briques des documents légaux : pages du site (mentions légales, CGV,
 * politique de confidentialité) et PDF des CGV joint à la confirmation de
 * commande. Un document est une suite de sections faites de blocs ; les pages
 * et le PDF les dessinent chacun à leur façon, à partir du même contenu.
 */

export type Morceau = string | { texte: string; lien: string };

export type Bloc =
  | { type: "paragraphe"; morceaux: Morceau[] }
  | { type: "liste"; elements: Morceau[][] }
  | { type: "coordonnees"; lignes: { libelle: string; valeur: Morceau[] }[] }
  | { type: "encadre"; id: string; paragraphes: string[] };

export interface Section {
  titre: string;
  blocs: Bloc[];
}

export interface DocumentLegal {
  titre: string;
  description: string;
  date: string;
  sections: Section[];
}

export const p = (...morceaux: Morceau[]): Bloc => ({ type: "paragraphe", morceaux });
export const liste = (...elements: Morceau[][]): Bloc => ({ type: "liste", elements });
export const lien = (texte: string, adresse: string): Morceau => ({ texte, lien: adresse });
export const encadre = (id: string, paragraphes: string[]): Bloc => ({ type: "encadre", id, paragraphes });

/** Lignes de coordonnées : une ligne dont la valeur est vide n'est pas écrite. */
export function coordonnees(lignes: [string, string | null][]): Bloc {
  return {
    type: "coordonnees",
    lignes: lignes
      .filter((ligne): ligne is [string, string] => ligne[1] !== null && ligne[1].trim() !== "")
      .map(([libelle, valeur]) => ({ libelle, valeur: [valeur] })),
  };
}

export function lienSite(adresse: string): Morceau {
  return lien(adresse.replace(/^https:\/\//, ""), adresse);
}
