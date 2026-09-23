import { typographier } from "../engine/texte";

/** Textes du guide de l'organisateur. Communs aux thèmes et aux formats. */

export const GUIDE = typographier({
  sousTitre: "Guide de l'organisateur",
  intro:
    "Tout est prêt : il ne vous reste qu'à imprimer, découper et poser les cartes aux bons endroits. Ce guide vous dit quoi faire, minute par minute, et vous donne toutes les solutions.",

  titreMateriel: "Le matériel",
  materiel: [
    "Une paire de ciseaux, pour détacher les cartes et les invitations.",
    "Du ruban adhésif ou de la pâte à fixer, pour tenir une carte sous un meuble.",
    "Des enveloppes, si vous voulez glisser les cartes à l'abri des regards.",
    "Un cadenas à code, si vous en avez un : facultatif, mais l'effet est garanti.",
    "Le trésor : le gâteau et les cadeaux, rassemblés dans un carton ou un sac.",
  ],

  titrePreparation: "À préparer avant l'arrivée des enfants",
  preparation: [
    "Imprimez le kit en A4, recto simple, en noir et blanc si vous préférez : tout reste lisible.",
    "Découpez les cartes-indices. Chaque carte indique en petit, pour vous, la cachette où la poser.",
    "Posez les cartes dans l'ordre du plan de pose ci-dessous, puis vérifiez que rien ne dépasse.",
    "Mettez le trésor de côté : vous ne le remettrez qu'à la toute fin.",
    "Gardez les fiches d'énigmes avec vous : vous les distribuez au fur et à mesure.",
  ],

  titrePlanPose: "Le plan de pose",
  planPoseIntro:
    "Posez une carte par équipe dans chaque cachette. Le symbole imprimé en haut de la carte indique à quelle équipe elle appartient.",
  planPoseSolo: "Posez une carte dans chaque cachette, dans l'ordre indiqué.",

  titreLecture: "À lire à voix haute, au départ",
  titreBriefing: "Puis annoncez la règle",
  titreDepart: "Et donnez la première devinette",

  titreEtapes: "Étape par étape : solutions et coups de pouce",
  etapesIntro:
    "Pour chaque étape : la cachette, puis trois indices de plus en plus précis. Donnez-les dans l'ordre, seulement si une équipe bloque vraiment.",
  indiceTitres: ["Premier coup de pouce", "Deuxième coup de pouce", "Troisième coup de pouce"],

  titreMaitreDuJeu: "Votre rôle pendant la partie",
  maitreDuJeu: [
    "Vous validez les réponses : une équipe vous apporte sa carte, vous confirmez ou vous laissez chercher encore.",
    "Vous remettez les fiches d'énigmes quand une carte le demande.",
    "Vous ne remettez le trésor qu'en échange du code complet, annoncé à voix haute.",
    "Si une équipe s'impatiente, donnez un coup de pouce plutôt que la réponse.",
  ],
  maitreDuJeuSansCode:
    "Vous lisez les cartes à voix haute, vous validez les réponses, et vous conduisez le groupe jusqu'au trésor à la dernière carte.",

  titreSecurite: "Consignes de sécurité",
  securite: [
    "Toutes les cachettes proposées sont à hauteur d'enfant : personne n'a besoin de grimper.",
    "Aucune cachette n'est un appareil, une prise, une fenêtre, un balcon ou un escalier, et aucune ne se trouve dans la salle de bains ni à l'extérieur.",
    "Si l'une des cachettes que vous avez cochées se trouve près du four ou des plaques, décochez-la et prenez-en une autre : le jeu s'adapte.",
    "Avant de commencer, fermez les pièces qui ne servent pas au jeu.",
    "Rappelez la règle aux enfants : on marche, on ne court pas, et on ne monte sur rien.",
    "Restez avec le groupe du début à la fin : le jeu se joue à l'intérieur, sous votre surveillance.",
    "Rangez hors de portée les produits ménagers, les médicaments et les objets coupants avant l'arrivée des invités.",
  ],

  titreSolutions: "Page des solutions",
  solutionsIntro: "À garder pour vous, loin des regards curieux.",
  colonneEtape: "Étape",
  colonneCachette: "Cachette",
  colonneReponse: "Réponse attendue",
  colonneChiffre: "Chiffre du code",
  codeFinalLibelle: "Code final",
  sansCode: "Pas de code final à ce format : la dernière carte ramène au maître du jeu.",

  titreInvitations: "Invitations",
  mentionSite: "Jeu créé sur missiongateau.com",
  invitationDate: "Date :",
  invitationHeure: "Heure :",
  invitationAdresse: "Adresse :",
  invitationContact: "Contact :",
  invitationPour: "Pour :",

  titreCartes: "Cartes-indices à découper",
  cartesIntro:
    "Découpez le long des pointillés. La mention en bas de chaque carte vous rappelle où la poser : les enfants ne la lisent pas.",
  cartePoser: "À poser :",
  carteNumero: "Carte",
  titreFiches: "Fiches d'énigmes",
  fichesIntro: "À remettre quand une équipe vous apporte la carte correspondante.",
  ficheNumero: "Fiche",
  titreDiplomes: "Diplômes",
  titreTresor: "Le trésor",

  apercuFiligrane: "APERÇU",
  apercuTitre: "Aperçu gratuit",
  apercuIntro:
    "Voici quatre pages représentatives de votre kit : une invitation, une carte-indice, une énigme et le début du guide. Le kit complet contient toutes les cartes, toutes les énigmes, les solutions, le trésor et les diplômes.",
  apercuSansSolution: "Les solutions et le code final ne figurent pas dans cet aperçu.",
} as const);
