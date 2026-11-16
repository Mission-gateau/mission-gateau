import { typographier } from "../engine/texte";

/**
 * Textes des épingles Pinterest : ceux écrits sur les images (titre en
 * haut, mention en bas) et ceux des flux RSS (titre et description de
 * chaque article, titre et description de chaque flux).
 *
 * Aucun prix, aucun avis, aucune note, aucun chiffre de ventes, aucune
 * adresse e-mail : `tests/epingles.test.ts` le vérifie sur chaque article.
 * Rien n'y est promis que le site ne tienne : les phrases sur les formats
 * reprennent celles de l'accueil (src/contenu/site.ts).
 *
 * Gabarits : {age}, {prenom}, {theme}, {tranche}, {jeu}, {enigmes}, {enigme}.
 * « de {prenom} » s'écrit toujours ainsi : src/epingles/flux.ts l'élide quand
 * le prénom commence par une voyelle ou un h (« d'Alba », « d'Hugo »).
 */
export const TEXTES_EPINGLES = typographier({
  /** En bas de chaque image. */
  pied: "Aperçu gratuit sur missiongateau.com",

  /** Un flux par tableau Pinterest : le titre du flux est le nom du tableau. */
  flux: {
    "chasse-4-6-ans": {
      titre: "Chasse au trésor anniversaire 4-6 ans",
      description:
        "Des pages de vraies chasses au trésor d'anniversaire pour les 4-6 ans, à imprimer et à jouer à la maison : déroulé, cartes-indices en images, énigmes, trésor et diplôme.",
    },
    "mission-7-9-ans": {
      titre: "Mission agents secrets anniversaire 7-9 ans",
      description:
        "Des pages de vraies missions d'anniversaire pour les 7-9 ans, à imprimer et à jouer à la maison : codes à déchiffrer, mots mêlés, écriture en miroir, trésor et diplôme.",
    },
    "escape-game-10-12-ans": {
      titre: "Escape game anniversaire 10-12 ans",
      description:
        "Des pages de vrais jeux d'anniversaire en escape game pour les 10-12 ans, à imprimer et à jouer à la maison : chiffre de César, morse, sudoku, grille de logique, code final et diplôme.",
    },
    "idees-anniversaire": {
      titre: "Idées anniversaire enfant à la maison",
      description:
        "Organiser un anniversaire d'enfant à la maison : le déroulé de la fête, des cachettes sûres et des énigmes adaptées à l'âge, avec des pages de vrais jeux à imprimer.",
    },
  },

  /** Les trois formats : titre de l'image, désignation du jeu, titre et phrase de l'article. */
  formats: {
    chasse: {
      image: "Chasse au trésor d'anniversaire",
      jeu: "une chasse au trésor d'anniversaire",
      titre: "Chasse au trésor d'anniversaire {age} ans",
      phrase:
        "Chasse au trésor anniversaire {age} ans à la maison, jeu à imprimer : les indices sont en images, les comptines se lisent à voix haute, les énigmes se résolvent du doigt, en un seul groupe.",
    },
    mission: {
      image: "Mission d'anniversaire",
      jeu: "une mission d'anniversaire",
      titre: "Mission d'anniversaire {age} ans",
      phrase:
        "Mission d'anniversaire {age} ans à la maison, jeu à imprimer : lecture courte, alphabet de pictogrammes, mots mêlés, écriture en miroir et code final à trois chiffres.",
    },
    escape: {
      image: "Escape game d'anniversaire",
      jeu: "un escape game d'anniversaire",
      titre: "Escape game d'anniversaire {age} ans",
      phrase:
        "Escape game anniversaire {age} ans à la maison, jeu à imprimer : chiffre de César, morse, sudoku, grille de logique et code final à quatre chiffres.",
    },
  },

  /** La seconde ligne du titre de l'image, pour une page d'un format. */
  sousTitreFormat: "{tranche} · thème {theme} · à imprimer",

  /** Les thèmes, tels qu'ils s'écrivent dans une phrase. */
  themes: {
    pirates: "pirates",
    agents: "agents secrets",
    dinosaures: "dinosaures",
  },

  /** Ce que montre l'image : la fin du titre de l'article, et sa première phrase. */
  pages: {
    deroule: {
      titre: "le déroulé minute par minute",
      phrase:
        "Le déroulé minute par minute d'{jeu} pour {prenom}, {age} ans, thème {theme} : une page du guide de l'organisateur, imprimée avec le jeu.",
    },
    briefing: {
      titre: "l'histoire à lire au départ",
      phrase:
        "L'histoire à lire à voix haute au départ d'{jeu}, thème {theme}, puis la règle et la devinette qui lance la partie.",
    },
    cartes: {
      titre: "les cartes-indices à imprimer",
      phrase:
        "Des cartes-indices d'{jeu}, thème {theme}, à découper et à cacher dans la maison : {enigmes}.",
    },
    fiche: {
      titre: "{enigme} à imprimer",
      phrase:
        "Une fiche d'énigme d'{jeu}, thème {theme} : {enigmes}, avec sa solution dans la page réservée à l'adulte.",
    },
    tresor: {
      titre: "la page du trésor",
      phrase: "La page du trésor d'{jeu}, thème {theme} : la fin de la partie de {prenom}, {age} ans.",
    },
    diplome: {
      titre: "le diplôme à imprimer",
      phrase:
        "Le diplôme d'{jeu}, thème {theme}, au prénom de {prenom}, {age} ans : le jeu en compte un par enfant, avec le prénom de chaque invité ou une ligne à remplir.",
    },
    preparation: {
      titre: "la page à préparer",
      phrase:
        "La page « à préparer » d'{jeu} pour {age} ans : où poser chaque carte, le rôle de l'adulte et les consignes de sécurité des cachettes.",
    },
  },

  /** Les énigmes, telles qu'elles se nomment dans une phrase. */
  enigmes: {
    devinette: "une devinette",
    intrus: "l'intrus à trouver",
    suite: "la suite à compléter",
    comptage: "des objets à compter",
    labyrinthe: "un labyrinthe",
    pictogrammes: "un alphabet de pictogrammes",
    calcul: "un petit calcul",
    motsmeles: "des mots mêlés",
    miroir: "un message en miroir",
    cesar: "un message chiffré",
    sudoku: "un sudoku",
    logique: "une grille de logique",
    morse: "un message en morse",
  },
  /** Entre deux énigmes d'une même page. */
  et: " et ",

  /** La fin de la description d'une page d'un format. */
  finFormat:
    "Le lien mène à notre guide pour l'organiser ; l'aperçu gratuit de votre jeu se compose en quelques minutes.",

  /** Les guides « déroulé » et « cachettes » : titre de l'image, titre et phrase de l'article. */
  guides: {
    deroule: {
      image: "Le déroulé d'un anniversaire à la maison",
      titre: "Déroulé d'un anniversaire d'enfant à la maison : l'exemple d'un jeu pour {age} ans",
      phrase:
        "Accueil, jeu, goûter, gâteau et cadeaux : notre guide gratuit détaille le déroulé d'un anniversaire d'enfant à la maison, heure par heure, selon l'âge et le nombre d'enfants.",
    },
    cachettes: {
      image: "Cachettes et énigmes selon l'âge",
      titre: "Cachettes et énigmes selon l'âge : la page à préparer d'un jeu pour {age} ans",
      phrase:
        "Des cachettes sûres, pièce par pièce, et des énigmes adaptées à l'âge, de 4 à 12 ans : notre guide gratuit aide à les choisir, consignes de sécurité comprises.",
    },
  },
  /** La seconde ligne du titre de l'image, pour une page d'un guide. */
  sousTitreGuide: "Guide gratuit · page d'un jeu {tranche}",

  /** La fin de la description d'une page d'un guide. */
  finGuide: "L'aperçu gratuit de votre jeu d'anniversaire à imprimer se compose en quelques minutes.",
} as const);
