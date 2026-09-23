import { typographier } from "../engine/texte";

/** Textes du site. Aucun prix, aucun avis, aucun chiffre invérifiable. */

export const SITE = typographier({
  nom: "Mission Gâteau",
  promesse: "Le jeu d'anniversaire personnalisé, prêt à imprimer",
  sousTitre:
    "Vous choisissez un thème, l'âge fêté et les cachettes de votre maison. Le site compose aussitôt un kit complet : guide de l'organisateur, invitations, cartes-indices, énigmes, diplômes.",
  boutonPrincipal: "Créer mon jeu",
  boutonSecondaire: "Voir comment ça marche",

  titreEtapes: "Trois étapes, et c'est prêt",
  etapes: [
    {
      titre: "Vous répondez à six questions",
      texte:
        "Le thème, l'âge fêté, le prénom, le nombre d'enfants, la durée, et les cachettes dont vous disposez chez vous. Une septième étape, facultative, sert aux invitations et aux diplômes.",
    },
    {
      titre: "Le jeu se compose tout seul",
      texte:
        "Les énigmes sont fabriquées et vérifiées par le site : chaque parcours est contrôlé, chaque solution recalculée avant impression.",
    },
    {
      titre: "Vous imprimez et vous jouez",
      texte:
        "Un PDF A4, lisible en noir et blanc, avec le déroulé minute par minute et les coups de pouce si une équipe bloque.",
    },
  ],

  titreFormats: "Un format par âge",
  formats: [
    {
      cle: "chasse",
      titre: "Chasse au trésor",
      age: "4-6 ans",
      texte:
        "Les enfants ne lisent pas encore : les indices sont en images, les comptines se lisent à voix haute, et les énigmes se résolvent du doigt.",
      points: ["Comptines lues par l'adulte", "Intrus, suites et labyrinthes", "Un seul groupe, mené par vous"],
    },
    {
      cle: "mission",
      titre: "Mission",
      age: "7-9 ans",
      texte:
        "Lecture simple et premiers codes : un alphabet de pictogrammes, des mots mêlés, de l'écriture en miroir et un code à trois chiffres.",
      points: ["Lecture courte et claire", "Codes à déchiffrer", "Jusqu'à trois équipes"],
    },
    {
      cle: "escape",
      titre: "Escape game",
      age: "10-12 ans",
      texte:
        "De la logique et du chiffrement : César, sudoku, grille de logique, morse, et un code final à quatre chiffres. Dès qu'il y a plusieurs équipes, le code se répartit entre elles et personne ne le détient en entier.",
      points: ["Chiffrements et déductions", "Code final à quatre chiffres", "Coopératif dès deux équipes"],
    },
  ],

  titreThemes: "Trois thèmes",
  titreExemple: "À quoi ressemble le kit",
  exempleTexte:
    "Voici les pages telles qu'elles sortent de l'imprimante : peu d'aplats, beaucoup de blanc, et tout reste lisible en noir et blanc.",

  titreDetails: "Ce que contient chaque kit",
  details: [
    "Le guide de l'organisateur : déroulé minute par minute, matériel, plan de pose, texte à lire à voix haute.",
    "Une invitation par invité, quatre par page, avec les traits de coupe.",
    "Les cartes-indices numérotées, à découper et à cacher, avec la cachette rappelée en petit pour vous.",
    "Les fiches d'énigmes, une série par équipe.",
    "La page du trésor et un diplôme par enfant.",
    "La page des solutions, séparée, à garder pour vous.",
  ],

  titreSecurite: "Des cachettes sûres, choisies par vous",
  securiteTexte:
    "La liste des cachettes est fermée et pensée pour la maison : aucune n'est un appareil, une prise, une fenêtre, un balcon ou un escalier, aucune n'oblige à grimper, aucune n'est dans la salle de bains ni à l'extérieur. Vous cochez celles que vous avez, et le formulaire vous rappelle, au moment de choisir, d'écarter celles qui seraient trop près du four ou des plaques.",

  titreDonnees: "Vos réponses restent chez vous",
  donneesTexte:
    "Rien n'est enregistré, rien n'est journalisé, rien n'est transmis à un tiers. Le prénom de l'enfant sert à composer le kit, puis disparaît avec la requête. Aucun cookie, aucun traceur, aucune ressource chargée depuis un autre domaine.",

  piedDePage: "Mission Gâteau — site en préparation",
  lienCredits: "Crédits et licences",
} as const);

export const CREDITS = typographier({
  titre: "Crédits et licences",
  intro:
    "Tout ce que le site et les PDF contiennent est soit écrit ici, soit repris de ressources libres dont voici la liste. Rien n'est chargé depuis un autre domaine au moment où vous utilisez le site : les polices et les images sont servies par missiongateau.com.",
  titreRessources: "Ressources reprises",
  ressources: [
    {
      nom: "Noto Emoji",
      usage: "Toutes les icônes du site et des PDF, en PNG.",
      licence: "Apache License 2.0",
      lienLicence: "https://www.apache.org/licenses/LICENSE-2.0",
      lien: "https://github.com/googlefonts/noto-emoji",
      credit: "Google LLC et les contributeurs du projet Noto Emoji.",
    },
    {
      nom: "Nunito",
      usage: "Police du texte, sur le site et dans les PDF.",
      licence: "SIL Open Font License 1.1",
      lienLicence: "https://scripts.sil.org/OFL",
      lien: "https://fonts.google.com/specimen/Nunito",
      credit: "Vernon Adams, Cyreal, Jacques Le Bailly.",
    },
    {
      nom: "Fredoka",
      usage: "Police des titres, sur le site et dans les PDF.",
      licence: "SIL Open Font License 1.1",
      lienLicence: "https://scripts.sil.org/OFL",
      lien: "https://fonts.google.com/specimen/Fredoka",
      credit: "Milena Brandão, Hafontia.",
    },
  ],
  titreRegles: "Les règles que nous nous donnons",
  regles: [
    "Licences acceptées pour tout ce qui est livré : MIT, Apache 2.0, SIL Open Font License, CC0, et CC BY 4.0 avec crédit.",
    "Licences refusées : CC BY-SA, toute clause non commerciale, et toute licence inconnue.",
    "Aucun personnage, nom ou univers protégé n'apparaît dans les jeux : les histoires, les énigmes et les textes sont écrits pour Mission Gâteau.",
  ],
  titreTextes: "Textes et énigmes",
  textesTexte:
    "Les histoires, les devinettes, les consignes et les énigmes sont écrites et fabriquées pour Mission Gâteau. Les grilles, les labyrinthes et les codes sont produits par le site et vérifiés automatiquement avant impression.",
} as const);
