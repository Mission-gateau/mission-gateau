import type { Alea } from "../alea";
import { compterSolutions, type FormeSudoku } from "../verif/sudoku";

export interface SudokuGenere {
  forme: FormeSudoku;
  grille: (number | null)[][];
  solution: number[][];
  caseCle: [number, number];
  chiffre: number;
}

/** Remplit une grille complète et valide, par retour sur trace. */
function grillePleine(alea: Alea, forme: FormeSudoku): number[][] {
  const grille: (number | null)[][] = Array.from({ length: forme.taille }, () =>
    Array.from({ length: forme.taille }, () => null),
  );

  const libre = (x: number, y: number, valeur: number): boolean => {
    for (let i = 0; i < forme.taille; i += 1) {
      if (grille[y]![i] === valeur) return false;
      if (grille[i]![x] === valeur) return false;
    }
    const x0 = Math.floor(x / forme.blocLargeur) * forme.blocLargeur;
    const y0 = Math.floor(y / forme.blocHauteur) * forme.blocHauteur;
    for (let dy = 0; dy < forme.blocHauteur; dy += 1) {
      for (let dx = 0; dx < forme.blocLargeur; dx += 1) {
        if (grille[y0 + dy]![x0 + dx] === valeur) return false;
      }
    }
    return true;
  };

  const remplir = (index: number): boolean => {
    if (index === forme.taille * forme.taille) return true;
    const x = index % forme.taille;
    const y = Math.floor(index / forme.taille);
    const valeurs = alea.melanger(
      Array.from({ length: forme.taille }, (_, i) => i + 1),
    );
    for (const valeur of valeurs) {
      if (!libre(x, y, valeur)) continue;
      grille[y]![x] = valeur;
      if (remplir(index + 1)) return true;
      grille[y]![x] = null;
    }
    return false;
  };

  if (!remplir(0)) throw new Error("sudoku : impossible de remplir la grille");
  return grille.map((ligne) => ligne.map((v) => v as number));
}

/**
 * Creuse la grille tant que la solution reste unique. L'unicité est prouvée
 * à chaque retrait par le solveur de src/engine/verif/sudoku.ts.
 */
export function genererSudoku(alea: Alea, taille: 4 | 6): SudokuGenere {
  const forme: FormeSudoku =
    taille === 4
      ? { taille: 4, blocLargeur: 2, blocHauteur: 2 }
      : { taille: 6, blocLargeur: 3, blocHauteur: 2 };

  const solution = grillePleine(alea, forme);
  const grille: (number | null)[][] = solution.map((ligne) => [...ligne]);

  const ordre = alea.melanger(
    Array.from({ length: taille * taille }, (_, i) => i),
  );
  const videsMax = taille === 4 ? 10 : 20;
  let vides = 0;
  for (const index of ordre) {
    if (vides >= videsMax) break;
    const x = index % taille;
    const y = Math.floor(index / taille);
    const garde = grille[y]![x]!;
    grille[y]![x] = null;
    if (compterSolutions(grille, forme, 2).nombre === 1) {
      vides += 1;
    } else {
      grille[y]![x] = garde;
    }
  }

  const casesVides: [number, number][] = [];
  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      if (grille[y]![x] === null) casesVides.push([x, y]);
    }
  }
  if (casesVides.length === 0) throw new Error("sudoku : aucune case à deviner");
  const caseCle = alea.choisir(casesVides);
  return {
    forme,
    grille,
    solution,
    caseCle,
    chiffre: solution[caseCle[1]]![caseCle[0]]!,
  };
}
