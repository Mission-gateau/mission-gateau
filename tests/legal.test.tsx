import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageLegale } from "@/composants/PageLegale";
import {
  VERSION_CGV,
  conditionsGenerales,
  mentionsLegales,
  politiqueDeConfidentialite,
  type DocumentLegal,
} from "@/contenu/legal";
import { VENDEUR, type FicheVendeur } from "@/contenu/vendeur";
import { piedDeFacture } from "@/vente/session";
import { PRIX_AFFICHE } from "@/vente/prix";
import { FICHE_COMPLETE, FICHE_SANS_CONVENTION } from "./fauxStripe";
import { FORMULAIRE_OFFICIEL } from "./officiels";

/**
 * L'encadré de l'annexe à l'article D211-3 du Code de la consommation (décret
 * n° 2022-946 du 29 juin 2022), recopié ici indépendamment du fichier de
 * contenu : un paragraphe par ligne, apostrophes typographiques comprises.
 */
const ENCADRE_OFFICIEL = `Le consommateur dispose d’un délai de deux ans à compter de la fourniture du contenu numérique ou du service numérique pour obtenir la mise en œuvre de la garantie légale de conformité en cas d’apparition d’un défaut de conformité. Durant un délai d’un an à compter de la date de fourniture, le consommateur n’est tenu d’établir que l’existence du défaut de conformité et non la date d’apparition de celui-ci.
La garantie légale de conformité emporte obligation de fournir toutes les mises à jour nécessaires au maintien de la conformité du contenu numérique ou du service numérique.
La garantie légale de conformité donne au consommateur droit à la mise en conformité du contenu numérique ou du service numérique sans retard injustifié suivant sa demande, sans frais et sans inconvénient majeur pour lui.
Le consommateur peut obtenir une réduction du prix en conservant le contenu numérique ou le service numérique ou il peut mettre fin au contrat en se faisant rembourser intégralement contre renoncement au contenu numérique ou au service numérique, si :
1° Le professionnel refuse de mettre le contenu numérique ou le service numérique en conformité ;
2° La mise en conformité du contenu numérique ou du service numérique est retardée de manière injustifiée ;
3° La mise en conformité du contenu numérique ou du service numérique ne peut intervenir sans frais imposés au consommateur ;
4° La mise en conformité du contenu numérique ou du service numérique occasionne un inconvénient majeur pour le consommateur ;
5° La non-conformité du contenu numérique ou du service numérique persiste en dépit de la tentative de mise en conformité du professionnel restée infructueuse.
Le consommateur a également droit à une réduction du prix ou à la résolution du contrat lorsque le défaut de conformité est si grave qu’il justifie que la réduction du prix ou la résolution du contrat soit immédiate. Le consommateur n’est alors pas tenu de demander la mise en conformité du contenu numérique ou du service numérique au préalable.
Dans les cas où le défaut de conformité est mineur, le consommateur n’a droit à l’annulation du contrat que si le contrat ne prévoit pas le paiement d’un prix.
Toute période d’indisponibilité du contenu numérique ou du service numérique en vue de sa remise en conformité suspend la garantie qui restait à courir jusqu’à la fourniture du contenu numérique ou du service numérique de nouveau conforme.
Les droits mentionnés ci-dessus résultent de l’application des articles L. 224-25-1 à L. 224-25-31 du code de la consommation.
Le professionnel qui fait obstacle de mauvaise foi à la mise en œuvre de la garantie légale de conformité encourt une amende civile d’un montant maximal de 300 000 euros, qui peut être porté jusqu’à 10 % du chiffre d’affaires moyen annuel (article L. 242-18-1 du code de la consommation).
Le consommateur bénéficie, en outre, de la garantie légale des vices cachés en application des articles 1641 à 1649 du code civil, pendant une durée de deux ans à compter de la découverte du défaut. Cette garantie donne droit à une réduction de prix si le contenu numérique ou le service numérique est conservé ou à un remboursement intégral contre renonciation au contenu numérique ou au service numérique.`;

/** Le texte visible d'un fragment HTML : balises retirées, entités décodées. */
function texteVisible(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Une espace insécable compte comme une espace. */
function espacesOrdinaires(texte: string): string {
  return texte.replace(/[\u00a0\u202f]/g, " ");
}

function rendre(document: DocumentLegal): string {
  return renderToStaticMarkup(<PageLegale document={document} venteOuverte={false} />);
}

function ficheAvecRcs(rcs: string): FicheVendeur {
  return { ...VENDEUR, rcs };
}

const MEDIATEUR = ["Société Médiation Professionnelle", "Alteritae, 5 rue Salvaing, 12000 Rodez", "mediateur-consommation-smp.fr"];
const PAGE_DE_DEMANDE = "https://www.mediateur-consommation-smp.fr/demander-une-mediation/";

describe("mentions légales", () => {
  const texte = espacesOrdinaires(texteVisible(rendre(mentionsLegales(VENDEUR))));

  it("portent chaque mention obligatoire de la fiche du vendeur", () => {
    for (const attendu of [
      "Quentin Courtois EI",
      "entrepreneur individuel",
      "Mission Gâteau",
      "992 667 006 00017",
      "7 impasse des Bosquets, 34670 Baillargues, France",
      "+33 6 32 57 69 77",
      "quentin.courtois090+missiongateau@gmail.com",
      "Directeur de la publication Quentin Courtois",
      "TVA non applicable, article 293 B du CGI",
      "Vercel Inc.",
      "440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis",
      "+1 951 383 6898",
      "vercel.com",
      "Stripe Payments Europe, Limited, 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Irlande",
      "Mise à jour le 27 septembre 2026",
    ]) {
      expect(texte, attendu).toContain(attendu);
    }
  });

  it("renvoient vers les crédits et la politique de confidentialité", () => {
    const html = rendre(mentionsLegales(VENDEUR));
    expect(html).toContain('href="/credits"');
    expect(html).toContain('href="/confidentialite"');
  });

  it("n'affichent ni le RCS ni le capital tant qu'ils sont vides, et les affichent une fois remplis", () => {
    expect(texte).not.toMatch(/RCS|Capital/);
    const avecRcs = texteVisible(rendre(mentionsLegales(ficheAvecRcs("Montpellier 992 667 006"))));
    expect(avecRcs).toContain("RCS Montpellier 992 667 006");
  });

  it("nomment le médiateur, la convention étant signée, et disent comment le saisir, gratuitement", () => {
    for (const morceau of MEDIATEUR) expect(texte, morceau).toContain(morceau);
    for (const attendu of [
      "Médiateur de la consommation dont relève le vendeur : Société Médiation Professionnelle, Alteritae, 5 rue Salvaing, 12000 Rodez, www.mediateur-consommation-smp.fr .",
      "La médiation est gratuite pour le consommateur.",
      "une réclamation écrite adressée d'abord au vendeur et restée sans solution",
      "dans l'année qui suit cette réclamation (article L612-2 du Code de la consommation)",
      "en ligne, sur sa page de demande de médiation , ou par courrier à l'adresse ci-dessus",
    ]) {
      expect(texte, attendu).toContain(attendu);
    }
    const html = rendre(mentionsLegales(VENDEUR));
    expect(html).toContain(`href="${PAGE_DE_DEMANDE}"`);
    expect(html).toContain('href="https://www.mediateur-consommation-smp.fr"');
  });

  it("ne nomment pas le médiateur sans convention signée", () => {
    const sans = espacesOrdinaires(texteVisible(rendre(mentionsLegales(FICHE_SANS_CONVENTION))));
    for (const morceau of MEDIATEUR) expect(sans, morceau).not.toContain(morceau);
  });
});

describe("conditions générales de vente", () => {
  const html = rendre(conditionsGenerales(VENDEUR, { prix: null }));
  const texte = espacesOrdinaires(texteVisible(html));

  it("couvrent chaque point exigé, dans l'ordre", () => {
    const titres = conditionsGenerales(FICHE_COMPLETE, { prix: PRIX_AFFICHE }).sections.map((s) => s.titre);
    expect(titres).toEqual([
      "1. Le vendeur",
      "2. Le jeu",
      "3. Fonctionnalités et compatibilité",
      "4. Prix",
      "5. Pays acceptés",
      "6. Commande et paiement",
      "7. Livraison",
      "8. Droit de rétractation",
      "9. Service client et réclamations",
      "10. Garantie légale de conformité",
      "11. Médiation de la consommation",
      "12. Droit applicable",
      "13. Usage familial",
      "14. Données personnelles",
      "15. Version",
      "Annexe\u00a0: formulaire type de rétractation",
    ]);
  });

  it("disent ce qu'il faut sur chaque point", () => {
    for (const attendu of [
      "Quentin Courtois EI, entrepreneur individuel, sous le nom commercial Mission Gâteau",
      "fichier PDF au format A4",
      "lecteur PDF",
      "imprimante",
      "noir et blanc suffit",
      "indiqué en euros",
      "TVA non applicable, article 293 B du CGI",
      "27 pays de l'Union européenne, en Suisse, à Monaco ou au Canada",
      "la case par laquelle vous acceptez les présentes conditions",
      // Article 6 : les deux accords, dans la nouvelle formulation, puis le paiement et l'e-mail de confirmation.
      "vous cochez la case par laquelle vous demandez à recevoir votre jeu dès le paiement, avant la fin du délai de rétractation de 14 jours, et reconnaissez que vous perdrez votre droit de rétractation dès le début de son premier téléchargement",
      "par carte bancaire",
      "page de paiement sécurisée de Stripe",
      // La confirmation part « après le paiement » : aussitôt, ou plus tard par la tâche quotidienne.
      "Après le paiement, nous vous envoyons la confirmation de votre commande par e-mail",
      "les présentes conditions y sont jointes en PDF, dans la version que vous avez acceptée",
      // Article 7 : l'e-mail d'abord, puis le téléchargement sur la page de la commande.
      "nous vous envoyons d'abord l'e-mail de confirmation de votre commande",
      "puis le jeu se télécharge sur la page de votre commande",
      "son lien figure dans l'e-mail de confirmation",
      "valable 30 jours",
      // Article 8 : le délai, son calcul, sa fin, les trois façons, l'accusé, le remboursement.
      "Vous disposez d'un délai de 14 jours pour vous rétracter",
      "le jour du paiement ne compte pas",
      "S'il expire un samedi, un dimanche ou un jour férié ou chômé, il est prolongé jusqu'au premier jour ouvrable suivant",
      "et que l'e-mail de confirmation de votre commande vous a été envoyé avant, votre droit de rétractation prend fin au début du premier téléchargement de votre jeu (article L221-28, 13° du Code de la consommation)",
      "vous avez trois possibilités",
      // Le nom de la fonction est un lien : le texte visible y est coupé par la balise.
      "la fonction « Renoncer au contrat ici »",
      "(voir ci-dessous) : vous y indiquez vos nom et prénom, la référence de votre commande et l'adresse e-mail où recevoir l'accusé de réception",
      "le formulaire type de rétractation reproduit en annexe",
      "toute autre déclaration dénuée d'ambiguïté",
      "par courrier à 7 impasse des Bosquets, 34670 Baillargues, France",
      // Le fonctionnement de la fonction et de ses accusés de réception, mot pour mot (le lien coupe le texte visible).
      "La fonction « Renoncer au contrat ici » se trouve à l'adresse https://www.missiongateau.com/renoncer ; son lien figure en bas de chaque page du site, sur la page de votre commande et dans l'e-mail de confirmation. Elle retrouve votre commande par sa référence, qui figure dans l'e-mail de confirmation (le lien de cet e-mail la remplit pour vous). Si aucune commande payée ne correspond à la référence indiquée, la page vous le dit aussitôt et votre déclaration n'est pas transmise : corrigez la référence, ou rétractez-vous par e-mail ou par courrier. Lorsque votre commande est retrouvée, nous vous adressons sans délai, par e-mail, un accusé de réception qui reprend le contenu de votre déclaration ainsi que la date et l'heure de son envoi ; pour une commande déjà rétractée, déjà téléchargée ou dont le délai a expiré, au-delà de trois accusés, les suivants s'affichent à l'écran sans être renvoyés par e-mail. Lorsque vous nous écrivez par e-mail ou par courrier, nous vous accusons réception de votre rétractation par e-mail, à l'adresse que vous nous indiquez ou, à défaut, à celle de votre commande.",
      "Nous vous remboursons la totalité du prix payé, sans frais, sans retard injustifié et au plus tard 14 jours",
      "par le même moyen de paiement que celui utilisé pour la commande",
      "le jeu n'est plus livré",
      "Nous répondons sous 7 jours au plus",
      "droit français",
      "usage familial",
      "revente",
      "interdites",
      "Version du 27 septembre 2026",
      "La version que vous avez acceptée vous est envoyée en PDF avec l'e-mail de confirmation de votre commande",
    ]) {
      expect(texte, attendu).toContain(attendu);
    }
    // Article 1 : l'adresse du site.
    expect(texte).toContain("sous le nom commercial Mission Gâteau, sur le site https://www.missiongateau.com . Ces conditions");
    expect(html).toContain('href="https://www.missiongateau.com"');
    expect(html).toContain('href="https://www.missiongateau.com/renoncer"');
    expect(texte).not.toContain("Dès que le paiement est confirmé");
    expect(html).toContain('href="/confidentialite"');
    expect(html).toContain('href="/renoncer"');
    // Plus aucune renonciation au moment du paiement.
    expect(texte).not.toMatch(/renoncement exprès|Absence de droit de rétractation/);
  });

  it("reproduisent en annexe le formulaire type, mot pour mot, rempli avec le nom, l'adresse et l'e-mail du vendeur", () => {
    const annexe = /<div data-encadre="formulaire-retractation" class="([^"]*)">([\s\S]*?)<\/div>/.exec(html);
    expect(annexe).not.toBeNull();
    const paragraphes = [...annexe![2]!.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => espacesOrdinaires(texteVisible(m[1]!)));
    expect(paragraphes).toEqual(
      FORMULAIRE_OFFICIEL.replace(
        "[le professionnel insère ici son nom, son adresse géographique et son adresse électronique]",
        "Quentin Courtois EI, 7 impasse des Bosquets, 34670 Baillargues, France, quentin.courtois090+missiongateau@gmail.com",
      ).split("\n"),
    );
  });

  it("nomment le garant de la conformité avec ses coordonnées postales, téléphoniques et électroniques", () => {
    const section = conditionsGenerales(VENDEUR, { prix: null }).sections.find((s) => s.titre.includes("Garantie"))!;
    const garant = section.blocs.find((b) => b.type === "coordonnees");
    expect(garant).toEqual({
      type: "coordonnees",
      lignes: [
        { libelle: "Vendeur", valeur: ["Quentin Courtois EI"] },
        { libelle: "Adresse", valeur: ["7 impasse des Bosquets, 34670 Baillargues, France"] },
        { libelle: "Téléphone", valeur: ["+33 6 32 57 69 77"] },
        { libelle: "E-mail", valeur: ["quentin.courtois090+missiongateau@gmail.com"] },
      ],
    });
  });

  it("reproduisent l'encadré de l'article D211-3 mot pour mot, visuellement encadré", () => {
    const encadre = /<div data-encadre="garantie-conformite" class="([^"]*)">([\s\S]*?)<\/div>/.exec(html);
    expect(encadre).not.toBeNull();
    expect(encadre![1]).toMatch(/border-2/);
    const paragraphes = [...encadre![2]!.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => espacesOrdinaires(texteVisible(m[1]!)));
    expect(paragraphes).toEqual(ENCADRE_OFFICIEL.split("\n"));
  });

  it("ne donnent aucun prix tant que la vente est fermée, et le donnent une fois ouverte", () => {
    expect(texte).not.toMatch(/€|12,90/);
    // Dans le HTML brut : l'espace insécable entre le montant et « € » y reste visible.
    expect(rendre(conditionsGenerales(FICHE_COMPLETE, { prix: PRIX_AFFICHE }))).toContain(
      "Le jeu complet coûte 12,90\u00a0€",
    );
  });

  it("décrivent la médiation, gratuite, avec ses conditions et ses deux voies de saisine, la convention étant signée", () => {
    for (const attendu of [
      ...MEDIATEUR,
      "La médiation est gratuite pour vous.",
      "qu'après une réclamation écrite adressée au vendeur et restée sans solution, et au plus tard un an après cette réclamation (article L612-2 du Code de la consommation)",
      "Vous pouvez saisir le médiateur en ligne, sur sa page de demande de médiation, www.mediateur-consommation-smp.fr/demander-une-mediation/ , ou par courrier à l'adresse ci-dessus.",
    ]) {
      expect(texte, attendu).toContain(attendu);
    }
    expect(html).toContain(`href="${PAGE_DE_DEMANDE}"`);
    const sans = espacesOrdinaires(texteVisible(rendre(conditionsGenerales(FICHE_SANS_CONVENTION, { prix: null }))));
    for (const morceau of MEDIATEUR) expect(sans, morceau).not.toContain(morceau);
  });

  it("ne renvoient pas vers l'ancienne plateforme européenne de règlement en ligne des litiges", () => {
    const signee = rendre(conditionsGenerales(FICHE_COMPLETE, { prix: PRIX_AFFICHE }));
    expect(signee).not.toMatch(/ec\.europa\.eu|\bodr\b|RLL|règlement en ligne des litiges/i);
  });

  it("portent la version que Stripe garde avec chaque commande", () => {
    expect(VERSION_CGV.identifiant).toBe("2026-09-27");
    expect(texte).toContain(`version du ${VERSION_CGV.libelle}`);
  });
});

describe("politique de confidentialité", () => {
  const html = rendre(politiqueDeConfidentialite(VENDEUR));
  const texte = espacesOrdinaires(texteVisible(html));

  it("dit qui est responsable, ce que devient chaque donnée, et pourquoi", () => {
    for (const attendu of [
      "Quentin Courtois EI, entrepreneur individuel",
      "rien n'est enregistré, rien n'est journalisé, rien n'est transmis à un tiers",
      "seuls le thème et la tranche d'âge du jeu y figurent en clair, sur la ligne de commande et sur la facture",
      "30 jours",
      "effacées automatiquement",
      // La trace de la commande, et combien de temps elle reste.
      "celle de l'envoi de la confirmation, celle du premier téléchargement et, si vous vous rétractez, celle de votre rétractation restent avec la commande chez Stripe aussi longtemps que la facture, dix ans",
      "Votre adresse e-mail, votre nom et votre adresse de facturation",
      "dix ans (article L123-22 du Code de commerce)",
      // Les copies des e-mails gardées par le vendeur.
      "Le vendeur en reçoit une copie cachée, qu'il garde dans sa messagerie, hébergée par Google (voir « Destinataires »), comme preuve de leur envoi pendant cinq ans",
      "Votre déclaration de rétractation",
      "L'exécution du contrat (article 6, paragraphe 1, b du RGPD)",
      "L'obligation légale (article 6, paragraphe 1, c du RGPD)",
      "L'intérêt légitime du vendeur (article 6, paragraphe 1, f du RGPD)",
      "Mise à jour le 27 septembre 2026",
      // La déclaration de rétractation : ce qui s'ajoute à la trace de la commande, et ce qui reste d'une déclaration non transmise.
      "une empreinte de la déclaration qui l'a enregistrée",
      "le nombre d'accusés de réception envoyés pour la commande",
      "seules la référence et l'heure de votre demande restent dans le journal du serveur, que notre hébergeur garde une heure",
    ]) {
      expect(texte, attendu).toContain(attendu);
    }
    // Corrigé : le thème et la tranche d'âge figurent en clair chez Stripe.
    expect(texte).not.toContain("aucune n'y figure en clair");
  });

  it("nomme les destinataires et l'encadrement de leurs transferts, tel qu'ils le déclarent", () => {
    for (const attendu of [
      "Stripe Payments Europe, Limited",
      "clauses contractuelles types",
      "cadre de protection des données UE–États-Unis",
      "politique de confidentialité de Stripe",
      // Resend, tel qu'il se déclare lui-même.
      "Plus Five Five, Inc. (Resend), prestataire d'envoi d'e-mails",
      "votre adresse e-mail, leur contenu et les conditions générales de vente jointes à la confirmation",
      "Resend déclare stocker ces e-mails et leurs journaux d'envoi aux États-Unis, et les garder 30 jours",
      "Resend déclare s'appuyer sur les clauses contractuelles types de la Commission européenne et sur son adhésion au cadre de protection des données UE–États-Unis",
      "page de Resend sur le RGPD , consultée le 26 septembre 2026",
      "accord de traitement des données de Resend , mis à jour le 31 décembre 2025",
      // Google, qui héberge la messagerie du vendeur, tel qu'il se déclare lui-même, sans accord de traitement avec le vendeur.
      "Google (Gmail), qui héberge la messagerie du vendeur, un compte Gmail personnel : il reçoit et conserve les copies cachées des confirmations de commande et des accusés de réception, ainsi que les messages que vous nous écrivez.",
      "Google n'est lié au vendeur par aucun accord de traitement des données",
      "Google Ireland Limited comme responsable du traitement pour les utilisateurs établis dans l'Espace économique européen",
      "Google déclare disposer de serveurs dans le monde entier",
      "par les décisions d'adéquation de la Commission européenne, par le cadre de protection des données UE–États-Unis, auquel Google LLC déclare adhérer, et par les clauses contractuelles types",
      "en vigueur depuis le 2 avril 2026",
      "en vigueur depuis le 23 août 2025",
      "Aucune donnée n'est vendue, ni transmise à qui que ce soit d'autre.",
      "Vercel Inc.",
      "avis de confidentialité de Vercel",
      "en vigueur depuis le 1er juin 2026",
    ]) {
      expect(texte, attendu).toContain(attendu);
    }
    expect(html).toContain('href="https://stripe.com/fr/privacy"');
    expect(html).toContain('href="https://resend.com/security/gdpr"');
    expect(html).toContain('href="https://resend.com/legal/dpa"');
    expect(html).toContain('href="https://vercel.com/legal/privacy-notice"');
    expect(html).toContain('href="https://policies.google.com/privacy?hl=fr"');
    expect(html).toContain('href="https://policies.google.com/privacy/frameworks?hl=fr"');
    expect(texte).not.toMatch(/21 septembre 2026|27 août 2026/);
    expect(html).not.toContain("vercel.com/legal/privacy-policy");
  });

  it("ne promet aucun cookie ni traceur, et dit le rôle du sessionStorage pendant le paiement", () => {
    expect(texte).toContain("ne déposent aucun cookie et n'emploient aucun traceur");
    expect(texte).toContain("sessionStorage");
    expect(texte).toContain("Pendant le paiement seulement");
  });

  it("liste les droits, la façon de les exercer, et la réclamation auprès de la CNIL", () => {
    for (const droit of ["d'accès", "de rectification", "d'effacement", "de limitation", "d'opposition", "de portabilité"]) {
      expect(texte, droit).toContain(droit);
    }
    expect(texte).toContain("écrivez à quentin.courtois090+missiongateau@gmail.com");
    expect(texte).toContain("CNIL");
    expect(html).toContain('href="https://www.cnil.fr"');
  });
});

describe("facture Stripe", () => {
  it("porte l'identité du vendeur, sa mention de TVA et le médiateur, lus dans la fiche", () => {
    const pied = piedDeFacture(FICHE_COMPLETE);
    for (const attendu of [
      "Quentin Courtois EI",
      "SIRET 992 667 006 00017",
      "TVA non applicable, article 293 B du CGI",
      ...MEDIATEUR,
    ]) {
      expect(pied, attendu).toContain(attendu);
    }
    expect(piedDeFacture(ficheAvecRcs("Montpellier 992 667 006"))).toContain("RCS Montpellier 992 667 006");
  });
});
