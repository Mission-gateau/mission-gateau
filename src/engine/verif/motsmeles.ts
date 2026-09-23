/**
 * Vérification des mots mêlés, à partir des seules données publiées :
 * la grille, la liste de mots, et les cases occupées par chaque mot.
 */

const DIRECTIONS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, -1], [1, -1], [-1, 1],
];

/** Cherche un mot dans la grille, dans les huit directions. */
export function motPresent(grille: string[][], mot: string): boolean {
  const hauteur = grille.length;
  const largeur = grille[0]!.length;
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      for (const [dx, dy] of DIRECTIONS) {
        let trouve = true;
        for (let i = 0; i < mot.length; i += 1) {
          const cx = x + dx * i;
          const cy = y + dy * i;
          if (cx < 0 || cy < 0 || cx >= largeur || cy >= hauteur || grille[cy]![cx] !== mot[i]) {
            trouve = false;
            break;
          }
        }
        if (trouve) return true;
      }
    }
  }
  return false;
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
    if (!motPresent(e.grille, mot)) {
      problemes.push(`mots mêlés : « ${mot} » est introuvable dans la grille`);
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
