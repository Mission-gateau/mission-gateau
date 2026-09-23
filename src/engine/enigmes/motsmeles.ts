import type { Alea } from "../alea";
import { MOTS_GRILLE } from "../../contenu/mots";
import { occurrences } from "../verif/motsmeles";

export interface MotsMelesGeneres {
  grille: string[][];
  mots: string[];
  placements: { mot: string; cases: [number, number][] }[];
}

/**
 * Grille de mots mêlés « à mot caché ».
 *
 * La grille est remplie entièrement : les mots de la liste occupent toutes les
 * cases sauf exactement autant qu'il y a de lettres dans le mot-réponse. Les
 * cases restantes, lues de gauche à droite et de haut en bas, donnent donc le
 * mot cherché — c'est une propriété de la construction, pas une retouche.
 *
 * Méthode : on remplit toujours la première case libre dans l'ordre de
 * lecture, soit par un mot (à l'horizontale ou à la verticale, écrit à
 * l'endroit ou à l'envers), soit par une lettre du mot-réponse. Le retour sur
 * trace corrige les impasses. Deux élagages suffisent à rendre la recherche
 * rapide : on n'écrit jamais un mot s'il ne reste plus assez de cases pour les
 * lettres du mot-réponse, et on n'écrit plus que des lettres du mot-réponse
 * quand il reste exactement autant de cases que de lettres.
 */
export function genererMotsMeles(
  alea: Alea,
  taille: number,
  motReponse: string,
): MotsMelesGeneres {
  const reponse = motReponse.toUpperCase();
  const total = taille * taille;
  if (reponse.length >= total) throw new Error("mots mêlés : mot-réponse trop long");

  const parLongueur = new Map<number, string[]>();
  for (const mot of MOTS_GRILLE) {
    if (mot === reponse) continue;
    const liste = parLongueur.get(mot.length) ?? [];
    liste.push(mot);
    parLongueur.set(mot.length, liste);
  }

  const LONGUEUR_MIN = 3;
  const LONGUEUR_MAX = 8;
  const CANDIDATS_PAR_LONGUEUR = 5;
  const BUDGET = 120_000;
  const ESSAIS = 60;

  for (let essai = 0; essai < ESSAIS; essai += 1) {
    const tirage = alea.deriver(`grille|${taille}|${reponse}|${essai}`);
    const cellules: (string | null)[] = Array.from({ length: total }, () => null);
    const placements: { mot: string; cases: [number, number][] }[] = [];
    const utilises = new Set<string>();
    let noeuds = 0;
    let libres = total;

    const placer = (
      depart: number,
      pas: number,
      lettres: string,
    ): [number, number][] => {
      const positions: [number, number][] = [];
      for (let i = 0; i < lettres.length; i += 1) {
        const index = depart + pas * i;
        cellules[index] = lettres[i]!;
        positions.push([index % taille, Math.floor(index / taille)]);
      }
      return positions;
    };

    const retirer = (depart: number, pas: number, longueur: number): void => {
      for (let i = 0; i < longueur; i += 1) cellules[depart + pas * i] = null;
    };

    const explorer = (indexReponse: number): boolean => {
      noeuds += 1;
      if (noeuds > BUDGET) return false;

      let position = -1;
      for (let i = 0; i < total; i += 1) {
        if (cellules[i] === null) {
          position = i;
          break;
        }
      }
      if (position === -1) return indexReponse === reponse.length;

      const restantesReponse = reponse.length - indexReponse;
      const x = position % taille;
      const y = Math.floor(position / taille);

      // Combien de cases libres d'affilée, vers la droite et vers le bas.
      let vers = 0;
      while (x + vers < taille && cellules[position + vers] === null) vers += 1;
      let bas = 0;
      while (y + bas < taille && cellules[position + bas * taille] === null) bas += 1;

      if (libres > restantesReponse) {
        const options: { pas: number; longueur: number; rang: number }[] = [];
        for (let longueur = Math.min(LONGUEUR_MAX, vers); longueur >= LONGUEUR_MIN; longueur -= 1) {
          options.push({ pas: 1, longueur, rang: longueur * 10 + tirage.entier(19) });
        }
        for (let longueur = Math.min(LONGUEUR_MAX, bas); longueur >= LONGUEUR_MIN; longueur -= 1) {
          options.push({ pas: taille, longueur, rang: longueur * 10 + tirage.entier(19) });
        }
        // Les mots longs d'abord, avec assez de hasard pour que l'horizontale
        // et la verticale alternent. Le rang est tiré une fois par option :
        // un comparateur au hasard rendrait le tri dépendant du moteur.
        options.sort((a, b) => b.rang - a.rang);

        for (const option of options) {
          if (libres - option.longueur < restantesReponse) continue;
          const disponibles = (parLongueur.get(option.longueur) ?? []).filter(
            (mot) => !utilises.has(mot),
          );
          if (disponibles.length === 0) continue;
          const candidats = tirage
            .melanger(disponibles)
            .slice(0, CANDIDATS_PAR_LONGUEUR);
          for (const mot of candidats) {
            const lettres = tirage.booleen() ? mot : [...mot].reverse().join("");
            const positions = placer(position, option.pas, lettres);
            utilises.add(mot);
            placements.push({ mot, cases: positions });
            libres -= option.longueur;
            if (explorer(indexReponse)) return true;
            libres += option.longueur;
            placements.pop();
            utilises.delete(mot);
            retirer(position, option.pas, option.longueur);
            if (noeuds > BUDGET) return false;
          }
        }
      }

      if (restantesReponse > 0) {
        cellules[position] = reponse[indexReponse]!;
        libres -= 1;
        if (explorer(indexReponse + 1)) return true;
        libres += 1;
        cellules[position] = null;
      }
      return false;
    };

    if (explorer(0)) {
      const grille: string[][] = [];
      for (let y = 0; y < taille; y += 1) {
        grille.push(cellules.slice(y * taille, (y + 1) * taille) as string[]);
      }
      const mots = placements.map((p) => p.mot).sort((a, b) => a.localeCompare(b, "fr"));
      // Le remplissage peut faire apparaître un mot une seconde fois par
      // hasard, souvent un mot court. L'enfant qui entoure la mauvaise
      // occurrence obtiendrait une réponse fausse : on repart alors sur un
      // autre essai plutôt que de livrer une grille ambiguë.
      if (mots.every((mot) => occurrences(grille, mot) === 1)) {
        return { grille, mots, placements };
      }
      continue;
    }
  }
  throw new Error(`mots mêlés : aucune grille ${taille}x${taille} trouvée pour « ${reponse} »`);
}
