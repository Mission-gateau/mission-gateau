import type { Alea } from "../alea";
import { CONSIGNES, SOLUTIONS, TITRES } from "../../contenu/consignes";
import { ALPHABET_PICTO, libelleIcone, type CleIcone } from "../icones";
import { LETTRES, remplir } from "../texte";
import type { Cachette, Enigme, IdFormat } from "../types";
import { creerGrille, iconesDistinctes } from "./grille";
import { genererLabyrinthe } from "./labyrinthe";
import { genererMotsMeles } from "./motsmeles";
import { genererSudoku } from "./sudoku";
import { genererLogique } from "./logique";
import { MORSE } from "./morse";
import { DEVINETTES } from "../../contenu/devinettes";
import type { ValeurLogique } from "../../contenu/logique";

export interface ContexteEnigme {
  alea: Alea;
  format: IdFormat;
  /** Identifiant stable, du genre « e1-A-nav ». */
  id: string;
  iconesTheme: CleIcone[];
  personnages: readonly string[];
  objetsLogique: readonly ValeurLogique[];
}

/** Décalages de César utilisables : le chiffre trouvé plus tôt par l'équipe. */
export interface ContexteCesar {
  decalage: number;
  origine: string;
}

const TAILLES_LABYRINTHE: Record<IdFormat, [number, number]> = {
  chasse: [5, 5],
  mission: [8, 8],
  escape: [12, 12],
};

// --------------------------------------------------------------------------
// Énigmes de navigation : la réponse est le mot-clé d'une cachette
// --------------------------------------------------------------------------

function solutionCachette(cible: Cachette): string {
  return remplir(SOLUTIONS.cachette, { reponse: cible.motCle, cachette: cible.libelle });
}

export function enigmeDevinette(ctx: ContexteEnigme, cible: Cachette): Enigme {
  const texte = DEVINETTES[cible.id]?.[ctx.format];
  if (!texte) throw new Error(`Devinette manquante : ${cible.id} / ${ctx.format}`);
  return {
    id: ctx.id,
    type: "devinette",
    titre: TITRES.devinette,
    consigne: CONSIGNES.devinette[ctx.format],
    texte,
    reponse: cible.motCle,
    role: "navigation",
    surFiche: false,
    solution: solutionCachette(cible),
  };
}

export function enigmePictogrammes(ctx: ContexteEnigme, cible: Cachette): Enigme {
  const lettres = [...new Set(cible.motCle.split(""))].sort();
  return {
    id: ctx.id,
    type: "pictogrammes",
    titre: TITRES.pictogrammes,
    consigne: CONSIGNES.pictogrammes,
    legende: lettres.map((lettre) => ({ lettre, icone: ALPHABET_PICTO[lettre]! })),
    suite: cible.motCle.split("").map((lettre) => ALPHABET_PICTO[lettre]!),
    reponse: cible.motCle,
    role: "navigation",
    surFiche: false,
    solution: solutionCachette(cible),
  };
}

export function enigmeMiroir(ctx: ContexteEnigme, cible: Cachette): Enigme {
  return {
    id: ctx.id,
    type: "miroir",
    titre: TITRES.miroir,
    consigne: CONSIGNES.miroir,
    texteMiroir: [...cible.motCle].reverse().join(""),
    reponse: cible.motCle,
    role: "navigation",
    surFiche: false,
    solution: solutionCachette(cible),
  };
}

export function enigmeCesar(ctx: ContexteEnigme, cible: Cachette, cesar: ContexteCesar): Enigme {
  const chiffre = [...cible.motCle]
    .map((lettre) => LETTRES[(LETTRES.indexOf(lettre) + cesar.decalage) % 26]!)
    .join("");
  return {
    id: ctx.id,
    type: "cesar",
    titre: TITRES.cesar,
    consigne: CONSIGNES.cesar,
    texteChiffre: chiffre,
    decalage: cesar.decalage,
    origineDecalage: cesar.origine,
    reponse: cible.motCle,
    role: "navigation",
    surFiche: false,
    // Seule la page réservée à l'adulte donne le décalage.
    solution: remplir(SOLUTIONS.cesar, {
      decalage: cesar.decalage,
      reponse: cible.motCle,
      cachette: cible.libelle,
    }),
  };
}

export function enigmeMorse(ctx: ContexteEnigme, cible: Cachette): Enigme {
  const lettres = [...new Set(cible.motCle.split(""))].sort();
  return {
    id: ctx.id,
    type: "morse",
    titre: TITRES.morse,
    consigne: CONSIGNES.morse,
    codes: cible.motCle.split("").map((lettre) => MORSE[lettre]!),
    legende: lettres.map((lettre) => ({ lettre, code: MORSE[lettre]! })),
    reponse: cible.motCle,
    role: "navigation",
    surFiche: false,
    solution: solutionCachette(cible),
  };
}

export function enigmeMotsMeles(ctx: ContexteEnigme, cible: Cachette, taille: number): Enigme {
  const { grille, mots, placements } = genererMotsMeles(ctx.alea, taille, cible.motCle);
  return {
    id: ctx.id,
    type: "motsmeles",
    titre: TITRES.motsmeles,
    consigne: CONSIGNES.motsmeles,
    taille,
    grille,
    mots,
    placements,
    reponse: cible.motCle,
    role: "navigation",
    surFiche: true,
    solution: solutionCachette(cible),
  };
}

// --------------------------------------------------------------------------
// Énigmes de code : la réponse est un chiffre
// --------------------------------------------------------------------------

function solutionChiffre(reponse: number, position: number): string {
  return remplir(SOLUTIONS.chiffre, { reponse, position });
}

const SYMBOLES = { plus: "+", moins: "−", fois: "×" };

export function enigmeCalcul(ctx: ContexteEnigme, chiffre: number, position: number): Enigme {
  for (let essai = 0; essai < 80; essai += 1) {
    const tirage = ctx.alea.deriver(`calcul|${essai}`);
    const depart = tirage.entre(3, 9);
    const ajout = tirage.entre(2, 9);
    const v1 = depart + ajout;
    const double = tirage.booleen();
    const v2 = double ? v1 * 2 : v1 + tirage.entre(3, 9);
    const retrait = v2 - chiffre;
    if (retrait < 1 || v2 > 40) continue;
    const lignes = [
      `${depart} ${SYMBOLES.plus} ${ajout} = ?`,
      double ? `${v1} ${SYMBOLES.fois} 2 = ?` : `${v1} ${SYMBOLES.plus} ${v2 - v1} = ?`,
      `${v2} ${SYMBOLES.moins} ${retrait} = ?`,
    ];
    return {
      id: ctx.id,
      type: "calcul",
      titre: TITRES.calcul,
      consigne: CONSIGNES.calcul,
      lignes,
      expression: lignes.join(" ; "),
      reponse: String(chiffre),
      role: "code",
      surFiche: false,
      solution: solutionChiffre(chiffre, position),
    };
  }
  throw new Error(`calcul : aucune suite d'opérations trouvée pour ${chiffre}`);
}

export function enigmeSudoku(ctx: ContexteEnigme, position: number, taille: 4 | 6): Enigme {
  const sudoku = genererSudoku(ctx.alea, taille);
  return {
    id: ctx.id,
    type: "sudoku",
    titre: TITRES.sudoku,
    consigne: remplir(CONSIGNES.sudoku, { max: taille }),
    taille,
    blocLargeur: sudoku.forme.blocLargeur,
    blocHauteur: sudoku.forme.blocHauteur,
    grille: sudoku.grille,
    grilleSolution: sudoku.solution,
    caseCle: sudoku.caseCle,
    reponse: String(sudoku.chiffre),
    role: "code",
    surFiche: true,
    solution: solutionChiffre(sudoku.chiffre, position),
  };
}

export function enigmeLogique(ctx: ContexteEnigme, position: number): Enigme {
  const grille = genererLogique(ctx.alea, ctx.personnages, ctx.objetsLogique);
  return {
    id: ctx.id,
    type: "logique",
    titre: TITRES.logique,
    consigne: CONSIGNES.logique,
    lignes: grille.lignes,
    colonnes: grille.colonnes,
    indices: grille.indices,
    indicesStructures: grille.indicesStructures,
    attribution: grille.attribution,
    question: grille.question,
    ligneQuestion: grille.ligneQuestion,
    colonneQuestion: grille.colonneQuestion,
    reponse: String(grille.chiffre),
    role: "code",
    surFiche: true,
    solution: solutionChiffre(grille.chiffre, position),
  };
}

// --------------------------------------------------------------------------
// Énigmes d'agrément
// --------------------------------------------------------------------------

export function enigmeIntrus(ctx: ContexteEnigme): Enigme {
  const [commun, intrus] = iconesDistinctes(ctx.alea, ctx.iconesTheme, 2) as [CleIcone, CleIcone];
  const largeur = 4;
  const hauteur = 4;
  const x = ctx.alea.entier(largeur);
  const y = ctx.alea.entier(hauteur);
  const grille = creerGrille(largeur, hauteur, (cx, cy) => (cx === x && cy === y ? intrus : commun));
  return {
    id: ctx.id,
    type: "intrus",
    titre: TITRES.intrus,
    consigne: CONSIGNES.intrus,
    grille,
    icone: commun,
    iconeIntrus: intrus,
    position: [x, y],
    reponse: `L${y + 1}C${x + 1}`,
    role: "bonus",
    surFiche: false,
    solution: remplir(SOLUTIONS.intrus, {
      ligne: y + 1,
      colonne: x + 1,
      intrus: libelleIcone(intrus),
      commun: libelleIcone(commun),
    }),
  };
}

export function enigmeSuite(ctx: ContexteEnigme): Enigme {
  const periode = ctx.alea.entre(2, 3);
  const motif = iconesDistinctes(ctx.alea, ctx.iconesTheme, periode);
  const longueur = periode === 2 ? 7 : 7;
  const complete = Array.from({ length: longueur }, (_, i) => motif[i % periode]!);
  const indexManquant = longueur - 1;
  const bonne = complete[indexManquant]!;
  const leurres = iconesDistinctes(
    ctx.alea,
    ctx.iconesTheme.filter((i) => i !== bonne),
    2,
  );
  return {
    id: ctx.id,
    type: "suite",
    titre: TITRES.suite,
    consigne: CONSIGNES.suite,
    motif,
    affichee: complete.map((icone, i) => (i === indexManquant ? null : icone)),
    choix: ctx.alea.melanger([bonne, ...leurres]),
    indexManquant,
    reponse: bonne,
    role: "bonus",
    surFiche: false,
    solution: remplir(SOLUTIONS.suite, { reponse: libelleIcone(bonne) }),
  };
}

export function enigmeComptage(ctx: ContexteEnigme): Enigme {
  const largeur = 5;
  const hauteur = 4;
  const [cible, ...autres] = iconesDistinctes(ctx.alea, ctx.iconesTheme, 4) as CleIcone[];
  const total = ctx.alea.entre(3, 8);
  const positions = new Set(ctx.alea.echantillon(
    Array.from({ length: largeur * hauteur }, (_, i) => i),
    total,
  ));
  const grille = creerGrille(largeur, hauteur, (x, y) =>
    positions.has(y * largeur + x) ? cible! : ctx.alea.choisir(autres),
  );
  return {
    id: ctx.id,
    type: "comptage",
    titre: TITRES.comptage,
    consigne: remplir(CONSIGNES.comptage, { cible: libelleIcone(cible!) }),
    grille,
    iconeCible: cible!,
    total,
    reponse: String(total),
    role: "bonus",
    surFiche: false,
    solution: remplir(SOLUTIONS.comptage, { total, cible: libelleIcone(cible!) }),
  };
}

export function enigmeLabyrinthe(ctx: ContexteEnigme): Enigme {
  const [largeur, hauteur] = TAILLES_LABYRINTHE[ctx.format];
  const labyrinthe = genererLabyrinthe(ctx.alea, largeur, hauteur);
  return {
    id: ctx.id,
    type: "labyrinthe",
    titre: TITRES.labyrinthe,
    consigne: CONSIGNES.labyrinthe[ctx.format],
    labyrinthe,
    reponse: "SORTIE",
    role: "bonus",
    surFiche: true,
    solution: remplir(SOLUTIONS.labyrinthe, { cases: labyrinthe.chemin.length }),
  };
}
