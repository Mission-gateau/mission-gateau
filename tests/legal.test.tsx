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
import { FICHE_COMPLETE } from "./fauxStripe";

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
      "Mise à jour le 24 septembre 2026",
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

  it("ne nomment le médiateur qu'une fois la convention signée", () => {
    for (const morceau of MEDIATEUR) expect(texte).not.toContain(morceau);
    const signee = espacesOrdinaires(texteVisible(rendre(mentionsLegales(FICHE_COMPLETE))));
    for (const morceau of MEDIATEUR) expect(signee, morceau).toContain(morceau);
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
      "8. Absence de droit de rétractation",
      "9. Service client et réclamations",
      "10. Garantie légale de conformité",
      "11. Médiation de la consommation",
      "12. Droit applicable",
      "13. Usage familial",
      "14. Données personnelles",
      "15. Version",
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
      "accès immédiat",
      "par carte bancaire",
      "page de paiement sécurisée de Stripe",
      "livré par téléchargement, immédiatement après le paiement",
      "valable 30 jours",
      "article L221-28, 13° du Code de la consommation",
      "accord préalable exprès",
      "renoncement exprès",
      "vous les confirme sur un support durable",
      "Nous répondons sous 7 jours au plus",
      "droit français",
      "usage familial",
      "revente",
      "interdites",
      "Version du 24 septembre 2026",
    ]) {
      expect(texte, attendu).toContain(attendu);
    }
    expect(html).toContain('href="/confidentialite"');
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

  it("décrivent la médiation, gratuite, avec ses conditions, une fois la convention signée", () => {
    for (const morceau of MEDIATEUR) expect(texte).not.toContain(morceau);
    const signee = espacesOrdinaires(texteVisible(rendre(conditionsGenerales(FICHE_COMPLETE, { prix: null }))));
    for (const attendu of [...MEDIATEUR, "gratuitement", "réclamation écrite", "un an"]) {
      expect(signee, attendu).toContain(attendu);
    }
  });

  it("ne renvoient pas vers l'ancienne plateforme européenne de règlement en ligne des litiges", () => {
    const signee = rendre(conditionsGenerales(FICHE_COMPLETE, { prix: PRIX_AFFICHE }));
    expect(signee).not.toMatch(/ec\.europa\.eu|\bodr\b|RLL|règlement en ligne des litiges/i);
  });

  it("portent la version que Stripe garde avec chaque commande", () => {
    expect(VERSION_CGV.identifiant).toBe("2026-09-24");
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
      "chiffrées : aucune n'y figure en clair",
      "30 jours",
      "effacées automatiquement",
      "Votre adresse e-mail, votre nom et votre adresse de facturation",
      "dix ans (article L123-22 du Code de commerce)",
      "L'exécution du contrat (article 6, paragraphe 1, b du RGPD)",
      "L'obligation légale (article 6, paragraphe 1, c du RGPD)",
      "Mise à jour le 24 septembre 2026",
    ]) {
      expect(texte, attendu).toContain(attendu);
    }
  });

  it("nomme les destinataires et l'encadrement de leurs transferts, tel qu'ils le déclarent", () => {
    for (const attendu of [
      "Stripe Payments Europe, Limited",
      "clauses contractuelles types",
      "cadre de protection des données UE–États-Unis",
      "politique de confidentialité de Stripe",
      "Vercel Inc.",
      "politique de confidentialité de Vercel",
    ]) {
      expect(texte, attendu).toContain(attendu);
    }
    expect(html).toContain('href="https://stripe.com/fr/privacy"');
    expect(html).toContain('href="https://vercel.com/legal/privacy-policy"');
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
