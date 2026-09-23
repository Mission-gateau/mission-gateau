import type { Alea } from "../alea";

/** Construit une grille rectangulaire remplie par une fonction. */
export function creerGrille<T>(
  largeur: number,
  hauteur: number,
  valeur: (x: number, y: number) => T,
): T[][] {
  return Array.from({ length: hauteur }, (_, y) =>
    Array.from({ length: largeur }, (_, x) => valeur(x, y)),
  );
}

/** Toutes les cases d'une grille, dans l'ordre de lecture. */
export function cases(largeur: number, hauteur: number): [number, number][] {
  const liste: [number, number][] = [];
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) liste.push([x, y]);
  }
  return liste;
}

/** Tire n icônes distinctes dans un jeu, en bouclant si besoin. */
export function iconesDistinctes(alea: Alea, jeu: readonly string[], n: number): string[] {
  if (n <= jeu.length) return alea.echantillon(jeu, n);
  const resultat: string[] = [];
  while (resultat.length < n) resultat.push(...alea.melanger(jeu));
  return resultat.slice(0, n);
}
