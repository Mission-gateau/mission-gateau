import { typographier } from "../engine/texte";

/**
 * Les e-mails : la confirmation de commande et l'accusé de réception d'une
 * rétractation. Ils ne contiennent jamais de donnée du jeu (prénoms, date,
 * heure, adresse et contact de la fête) : le jeu y est nommé par son thème et
 * sa tranche d'âge. L'accusé de réception reprend, lui, la déclaration de
 * celui qui se rétracte.
 */

/** L'expéditeur de tous les e-mails. Les réponses vont à l'e-mail du service client, lu dans la fiche du vendeur. */
export const EXPEDITEUR = "Mission Gâteau <commandes@missiongateau.com>";

export const CONFIRMATION = typographier({
  objet: "Confirmation de votre commande Mission Gâteau",
  intro:
    "Merci pour votre commande ! Voici sa confirmation : gardez cet e-mail. Nos conditions générales de vente, dans la version que vous avez acceptée, y sont jointes en PDF.",

  titreCommande: "Votre commande",
  libelleReference: "Référence",
  libellePayeeLe: "Payée le",
  payeeLe: "{date} à {heure} (heure de Paris)",
  libelleJeu: "Jeu",
  jeu: "{produit} — thème {theme}, {tranche}",
  libellePrix: "Prix",
  prix: "{montant} — {tva}, payé par carte",

  titreJeu: "Votre jeu",
  telechargement:
    "Votre jeu se télécharge sur la page de votre commande, par son bouton « Télécharger mon jeu (PDF) » :",
  validite:
    "Ce lien reste valable 30 jours après le paiement, jusqu'au {date} à {heure} (heure de Paris) : pensez à enregistrer le fichier.",

  titreAccord: "Votre demande de recevoir le jeu dès le paiement",
  accord:
    "Avant de payer, le {date} à {heure}, vous avez demandé à recevoir votre jeu avant la fin du délai de rétractation de 14 jours et reconnu que vous perdrez votre droit de rétractation dès le début de son premier téléchargement (article L221-28, 13° du Code de la consommation). Cet e-mail vous confirme cet accord et cette reconnaissance.",

  titreRetractation: "Votre droit de rétractation",
  retractation:
    "Vous pouvez renoncer à votre commande, sans avoir à vous justifier, jusqu'au début du premier téléchargement de votre jeu, et au plus tard le {date} :",
  parLien: "par le lien ",
  lienRenoncer: "Renoncer au contrat ici",
  parLienSuite: " ;",
  parFormulaire: "par le formulaire type ci-dessous ;",
  parDeclaration: "par toute déclaration claire envoyée par e-mail à {email} ou par courrier à {adresse}.",
  remboursement: "Nous vous rembourserons alors {montant} sous 14 jours au plus, sur la carte utilisée pour le paiement.",

  titreFormulaire: "Formulaire type de rétractation",
  formulaire: "Vous pouvez le recopier, le compléter et nous le renvoyer par e-mail ou par courrier :",

  titreVendeur: "Le vendeur",
  libelleVendeur: "Vendeur",
  libelleNomCommercial: "Nom commercial",
  libelleSiret: "SIRET",
  libelleRcs: "RCS",
  libelleAdresse: "Adresse",
  libelleTelephone: "Téléphone",
  libelleEmail: "E-mail",
  serviceClient: "Service client : écrivez-nous à {email} ; nous répondons sous 7 jours au plus. Il suffit de répondre à cet e-mail.",
  garantie:
    "Comme tout contenu numérique, votre jeu bénéficie de la garantie légale de conformité et de la garantie légale des vices cachés : voir l'article {article} des conditions générales de vente jointes.",
  mediateur: "Médiateur de la consommation dont relève le vendeur : {nom}, {adresse}, {site}.",
  mediation:
    "La médiation est gratuite pour vous. Elle suppose une réclamation écrite adressée d'abord au vendeur et restée sans solution, puis une saisine du médiateur dans l'année qui suit cette réclamation (article L612-2 du Code de la consommation) : en ligne, sur {demande}, ou par courrier à l'adresse ci-dessus.",

  pieceJointe: "Pièce jointe : nos conditions générales de vente, version du {version} (fichier {fichier}).",
} as const);

export const ACCUSE = typographier({
  objet: "Accusé de réception de votre rétractation — Mission Gâteau",
  intro:
    "Nous avons bien reçu votre déclaration de rétractation. En voici le contenu, avec la date et l'heure de son envoi, et la suite que nous lui donnons.",

  titreDeclaration: "Votre déclaration",
  declaration: "Je renonce au contrat portant sur la commande indiquée ci-dessous.",
  libelleNom: "Nom",
  libellePrenom: "Prénom",
  libelleReference: "Référence de la commande",
  libelleEmail: "Adresse e-mail",
  libelleEnvoyee: "Envoyée le",
  envoyee: "{date} à {heure} (heure de Paris)",

  titreSuite: "Suite donnée",
  libelleStatut: "Statut",
  retractee: {
    statut: "rétractation enregistrée",
    texte: "Votre rétractation est enregistrée : votre jeu n'est plus disponible au téléchargement.",
  },
  rembourse: {
    statut: "remboursement effectué",
    texte:
      "Nous vous avons remboursé {montant} sur la carte utilisée pour le paiement ; le remboursement apparaît sur votre compte selon les délais de votre banque.",
  },
  aRembourser: {
    statut: "remboursement à venir",
    texte: "Nous vous rembourserons {montant} sur la carte utilisée pour le paiement, sous 14 jours au plus.",
  },
  litige: {
    statut: "paiement contesté, remboursement non automatique",
    texte:
      "Le paiement de cette commande fait l'objet d'une contestation auprès de votre banque : il ne peut pas être remboursé automatiquement. Nous vous répondons sous 7 jours au plus.",
  },
  dejaRetractee: {
    statut: "rétractation déjà enregistrée",
    texte:
      "Votre rétractation de cette commande a déjà été enregistrée le {date} à {heure} (heure de Paris), à la réception d'une précédente déclaration. Cette nouvelle déclaration, envoyée le {dateDeclaration} à {heureDeclaration}, n'y change rien : votre jeu n'est plus disponible au téléchargement, et aucun second remboursement n'est fait.",
  },
  telechargee: {
    statut: "droit de rétractation éteint au premier téléchargement",
    texte:
      "Votre droit de rétractation a pris fin au début du premier téléchargement de votre jeu, le {date} à {heure} (heure de Paris), comme vous l'aviez demandé et reconnu avant de payer (article L221-28, 13° du Code de la consommation). Votre commande est donc maintenue, sans remboursement.",
  },
  simultanee: {
    statut: "déclaration arrivée en même temps que le premier téléchargement, examinée par le vendeur",
    texte:
      "Votre déclaration et le premier téléchargement de votre jeu, le {date} à {heure} (heure de Paris), sont arrivés presque en même temps. Le vendeur examine votre commande et vous répond sous 7 jours au plus.",
  },
  expiree: {
    statut: "délai de rétractation expiré",
    texte: "Le délai de rétractation de cette commande a pris fin le {date}. Votre commande est donc maintenue, sans remboursement.",
  },
  erreur: "Si vous pensez qu'il s'agit d'une erreur, répondez à cet e-mail : nous vous répondons sous 7 jours au plus.",
  manuelle: {
    statut: "déclaration traitée à la main par le vendeur, qui vous répond sous 7 jours",
    texte:
      "Votre déclaration est bien reçue, mais elle n'a pas pu être traitée automatiquement : le vendeur la traite à la main et vous répond sous 7 jours au plus. Aucun remboursement n'est fait automatiquement d'ici là.",
  },

  titreVendeur: "Le vendeur",
  vendeur: "{vendeur}, {adresse}, {email}",
} as const);
