import type { GrilleLogiqueColonne, IndiceLogique } from "../types";

/**
 * Solveur de grille de logique, indépendant du générateur.
 *
 * Une solution associe à chaque ligne une valeur de chaque colonne, sans
 * répétition : c'est une permutation par colonne. Avec trois lignes et deux
 * colonnes, il n'y a que 6 x 6 = 36 possibilités : on les énumère toutes.
 */

export interface ProblemeLogique {
  lignes: string[];
  colonnes: GrilleLogiqueColonne[];
  indices: IndiceLogique[];
}

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const resultat: number[][] = [];
  for (const reste of permutations(n - 1)) {
    for (let i = 0; i <= reste.length; i += 1) {
      resultat.push([...reste.slice(0, i), n - 1, ...reste.slice(i)]);
    }
  }
  return resultat;
}

function respecte(
  attribution: number[][],
  indice: IndiceLogique,
  colonnes: GrilleLogiqueColonne[],
): boolean {
  switch (indice.type) {
    case "pasValeur":
      return attribution[indice.ligne]![indice.colonne] !== indice.valeur;
    case "lien":
    case "pasLien": {
      const ligneA = attribution.findIndex((l) => l[indice.colonneA] === indice.valeurA);
      const memeLigne = attribution[ligneA]![indice.colonneB] === indice.valeurB;
      return indice.type === "lien" ? memeLigne : !memeLigne;
    }
    case "compare": {
      const valeurs = colonnes[indice.colonne]!.valeurs;
      const a = Number(valeurs[attribution[indice.ligneA]![indice.colonne]!]);
      const b = Number(valeurs[attribution[indice.ligneB]![indice.colonne]!]);
      return a > b;
    }
  }
}

/** Renvoie toutes les solutions compatibles avec les indices. */
export function resoudreLogique(probleme: ProblemeLogique): number[][][] {
  const nbLignes = probleme.lignes.length;
  const nbColonnes = probleme.colonnes.length;
  const perms = permutations(nbLignes);
  const solutions: number[][][] = [];

  const combiner = (colonne: number, partiel: number[][]): void => {
    if (colonne === nbColonnes) {
      if (probleme.indices.every((i) => respecte(partiel, i, probleme.colonnes))) {
        solutions.push(partiel.map((l) => [...l]));
      }
      return;
    }
    for (const perm of perms) {
      const suivant = partiel.map((ligne, i) => [...ligne, perm[i]!]);
      combiner(colonne + 1, suivant);
    }
  };

  combiner(
    0,
    Array.from({ length: nbLignes }, () => []),
  );
  return solutions;
}

export function verifierLogique(
  probleme: ProblemeLogique,
  solutionPubliee: number[][],
  textesIndices: string[],
): string[] {
  const problemes: string[] = [];
  if (textesIndices.length !== probleme.indices.length) {
    problemes.push("logique : autant d'indices imprimés que d'indices utiles est attendu");
  }
  const solutions = resoudreLogique(probleme);
  if (solutions.length === 0) {
    problemes.push("logique : aucune solution");
    return problemes;
  }
  if (solutions.length > 1) {
    problemes.push(`logique : ${solutions.length} solutions au lieu d'une seule`);
  }
  const attendue = JSON.stringify(solutionPubliee);
  if (!solutions.some((s) => JSON.stringify(s) === attendue)) {
    problemes.push("logique : la solution publiée ne satisfait pas les indices");
  }
  return problemes;
}
