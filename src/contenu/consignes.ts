import { typographier } from "../engine/texte";

/**
 * Consignes des énigmes.
 *
 * Tous les textes du jeu vivent dans src/contenu : le code des énigmes n'en
 * contient aucun. Les enfants sont tutoyés sur leur matériel, les parents sont
 * vouvoyés dans le guide et sur le site.
 *
 * Les {gabarits} sont remplis par src/engine/texte.ts, qui refuse de laisser
 * passer un gabarit non résolu.
 */

export const CONSIGNES = typographier({
  devinette: {
    chasse: "Écoute bien la comptine. Elle dit où aller.",
    mission: "Cette devinette indique la cachette suivante.",
    escape: "Cette devinette indique la cachette suivante.",
  },

  intrus: "Il y a un dessin qui n'est pas comme les autres. Montre-le du doigt.",

  suite: "Regarde bien l'ordre des dessins. Quel dessin manque à la fin ?",

  comptage: "Compte les {cible} de la grille. Dis le nombre à voix haute.",

  labyrinthe: {
    chasse: "Suis le chemin avec ton doigt, de l'entrée jusqu'à la sortie.",
    mission: "Trace le chemin de l'entrée jusqu'à la sortie, sans passer à travers les murs.",
    escape: "Trace l'unique chemin qui relie l'entrée à la sortie.",
  },

  pictogrammes:
    "Chaque dessin remplace une lettre. Utilise la légende pour lire le mot caché.",

  calcul:
    "Résous les trois opérations, l'une après l'autre. Le dernier résultat est un chiffre du code.",

  motsmeles:
    "Entoure tous les mots de la liste dans la grille. Ils se lisent à l'horizontale ou à la verticale, dans un sens ou dans l'autre. Les lettres qui restent, lues de gauche à droite et de haut en bas, forment le mot cherché.",

  miroir: "Ce mot est écrit à l'envers. Lis-le de droite à gauche, ou dans un miroir.",

  // Le décalage est un chiffre du code, souvent la réponse de la fiche que la
  // même carte fait remettre : l'écrire ici reviendrait à donner la solution.
  cesar:
    "Chaque lettre a été décalée dans l'alphabet, toujours du même nombre de rangs. Ce nombre est le chiffre que ton équipe a déjà trouvé. Recule d'autant de rangs pour retrouver le mot.",

  sudoku:
    "Remplis la grille : chaque chiffre de 1 à {max} apparaît une seule fois par ligne, par colonne et dans chaque bloc. Le chiffre de la case marquée d'un rond est un chiffre du code.",

  logique:
    "Lis les indices et complète le tableau. Une seule solution est possible.",

  morse: "Ce message est en morse. La légende donne la lettre de chaque signal.",
} as const);

/** Texte de la dernière carte, celle qui renvoie au maître du jeu. */
export const MESSAGES_FINAUX = typographier({
  chasse:
    "Bravo ! Il n'y a plus de carte à trouver. Apporte celle-ci au maître du jeu : le trésor n'est plus très loin.",
  mission:
    "C'était la dernière carte. Rassemblez tous les chiffres du code et apportez-les au maître du jeu : le trésor est à ce prix.",
  escape: {
    uneEquipe:
      "Fin de la piste. Rassemblez les chiffres que vous avez trouvés, reconstituez le code complet, et présentez-le au maître du jeu.",
    plusieursEquipes:
      "Fin de la piste. Réunissez vos chiffres avec ceux des autres équipes, reconstituez le code complet, et présentez-le au maître du jeu.",
  },
} as const);

/** Titres imprimés en haut de chaque énigme. */
export const TITRES = typographier({
  devinette: "Devinette",
  intrus: "Cherche l'intrus",
  suite: "La suite logique",
  comptage: "Compte bien",
  labyrinthe: "Le labyrinthe",
  pictogrammes: "L'alphabet secret",
  calcul: "Le calcul du code",
  motsmeles: "Les mots mêlés",
  miroir: "Le mot à l'envers",
  cesar: "Le message décalé",
  sudoku: "La grille de chiffres",
  logique: "L'énigme de logique",
  morse: "Le message en morse",
} as const);

/** Phrases de solution, pour la page réservée à l'adulte. */
export const SOLUTIONS = typographier({
  cachette: "La réponse est {reponse} : {cachette}.",
  cesar: "Décalage de {decalage} {rangs}. La réponse est {reponse} : {cachette}.",
  chiffre: "Le résultat est {reponse}. C'est le chiffre n° {position} du code.",
  bonus: "Réponse : {reponse}.",
  intrus: "L'intrus est en ligne {ligne}, colonne {colonne} : c'est {intrus} au milieu des {commun}.",
  comptage: "Il y a {total} {cible} dans la grille.",
  labyrinthe: "Le chemin compte {cases} cases.",
  suite: "Le dessin manquant est {reponse}.",
} as const);
