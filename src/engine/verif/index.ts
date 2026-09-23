import { LETTRES } from "../texte";
import type { Enigme } from "../types";
import { verifierLabyrinthe } from "./labyrinthe";
import { verifierLogique } from "./logique";
import { verifierMotsMeles } from "./motsmeles";
import { compterSolutions } from "./sudoku";

/**
 * Contrôle indépendant des énigmes.
 *
 * Ces fonctions ne lisent que ce qui est imprimé sur la fiche ou la carte :
 * la grille, la légende, les indices. Elles refont le chemin de l'enfant et
 * comparent le résultat à la réponse annoncée. Un générateur qui se tromperait
 * ne pourrait pas passer inaperçu.
 */

const OPERATEURS: Record<string, (a: number, b: number) => number> = {
  "+": (a, b) => a + b,
  "−": (a, b) => a - b,
  "×": (a, b) => a * b,
};

function verifierCalcul(lignes: string[], reponse: string): string[] {
  const problemes: string[] = [];
  let precedent: number | null = null;
  for (const ligne of lignes) {
    const m = /^(\d+) (.) (\d+) = \?$/u.exec(ligne);
    if (!m) {
      problemes.push(`calcul : ligne illisible « ${ligne} »`);
      return problemes;
    }
    const a = Number(m[1]);
    const operateur = OPERATEURS[m[2]!];
    const b = Number(m[3]);
    if (!operateur) {
      problemes.push(`calcul : opérateur inconnu « ${m[2]} »`);
      return problemes;
    }
    if (precedent !== null && a !== precedent) {
      problemes.push(`calcul : la ligne « ${ligne} » ne reprend pas le résultat précédent`);
    }
    precedent = operateur(a, b);
    if (precedent < 0) problemes.push(`calcul : résultat négatif à « ${ligne} »`);
  }
  if (String(precedent) !== reponse) {
    problemes.push(`calcul : le calcul donne ${precedent} au lieu de ${reponse}`);
  }
  return problemes;
}

function decoder(
  suite: readonly string[],
  legende: readonly { lettre: string; code?: string; icone?: string }[],
  cle: "code" | "icone",
): { mot: string; problemes: string[] } {
  const problemes: string[] = [];
  const inverse = new Map<string, string>();
  for (const entree of legende) {
    const symbole = entree[cle];
    if (symbole === undefined) continue;
    if (inverse.has(symbole)) problemes.push(`légende ambiguë : « ${symbole} » vaut deux lettres`);
    inverse.set(symbole, entree.lettre);
  }
  const mot = suite
    .map((symbole) => {
      const lettre = inverse.get(symbole);
      if (lettre === undefined) {
        problemes.push(`symbole absent de la légende : « ${symbole} »`);
        return "?";
      }
      return lettre;
    })
    .join("");
  return { mot, problemes };
}

export function verifierEnigme(e: Enigme): string[] {
  const problemes: string[] = [];
  if (!e.titre.trim()) problemes.push(`${e.id} : titre vide`);
  if (!e.consigne.trim()) problemes.push(`${e.id} : consigne vide`);
  if (!e.reponse.trim()) problemes.push(`${e.id} : réponse vide`);
  if (!e.solution.trim()) problemes.push(`${e.id} : solution vide`);
  if (e.role === "code" && !/^[0-9]$/.test(e.reponse)) {
    problemes.push(`${e.id} : une énigme de code doit répondre par un chiffre`);
  }

  const prefixe = (liste: string[]) => liste.map((p) => `${e.id} : ${p}`);

  switch (e.type) {
    case "devinette": {
      if (!e.texte.trim()) problemes.push(`${e.id} : devinette vide`);
      break;
    }
    case "intrus": {
      const differentes: [number, number][] = [];
      e.grille.forEach((ligne, y) =>
        ligne.forEach((icone, x) => {
          if (icone !== e.icone) differentes.push([x, y]);
        }),
      );
      if (differentes.length !== 1) {
        problemes.push(`${e.id} : ${differentes.length} intrus au lieu d'un seul`);
        break;
      }
      const [x, y] = differentes[0]!;
      if (x !== e.position[0] || y !== e.position[1]) {
        problemes.push(`${e.id} : la position annoncée de l'intrus est fausse`);
      }
      if (e.reponse !== `L${y + 1}C${x + 1}`) {
        problemes.push(`${e.id} : la réponse ne désigne pas la case de l'intrus`);
      }
      break;
    }
    case "suite": {
      const periode = e.motif.length;
      e.affichee.forEach((icone, i) => {
        const attendue = e.motif[i % periode]!;
        if (i === e.indexManquant) {
          if (icone !== null) problemes.push(`${e.id} : la case à deviner n'est pas vide`);
          if (attendue !== e.reponse) problemes.push(`${e.id} : la réponse ne suit pas le motif`);
        } else if (icone !== attendue) {
          problemes.push(`${e.id} : la suite ne respecte pas son motif en case ${i + 1}`);
        }
      });
      if (!e.choix.includes(e.reponse)) problemes.push(`${e.id} : la bonne réponse n'est pas proposée`);
      if (new Set(e.choix).size !== e.choix.length) problemes.push(`${e.id} : choix en double`);
      break;
    }
    case "comptage": {
      const total = e.grille.flat().filter((icone) => icone === e.iconeCible).length;
      if (total !== e.total) problemes.push(`${e.id} : ${total} icônes cibles au lieu de ${e.total}`);
      if (String(total) !== e.reponse) problemes.push(`${e.id} : la réponse ne vaut pas le compte`);
      break;
    }
    case "labyrinthe": {
      problemes.push(...prefixe(verifierLabyrinthe(e.labyrinthe)));
      break;
    }
    case "pictogrammes": {
      const { mot, problemes: soucis } = decoder(e.suite, e.legende, "icone");
      problemes.push(...prefixe(soucis));
      if (mot !== e.reponse) problemes.push(`${e.id} : les pictogrammes donnent « ${mot} »`);
      break;
    }
    case "calcul": {
      problemes.push(...prefixe(verifierCalcul(e.lignes, e.reponse)));
      break;
    }
    case "motsmeles": {
      problemes.push(
        ...prefixe(
          verifierMotsMeles({
            grille: e.grille,
            mots: e.mots,
            placements: e.placements,
            reponse: e.reponse,
          }),
        ),
      );
      if (e.grille.length !== e.taille) problemes.push(`${e.id} : taille de grille incohérente`);
      break;
    }
    case "miroir": {
      const lu = [...e.texteMiroir].reverse().join("");
      if (lu !== e.reponse) problemes.push(`${e.id} : le miroir donne « ${lu} »`);
      break;
    }
    case "cesar": {
      if (e.decalage < 1 || e.decalage > 25) problemes.push(`${e.id} : décalage hors bornes`);
      const clair = [...e.texteChiffre]
        .map((lettre) => {
          const index = LETTRES.indexOf(lettre);
          return index < 0 ? lettre : LETTRES[(index - e.decalage + 26) % 26]!;
        })
        .join("");
      if (clair !== e.reponse) problemes.push(`${e.id} : le déchiffrement donne « ${clair} »`);
      if (clair === e.texteChiffre) problemes.push(`${e.id} : le texte n'est pas chiffré`);
      break;
    }
    case "sudoku": {
      const forme = { taille: e.taille, blocLargeur: e.blocLargeur, blocHauteur: e.blocHauteur };
      const { nombre, premiere } = compterSolutions(e.grille, forme, 2);
      if (nombre === 0) problemes.push(`${e.id} : sudoku sans solution`);
      if (nombre > 1) problemes.push(`${e.id} : sudoku à plusieurs solutions`);
      if (premiere && JSON.stringify(premiere) !== JSON.stringify(e.grilleSolution)) {
        problemes.push(`${e.id} : la grille résolue publiée est fausse`);
      }
      const [cx, cy] = e.caseCle;
      if (e.grille[cy]![cx] !== null) problemes.push(`${e.id} : la case du code est déjà remplie`);
      if (String(e.grilleSolution[cy]![cx]) !== e.reponse) {
        problemes.push(`${e.id} : le chiffre annoncé ne correspond pas à la case grisée`);
      }
      break;
    }
    case "logique": {
      problemes.push(
        ...prefixe(
          verifierLogique(
            { lignes: e.lignes, colonnes: e.colonnes, indices: e.indicesStructures },
            e.attribution,
            e.indices,
          ),
        ),
      );
      const valeur =
        e.colonnes[e.colonneQuestion]!.valeurs[e.attribution[e.ligneQuestion]![e.colonneQuestion]!];
      if (valeur !== e.reponse) problemes.push(`${e.id} : la réponse ne suit pas la solution`);
      break;
    }
    case "morse": {
      const { mot, problemes: soucis } = decoder(e.codes, e.legende, "code");
      problemes.push(...prefixe(soucis));
      if (mot !== e.reponse) problemes.push(`${e.id} : le morse donne « ${mot} »`);
      break;
    }
  }
  return problemes;
}
