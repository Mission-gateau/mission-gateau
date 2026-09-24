import { describe, expect, it } from "vitest";
import { VENDEUR, type FicheVendeur } from "@/contenu/vendeur";
import { adresseDuSite, cleConforme, lireEnvironnement, natureCle } from "@/vente/environnement";
import { CHAMPS_OBLIGATOIRES, ficheComplete, manquesDeLaFiche } from "@/vente/fiche";
import { livraisonPossible, venteOuverte } from "@/vente/ouverture";
import { NOMS_PAYS } from "@/contenu/vente";
import { PAYS_ACCEPTES, PAYS_UNION_EUROPEENNE, paysAccepte } from "@/vente/pays";
import { MONTANT_CENTIMES, PRIX_AFFICHE, formaterPrix } from "@/vente/prix";
import { creerReference, referenceValide, sessionValide } from "@/vente/reference";
import {
  CLE_REELLE,
  CLE_RESTREINTE_REELLE,
  CLE_RESTREINTE_TEST,
  CLE_TEST,
  DOMAINE_PREVERSION,
  DOMAINE_PRODUCTION,
  FICHE_COMPLETE,
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
      VERCEL_ENV: "preview",
      VERCEL_URL: DOMAINE_PREVERSION,
      VERCEL_PROJECT_PRODUCTION_URL: DOMAINE_PRODUCTION,
      AUTRE: "x",
    });
    expect(env).toEqual({
      cleStripe: CLE_TEST,
      vercelEnv: "preview",
      domaineProduction: DOMAINE_PRODUCTION,
      domaineDeploiement: DOMAINE_PREVERSION,
      port: undefined,
    });
    expect(lireEnvironnement({ STRIPE_SECRET_KEY: "  " }).cleStripe).toBeUndefined();
  });
});

describe("fiche du vendeur", () => {
  it("est remplie comme demandé, sans rien inventer", () => {
    expect(VENDEUR.nom).toBe("Quentin Courtois");
    expect(VENDEUR.mention).toBe("EI");
    expect(VENDEUR.siret.replace(/\s/g, "")).toBe("99266700600017");
    expect(VENDEUR.rcs).toBe("");
    expect(VENDEUR.capital).toBe("");
    expect(VENDEUR.mediateur.conventionSignee).toBe(false);
  });

  it("aujourd'hui, il ne manque que la convention avec le médiateur", () => {
    expect(manquesDeLaFiche(VENDEUR)).toEqual(["mediateur.conventionSignee"]);
    expect(ficheComplete(FICHE_COMPLETE)).toBe(true);
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

  it("reste fermée en production aujourd'hui : la convention n'est pas signée", () => {
    expect(venteOuverte(PRODUCTION_REELLE, VENDEUR)).toBe(false);
    expect(venteOuverte(environnement(), VENDEUR)).toBe(false);
  });

  it("s'ouvre quand tout y est, avec une clé de la bonne nature", () => {
    expect(venteOuverte(PRODUCTION_REELLE, FICHE_COMPLETE)).toBe(true);
    expect(venteOuverte(environnement({ cleStripe: CLE_TEST }), FICHE_COMPLETE)).toBe(true);
    expect(venteOuverte(environnement({ vercelEnv: undefined, cleStripe: CLE_RESTREINTE_TEST }), FICHE_COMPLETE)).toBe(
      true,
    );
  });

  it("reste fermée sans clé, ou avec une clé de la mauvaise nature", () => {
    expect(venteOuverte(environnement({ cleStripe: undefined }), FICHE_COMPLETE)).toBe(false);
    expect(venteOuverte(environnement({ vercelEnv: "production", cleStripe: CLE_TEST }), FICHE_COMPLETE)).toBe(false);
    expect(venteOuverte(environnement({ vercelEnv: "preview", cleStripe: CLE_REELLE }), FICHE_COMPLETE)).toBe(false);
  });

  it("reste fermée dès qu'un champ obligatoire est vide ou que la convention n'est pas signée", () => {
    for (const chemin of CHAMPS_OBLIGATOIRES) {
      expect(venteOuverte(PRODUCTION_REELLE, ficheAvec(chemin, "")), chemin).toBe(false);
    }
    expect(venteOuverte(PRODUCTION_REELLE, ficheAvec("mediateur.conventionSignee", false))).toBe(false);
  });

  it("la livraison des commandes payées n'a besoin que d'une clé, quelle qu'elle soit", () => {
    expect(livraisonPossible(environnement({ vercelEnv: "production", cleStripe: CLE_TEST }))).toBe(true);
    expect(livraisonPossible(environnement({ vercelEnv: "preview", cleStripe: CLE_REELLE }))).toBe(true);
    expect(livraisonPossible(environnement({ cleStripe: undefined }))).toBe(false);
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
