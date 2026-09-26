import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { VENDEUR, type FicheVendeur } from "@/contenu/vendeur";
import { adresseDuSite, cleConforme, lireEnvironnement, natureCle } from "@/vente/environnement";
import { CHAMPS_OBLIGATOIRES, ficheComplete, ficheCompleteHorsConvention, manquesDeLaFiche } from "@/vente/fiche";
import { exemplaireDEssai, livraisonPossible, stripePermis, venteOuverte } from "@/vente/ouverture";
import { NOMS_PAYS } from "@/contenu/vente";
import { PAYS_ACCEPTES, PAYS_UNION_EUROPEENNE, paysAccepte } from "@/vente/pays";
import { MONTANT_CENTIMES, PRIX_AFFICHE, formaterPrix } from "@/vente/prix";
import { creerReference, referenceValide, sessionValide } from "@/vente/reference";
import {
  CLE_REELLE,
  CLE_RESEND,
  CLE_RESTREINTE_REELLE,
  CLE_RESTREINTE_TEST,
  CLE_TEST,
  DOMAINE_PREVERSION,
  DOMAINE_PRODUCTION,
  FICHE_COMPLETE,
  FICHE_SANS_CONVENTION,
  environnement,
} from "./fauxStripe";

/** Copie profonde de la fiche avec un champ remplacé. */
function ficheAvec(chemin: string, valeur: unknown): FicheVendeur {
  const copie = structuredClone(FICHE_COMPLETE) as unknown as Record<string, unknown>;
  const cles = chemin.split(".");
  let objet = copie;
  for (const cle of cles.slice(0, -1)) objet = objet[cle] as Record<string, unknown>;
  objet[cles.at(-1)!] = valeur;
  return copie as unknown as FicheVendeur;
}

describe("nature de la clé Stripe", () => {
  it("reconnaît les clés réelles et de test, secrètes ou restreintes", () => {
    expect(natureCle(CLE_REELLE)).toBe("reelle");
    expect(natureCle(CLE_RESTREINTE_REELLE)).toBe("reelle");
    expect(natureCle(CLE_TEST)).toBe("test");
    expect(natureCle(CLE_RESTREINTE_TEST)).toBe("test");
  });

  it("refuse tout le reste", () => {
    for (const cle of [undefined, "", "pk_test_abc", "pk_live_abc", "sk_live_", "whsec_abc", `${CLE_TEST} `, "sk_test_a b"]) {
      expect(natureCle(cle), String(cle)).toBeNull();
    }
  });

  it("exige une clé réelle en production et une clé de test partout ailleurs", () => {
    expect(cleConforme(environnement({ vercelEnv: "production", cleStripe: CLE_REELLE }))).toBe(true);
    expect(cleConforme(environnement({ vercelEnv: "production", cleStripe: CLE_TEST }))).toBe(false);
    for (const vercelEnv of ["preview", "development", undefined]) {
      expect(cleConforme(environnement({ vercelEnv, cleStripe: CLE_TEST })), String(vercelEnv)).toBe(true);
      expect(cleConforme(environnement({ vercelEnv, cleStripe: CLE_REELLE })), String(vercelEnv)).toBe(false);
    }
    expect(cleConforme(environnement({ cleStripe: undefined }))).toBe(false);
  });

  it("lit l'environnement sans rien garder de ce qu'il ne connaît pas", () => {
    const env = lireEnvironnement({
      STRIPE_SECRET_KEY: ` ${CLE_TEST} `,
      RESEND_API_KEY: ` ${CLE_RESEND} `,
      CRON_SECRET: "secret-de-la-tache",
      VERCEL_ENV: "preview",
      VERCEL_URL: DOMAINE_PREVERSION,
      VERCEL_PROJECT_PRODUCTION_URL: DOMAINE_PRODUCTION,
      AUTRE: "x",
      URL_SITE: "https://ailleurs.example",
      SUPABASE_URL: "https://base.example",
      LIEN_SECRET: "x",
    });
    expect(env).toEqual({
      cleStripe: CLE_TEST,
      vercelEnv: "preview",
      domaineProduction: DOMAINE_PRODUCTION,
      domaineDeploiement: DOMAINE_PREVERSION,
      port: undefined,
      cleResend: CLE_RESEND,
      secretTache: "secret-de-la-tache",
    });
    expect(lireEnvironnement({ STRIPE_SECRET_KEY: "  ", RESEND_API_KEY: " ", CRON_SECRET: "" })).toMatchObject({
      cleStripe: undefined,
      cleResend: undefined,
      secretTache: undefined,
    });
  });

  it("ne lit jamais URL_SITE, SUPABASE_URL ni LIEN_SECRET, qui ne servent à rien", () => {
    const fichiers = (dossier: string): string[] =>
      readdirSync(dossier).flatMap((nom) => {
        const chemin = path.join(dossier, nom);
        return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
      });
    const fautifs = fichiers(path.join(process.cwd(), "src")).filter((fichier) =>
      /\b(URL_SITE|SUPABASE_URL|LIEN_SECRET)\b/.test(readFileSync(fichier, "utf8")),
    );
    expect(fautifs).toEqual([]);
  });
});

describe("fiche du vendeur", () => {
  it("est remplie comme demandé, sans rien inventer", () => {
    expect(VENDEUR.nom).toBe("Quentin Courtois");
    expect(VENDEUR.mention).toBe("EI");
    expect(VENDEUR.siret.replace(/\s/g, "")).toBe("99266700600017");
    expect(VENDEUR.rcs).toBe("");
    expect(VENDEUR.capital).toBe("");
    // La convention avec le médiateur a été signée le 25 septembre 2026 ; le médiateur reste celui de la fiche.
    expect(VENDEUR.mediateur.conventionSignee).toBe(true);
    expect(VENDEUR.mediateur.nom).toBe("Société Médiation Professionnelle");
    expect(VENDEUR.mediateur.site).toBe("https://www.mediateur-consommation-smp.fr");
    expect(VENDEUR.mediateur.demande).toBe("https://www.mediateur-consommation-smp.fr/demander-une-mediation/");
  });

  it("est complète, convention avec le médiateur comprise", () => {
    expect(manquesDeLaFiche(VENDEUR)).toEqual([]);
    expect(ficheComplete(VENDEUR)).toBe(true);
    expect(FICHE_COMPLETE).toBe(VENDEUR);
    expect(ficheCompleteHorsConvention(VENDEUR)).toBe(true);
    expect(manquesDeLaFiche(FICHE_SANS_CONVENTION)).toEqual(["mediateur.conventionSignee"]);
    expect(ficheCompleteHorsConvention(ficheAvec("siret", ""))).toBe(false);
    // La page de demande de médiation est facultative : le site du médiateur en tient lieu.
    expect(ficheComplete(ficheAvec("mediateur.demande", ""))).toBe(true);
  });

  it("chaque champ obligatoire vide rend la fiche incomplète", () => {
    for (const chemin of CHAMPS_OBLIGATOIRES) {
      for (const vide of ["", "   "]) {
        const fiche = ficheAvec(chemin, vide);
        expect(manquesDeLaFiche(fiche), chemin).toContain(chemin);
        expect(ficheComplete(fiche), chemin).toBe(false);
      }
    }
  });

  it("le RCS et le capital sont facultatifs", () => {
    expect(ficheComplete(ficheAvec("rcs", ""))).toBe(true);
    expect(ficheComplete(ficheAvec("capital", ""))).toBe(true);
    expect(ficheComplete(ficheAvec("rcs", "Montpellier 992 667 006"))).toBe(true);
  });

  it("un SIRET qui n'a pas quatorze chiffres ne passe pas", () => {
    expect(ficheComplete(ficheAvec("siret", "992 667 006"))).toBe(false);
  });
});

describe("ouverture de la vente", () => {
  const PRODUCTION_REELLE = environnement({ vercelEnv: "production", cleStripe: CLE_REELLE });

  it("reste fermée en production aujourd'hui : aucune clé Stripe réelle", () => {
    // Aujourd'hui : aucune STRIPE_SECRET_KEY en production ; une clé de test n'ouvrirait rien non plus.
    expect(venteOuverte(environnement({ vercelEnv: "production", cleStripe: undefined }), VENDEUR)).toBe(false);
    expect(venteOuverte(environnement({ vercelEnv: "production", cleStripe: CLE_TEST }), VENDEUR)).toBe(false);
    // Avec une clé réelle, la fiche étant désormais complète, elle ouvrirait.
    expect(venteOuverte(PRODUCTION_REELLE, VENDEUR)).toBe(true);
    expect(venteOuverte(PRODUCTION_REELLE, FICHE_SANS_CONVENTION)).toBe(false);
  });

  it("s'ouvre pour l'essai hors production dès aujourd'hui : clé de test, fiche complète sauf la convention, clé de Resend", () => {
    expect(venteOuverte(environnement(), VENDEUR)).toBe(true);
    expect(venteOuverte(environnement({ vercelEnv: undefined, cleStripe: CLE_RESTREINTE_TEST }), VENDEUR)).toBe(true);
  });

  it("s'ouvre en production quand tout y est, convention comprise", () => {
    expect(venteOuverte(PRODUCTION_REELLE, FICHE_COMPLETE)).toBe(true);
  });

  /**
   * La matrice complète : production ou non × nature de la clé × fiche ×
   * convention × clé de Resend. L'attendu est écrit ici indépendamment de
   * src/vente/ouverture.ts.
   */
  it("suit la matrice complète des conditions", () => {
    const environnements = ["production", "preview", "development", undefined] as const;
    const cles = [undefined, CLE_TEST, CLE_RESTREINTE_TEST, CLE_REELLE, CLE_RESTREINTE_REELLE, "pk_test_abc"] as const;
    const fiches = [
      { nom: "complète", remplie: true },
      { nom: "SIRET vide", remplie: false },
    ] as const;
    let cas = 0;
    for (const vercelEnv of environnements) {
      for (const cleStripe of cles) {
        for (const { nom, remplie } of fiches) {
          for (const signee of [true, false]) {
            for (const cleResend of [CLE_RESEND, undefined]) {
              const fiche = ficheAvec("mediateur.conventionSignee", signee);
              if (!remplie) fiche.siret = "";
              const production = vercelEnv === "production";
              const cleAttendue = production ? cleStripe === CLE_REELLE || cleStripe === CLE_RESTREINTE_REELLE : cleStripe === CLE_TEST || cleStripe === CLE_RESTREINTE_TEST;
              const attendu = cleAttendue && remplie && (signee || !production) && cleResend !== undefined;
              const obtenu = venteOuverte(environnement({ vercelEnv, cleStripe, cleResend }), fiche);
              expect(obtenu, `${vercelEnv} / ${cleStripe} / ${nom} / signée ${signee} / Resend ${Boolean(cleResend)}`).toBe(attendu);
              cas += 1;
            }
          }
        }
      }
    }
    expect(cas).toBe(4 * 6 * 2 * 2 * 2);
  });

  it("reste fermée dès qu'un champ obligatoire est vide, en production comme ailleurs", () => {
    for (const chemin of CHAMPS_OBLIGATOIRES) {
      expect(venteOuverte(PRODUCTION_REELLE, ficheAvec(chemin, "")), chemin).toBe(false);
      expect(venteOuverte(environnement(), ficheAvec(chemin, "")), chemin).toBe(false);
    }
    expect(venteOuverte(PRODUCTION_REELLE, ficheAvec("mediateur.conventionSignee", false))).toBe(false);
  });

  it("en production, seule une clé réelle donne un client Stripe ; ailleurs, toute clé valable", () => {
    for (const cle of [CLE_REELLE, CLE_RESTREINTE_REELLE]) {
      expect(stripePermis(environnement({ vercelEnv: "production", cleStripe: cle })), cle).toBe(true);
    }
    for (const cle of [CLE_TEST, CLE_RESTREINTE_TEST, undefined, "pk_live_abc"]) {
      expect(stripePermis(environnement({ vercelEnv: "production", cleStripe: cle })), String(cle)).toBe(false);
    }
    for (const vercelEnv of ["preview", "development", undefined]) {
      for (const cle of [CLE_TEST, CLE_RESTREINTE_TEST, CLE_REELLE]) {
        expect(stripePermis(environnement({ vercelEnv, cleStripe: cle })), `${vercelEnv} ${cle}`).toBe(true);
      }
      expect(stripePermis(environnement({ vercelEnv, cleStripe: undefined })), String(vercelEnv)).toBe(false);
    }
  });

  it("la livraison des commandes payées n'a besoin que de ce client, pas de l'ouverture de la vente", () => {
    expect(livraisonPossible(environnement({ vercelEnv: "production", cleStripe: CLE_REELLE }))).toBe(true);
    expect(livraisonPossible(environnement({ vercelEnv: "production", cleStripe: CLE_TEST }))).toBe(false);
    expect(livraisonPossible(environnement({ vercelEnv: "preview", cleStripe: CLE_REELLE }))).toBe(true);
    expect(livraisonPossible(environnement({ cleStripe: undefined }))).toBe(false);
  });

  it("le kit livré est un exemplaire d'essai hors production, et en production sans clé réelle", () => {
    expect(exemplaireDEssai(environnement({ vercelEnv: "production", cleStripe: CLE_REELLE }))).toBe(false);
    expect(exemplaireDEssai(environnement({ vercelEnv: "production", cleStripe: CLE_RESTREINTE_REELLE }))).toBe(false);
    expect(exemplaireDEssai(environnement({ vercelEnv: "production", cleStripe: CLE_TEST }))).toBe(true);
    expect(exemplaireDEssai(environnement({ vercelEnv: "production", cleStripe: undefined }))).toBe(true);
    for (const vercelEnv of ["preview", "development", undefined]) {
      expect(exemplaireDEssai(environnement({ vercelEnv })), String(vercelEnv)).toBe(true);
      expect(exemplaireDEssai(environnement({ vercelEnv, cleStripe: CLE_REELLE })), String(vercelEnv)).toBe(true);
    }
  });
});

describe("adresse du déploiement", () => {
  it("vise la production, la préversion ou localhost selon l'environnement", () => {
    expect(adresseDuSite(environnement({ vercelEnv: "production" }))).toBe(`https://${DOMAINE_PRODUCTION}`);
    expect(adresseDuSite(environnement({ vercelEnv: "preview" }))).toBe(`https://${DOMAINE_PREVERSION}`);
    expect(adresseDuSite(environnement({ vercelEnv: undefined }))).toBe("http://localhost:3000");
    expect(adresseDuSite(environnement({ vercelEnv: undefined, port: "4000" }))).toBe("http://localhost:4000");
  });

  it("refuse une adresse absente ou douteuse plutôt que d'envoyer le client ailleurs", () => {
    expect(adresseDuSite(environnement({ vercelEnv: "production", domaineProduction: undefined }))).toBeNull();
    expect(adresseDuSite(environnement({ vercelEnv: "preview", domaineDeploiement: "evil.com/x?y" }))).toBeNull();
    expect(adresseDuSite(environnement({ vercelEnv: "production", domaineProduction: "https://a.fr" }))).toBeNull();
  });
});

describe("prix, pays et références", () => {
  it("affiche 12,90 € pour 1 290 centimes", () => {
    expect(MONTANT_CENTIMES).toBe(1290);
    expect(PRIX_AFFICHE).toBe("12,90\u00a0€");
    expect(formaterPrix(500)).toBe("5,00\u00a0€");
  });

  it("accepte les 27 pays de l'Union européenne, la Suisse, Monaco et le Canada, et eux seuls", () => {
    expect(new Set(PAYS_UNION_EUROPEENNE).size).toBe(27);
    expect(PAYS_ACCEPTES).toHaveLength(30);
    for (const code of ["FR", "DE", "BE", "LU", "CH", "MC", "CA", "CZ", "SE"]) expect(paysAccepte(code), code).toBe(true);
    for (const code of ["GB", "US", "NO", "AUTRE", "", "fr", null]) expect(paysAccepte(code), String(code)).toBe(false);
    expect(Object.keys(NOMS_PAYS).sort()).toEqual([...PAYS_ACCEPTES].sort());
    expect(Object.keys(NOMS_PAYS)[0]).toBe("FR");
  });

  it("tire des références de 128 bits en base64url, toutes différentes", () => {
    const references = Array.from({ length: 200 }, creerReference);
    expect(new Set(references).size).toBe(200);
    for (const reference of references) {
      expect(referenceValide(reference)).toBe(true);
      expect(Buffer.from(reference, "base64url")).toHaveLength(16);
    }
    for (const douteuse of ["abc", "x".repeat(23), `${"a".repeat(21)}"`, `${"a".repeat(21)}\\`, null]) {
      expect(referenceValide(douteuse)).toBe(false);
    }
    expect(sessionValide("cs_test_a1B2c3D4e5F6")).toBe(true);
    expect(sessionValide("cs_live_a1B2c3D4e5F6")).toBe(true);
    expect(sessionValide("pi_123")).toBe(false);
    expect(sessionValide("cs_test_abc\"")).toBe(false);
  });
});
