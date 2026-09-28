import { typographier } from "../engine/texte";
import { adresseSurUneLigne, denomination, mediateurCite, pageDeDemande, siRempli } from "../vente/fiche";
import { coordonnees, lien, lienSite, liste, p, type DocumentLegal, type Section } from "./document";
import type { FicheVendeur } from "./vendeur";

/**
 * Les pages légales : mentions légales et politique de confidentialité. Les
 * conditions générales de vente vivent dans src/contenu/cgv/, une version par
 * fichier.
 *
 * Chaque page est construite à partir de la fiche du vendeur : rien n'y est
 * recopié à la main, et un champ vide n'y apparaît jamais. Le médiateur n'est
 * nommé qu'une fois la convention signée (signée le 25 septembre 2026).
 */

export type { Bloc, DocumentLegal, Morceau, Section } from "./document";
export { ENCADRE_GARANTIE } from "./garantie";
export { VERSION_CGV, conditionsGenerales } from "./cgv";

/** Date de mise à jour de chaque page. */
export const MISE_A_JOUR_MENTIONS = "27 septembre 2026";
export const MISE_A_JOUR_CONFIDENTIALITE = "28 septembre 2026";

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
          ".",
        ),
        p(
          "La médiation est gratuite pour le consommateur. Elle suppose une réclamation écrite adressée d'abord au vendeur et restée sans solution, puis une saisine du médiateur dans l'année qui suit cette réclamation (article L612-2 du Code de la consommation). Le médiateur peut être saisi en ligne, sur ",
          lien("sa page de demande de médiation", pageDeDemande(mediateur)),
          ", ou par courrier à l'adresse ci-dessus. Les conditions de la médiation figurent aussi dans les ",
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
    date: `Mise à jour le ${MISE_A_JOUR_MENTIONS}`,
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
          "Pour composer un aperçu, vos réponses — thème, âge fêté, prénom de l'enfant, nombre d'enfants, durée, cachettes et, si vous les donnez, les détails de la fête — sont envoyées au site par le formulaire. Elles servent à produire le PDF, puis disparaissent avec la requête : elles ne sont ni enregistrées, ni journalisées, ni transmises à un tiers (le journal de notre hébergeur ne note que la requête elle-même : voir « Destinataires »).",
        ),
      ],
    },
    {
      titre: "L'achat du jeu complet : ce qui est conservé, et combien de temps",
      blocs: [
        liste(
          [
            "Vos réponses. Pour que le jeu puisse vous être livré, elles sont confiées à Stripe, notre prestataire de paiement, chiffrées ; seuls le thème et la tranche d'âge du jeu y figurent en clair, sur la ligne de commande et sur la facture. Vos réponses chiffrées y restent 30 jours après le paiement, la durée de validité du lien de téléchargement, puis sont effacées automatiquement. Si vous quittez la page de paiement sans payer, elles peuvent rester attachées, chiffrées, à la session de paiement abandonnée : Stripe ne donne aucun moyen de les en effacer, et elles restent illisibles sans la clé secrète du site.",
          ],
          [
            "La trace de votre commande. La référence de la commande, la référence du jeu, le pays de résidence déclaré, la version des conditions de vente acceptée, l'heure de vos deux accords, celle de l'envoi de la confirmation, celle du premier téléchargement, si vous vous rétractez, celle de votre rétractation et, si le vendeur a dû examiner votre commande, celle de sa réponse restent avec la commande chez Stripe aussi longtemps que la facture, dix ans : elles prouvent ce qui a été vendu, ce que vous avez accepté et ce qui a été fait.",
          ],
          [
            "Vos coordonnées de facturation. Votre adresse e-mail, votre nom et votre adresse de facturation, que vous saisissez sur la page de paiement de Stripe, ainsi que la facture, restent chez Stripe au titre de nos obligations comptables : dix ans (article L123-22 du Code de commerce).",
          ],
          [
            "Nos e-mails. L'e-mail de confirmation de votre commande et, si vous vous rétractez, l'accusé de réception de votre déclaration vous sont envoyés par Resend, notre prestataire d'envoi d'e-mails. Le vendeur en reçoit une copie cachée, qu'il garde dans sa messagerie, hébergée par Google (voir « Destinataires »), comme preuve de leur envoi pendant cinq ans, le délai pendant lequel une action en justice sur la commande reste possible (article 2224 du Code civil). Les messages que vous nous écrivez y arrivent aussi.",
          ],
          [
            "Votre déclaration de rétractation. Si vous utilisez la fonction « Renoncer au contrat ici », seule la référence de votre commande sert à la retrouver (avec, si vous venez de la page de votre commande, l'identifiant de la session de paiement Stripe que porte son lien) ; vos nom et prénom et l'adresse e-mail que vous indiquez servent à traiter votre déclaration et à vous en accuser réception : ils ne sont gardés que dans cet accusé de réception et dans sa copie. À la trace de la commande chez Stripe s'ajoutent seulement l'heure de votre rétractation, une empreinte de la déclaration qui l'a enregistrée (un code calculé à partir de ces quatre champs, qui sert à reconnaître une déclaration identique sans les garder en clair) et le nombre d'accusés de réception envoyés pour la commande. Si aucune commande payée ne correspond à la référence indiquée, ou si votre commande ne peut pas être vérifiée, votre déclaration n'est ni transmise ni gardée : le site n'écrit alors dans le journal de son hébergeur que la référence de la commande et l'heure de votre demande, jamais votre nom ni votre adresse e-mail (voir « Destinataires »).",
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
            "L'obligation légale (article 6, paragraphe 1, c du RGPD) : vous confirmer votre commande sur un support durable, accuser réception de votre rétractation et la traiter, conserver les factures et les pièces comptables.",
          ],
          [
            "L'intérêt légitime du vendeur (article 6, paragraphe 1, f du RGPD) : garder la preuve des e-mails envoyés, pour pouvoir répondre à une réclamation ou à un litige.",
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
            "Plus Five Five, Inc. (Resend), prestataire d'envoi d'e-mails, à San Francisco, aux États-Unis : il reçoit, pour les acheminer, l'e-mail de confirmation de votre commande et, si vous vous rétractez, l'accusé de réception de votre déclaration — votre adresse e-mail, leur contenu et les conditions générales de vente jointes à la confirmation. Resend déclare stocker ces e-mails et leurs journaux d'envoi aux États-Unis, et les garder 30 jours. Pour les transferts de données hors de l'Union européenne, Resend déclare s'appuyer sur les clauses contractuelles types de la Commission européenne et sur son adhésion au cadre de protection des données UE–États-Unis (",
            lien("page de Resend sur le RGPD", "https://resend.com/security/gdpr"),
            ", consultée le 26 septembre 2026, et ",
            lien("accord de traitement des données de Resend", "https://resend.com/legal/dpa"),
            ", mis à jour le 31 décembre 2025).",
          ],
          [
            "Google (Gmail), qui héberge la messagerie du vendeur, un compte Gmail personnel : il reçoit et conserve les copies cachées des confirmations de commande et des accusés de réception, ainsi que les messages que vous nous écrivez. Google n'est lié au vendeur par aucun accord de traitement des données : il traite ces messages selon ses propres règles de confidentialité, qui désignent Google Ireland Limited comme responsable du traitement pour les utilisateurs établis dans l'Espace économique européen, comme le vendeur. Google déclare disposer de serveurs dans le monde entier, si bien que ces données peuvent être traitées hors de l'Union européenne, et encadrer ces transferts par les décisions d'adéquation de la Commission européenne, par le cadre de protection des données UE–États-Unis, auquel Google LLC déclare adhérer, et par les clauses contractuelles types lorsqu'aucune décision d'adéquation ne s'applique (",
            lien("règles de confidentialité de Google", "https://policies.google.com/privacy?hl=fr&gl=FR"),
            ", en vigueur depuis le 2 avril 2026, et ",
            lien("cadres légaux de Google pour les transferts de données", "https://policies.google.com/privacy/frameworks?hl=fr&gl=FR"),
            ", en vigueur depuis le 23 août 2025).",
          ],
          [
            `${fiche.hebergeur.nom}, hébergeur du site, aux États-Unis : chaque requête passe par ses serveurs. Selon sa documentation, son journal d'exécution enregistre, pour chaque requête vers une page ou une fonction du site, la méthode, l'adresse demandée et ses paramètres, le nom de domaine, l'heure, le code de réponse, le navigateur utilisé et la région de ses serveurs qui l'a traitée, ainsi que les lignes que le site y écrit ; il garde ce journal une heure, avec l'offre qu'utilise le site (`,
            lien("documentation de Vercel sur ses journaux d'exécution", "https://vercel.com/docs/logs/runtime"),
            `, mise à jour le 28 août 2026). Vercel déclare aussi recueillir, sur le trafic des sites qu'il héberge, l'adresse IP des visiteurs, la ville et le pays qu'il en déduit et des informations sur la configuration de leur système, et garder ses informations pendant la durée qu'il juge nécessaire à ses obligations et à son activité, sans indiquer de durée chiffrée. Vercel déclare se conformer au cadre de protection des données UE–États-Unis, à son extension au Royaume-Uni et au cadre Suisse–États-Unis, et recourir aux clauses contractuelles types ou à d'autres mécanismes appropriés pour ses transferts (`,
            lien("avis de confidentialité de Vercel", "https://vercel.com/legal/privacy-notice"),
            ", en vigueur depuis le 1er juin 2026).",
          ],
        ),
        p("Aucune donnée n'est vendue, ni transmise à qui que ce soit d'autre, sauf au médiateur de la consommation si vous le saisissez."),
      ],
    },
    {
      titre: "Cookies et traceurs",
      blocs: [
        p(
          "Nos pages ne déposent aucun cookie et n'emploient aucun traceur ; elles ne chargent aucune ressource depuis un autre domaine. Nos e-mails ne contiennent ni image ni ressource à télécharger.",
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
    date: `Mise à jour le ${MISE_A_JOUR_CONFIDENTIALITE}`,
    sections,
  });
}
