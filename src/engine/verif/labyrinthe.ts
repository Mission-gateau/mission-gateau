import type { Labyrinthe } from "../types";

/**
 * Solveur de labyrinthe, indépendant du générateur : il ne lit que les murs
 * publiés, jamais l'état interne de la génération.
 */

function passageOuvert(laby: Labyrinthe, x: number, y: number, dx: number, dy: number): boolean {
  if (dx === 1) return !laby.murs[y]![x]!.droite;
  if (dx === -1) return x > 0 && !laby.murs[y]![x - 1]!.droite;
  if (dy === 1) return !laby.murs[y]![x]!.bas;
  if (dy === -1) return y > 0 && !laby.murs[y - 1]![x]!.bas;
  return false;
}

export function voisins(laby: Labyrinthe, x: number, y: number): [number, number][] {
  const resultat: [number, number][] = [];
  const directions: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dy] of directions) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= laby.largeur || ny >= laby.hauteur) continue;
    if (passageOuvert(laby, x, y, dx, dy)) resultat.push([nx, ny]);
  }
  return resultat;
}

/** Parcours en largeur : plus court chemin départ → arrivée, ou null. */
export function resoudreLabyrinthe(laby: Labyrinthe): [number, number][] | null {
  const cle = (x: number, y: number) => y * laby.largeur + x;
  const precedent = new Map<number, number>();
  const vus = new Set<number>([cle(...laby.depart)]);
  let file: [number, number][] = [laby.depart];

  while (file.length > 0) {
    const suivante: [number, number][] = [];
    for (const [x, y] of file) {
      if (x === laby.arrivee[0] && y === laby.arrivee[1]) {
        const chemin: [number, number][] = [];
        let courant = cle(x, y);
        while (courant !== cle(...laby.depart)) {
          chemin.push([courant % laby.largeur, Math.floor(courant / laby.largeur)]);
          courant = precedent.get(courant)!;
        }
        chemin.push(laby.depart);
        return chemin.reverse();
      }
      for (const [nx, ny] of voisins(laby, x, y)) {
        if (vus.has(cle(nx, ny))) continue;
        vus.add(cle(nx, ny));
        precedent.set(cle(nx, ny), cle(x, y));
        suivante.push([nx, ny]);
      }
    }
    file = suivante;
  }
  return null;
}

/** Nombre de passages ouverts (arêtes du graphe). */
export function compterPassages(laby: Labyrinthe): number {
  let total = 0;
  for (let y = 0; y < laby.hauteur; y += 1) {
    for (let x = 0; x < laby.largeur; x += 1) {
      if (x + 1 < laby.largeur && !laby.murs[y]![x]!.droite) total += 1;
      if (y + 1 < laby.hauteur && !laby.murs[y]![x]!.bas) total += 1;
    }
  }
  return total;
}

/**
 * Vérifie qu'un labyrinthe est résoluble et que le chemin est unique.
 *
 * Un labyrinthe connexe de N cases avec exactement N-1 passages est un arbre :
 * entre deux cases il existe alors un chemin simple et un seul. La preuve
 * d'unicité tient donc en deux mesures, sans énumérer les chemins.
 */
export function verifierLabyrinthe(laby: Labyrinthe): string[] {
  const problemes: string[] = [];
  const total = laby.largeur * laby.hauteur;
  const chemin = resoudreLabyrinthe(laby);

  if (!chemin) {
    problemes.push("labyrinthe : aucun chemin entre le départ et l'arrivée");
    return problemes;
  }

  // Connexité : le parcours en largeur doit atteindre toutes les cases.
  const atteintes = new Set<number>();
  const pile: [number, number][] = [laby.depart];
  atteintes.add(laby.depart[1] * laby.largeur + laby.depart[0]);
  while (pile.length > 0) {
    const [x, y] = pile.pop()!;
    for (const [nx, ny] of voisins(laby, x, y)) {
      const k = ny * laby.largeur + nx;
      if (atteintes.has(k)) continue;
      atteintes.add(k);
      pile.push([nx, ny]);
    }
  }
  if (atteintes.size !== total) {
    problemes.push(`labyrinthe : ${total - atteintes.size} cases inaccessibles`);
  }

  const passages = compterPassages(laby);
  if (passages !== total - 1) {
    problemes.push(`labyrinthe : ${passages} passages pour ${total - 1} attendus (chemin non unique)`);
  }

  const publie = laby.chemin.map(([x, y]) => `${x},${y}`).join(" ");
  const calcule = chemin.map(([x, y]) => `${x},${y}`).join(" ");
  if (publie !== calcule) {
    problemes.push("labyrinthe : le chemin publié ne correspond pas au chemin trouvé");
  }
  if (chemin.length < Math.max(laby.largeur, laby.hauteur)) {
    problemes.push("labyrinthe : chemin trop court pour être intéressant");
  }
  return problemes;
}
