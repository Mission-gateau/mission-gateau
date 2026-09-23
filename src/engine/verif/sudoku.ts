/**
 * Solveur de sudoku indépendant : il ne lit que la grille publiée.
 * Il sert à prouver qu'une grille a une solution et une seule.
 */

export interface FormeSudoku {
  taille: number;
  blocLargeur: number;
  blocHauteur: number;
}

function possible(
  grille: (number | null)[][],
  forme: FormeSudoku,
  x: number,
  y: number,
  valeur: number,
): boolean {
  for (let i = 0; i < forme.taille; i += 1) {
    if (i !== x && grille[y]![i] === valeur) return false;
    if (i !== y && grille[i]![x] === valeur) return false;
  }
  const x0 = Math.floor(x / forme.blocLargeur) * forme.blocLargeur;
  const y0 = Math.floor(y / forme.blocHauteur) * forme.blocHauteur;
  for (let dy = 0; dy < forme.blocHauteur; dy += 1) {
    for (let dx = 0; dx < forme.blocLargeur; dx += 1) {
      const cx = x0 + dx;
      const cy = y0 + dy;
      if ((cx !== x || cy !== y) && grille[cy]![cx] === valeur) return false;
    }
  }
  return true;
}

/**
 * Compte les solutions, en s'arrêtant à `plafond` (2 suffit pour prouver
 * l'unicité). Renvoie aussi la première solution trouvée.
 */
export function compterSolutions(
  grilleDepart: (number | null)[][],
  forme: FormeSudoku,
  plafond = 2,
): { nombre: number; premiere: number[][] | null } {
  const grille = grilleDepart.map((ligne) => [...ligne]);
  let nombre = 0;
  let premiere: number[][] | null = null;

  const chercher = (): void => {
    if (nombre >= plafond) return;
    let cible: [number, number] | null = null;
    for (let y = 0; y < forme.taille && !cible; y += 1) {
      for (let x = 0; x < forme.taille; x += 1) {
        if (grille[y]![x] === null) {
          cible = [x, y];
          break;
        }
      }
    }
    if (!cible) {
      nombre += 1;
      if (!premiere) premiere = grille.map((ligne) => ligne.map((v) => v as number));
      return;
    }
    const [x, y] = cible;
    for (let valeur = 1; valeur <= forme.taille; valeur += 1) {
      if (!possible(grille, forme, x, y, valeur)) continue;
      grille[y]![x] = valeur;
      chercher();
      grille[y]![x] = null;
      if (nombre >= plafond) return;
    }
  };

  chercher();
  return { nombre, premiere };
}

/** Vérifie qu'une grille pleine respecte bien les règles. */
export function grilleValide(grille: number[][], forme: FormeSudoku): boolean {
  for (let y = 0; y < forme.taille; y += 1) {
    for (let x = 0; x < forme.taille; x += 1) {
      const valeur = grille[y]![x]!;
      if (valeur < 1 || valeur > forme.taille) return false;
      const copie: (number | null)[][] = grille.map((l) => [...l]);
      if (!possible(copie, forme, x, y, valeur)) return false;
    }
  }
  return true;
}
