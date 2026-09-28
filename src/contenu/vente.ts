import { typographier } from "../engine/texte";
import type { CodePays } from "../vente/pays";

/**
 * Textes de la vente : le bloc d'achat de /creer, les réponses des routes de
 * la vente, la page d'une commande, et ce qui part chez Stripe (produit,
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
  livraison: "E-mail de confirmation, puis téléchargement immédiat sur la page de votre commande ; lien valable 30 jours.",
  retractation:
    "Droit de rétractation : 14 jours après le paiement, jusqu'au début du premier téléchargement. Pour l'exercer : « Renoncer au contrat ici », en bas de chaque page. Détails : article 8 des conditions générales de vente ; formulaire type : en annexe de ces conditions.",

  libellePays: "Pays de résidence",
  autrePays: "Un autre pays",
  paysRefuse: "Nous ne pouvons pas encore vendre dans votre pays.",

  accordCgvAvant: "J'ai lu et j'accepte les ",
  accordCgvLien: "conditions générales de vente",
  accordCgvApres: ".",
  accordAccesImmediat:
    "Je demande à recevoir mon jeu dès le paiement, avant la fin du délai de rétractation de 14 jours, et je reconnais que je perdrai mon droit de rétractation dès le début de son premier téléchargement (article L221-28, 13° du Code de la consommation).",

  bouton: "Commander et payer {prix}",
  enCours: "Préparation du paiement…",
  paiement:
    "Vous payez par carte bancaire, ou avec Apple Pay ou Google Pay si votre appareil le propose, sur la page sécurisée de Stripe, notre prestataire de paiement. Nous vous envoyons ensuite par e-mail la confirmation de votre commande, avec le lien de votre jeu et nos conditions générales de vente ; Stripe vous envoie de son côté votre facture et votre reçu.",
  nouvelOnglet: "(s'ouvre dans un nouvel onglet)",

  /** Le bloc d'achat tient lieu de bon de commande : il nomme le médiateur et donne l'adresse de son site (article R616-1 du Code de la consommation). */
  mediateur: "Médiateur de la consommation : {nom}, site ",

  erreurAccordCgv: "Merci d'accepter les conditions générales de vente.",
  erreurAccordAcces: "Merci de cocher la seconde case : elle est nécessaire pour recevoir votre jeu dès le paiement.",
  erreurReseau: "La commande n'a pas pu être préparée. Vérifiez votre connexion et réessayez.",

  revoirApercu: "Revoir l'aperçu",
  apercuEnCours: "Préparation de l'aperçu…",
} as const);

/** Réponses des routes de la vente et de l'aperçu, en cas de refus. */
export const REPONSES_COMMANDE = typographier({
  formatRefuse: "Cette adresse n'accepte que des données envoyées au format JSON.",
  origineRefusee: "Cette demande ne peut venir que d'une page de Mission Gâteau : elle a été refusée.",
  venteFermee: "La vente du jeu complet n'est pas encore ouverte.",
  tropVolumineuse: "Requête trop volumineuse.",
  illisible: "Requête illisible.",
  configurationInvalide: "Cette configuration n'est pas valide : composez un nouvel aperçu.",
  graineInvalide: "La référence de votre aperçu est illisible : composez un nouvel aperçu.",
  kitRefuse: "Ce jeu n'a pas passé ses contrôles : composez un nouvel aperçu.",
  kitImpossible: "Ce jeu n'a pas pu être préparé. Composez un nouvel aperçu, ou réessayez dans quelques minutes.",
  indisponible: "La commande est momentanément impossible. Réessayez dans quelques minutes.",
  stripe: "Le paiement n'a pas pu être préparé. Réessayez dans quelques minutes.",
  methode: "Cette adresse attend une demande envoyée par une page du site.",
  enregistrementImpossible:
    "Votre téléchargement n'a pas pu être enregistré : le jeu ne vous est pas envoyé pour le moment. Réessayez dans quelques minutes.",
} as const);

/** La page d'une commande, un texte par cas. */
export const COMMANDE = typographier({
  titrePage: "Votre commande",
  reference: "Référence de la commande",
  serviceClient: "Une question ? Écrivez-nous à {email} : nous répondons sous 7 jours au plus.",
  retourCreer: "Revenir à mon jeu",
  lienRenoncer: "Renoncer au contrat ici",

  payee: {
    titre: "Votre jeu est prêt",
    texte: "Merci pour votre commande ! Votre jeu complet vous attend : un PDF A4 à imprimer, en couleur ou en noir et blanc.",
    confirmationEnvoyee: "Votre confirmation de commande vous a été envoyée par e-mail à {adresse}.",
    confirmationEnvoyeeSansAdresse: "Votre confirmation de commande vous a été envoyée par e-mail.",
    confirmationEssai:
      "Exemplaire d'essai : hors production, les e-mails ne partent qu'aux adresses de test de notre prestataire d'envoi ; celui-ci est parti à {test} au lieu de {adresse}.",
    avantTelechargement:
      "Le téléchargement commence l'exécution de votre commande : comme vous l'avez demandé, votre droit de rétractation prend fin au début du premier téléchargement. D'ici là, vous pouvez renoncer au contrat :",
    delaiExpire: "Votre délai de rétractation a pris fin le {date}.",
    apresTelechargement: "Premier téléchargement le {date} à {heure} : votre droit de rétractation a pris fin à ce moment.",
    bouton: "Télécharger mon jeu (PDF)",
    enCours: "Préparation de votre jeu…",
    validite:
      "Ce lien reste valable jusqu'au {date} à {heure} (heure de Paris), soit 30 jours après le paiement : pensez à enregistrer le fichier.",
    email: "Le lien de cette page figure dans votre e-mail de confirmation.",
    erreurReseau: "Le téléchargement n'a pas abouti. Vérifiez votre connexion et réessayez.",
  },
  /** Commande payée dont la confirmation n'est pas encore partie : la page l'envoie à son chargement. */
  confirmation: {
    titre: "Merci pour votre commande",
    texte: "Votre paiement est bien reçu. Votre jeu vous est proposé dès que votre confirmation de commande est partie par e-mail.",
    envoi: "Envoi de votre confirmation de commande…",
    enAttente: "Votre confirmation de commande est en cours d'envoi. Cette page se met à jour dans quelques instants.",
    echec:
      "Votre confirmation de commande n'a pas pu vous être envoyée par e-mail pour le moment : votre jeu vous sera proposé dès qu'elle sera partie. Réessayez plus tard en rechargeant cette page, ou écrivez-nous à {email}.",
    /** L'e-mail est parti, mais sa marque n'a pas pu être posée chez Stripe. */
    nonEnregistree: "Votre confirmation de commande est partie, mais n'a pas pu être enregistrée : rechargez cette page dans quelques minutes.",
    impossible:
      "Votre confirmation de commande ne peut pas être préparée. Écrivez-nous à {email} en indiquant la référence de la commande : nous vous répondons sous 7 jours au plus.",
    reessayer: "Réessayer",
  },
  nonAboutie: {
    titre: "Le paiement n'a pas abouti",
    texte: "Cette commande n'est pas payée : votre jeu ne peut pas encore être livré. Vous pouvez revenir à votre jeu et relancer le paiement.",
  },
  introuvable: {
    titre: "Commande introuvable",
    texte: "Aucune commande ne correspond à cette adresse. Vérifiez le lien reçu dans l'e-mail de confirmation de votre commande.",
  },
  expiree: {
    titre: "Ce lien a expiré",
    texte: "Le lien de téléchargement restait valable 30 jours après le paiement. Passé ce délai, vos réponses chiffrées sont effacées et le jeu ne peut plus être produit.",
  },
  remboursee: {
    titre: "Commande remboursée",
    texte: "Cette commande a été remboursée en totalité : le jeu n'est plus disponible au téléchargement.",
  },
  retractee: {
    titre: "Commande rétractée",
    texte: "Vous avez renoncé à cette commande : le jeu n'est plus disponible au téléchargement.",
    le: "Votre rétractation a été enregistrée le {date} à {heure}.",
    rembourse: "Remboursement : {montant} remboursés par Stripe sur la carte utilisée pour le paiement.",
    demande:
      "Remboursement demandé : {montant}, sur la carte utilisée pour le paiement ; il apparaît sur votre compte selon les délais de votre banque.",
    aRembourser:
      "Remboursement : pas encore effectué ; il vous sera versé sous 14 jours au plus après votre rétractation, sur la carte utilisée pour le paiement.",
    litige:
      "Le paiement de cette commande fait l'objet d'une contestation auprès de votre banque : le vendeur vous répond sous 7 jours au plus.",
  },
  aExaminer: {
    titre: "Commande à examiner",
    texte:
      "Le premier téléchargement de votre jeu et une rétractation sont arrivés presque en même temps : le vendeur examine votre commande et vous répond sous 7 jours au plus. Pour toute question, écrivez-nous en indiquant la référence de la commande.",
  },
  litige: {
    titre: "Paiement contesté",
    texte: "Le paiement de cette commande fait l'objet d'une contestation auprès de votre banque : le jeu ne peut pas être livré tant qu'elle est en cours. Écrivez-nous en indiquant la référence de la commande : nous vous répondons sous 7 jours au plus.",
  },
  nonConfirmee: {
    titre: "Confirmation en attente",
    texte: "Votre confirmation de commande n'est pas encore partie : rechargez la page de votre commande.",
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
    "Commande {ref}. Vous avez demandé à recevoir votre jeu dès le paiement ; votre droit de rétractation de 14 jours prend fin au début de son premier téléchargement (article L221-28, 13° du Code de la consommation). Votre lien de téléchargement reste valable 30 jours après le paiement. Conditions générales de vente acceptées : version du {versionCgv}.",
  descriptionPaiement: "Mission Gâteau — votre jeu à télécharger : {lien}",
  rappelPaiement:
    "En payant, vous demandez à recevoir votre jeu dès le paiement ; votre droit de rétractation de 14 jours prendra fin au début de son premier téléchargement (article L221-28, 13° du Code de la consommation).",
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
