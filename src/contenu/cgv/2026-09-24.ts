import { typographier } from "../../engine/texte";
import { adresseSurUneLigne, denomination, mediateurCite, siRempli } from "../../vente/fiche";
import { coordonnees, lien, lienSite, liste, p, type DocumentLegal, type Section } from "../document";
import { ENCADRE_GARANTIE } from "../garantie";
import type { FicheVendeur } from "../vendeur";

/**
 * Conditions générales de vente, version du 24 septembre 2026 (lot 4).
 *
 * Version publiée : ce fichier n'est plus jamais modifié. Les commandes
 * passées sous cette version la gardent dans leurs métadonnées, et leur
 * confirmation joint ce texte-ci, tel qu'il a été accepté. Il ne dépend que de
 * la fiche du vendeur : la liste du contenu du kit y est recopiée plutôt que
 * lue ailleurs, pour qu'une retouche des textes du site ne le change pas.
 */

export const IDENTIFIANT = "2026-09-24";
export const LIBELLE = "24 septembre 2026";
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
          ...[
            "Le guide de l'organisateur : déroulé minute par minute, matériel, plan de pose, texte à lire à voix haute.",
            "Une invitation par invité, quatre par page, avec les traits de coupe.",
            "Les cartes-indices numérotées, à découper et à cacher, avec la cachette rappelée en petit pour vous.",
            "Les fiches d'énigmes, une série par équipe.",
            "La page du trésor et un diplôme par enfant.",
            "La page des solutions, séparée, à garder pour vous.",
          ].map((detail) => [detail]),
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
          `Conditions générales de vente dans leur version du ${LIBELLE}. La version acceptée lors de votre commande est rappelée sur votre facture.`,
        ),
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
