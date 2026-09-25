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

  libelleNom: "Nom",
  libellePrenom: "Prénom",
  libelleReference: "Référence de la commande",
  aideReference:
    "Elle figure dans votre e-mail de confirmation et sur la page de votre commande. Vous pouvez aussi coller le lien de la commande.",
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
    nom: "Indiquez votre nom.",
    prenom: "Indiquez votre prénom.",
    reference: "Indiquez la référence de votre commande, ou collez son lien.",
    email: "Indiquez une adresse e-mail valable : l'accusé de réception y sera envoyé.",
    reseau:
      "Votre déclaration n'a pas pu être envoyée. Vérifiez votre connexion et réessayez, ou écrivez-nous à {email} : nous vous répondons sous 7 jours au plus.",
    refusee:
      "Votre déclaration n'a pas pu être envoyée. Rechargez la page et réessayez, ou écrivez-nous à {email} : nous vous répondons sous 7 jours au plus.",
  },

  titreResultat: "Votre déclaration est reçue",
  /** Quand l'accusé n'a pas pu partir, la page ne dit pas que la déclaration est reçue : rien ne l'atteste encore. */
  titreEchec: "Votre déclaration",
  accuseEnvoye: "Un accusé de réception vous a été envoyé par e-mail à {adresse}.",
  copieAcheteur: "Une copie est aussi partie à l'adresse e-mail donnée lors du paiement.",
  essai:
    "Exemplaire d'essai : hors production, les e-mails ne partent qu'aux adresses de test de notre prestataire d'envoi ; l'accusé est parti à {test} au lieu de {adresse}.",
  accuseEchec: "L'accusé de réception n'a pas pu partir pour le moment.",
  renvoyer: "Renvoyer l'accusé de réception",
  renvoiEnCours: "Nouvel envoi de l'accusé de réception…",
  accuseEchecSuite:
    "Si l'envoi échoue encore, écrivez-nous à {email} en recopiant votre déclaration : nous vous répondons sous 7 jours au plus.",
  titreDejaEnregistree: "Votre rétractation est déjà enregistrée",
  dejaEnregistree: "Votre rétractation de cette commande a été enregistrée le {date} à {heure}.",
  dejaAccusee:
    "Un accusé de réception vous a été envoyé à ce moment-là : aucun nouveau remboursement ni nouvel e-mail n'est nécessaire.",
  remboursee: "Remboursement : effectué par Stripe sur la carte utilisée pour le paiement.",
  aRembourser: "Remboursement : pas encore effectué ; il vous sera versé sous 14 jours au plus après votre rétractation.",
  litige: "Remboursement : le paiement fait l'objet d'une contestation auprès de votre banque ; nous vous répondons sous 7 jours au plus.",
  nouvelleDeclaration: "Faire une autre déclaration",
} as const);

/** Réponses de la route de rétractation, en cas de refus. */
export const REPONSES_RETRACTATION = typographier({
  invalide: "Votre déclaration est incomplète : vérifiez chaque champ.",
  refusee: "Votre déclaration n'a pas pu être envoyée.",
} as const);
