import { typographier } from "../../engine/texte";
import { adresseSurUneLigne, denomination, mediateurCite, siRempli } from "../../vente/fiche";
import { coordonnees, encadre, lien, lienSite, liste, p, type DocumentLegal, type Section } from "../document";
import { formulaireRempli } from "../formulaireRetractation";
import { ENCADRE_GARANTIE } from "../garantie";
import type { FicheVendeur } from "../vendeur";

/**
 * Conditions générales de vente, version du 25 septembre 2026 (lot 5).
 *
 * Par rapport à la version du 24 septembre : la confirmation de commande par
 * e-mail (articles 6 et 7), le droit de rétractation jusqu'au premier
 * téléchargement et la fonction « Renoncer au contrat ici » (article 8), la
 * version jointe à la confirmation (article 15), et le formulaire type de
 * rétractation en annexe.
 *
 * Une fois publiée, cette version n'est plus jamais modifiée : toute
 * modification des CGV passe par une nouvelle version, dans un nouveau
 * fichier (voir src/contenu/cgv/index.ts). Elle ne dépend que de la fiche du
 * vendeur.
 */

export const IDENTIFIANT = "2026-09-25";
export const LIBELLE = "25 septembre 2026";
/** Article des CGV qui traite de la garantie légale de conformité. */
export const ARTICLE_GARANTIE = 10;

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
        liste(
          ["Le guide de l'organisateur : déroulé minute par minute, matériel, plan de pose, texte à lire à voix haute."],
          ["Une invitation par invité, quatre par page, avec les traits de coupe."],
          ["Les cartes-indices numérotées, à découper et à cacher, avec la cachette rappelée en petit pour vous."],
          ["Les fiches d'énigmes, une série par équipe."],
          ["La page du trésor et un diplôme par enfant."],
          ["La page des solutions, séparée, à garder pour vous."],
        ),
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
            "vous cochez la case par laquelle vous demandez à recevoir votre jeu dès le paiement, avant la fin du délai de rétractation de 14 jours, et reconnaissez que vous perdrez votre droit de rétractation dès le début de son premier téléchargement (voir l'article 8) ;",
          ],
          [
            "vous cliquez sur « Commander et payer » : vous êtes conduit sur la page de paiement sécurisée de Stripe, où vous payez par carte bancaire, ou avec Apple Pay ou Google Pay si votre appareil le propose.",
          ],
        ),
        p(
          "Les deux cases sont distinctes, non cochées au départ, et toutes deux obligatoires : sans elles, la commande est impossible.",
        ),
        p(
          `La commande est conclue au paiement. Les données de votre carte sont traitées par ${fiche.paiement.nom} ; le vendeur n'y a jamais accès.`,
        ),
        p(
          "Dès que le paiement est confirmé, nous vous envoyons la confirmation de votre commande par e-mail, à l'adresse que vous avez saisie sur la page de paiement. Elle récapitule votre commande, vous confirme les deux accords donnés par les cases ci-dessus, vous rappelle votre droit de rétractation et contient le formulaire type de rétractation ; les présentes conditions y sont jointes en PDF, dans la version que vous avez acceptée. Stripe vous envoie de son côté votre facture et votre reçu.",
        ),
      ],
    },
    {
      titre: "7. Livraison",
      blocs: [
        p(
          "Le jeu est livré en deux temps : nous vous envoyons d'abord l'e-mail de confirmation de votre commande (article 6), puis le jeu se télécharge sur la page de votre commande, par un bouton qui n'apparaît qu'une fois cet e-mail parti. Vous arrivez sur cette page juste après le paiement, et son lien figure dans l'e-mail de confirmation. Il reste valable 30 jours après le paiement : pensez à enregistrer le fichier.",
        ),
      ],
    },
    {
      titre: "8. Droit de rétractation",
      blocs: [
        p(
          "Vous disposez d'un délai de 14 jours pour vous rétracter, sans avoir à motiver votre décision. Ce délai court à compter de la conclusion du contrat, c'est-à-dire du paiement : le jour du paiement ne compte pas, et le délai prend fin à l'expiration de la dernière heure du quatorzième jour. S'il expire un samedi, un dimanche ou un jour férié ou chômé, il est prolongé jusqu'au premier jour ouvrable suivant (articles L221-18 et L221-19 du Code de la consommation).",
        ),
        p(
          "Le jeu est un contenu numérique fourni sans support matériel. Lorsque vous avez demandé à le recevoir dès le paiement et reconnu que vous perdrez ainsi votre droit de rétractation, par la case prévue à cet effet (article 6), et que l'e-mail de confirmation de votre commande vous a été envoyé avant, votre droit de rétractation prend fin au début du premier téléchargement de votre jeu (article L221-28, 13° du Code de la consommation). Jusque-là, vous pouvez vous rétracter dans le délai de 14 jours.",
        ),
        p("Pour vous rétracter, vous avez trois possibilités :"),
        liste(
          [
            "la fonction ",
            lien("« Renoncer au contrat ici »", "/renoncer"),
            ", dont le lien figure en bas de chaque page du site, sur la page de votre commande et dans l'e-mail de confirmation : vous y indiquez vos nom et prénom, la référence de votre commande et l'adresse e-mail où recevoir l'accusé de réception, puis vous confirmez votre rétractation ;",
          ],
          [
            `le formulaire type de rétractation reproduit en annexe, rempli et envoyé par e-mail à ${fiche.email} ou par courrier à ${adresse} ;`,
          ],
          [
            `toute autre déclaration dénuée d'ambiguïté exprimant votre volonté de vous rétracter, envoyée par e-mail à ${fiche.email} ou par courrier à ${adresse}.`,
          ],
        ),
        p(
          "Nous vous adressons par e-mail un accusé de réception de votre rétractation, qui reprend le contenu de votre déclaration ainsi que la date et l'heure de son envoi ; lorsque vous utilisez la fonction « Renoncer au contrat ici », il part sans délai.",
        ),
        p(
          "Nous vous remboursons la totalité du prix payé, sans frais, sans retard injustifié et au plus tard 14 jours après avoir été informés de votre décision de vous rétracter, par le même moyen de paiement que celui utilisé pour la commande (article L221-24 du Code de la consommation). Dès que votre rétractation est enregistrée, le jeu n'est plus livré : la page de votre commande ne propose plus son téléchargement.",
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
      titre: `${ARTICLE_GARANTIE}. Garantie légale de conformité`,
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
          `Conditions générales de vente dans leur version du ${LIBELLE}. La version que vous avez acceptée vous est envoyée en PDF avec l'e-mail de confirmation de votre commande ; elle est aussi rappelée sur votre facture.`,
        ),
      ],
    },
    {
      titre: "Annexe : formulaire type de rétractation",
      blocs: [
        p(
          "Ce formulaire peut vous servir à exercer votre droit de rétractation (article 8) ; son usage n'est pas obligatoire.",
        ),
        encadre("formulaire-retractation", formulaireRempli(fiche)),
      ],
    },
  );

  return typographier({
    titre: "Conditions générales de vente",
    description: "Les conditions de vente du jeu complet Mission Gâteau.",
    date: `Version du ${LIBELLE}`,
    sections,
  });
}
