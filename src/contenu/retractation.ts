import { typographier } from "../engine/texte";

/**
 * La page /renoncer : la fonction de rétractation exigée par les articles
 * L221-21 et D221-5 du Code de la consommation. Ses deux libellés imposés
 * sont « Renoncer au contrat ici » (le lien qui y mène) et « Confirmer la
 * rétractation » (le bouton qui envoie la déclaration).
 */
export const RETRACTATION = typographier({
  lien: "Renoncer au contrat ici",
  titre: "Renoncer au contrat",
  description: "La fonction de rétractation de Mission Gâteau : renoncer à une commande et recevoir un accusé de réception.",
  intro: [
    "Vous pouvez renoncer à votre commande pendant 14 jours après le paiement, jusqu'au début du premier téléchargement de votre jeu, sans avoir à vous justifier.",
    "Nous vous remboursons alors la totalité du prix, sur la carte utilisée pour le paiement, sous 14 jours au plus.",
  ],
  /** Sous les deux phrases : ce qu'il faut pour se servir de cette page, et ce qui reste possible sans elle. */
  prealable:
    "Il vous faut la référence de votre commande : elle figure dans l'e-mail de confirmation de votre commande. À défaut, vous pouvez vous rétracter par e-mail à {email} ou par courrier à {adresse}.",

  titreSaisie: "Vos coordonnées et votre commande",
  libelleNom: "Nom",
  libellePrenom: "Prénom",
  libelleReference: "Référence de la commande",
  aideReference:
    "Elle figure dans votre e-mail de confirmation et sur la page de votre commande : 22 lettres, chiffres, tirets (-) ou tirets bas (_). Vous pouvez aussi coller le lien de la commande.",
  libelleEmail: "Adresse e-mail",
  aideEmail: "Nous y envoyons l'accusé de réception de votre déclaration.",
  libellePiege: "Laissez ce champ vide",

  verifier: "Vérifier ma déclaration",
  titreRecapitulatif: "Votre déclaration",
  recapitulatif: "Je renonce au contrat portant sur la commande indiquée ci-dessous.",
  modifier: "Modifier",
  confirmer: "Confirmer la rétractation",
  envoi: "Envoi de votre déclaration…",

  erreurs: {
    nom: "Indiquez votre nom : des lettres, et au besoin des espaces, des apostrophes ou des traits d'union, 60 caractères au plus.",
    prenom:
      "Indiquez votre prénom : des lettres, et au besoin des espaces, des apostrophes ou des traits d'union, 60 caractères au plus.",
    reference: "Indiquez la référence de votre commande (22 caractères), ou collez le lien de sa page.",
    email: "Indiquez une adresse e-mail valable, de 254 caractères au plus : l'accusé de réception y sera envoyé.",
    reseau:
      "Votre déclaration n'a pas pu être envoyée. Vérifiez votre connexion et réessayez, ou écrivez-nous à {email} : nous vous répondons sous 7 jours au plus.",
    refusee:
      "Votre déclaration n'a pas pu être envoyée. Rechargez la page et réessayez, ou écrivez-nous à {email} : nous vous répondons sous 7 jours au plus.",
  },

  /** Aucune commande payée retrouvée, ou Stripe injoignable : rien n'est enregistré ni envoyé. */
  nonTransmise: {
    titre: "Votre déclaration n'a pas été transmise",
    introuvable:
      "Nous ne trouvons aucune commande payée sous cette référence : votre déclaration n'a pas été transmise et aucun accusé de réception ne partira.",
    conseils: [
      "La référence figure dans l'e-mail de confirmation de votre commande, et le lien « Renoncer au contrat ici » de cet e-mail la remplit tout seul.",
      "Si votre paiement vient d'avoir lieu, réessayez dans quelques minutes.",
      "À défaut, rétractez-vous par e-mail à {email} ou par courrier à {adresse}, avec le formulaire type en annexe des conditions générales de vente ou par toute autre déclaration dénuée d'ambiguïté.",
    ],
    indisponible:
      "Nous ne pouvons pas vérifier votre commande pour le moment : votre déclaration n'a pas été transmise. Réessayez dans quelques minutes, ou envoyez-la dès maintenant par e-mail : une déclaration envoyée avant la fin du délai de rétractation préserve votre droit.",
    boutonEmail: "Envoyer ma déclaration par e-mail",
    aideEmail:
      "Ce bouton ouvre votre messagerie avec votre déclaration déjà écrite, adressée au vendeur : aucun e-mail ne part de notre site, et vous gardez la preuve de votre envoi.",
    corriger: "Corriger ma déclaration",
  },
  /** L'e-mail que le bouton prépare dans la messagerie de la personne. */
  courriel: {
    objet: "Rétractation de la commande {ref}",
    declaration: "Je renonce au contrat portant sur la commande indiquée ci-dessous.",
    nom: "Nom : {nom}",
    prenom: "Prénom : {prenom}",
    reference: "Référence de la commande : {ref}",
    email: "Adresse e-mail : {email}",
    faiteLe: "Déclaration faite le {date} à {heure} (heure de Paris).",
  },

  titreResultat: "Votre déclaration est reçue",
  /** Quand l'accusé n'a pas pu partir, la page ne dit pas que la déclaration est reçue : rien ne l'atteste encore. */
  titreEchec: "Votre déclaration",
  accuseEnvoye: "Un accusé de réception vous a été envoyé par e-mail à {adresse}.",
  copie: "Si l'adresse e-mail utilisée lors du paiement est différente, une copie y part aussi.",
  essai:
    "Exemplaire d'essai : hors production, les e-mails ne partent qu'aux adresses de test de notre prestataire d'envoi ; l'accusé est parti à {test} au lieu de {adresse}.",
  plafond:
    "Cet accusé de réception s'affiche ici sans être renvoyé par e-mail : trois accusés sont déjà partis pour cette commande. Pour toute question, écrivez au vendeur à {email}.",
  accuseEchec: "L'accusé de réception n'a pas pu partir pour le moment.",
  renvoyer: "Renvoyer l'accusé de réception",
  renvoiEnCours: "Nouvel envoi de l'accusé de réception…",
  accuseEchecSuite:
    "Si l'envoi échoue encore, écrivez-nous à {email} en recopiant votre déclaration : nous vous répondons sous 7 jours au plus.",
  titreDejaAccusee: "Votre déclaration est déjà enregistrée",
  dejaAccusee: "Votre déclaration du {date} à {heure} est déjà enregistrée, et son accusé de réception vous a été envoyé par e-mail.",
  titreEnCours: "Votre déclaration",
  enCours: "Votre déclaration est en cours de traitement : rechargez la page dans quelques instants.",
  reessayer: "Réessayer",
  nouvelleDeclaration: "Faire une autre déclaration",
} as const);

/** Réponses de la route de rétractation, en cas de refus. */
export const REPONSES_RETRACTATION = typographier({
  invalide: "Votre déclaration est incomplète : vérifiez chaque champ.",
  refusee: "Votre déclaration n'a pas pu être envoyée.",
} as const);
