import { typographier } from "../engine/texte";
import type { CodePays } from "../vente/pays";

/**
 * Textes de la vente : le bloc d'achat de /creer, les réponses de la route de
 * commande, la page d'une commande, et ce qui part chez Stripe (produit,
 * facture, reçu). Aucun de ces textes ne contient de prénom ni de donnée de
 * la fête : ils sont les mêmes pour tout le monde.
 */

export const ACHAT = typographier({
  bientot: "La vente du jeu complet ouvre bientôt.",

  titre: "Le jeu complet",
  intro:
    "Le jeu complet reprend exactement cet aperçu : mêmes réponses, même référence, mêmes énigmes. Les solutions et le code final y figurent.",
  titreContenu: "Ce que contient le kit",
  libelleFormat: "Format",
  format: "Un PDF A4 à imprimer, lisible en noir et blanc : un lecteur PDF et une imprimante suffisent.",
  libellePrix: "Prix",
  libelleLivraison: "Livraison",
  livraison: "Téléchargement immédiat après le paiement ; le lien reste valable 30 jours.",

  libellePays: "Pays de résidence",
  autrePays: "Un autre pays",
  paysRefuse: "Nous ne pouvons pas encore vendre dans votre pays.",

  accordCgvAvant: "J'ai lu et j'accepte les ",
  accordCgvLien: "conditions générales de vente",
  accordCgvApres: ".",
  accordAccesImmediat:
    "Je demande l'accès immédiat à mon jeu dès le paiement et je reconnais perdre ainsi mon droit de rétractation (article L221-28, 13° du Code de la consommation).",

  bouton: "Commander et payer {prix}",
  enCours: "Préparation du paiement…",
  paiement:
    "Vous payez par carte bancaire, ou avec Apple Pay ou Google Pay si votre appareil le propose, sur la page sécurisée de Stripe, notre prestataire de paiement. Stripe vous envoie ensuite par e-mail votre facture et votre reçu, avec le lien de votre jeu.",
  nouvelOnglet: "(s'ouvre dans un nouvel onglet)",

  erreurAccordCgv: "Merci d'accepter les conditions générales de vente.",
  erreurAccordAcces:
    "Merci de demander l'accès immédiat à votre jeu : sans cet accord, il ne peut pas vous être livré dès le paiement.",
  erreurReseau: "La commande n'a pas pu être préparée. Vérifiez votre connexion et réessayez.",

  revoirApercu: "Revoir l'aperçu",
  apercuEnCours: "Préparation de l'aperçu…",
} as const);

/** Réponses de la route de commande, en cas de refus. */
export const REPONSES_COMMANDE = typographier({
  venteFermee: "La vente du jeu complet n'est pas encore ouverte.",
  tropVolumineuse: "Requête trop volumineuse.",
  illisible: "Requête illisible.",
  configurationInvalide: "Cette configuration n'est pas valide : composez un nouvel aperçu.",
  graineInvalide: "La référence de votre aperçu est illisible : composez un nouvel aperçu.",
  kitRefuse: "Ce jeu n'a pas passé ses contrôles : composez un nouvel aperçu.",
  indisponible: "La commande est momentanément impossible. Réessayez dans quelques minutes.",
  stripe: "Le paiement n'a pas pu être préparé. Réessayez dans quelques minutes.",
  methode: "Cette adresse attend un envoi de formulaire.",
} as const);

/** La page d'une commande, un texte par cas. */
export const COMMANDE = typographier({
  titrePage: "Votre commande",
  reference: "Référence de la commande",
  serviceClient: "Une question ? Écrivez-nous à {email} : nous répondons sous 7 jours au plus.",
  retourCreer: "Revenir à mon jeu",

  payee: {
    titre: "Votre jeu est prêt",
    texte: "Merci pour votre commande ! Votre jeu complet vous attend : un PDF A4 à imprimer, en couleur ou en noir et blanc.",
    bouton: "Télécharger mon jeu (PDF)",
    enCours: "Préparation de votre jeu…",
    validite: "Ce lien reste valable jusqu'au {date}, soit 30 jours après le paiement : pensez à enregistrer le fichier.",
    email: "Vous le retrouverez aussi dans l'e-mail envoyé par Stripe, avec votre facture et votre reçu.",
    erreurReseau: "Le téléchargement n'a pas abouti. Vérifiez votre connexion et réessayez.",
  },
  nonAboutie: {
    titre: "Le paiement n'a pas abouti",
    texte: "Cette commande n'est pas payée : votre jeu ne peut pas encore être livré. Vous pouvez revenir à votre jeu et relancer le paiement.",
  },
  introuvable: {
    titre: "Commande introuvable",
    texte: "Aucune commande ne correspond à cette adresse. Vérifiez le lien reçu dans l'e-mail de Stripe.",
  },
  expiree: {
    titre: "Ce lien a expiré",
    texte: "Le lien de téléchargement restait valable 30 jours après le paiement. Passé ce délai, vos réponses chiffrées sont effacées et le jeu ne peut plus être produit.",
  },
  remboursee: {
    titre: "Commande remboursée",
    texte: "Cette commande a été remboursée en totalité : le jeu n'est plus disponible au téléchargement.",
  },
  autreVersion: {
    titre: "Votre jeu doit être vérifié",
    texte: "Votre jeu a été composé avec une version précédente de Mission Gâteau, qui ne peut plus être produite telle quelle. Écrivez-nous en indiquant la référence de la commande : nous trouverons une solution.",
  },
  illisible: {
    titre: "Votre commande ne peut pas être relue",
    texte: "Le paiement est bien enregistré, mais les réponses de votre jeu ne peuvent pas être relues. Écrivez-nous en indiquant la référence de la commande.",
  },
  indisponible: {
    titre: "Vérification momentanément impossible",
    texte: "Votre commande ne peut pas être vérifiée pour le moment. Réessayez dans quelques minutes.",
  },
} as const);

/**
 * Ce qui part chez Stripe : le produit, la facture, le reçu et le rappel près
 * du bouton de paiement. Le thème et la tranche d'âge décrivent le produit ;
 * jamais un prénom.
 */
export const TEXTES_STRIPE = typographier({
  nomProduit: "Jeu d'anniversaire Mission Gâteau — kit personnalisé à imprimer (PDF)",
  descriptionProduit: "Thème {theme}, {tranche}",
  champFacture: "Votre jeu",
  descriptionFacture:
    "Commande {ref}. Vous avez demandé l'accès immédiat à votre jeu dès le paiement et renoncé ainsi à votre droit de rétractation (article L221-28, 13° du Code de la consommation). Votre lien de téléchargement reste valable 30 jours après le paiement. Conditions générales de vente acceptées : version du {versionCgv}.",
  descriptionPaiement: "Mission Gâteau — votre jeu à télécharger : {lien}",
  rappelPaiement:
    "En payant, vous demandez l'accès immédiat à votre jeu dès le paiement et vous renoncez ainsi à votre droit de rétractation (article L221-28, 13° du Code de la consommation).",
  mediateur: "Médiateur de la consommation : {nom}, {adresse}, {site}",
} as const);

/** Noms des pays acceptés, dans l'ordre où le formulaire les propose. */
export const NOMS_PAYS: Record<CodePays, string> = {
  FR: "France",
  DE: "Allemagne",
  AT: "Autriche",
  BE: "Belgique",
  BG: "Bulgarie",
  CA: "Canada",
  CY: "Chypre",
  HR: "Croatie",
  DK: "Danemark",
  ES: "Espagne",
  EE: "Estonie",
  FI: "Finlande",
  GR: "Grèce",
  HU: "Hongrie",
  IE: "Irlande",
  IT: "Italie",
  LV: "Lettonie",
  LT: "Lituanie",
  LU: "Luxembourg",
  MT: "Malte",
  MC: "Monaco",
  NL: "Pays-Bas",
  PL: "Pologne",
  PT: "Portugal",
  RO: "Roumanie",
  SK: "Slovaquie",
  SI: "Slovénie",
  SE: "Suède",
  CH: "Suisse",
  CZ: "Tchéquie",
};
