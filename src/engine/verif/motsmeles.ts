/**
 * Vérification des mots mêlés, à partir des seules données publiées :
 * la grille, la liste de mots, et les cases occupées par chaque mot.
 */

/**
 * Les deux axes de lecture annoncés par la consigne : horizontale et
 * verticale. Chaque alignement n'est parcouru qu'une fois, et le mot y est
 * accepté dans un sens comme dans l'autre : une même suite de cases compte
 * donc pour une seule occurrence, jamais pour deux.
 */
const AXES: [number, number][] = [
  [1, 0],
  [0, 1],
];

/**
 * Compte les endroits où un mot se lit dans la grille.
 *
 * Un mot qui apparaît deux fois rend le jeu faux : l'enfant qui entoure la
 * mauvaise occurrence raye des lettres du mot-réponse et obtient une réponse
 * erronée. Le générateur comme le contrôle indépendant exigent donc
 * exactement une occurrence par mot de la liste.
 */
export function occurrences(grille: string[][], mot: string): number {
  const hauteur = grille.length;
  const largeur = grille[0]!.length;
  const inverse = [...mot].reverse().join("");
  let total = 0;

  for (const [dx, dy] of AXES) {
    for (let y = 0; y < hauteur; y += 1) {
      for (let x = 0; x < largeur; x += 1) {
        if (x + dx * (mot.length - 1) >= largeur) continue;
        if (y + dy * (mot.length - 1) >= hauteur) continue;
        let lettres = "";
        for (let i = 0; i < mot.length; i += 1) lettres += grille[y + dy * i]![x + dx * i]!;
        if (lettres === mot || lettres === inverse) total += 1;
      }
    }
  }
  return total;
}

/** Le mot se lit-il au moins une fois dans la grille ? */
export function motPresent(grille: string[][], mot: string): boolean {
  return occurrences(grille, mot) > 0;
}

export interface MotsMelesPublies {
  grille: string[][];
  mots: string[];
  placements: { mot: string; cases: [number, number][] }[];
  reponse: string;
}

export function verifierMotsMeles(e: MotsMelesPublies): string[] {
  const problemes: string[] = [];
  const hauteur = e.grille.length;
  const largeur = e.grille[0]!.length;

  for (const ligne of e.grille) {
    if (ligne.length !== largeur) problemes.push("mots mêlés : grille non rectangulaire");
    for (const lettre of ligne) {
      if (!/^[A-Z]$/.test(lettre)) problemes.push(`mots mêlés : case invalide « ${lettre} »`);
    }
  }

  const occupees = new Set<number>();
  for (const placement of e.placements) {
    const lettres = placement.cases.map(([x, y]) => e.grille[y]![x]!).join("");
    const inverse = [...lettres].reverse().join("");
    if (lettres !== placement.mot && inverse !== placement.mot) {
      problemes.push(`mots mêlés : « ${placement.mot} » n'est pas à sa place annoncée`);
    }
    for (const [x, y] of placement.cases) {
      const cle = y * largeur + x;
      if (occupees.has(cle)) problemes.push("mots mêlés : deux mots se chevauchent");
      occupees.add(cle);
    }
  }

  for (const mot of e.mots) {
    const combien = occurrences(e.grille, mot);
    if (combien === 0) {
      problemes.push(`mots mêlés : « ${mot} » est introuvable dans la grille`);
    } else if (combien > 1) {
      problemes.push(`mots mêlés : « ${mot} » se lit ${combien} fois dans la grille`);
    }
  }
  if (new Set(e.mots).size !== e.mots.length) {
    problemes.push("mots mêlés : la liste contient deux fois le même mot");
  }
  if (e.mots.length !== e.placements.length) {
    problemes.push("mots mêlés : la liste et les placements ne concordent pas");
  }

  const restantes: string[] = [];
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      if (!occupees.has(y * largeur + x)) restantes.push(e.grille[y]![x]!);
    }
  }
  const motCache = restantes.join("");
  if (motCache !== e.reponse) {
    problemes.push(
      `mots mêlés : les lettres restantes donnent « ${motCache} » au lieu de « ${e.reponse} »`,
    );
  }
  return problemes;
}
