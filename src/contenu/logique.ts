import { typographier } from "../engine/texte";

/** Textes de la grille de logique. Les indices imprimés sont produits ici. */

export interface ValeurLogique {
  /** Forme courte, pour l'en-tête du tableau. */
  court: string;
  /** Forme employée dans une phrase, article compris. */
  avecArticle: string;
}

export const GABARITS_LOGIQUE = typographier({
  pasValeur: "{nom} ne possède pas {valeur}.",
  lien: "La personne qui possède {valeurA} possède aussi {valeurB}.",
  pasLien: "La personne qui possède {valeurA} ne possède pas {valeurB}.",
  compare: "Le numéro de {nomA} est plus grand que le numéro de {nomB}.",
  question: "Quel numéro possède {nom} ?",
  colonneObjet: "Objet",
  colonneNumero: "Numéro",
} as const);

export function numeroAvecArticle(chiffre: number): ValeurLogique {
  return { court: String(chiffre), avecArticle: `le numéro ${chiffre}` };
}
