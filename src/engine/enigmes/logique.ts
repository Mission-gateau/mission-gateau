import type { Alea } from "../alea";
import { resoudreLogique } from "../verif/logique";
import { GABARITS_LOGIQUE, numeroAvecArticle, type ValeurLogique } from "../../contenu/logique";
import { remplir } from "../texte";
import type { GrilleLogiqueColonne, IndiceLogique } from "../types";

export interface LogiqueGeneree {
  lignes: string[];
  colonnes: GrilleLogiqueColonne[];
  indices: string[];
  indicesStructures: IndiceLogique[];
  attribution: number[][];
  question: string;
  ligneQuestion: number;
  colonneQuestion: number;
  chiffre: number;
}

const COLONNE_OBJET = 0;
const COLONNE_NUMERO = 1;

/**
 * Grille de logique 3x3 : trois personnages, un objet et un numéro chacun.
 *
 * On tire d'abord la solution, puis on ajoute des indices vrais jusqu'à ce que
 * le solveur ne trouve plus qu'une seule possibilité, et on retire ensuite
 * tous les indices devenus inutiles. L'unicité est donc prouvée par le
 * solveur, pas supposée.
 */
export function genererLogique(
  alea: Alea,
  personnages: readonly string[],
  objets: readonly ValeurLogique[],
): LogiqueGeneree {
  const lignes = alea.melanger(personnages).slice(0, 3);
  const valeursObjet = alea.melanger(objets).slice(0, 3);
  const chiffres = alea.echantillon([1, 2, 3, 4, 5, 6, 7, 8, 9], 3);
  const valeursNumero = chiffres.map(numeroAvecArticle);

  const colonnes: GrilleLogiqueColonne[] = [
    { titre: GABARITS_LOGIQUE.colonneObjet, valeurs: valeursObjet.map((v) => v.court) },
    { titre: GABARITS_LOGIQUE.colonneNumero, valeurs: valeursNumero.map((v) => v.court) },
  ];
  const formes = [valeursObjet, valeursNumero];

  const permObjet = alea.melanger([0, 1, 2]);
  const permNumero = alea.melanger([0, 1, 2]);
  const solution = [0, 1, 2].map((i) => [permObjet[i]!, permNumero[i]!]);

  // Tous les indices vrais possibles.
  const candidats: IndiceLogique[] = [];
  for (let ligne = 0; ligne < 3; ligne += 1) {
    for (let colonne = 0; colonne < 2; colonne += 1) {
      for (let valeur = 0; valeur < 3; valeur += 1) {
        if (solution[ligne]![colonne] !== valeur) {
          candidats.push({ type: "pasValeur", ligne, colonne, valeur });
        }
      }
    }
  }
  for (let ligne = 0; ligne < 3; ligne += 1) {
    for (let autre = 0; autre < 3; autre += 1) {
      const indice: IndiceLogique = {
        type: ligne === autre ? "lien" : "pasLien",
        colonneA: COLONNE_OBJET,
        valeurA: solution[ligne]![COLONNE_OBJET]!,
        colonneB: COLONNE_NUMERO,
        valeurB: solution[autre]![COLONNE_NUMERO]!,
      };
      candidats.push(indice);
    }
  }
  for (let a = 0; a < 3; a += 1) {
    for (let b = 0; b < 3; b += 1) {
      if (a === b) continue;
      const va = Number(colonnes[COLONNE_NUMERO]!.valeurs[solution[a]![COLONNE_NUMERO]!]);
      const vb = Number(colonnes[COLONNE_NUMERO]!.valeurs[solution[b]![COLONNE_NUMERO]!]);
      if (va > vb) candidats.push({ type: "compare", ligneA: a, ligneB: b, colonne: COLONNE_NUMERO });
    }
  }

  const uniques = (indices: IndiceLogique[]): boolean =>
    resoudreLogique({ lignes, colonnes, indices }).length === 1;

  const melanges = alea.melanger(candidats);
  const choisis: IndiceLogique[] = [];
  for (const indice of melanges) {
    if (uniques(choisis)) break;
    choisis.push(indice);
  }
  if (!uniques(choisis)) throw new Error("logique : aucune grille unique trouvée");

  // On retire les indices devenus superflus, du dernier au premier.
  for (let i = choisis.length - 1; i >= 0; i -= 1) {
    const sans = choisis.filter((_, j) => j !== i);
    if (uniques(sans)) choisis.splice(i, 1);
  }

  const texte = (indice: IndiceLogique): string => {
    switch (indice.type) {
      case "pasValeur":
        return remplir(GABARITS_LOGIQUE.pasValeur, {
          nom: lignes[indice.ligne]!,
          valeur: formes[indice.colonne]![indice.valeur]!.avecArticle,
        });
      case "lien":
        return remplir(GABARITS_LOGIQUE.lien, {
          valeurA: formes[indice.colonneA]![indice.valeurA]!.avecArticle,
          valeurB: formes[indice.colonneB]![indice.valeurB]!.avecArticle,
        });
      case "pasLien":
        return remplir(GABARITS_LOGIQUE.pasLien, {
          valeurA: formes[indice.colonneA]![indice.valeurA]!.avecArticle,
          valeurB: formes[indice.colonneB]![indice.valeurB]!.avecArticle,
        });
      case "compare":
        return remplir(GABARITS_LOGIQUE.compare, {
          nomA: lignes[indice.ligneA]!,
          nomB: lignes[indice.ligneB]!,
        });
    }
  };

  const ligneQuestion = alea.entier(3);
  const chiffre = Number(colonnes[COLONNE_NUMERO]!.valeurs[solution[ligneQuestion]![COLONNE_NUMERO]!]);

  return {
    lignes,
    colonnes,
    indices: choisis.map(texte),
    indicesStructures: choisis,
    attribution: solution,
    question: remplir(GABARITS_LOGIQUE.question, { nom: lignes[ligneQuestion]! }),
    ligneQuestion,
    colonneQuestion: COLONNE_NUMERO,
    chiffre,
  };
}
