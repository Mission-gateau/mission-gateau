import type { Alea } from "../alea";
import { creerGrille } from "./grille";
import { resoudreLabyrinthe } from "../verif/labyrinthe";
import type { Labyrinthe } from "../types";

/**
 * Labyrinthe parfait : tous les murs sont posés, puis un parcours en
 * profondeur en abat juste assez pour relier toutes les cases sans jamais
 * créer de boucle. Le résultat est un arbre couvrant : il existe donc un
 * chemin, et un seul, entre le départ et l'arrivée.
 */
export function genererLabyrinthe(alea: Alea, largeur: number, hauteur: number): Labyrinthe {
  const murs = creerGrille(largeur, hauteur, () => ({ droite: true, bas: true }));
  const visitees = creerGrille(largeur, hauteur, () => false);

  const pile: [number, number][] = [[0, 0]];
  visitees[0]![0] = true;

  while (pile.length > 0) {
    const [x, y] = pile[pile.length - 1]!;
    const candidats: [number, number, number, number][] = [];
    if (x + 1 < largeur && !visitees[y]![x + 1]) candidats.push([x + 1, y, 1, 0]);
    if (x > 0 && !visitees[y]![x - 1]) candidats.push([x - 1, y, -1, 0]);
    if (y + 1 < hauteur && !visitees[y + 1]![x]) candidats.push([x, y + 1, 0, 1]);
    if (y > 0 && !visitees[y - 1]![x]) candidats.push([x, y - 1, 0, -1]);

    if (candidats.length === 0) {
      pile.pop();
      continue;
    }
    const [nx, ny, dx, dy] = alea.choisir(candidats);
    if (dx === 1) murs[y]![x]!.droite = false;
    if (dx === -1) murs[y]![nx]!.droite = false;
    if (dy === 1) murs[y]![x]!.bas = false;
    if (dy === -1) murs[ny]![x]!.bas = false;
    visitees[ny]![nx] = true;
    pile.push([nx, ny]);
  }

  const depart: [number, number] = [0, 0];
  const arrivee: [number, number] = [largeur - 1, hauteur - 1];
  const partiel: Labyrinthe = { largeur, hauteur, murs, depart, arrivee, chemin: [] };
  const chemin = resoudreLabyrinthe(partiel);
  if (!chemin) throw new Error("labyrinthe : génération sans solution");
  return { ...partiel, chemin };
}
