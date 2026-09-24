import { typographier } from "../engine/texte";
import { adresseSurUneLigne, denomination, mediateurCite, siRempli } from "../vente/fiche";
import type { FicheVendeur } from "./vendeur";
import { SITE } from "./site";

/**
 * Les trois pages légales : mentions légales, conditions générales de vente
 * et politique de confidentialité.
 *
 * Chaque page est construite à partir de la fiche du vendeur : rien n'y est
 * recopié à la main, et un champ vide n'y apparaît jamais. Tant que la
 * convention avec le médiateur n'est pas signée, le médiateur n'est nommé
 * nulle part.
 */

/** Date de mise à jour des trois pages. */
export const MISE_A_JOUR = "24 septembre 2026";

/**
 * Version des CGV. L'identifiant part dans les métadonnées de chaque
 * commande ; le libellé figure sur la facture et sur la page.
 * Toute modification des CGV change les deux.
 */
export const VERSION_CGV = { identifiant: "2026-09-24", libelle: "24 septembre 2026" } as const;

export type Morceau = string | { texte: string; lien: string };

export type Bloc =
  | { type: "paragraphe"; morceaux: Morceau[] }
  | { type: "liste"; elements: Morceau[][] }
  | { type: "coordonnees"; lignes: { libelle: string; valeur: Morceau[] }[] }
  | { type: "encadre"; id: string; paragraphes: string[] };

export interface Section {
  titre: string;
  blocs: Bloc[];
}

export interface DocumentLegal {
  titre: string;
  description: string;
  date: string;
  sections: Section[];
}

const p = (...morceaux: Morceau[]): Bloc => ({ type: "paragraphe", morceaux });
const liste = (...elements: Morceau[][]): Bloc => ({ type: "liste", elements });
const lien = (texte: string, adresse: string): Morceau => ({ texte, lien: adresse });

/** Lignes de coordonnées : une ligne dont la valeur est vide n'est pas écrite. */
function coordonnees(lignes: [string, string | null][]): Bloc {
  return {
    type: "coordonnees",
    lignes: lignes
      .filter((ligne): ligne is [string, string] => ligne[1] !== null && ligne[1].trim() !== "")
      .map(([libelle, valeur]) => ({ libelle, valeur: [valeur] })),
  };
}

function lienSite(adresse: string): Morceau {
  return lien(adresse.replace(/^https:\/\//, ""), adresse);
}

// ---------------------------------------------------------------------------
// Garantie légale de conformité : l'encadré de l'annexe à l'article D211-3 du
// Code de la consommation (décret n° 2022-946 du 29 juin 2022), pour un
// contenu numérique. Il est reproduit mot pour mot, un paragraphe par ligne ;
// tests/legal.test.tsx le compare au texte officiel.
// ---------------------------------------------------------------------------

export const ENCADRE_GARANTIE = [
  "Le consommateur dispose d’un délai de deux ans à compter de la fourniture du contenu numérique ou du service numérique pour obtenir la mise en œuvre de la garantie légale de conformité en cas d’apparition d’un défaut de conformité. Durant un délai d’un an à compter de la date de fourniture, le consommateur n’est tenu d’établir que l’existence du défaut de conformité et non la date d’apparition de celui-ci.",
  "La garantie légale de conformité emporte obligation de fournir toutes les mises à jour nécessaires au maintien de la conformité du contenu numérique ou du service numérique.",
  "La garantie légale de conformité donne au consommateur droit à la mise en conformité du contenu numérique ou du service numérique sans retard injustifié suivant sa demande, sans frais et sans inconvénient majeur pour lui.",
  "Le consommateur peut obtenir une réduction du prix en conservant le contenu numérique ou le service numérique ou il peut mettre fin au contrat en se faisant rembourser intégralement contre renoncement au contenu numérique ou au service numérique, si :",
  "1° Le professionnel refuse de mettre le contenu numérique ou le service numérique en conformité ;",
  "2° La mise en conformité du contenu numérique ou du service numérique est retardée de manière injustifiée ;",
  "3° La mise en conformité du contenu numérique ou du service numérique ne peut intervenir sans frais imposés au consommateur ;",
  "4° La mise en conformité du contenu numérique ou du service numérique occasionne un inconvénient majeur pour le consommateur ;",
  "5° La non-conformité du contenu numérique ou du service numérique persiste en dépit de la tentative de mise en conformité du professionnel restée infructueuse.",
  "Le consommateur a également droit à une réduction du prix ou à la résolution du contrat lorsque le défaut de conformité est si grave qu’il justifie que la réduction du prix ou la résolution du contrat soit immédiate. Le consommateur n’est alors pas tenu de demander la mise en conformité du contenu numérique ou du service numérique au préalable.",
  "Dans les cas où le défaut de conformité est mineur, le consommateur n’a droit à l’annulation du contrat que si le contrat ne prévoit pas le paiement d’un prix.",
  "Toute période d’indisponibilité du contenu numérique ou du service numérique en vue de sa remise en conformité suspend la garantie qui restait à courir jusqu’à la fourniture du contenu numérique ou du service numérique de nouveau conforme.",
  "Les droits mentionnés ci-dessus résultent de l’application des articles L. 224-25-1 à L. 224-25-31 du code de la consommation.",
  "Le professionnel qui fait obstacle de mauvaise foi à la mise en œuvre de la garantie légale de conformité encourt une amende civile d’un montant maximal de 300 000 euros, qui peut être porté jusqu’à 10 % du chiffre d’affaires moyen annuel (article L. 242-18-1 du code de la consommation).",
  "Le consommateur bénéficie, en outre, de la garantie légale des vices cachés en application des articles 1641 à 1649 du code civil, pendant une durée de deux ans à compter de la découverte du défaut. Cette garantie donne droit à une réduction de prix si le contenu numérique ou le service numérique est conservé ou à un remboursement intégral contre renonciation au contenu numérique ou au service numérique.",
];

// ---------------------------------------------------------------------------
// Mentions légales
// ---------------------------------------------------------------------------

export function mentionsLegales(fiche: FicheVendeur): DocumentLegal {
  const mediateur = mediateurCite(fiche);
  const sections: Section[] = [
    {
      titre: "Éditeur du site",
      blocs: [
        coordonnees([
          ["Vendeur", denomination(fiche)],
          ["Statut", fiche.statut],
          ["Capital", siRempli(fiche.capital)],
          ["Nom commercial", fiche.nomCommercial],
          ["SIRET", fiche.siret],
          ["RCS", siRempli(fiche.rcs)],
          ["Adresse", adresseSurUneLigne(fiche.adresse)],
          ["Téléphone", fiche.telephone],
          ["E-mail", fiche.email],
        ]),
      ],
    },
    {
      titre: "Directeur de la publication",
      blocs: [p(fiche.directeurPublication)],
    },
    {
      titre: "Hébergeur",
      blocs: [
        p("Le site est hébergé par :"),
        coordonnees([
          ["Hébergeur", fiche.hebergeur.nom],
          ["Adresse", fiche.hebergeur.adresse],
          ["Téléphone", fiche.hebergeur.telephone],
          ["Site", fiche.hebergeur.site.replace(/^https:\/\//, "")],
        ]),
      ],
    },
    {
      titre: "Prestataire de paiement",
      blocs: [
        p(
          `Les paiements sont traités par ${fiche.paiement.nom}, ${fiche.paiement.adresse}. Le vendeur n'a jamais accès aux données de carte bancaire.`,
        ),
      ],
    },
    {
      titre: "TVA",
      blocs: [p(`${fiche.tva}.`)],
    },
  ];
  if (mediateur) {
    sections.push({
      titre: "Médiation de la consommation",
      blocs: [
        p(
          `Médiateur de la consommation dont relève le vendeur : ${mediateur.nom}, ${mediateur.adresse}, `,
          lienSite(mediateur.site),
          ". Les conditions de la médiation figurent dans les ",
          lien("conditions générales de vente", "/cgv"),
          ".",
        ),
      ],
    });
  }
  sections.push(
    {
      titre: "Données personnelles",
      blocs: [
        p(
          "Ce que le site fait de vos données, et comment exercer vos droits, est expliqué dans la ",
          lien("politique de confidentialité", "/confidentialite"),
          ".",
        ),
      ],
    },
    {
      titre: "Crédits",
      blocs: [
        p(
          "Les polices, les icônes et leurs licences sont listées sur la page ",
          lien("Crédits et licences", "/credits"),
          ".",
        ),
      ],
    },
  );
  return typographier({
    titre: "Mentions légales",
    description: "L'éditeur du site, son hébergeur, son prestataire de paiement.",
    date: `Mise à jour le ${MISE_A_JOUR}`,
    sections,
  });
}

// ---------------------------------------------------------------------------
// Conditions générales de vente
// ---------------------------------------------------------------------------

export function conditionsGenerales(fiche: FicheVendeur, options: { prix: string | null }): DocumentLegal {
  const mediateur = mediateurCite(fiche);
  const nom = denomination(fiche);
  const adresse = adresseSurUneLigne(fiche.adresse);

  const sections: Section[] = [
    {
      titre: "1. Le vendeur",
      blocs: [
        p(
          `Le jeu est vendu par ${nom}, ${fiche.statut}, sous le nom commercial ${fiche.nomCommercial}. Ces conditions s'appliquent à toute commande passée sur le site.`,
        ),
        coordonnees([
          ["Adresse", adresse],
          ["Téléphone", fiche.telephone],
          ["E-mail", fiche.email],
          ["SIRET", fiche.siret],
          ["RCS", siRempli(fiche.rcs)],
        ]),
      ],
    },
    {
      titre: "2. Le jeu",
      blocs: [
        p(
          "Le jeu complet est un kit de jeu d'anniversaire personnalisé, composé à partir des réponses que vous donnez sur le site : le thème, l'âge fêté, le prénom de l'enfant, le nombre d'enfants, la durée, les cachettes dont vous disposez et, si vous le souhaitez, quelques détails de la fête. Il contient :",
        ),
        liste(...SITE.details.map((detail) => [detail])),
        p(
          "Le jeu complet est celui de l'aperçu gratuit que vous avez vu avant de commander : mêmes réponses, même référence, mêmes énigmes. L'aperçu vous permet de vérifier le jeu avant de l'acheter.",
        ),
      ],
    },
    {
      titre: "3. Fonctionnalités et compatibilité",
      blocs: [
        p(
          "Le jeu est un fichier PDF au format A4, à imprimer. Il se lit avec n'importe quel lecteur PDF et s'imprime sur une imprimante ordinaire ; une impression en noir et blanc suffit. Une fois le fichier téléchargé, aucun compte, aucun logiciel particulier et aucune connexion ne sont nécessaires. Le fichier ne comporte aucune mesure technique de protection : vous pouvez l'imprimer autant de fois que votre fête le demande.",
        ),
      ],
    },
    {
      titre: "4. Prix",
      blocs: [
        p(
          ...(options.prix ? [`Le jeu complet coûte ${options.prix}, sans aucun frais supplémentaire. `] : []),
          `Le prix est indiqué en euros avant la commande, puis rappelé sur la page de paiement. ${fiche.tva}. Le jeu se télécharge : il n'y a aucun frais de livraison.`,
        ),
      ],
    },
    {
      titre: "5. Pays acceptés",
      blocs: [
        p(
          "La vente est ouverte aux personnes qui résident dans l'un des 27 pays de l'Union européenne, en Suisse, à Monaco ou au Canada. Votre pays de résidence vous est demandé avant la commande.",
        ),
      ],
    },
    {
      titre: "6. Commande et paiement",
      blocs: [
        p("Une fois votre aperçu composé, vous commandez en quatre temps :"),
        liste(
          ["vous choisissez votre pays de résidence ;"],
          ["vous cochez la case par laquelle vous acceptez les présentes conditions ;"],
          [
            "vous cochez la case par laquelle vous demandez l'accès immédiat à votre jeu dès le paiement et reconnaissez perdre ainsi votre droit de rétractation (voir l'article 8) ;",
          ],
          [
            "vous cliquez sur « Commander et payer » : vous êtes conduit sur la page de paiement sécurisée de Stripe, où vous payez par carte bancaire, ou avec Apple Pay ou Google Pay si votre appareil le propose.",
          ],
        ),
        p(
          `La commande est conclue au paiement. Les données de votre carte sont traitées par ${fiche.paiement.nom} ; le vendeur n'y a jamais accès.`,
        ),
      ],
    },
    {
      titre: "7. Livraison",
      blocs: [
        p(
          "Le jeu est livré par téléchargement, immédiatement après le paiement : vous revenez sur le site, sur la page de votre commande, où un bouton télécharge le PDF. Le lien de cette page vous est aussi envoyé par Stripe, par e-mail, avec votre facture et votre reçu. Il reste valable 30 jours après le paiement ; pensez à enregistrer le fichier.",
        ),
      ],
    },
    {
      titre: "8. Absence de droit de rétractation",
      blocs: [
        p(
          "Le jeu est un contenu numérique fourni sans support matériel. En application de l'article L221-28, 13° du Code de la consommation, le droit de rétractation ne s'applique pas à un tel contenu lorsque sa fourniture a commencé avec l'accord préalable exprès du consommateur et son renoncement exprès à ce droit.",
        ),
        p(
          "Cet accord et ce renoncement vous sont demandés avant le paiement, par une case distincte, non cochée au départ, sans laquelle la commande est impossible. L'e-mail que Stripe vous envoie après le paiement, avec votre facture et votre reçu, vous les confirme sur un support durable.",
        ),
      ],
    },
    {
      titre: "9. Service client et réclamations",
      blocs: [
        p(
          `Pour toute question ou réclamation, écrivez à ${fiche.email}, en indiquant si possible la référence de votre commande. Nous répondons sous 7 jours au plus. Vous pouvez aussi nous joindre par téléphone au ${fiche.telephone}, ou par courrier : ${adresse}.`,
        ),
      ],
    },
    {
      titre: "10. Garantie légale de conformité",
      blocs: [
        p(
          "Comme tout contenu numérique, le jeu bénéficie de la garantie légale de conformité et de la garantie légale des vices cachés. Elles sont dues par le vendeur :",
        ),
        coordonnees([
          ["Vendeur", nom],
          ["Adresse", adresse],
          ["Téléphone", fiche.telephone],
          ["E-mail", fiche.email],
        ]),
        p("Vos droits sont résumés dans l'encadré suivant, prévu par l'article D211-3 du Code de la consommation :"),
        { type: "encadre", id: "garantie-conformite", paragraphes: ENCADRE_GARANTIE },
      ],
    },
  ];

  if (mediateur) {
    sections.push({
      titre: "11. Médiation de la consommation",
      blocs: [
        p(
          `En cas de litige, adressez d'abord une réclamation écrite au service client (article 9). Si le litige n'est pas résolu, vous pouvez recourir gratuitement au médiateur de la consommation dont relève le vendeur : ${mediateur.nom}, ${mediateur.adresse}, `,
          lienSite(mediateur.site),
          ".",
        ),
        p(
          "Le médiateur ne peut être saisi qu'après cette réclamation écrite au vendeur, et au plus tard un an après elle. Il n'examine pas une demande manifestement infondée ou abusive, ni un litige déjà examiné ou en cours d'examen par un autre médiateur ou par un tribunal.",
        ),
      ],
    });
  }

  const numero = (rang: number) => (mediateur ? rang : rang - 1);
  sections.push(
    {
      titre: `${numero(12)}. Droit applicable`,
      blocs: [
        p(
          "Ces conditions sont soumises au droit français. Ce choix ne vous prive pas de la protection que vous assurent les règles impératives du droit de votre pays de résidence.",
        ),
      ],
    },
    {
      titre: `${numero(13)}. Usage familial`,
      blocs: [
        p(
          "Le jeu est destiné à un usage familial et privé. Sa revente, sa diffusion et sa mise à disposition du public sont interdites ; chaque page du PDF le rappelle.",
        ),
      ],
    },
    {
      titre: `${numero(14)}. Données personnelles`,
      blocs: [
        p(
          "Ce qui est conservé lors d'une commande, pendant combien de temps, et comment exercer vos droits : tout est expliqué dans la ",
          lien("politique de confidentialité", "/confidentialite"),
          ".",
        ),
      ],
    },
    {
      titre: `${numero(15)}. Version`,
      blocs: [
        p(
          `Conditions générales de vente dans leur version du ${VERSION_CGV.libelle}. La version acceptée lors de votre commande est rappelée sur votre facture.`,
        ),
      ],
    },
  );

  return typographier({
    titre: "Conditions générales de vente",
    description: "Les conditions de vente du jeu complet Mission Gâteau.",
    date: `Version du ${VERSION_CGV.libelle}`,
    sections,
  });
}

// ---------------------------------------------------------------------------
// Politique de confidentialité
// ---------------------------------------------------------------------------

export function politiqueDeConfidentialite(fiche: FicheVendeur): DocumentLegal {
  const nom = denomination(fiche);
  const sections: Section[] = [
    {
      titre: "Responsable du traitement",
      blocs: [
        p(`Les données traitées par le site le sont sous la responsabilité de ${nom}, ${fiche.statut} :`),
        coordonnees([
          ["Adresse", adresseSurUneLigne(fiche.adresse)],
          ["E-mail", fiche.email],
          ["Téléphone", fiche.telephone],
        ]),
      ],
    },
    {
      titre: "L'aperçu gratuit : rien n'est conservé",
      blocs: [
        p(
          "Pour composer un aperçu, vos réponses — thème, âge fêté, prénom de l'enfant, nombre d'enfants, durée, cachettes et, si vous les donnez, les détails de la fête — sont envoyées au site par le formulaire. Elles servent à produire le PDF, puis disparaissent avec la requête : rien n'est enregistré, rien n'est journalisé, rien n'est transmis à un tiers.",
        ),
      ],
    },
    {
      titre: "L'achat du jeu complet : ce qui est conservé, et combien de temps",
      blocs: [
        liste(
          [
            "Vos réponses. Pour que le jeu puisse vous être livré, elles sont confiées à Stripe, notre prestataire de paiement, chiffrées : aucune n'y figure en clair. Elles y restent 30 jours après le paiement, la durée de validité du lien de téléchargement, puis sont effacées automatiquement. Si vous quittez la page de paiement sans payer, elles peuvent rester attachées, chiffrées, à la session de paiement abandonnée : Stripe ne donne aucun moyen de les en effacer, et elles restent illisibles sans la clé secrète du site.",
          ],
          [
            "La trace de votre commande. La référence de la commande, la référence du jeu, le pays de résidence déclaré, la version des conditions de vente acceptée et l'heure de vos deux accords restent avec la commande : ils prouvent ce qui a été vendu et ce que vous avez accepté.",
          ],
          [
            "Vos coordonnées de facturation. Votre adresse e-mail, votre nom et votre adresse de facturation, que vous saisissez sur la page de paiement de Stripe, ainsi que la facture, restent chez Stripe au titre de nos obligations comptables : dix ans (article L123-22 du Code de commerce).",
          ],
          [
            "Vos données de carte. Elles sont traitées par Stripe seul ; le vendeur n'y a jamais accès.",
          ],
        ),
      ],
    },
    {
      titre: "Bases légales",
      blocs: [
        liste(
          [
            "L'exécution du contrat (article 6, paragraphe 1, b du RGPD) : produire votre jeu, vous le livrer et répondre à vos demandes.",
          ],
          [
            "L'obligation légale (article 6, paragraphe 1, c du RGPD) : conserver les factures et les pièces comptables.",
          ],
        ),
      ],
    },
    {
      titre: "Destinataires",
      blocs: [
        liste(
          [
            `${fiche.paiement.nom} (Stripe), prestataire de paiement : il reçoit la commande, la configuration chiffrée et les données de paiement. Stripe traite aussi certaines données pour son propre compte, notamment pour lutter contre la fraude, selon sa propre politique de confidentialité. Pour les transferts de données hors de l'Union européenne, Stripe déclare s'appuyer sur des décisions d'adéquation, sur les clauses contractuelles types de la Commission européenne et sur l'adhésion de Stripe, Inc. au cadre de protection des données UE–États-Unis (`,
            lien("politique de confidentialité de Stripe", "https://stripe.com/fr/privacy"),
            ", mise à jour le 16 janvier 2026).",
          ],
          [
            `${fiche.hebergeur.nom}, hébergeur du site, aux États-Unis : chaque requête passe par ses serveurs. Vercel déclare se conformer au cadre de protection des données UE–États-Unis, à son extension au Royaume-Uni et au cadre Suisse–États-Unis, et recourir aux clauses contractuelles types ou à d'autres mécanismes appropriés pour ses transferts (`,
            lien("politique de confidentialité de Vercel", "https://vercel.com/legal/privacy-policy"),
            ", en vigueur depuis le 1er juin 2026).",
          ],
        ),
        p("Aucune donnée n'est vendue, ni transmise à qui que ce soit d'autre."),
      ],
    },
    {
      titre: "Cookies et traceurs",
      blocs: [
        p(
          "Nos pages ne déposent aucun cookie et n'emploient aucun traceur ; elles ne chargent aucune ressource depuis un autre domaine.",
        ),
        p(
          "Pendant le paiement seulement, l'onglet de votre navigateur garde vos réponses et votre aperçu dans son stockage de session (sessionStorage), pour que vous retrouviez votre jeu si vous revenez de la page de paiement sans payer. Rien n'en sort de votre navigateur ; tout est effacé une fois la commande payée, quand vous composez un autre jeu, ou à la fermeture de l'onglet.",
        ),
        p("La page de paiement, hébergée par Stripe, relève de la politique de confidentialité de Stripe."),
      ],
    },
    {
      titre: "Vos droits",
      blocs: [
        p(
          `Vous disposez, dans les conditions prévues par le RGPD, des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité. Pour les exercer, écrivez à ${fiche.email}, en indiquant si possible la référence de votre commande : nous répondons dans un délai d'un mois. Les factures et les pièces comptables ne peuvent pas être effacées avant la fin de leur durée légale de conservation.`,
        ),
      ],
    },
    {
      titre: "Réclamation",
      blocs: [
        p(
          "Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (",
          lien("cnil.fr", "https://www.cnil.fr"),
          ").",
        ),
      ],
    },
  ];

  return typographier({
    titre: "Politique de confidentialité",
    description: "Ce que Mission Gâteau fait de vos données, et combien de temps elles sont gardées.",
    date: `Mise à jour le ${MISE_A_JOUR}`,
    sections,
  });
}
