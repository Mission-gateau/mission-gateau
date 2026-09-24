import { describe, expect, it } from "vitest";
import { ENFANTS_MAX, PRENOM_MAX } from "@/engine/configuration";
import { CACHETTES } from "@/engine/cachettes";
import type { Configuration } from "@/engine/types";
import { ETIQUETTE_HKDF, chiffrer, dechiffrer, decouper } from "@/vente/chiffrement";
import {
  CLES,
  LIMITES_METADONNEES,
  configurationPresente,
  depassementsDeMetadonnees,
  lireCommande,
  lireConfiguration,
  metadonneesDEffacement,
  metadonneesDuPaiement,
  type Commande,
} from "@/vente/metadonnees";
import { CLE_REELLE, CLE_TEST, configurationMarquee, marquesDans } from "./fauxStripe";

const COMMANDE: Commande = {
  reference: "AbCdEfGhIjKlMnOpQrStUv",
  versionKit: "1.2",
  graine: "k7m2p9q4rs",
  pays: "FR",
  versionCgv: "2026-09-24",
  accordCgv: "2026-09-24T12:00:00.000Z",
  accordAccesImmediat: "2026-09-24T12:00:00.000Z",
};

/** La configuration la plus lourde que le formulaire accepte : chaque champ au maximum. */
function configurationMaximale(): Configuration {
  const long = (n: number) => "é".repeat(n);
  return {
    theme: "dinosaures",
    age: 12,
    prenom: "Ǆ".repeat(PRENOM_MAX),
    nombreEnfants: ENFANTS_MAX,
    duree: 60,
    cachettes: CACHETTES.map((c) => c.id),
    fete: {
      date: long(120),
      heure: long(120),
      adresse: "漢".repeat(200),
      contact: long(120),
      invites: Array.from({ length: ENFANTS_MAX }, () => "Ǆ".repeat(PRENOM_MAX)),
    },
  };
}

describe("chiffrement AES-256-GCM", () => {
  it("fait l'aller-retour", () => {
    const bloc = chiffrer("Zéphyrine — 3 allée des Mésanges", CLE_TEST, "contexte");
    expect(dechiffrer(bloc, CLE_TEST, "contexte")).toBe("Zéphyrine — 3 allée des Mésanges");
  });

  it("ne laisse rien lire en clair et ne produit jamais deux fois le même bloc", () => {
    const a = chiffrer("Zéphyrine", CLE_TEST, "c");
    const b = chiffrer("Zéphyrine", CLE_TEST, "c");
    expect(a).not.toBe(b);
    expect(marquesDans(a + Buffer.from(a, "base64url").toString("latin1"))).toEqual([]);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("refuse un contenu altéré, une autre clé ou un autre contexte", () => {
    const bloc = chiffrer("Zéphyrine", CLE_TEST, "ref|1.2|graine");
    const octets = Buffer.from(bloc, "base64url");
    for (let position = 0; position < octets.length; position += 1) {
      const altere = Buffer.from(octets);
      altere[position] = altere[position]! ^ 0x01;
      expect(dechiffrer(altere.toString("base64url"), CLE_TEST, "ref|1.2|graine"), `octet ${position}`).toBeNull();
    }
    expect(dechiffrer(bloc, CLE_REELLE, "ref|1.2|graine")).toBeNull();
    expect(dechiffrer(bloc, CLE_TEST, "autre|1.2|graine")).toBeNull();
    expect(dechiffrer(bloc.slice(0, -4), CLE_TEST, "ref|1.2|graine")).toBeNull();
    expect(dechiffrer("pas du base64 !", CLE_TEST, "ref|1.2|graine")).toBeNull();
    expect(dechiffrer("", CLE_TEST, "ref|1.2|graine")).toBeNull();
  });

  it("dérive sa clé avec une étiquette propre à cet usage", () => {
    expect(ETIQUETTE_HKDF).toMatch(/mission-gateau/);
    expect(ETIQUETTE_HKDF).toMatch(/configuration/);
  });

  it("découpe un texte en morceaux bornés, sans rien perdre", () => {
    const texte = "x".repeat(1234);
    const morceaux = decouper(texte, 500);
    expect(morceaux.map((m) => m.length)).toEqual([500, 500, 234]);
    expect(morceaux.join("")).toBe(texte);
  });
});

describe("métadonnées du paiement", () => {
  it("gardent en clair la référence, la version, la graine, le pays, les CGV et l'heure des accords", () => {
    const meta = metadonneesDuPaiement(COMMANDE, configurationMarquee(), CLE_TEST);
    expect(meta[CLES.reference]).toBe(COMMANDE.reference);
    expect(meta[CLES.versionKit]).toBe("1.2");
    expect(meta[CLES.graine]).toBe(COMMANDE.graine);
    expect(meta[CLES.pays]).toBe("FR");
    expect(meta[CLES.versionCgv]).toBe("2026-09-24");
    expect(meta[CLES.accordCgv]).toBe(COMMANDE.accordCgv);
    expect(meta[CLES.accordAccesImmediat]).toBe(COMMANDE.accordAccesImmediat);
    expect(meta[CLES.etatConfiguration]).toBe("chiffree");
    expect(lireCommande(meta)).toEqual(COMMANDE);
  });

  it("ne contiennent aucune donnée saisie en clair", () => {
    const meta = metadonneesDuPaiement(COMMANDE, configurationMarquee(), CLE_TEST);
    expect(marquesDans(JSON.stringify(meta))).toEqual([]);
    expect(JSON.stringify(meta)).not.toMatch(/prenom|invites|adresse|contact/);
  });

  it("rendent la configuration complète, et rien d'autre", () => {
    const configuration = configurationMarquee();
    const meta = metadonneesDuPaiement(COMMANDE, configuration, CLE_TEST);
    expect(lireConfiguration(meta, CLE_TEST)).toEqual({ etat: "lue", configuration });
  });

  it("tiennent dans les limites de Stripe, même pour la configuration la plus lourde", () => {
    const meta = metadonneesDuPaiement(COMMANDE, configurationMaximale(), CLE_TEST);
    expect(depassementsDeMetadonnees(meta)).toEqual([]);
    expect(Number(meta[CLES.nombreMorceaux])).toBeGreaterThan(1);
    expect(Object.keys(meta).length).toBeLessThanOrEqual(LIMITES_METADONNEES.cles);
    expect(lireConfiguration(meta, CLE_TEST)).toEqual({ etat: "lue", configuration: configurationMaximale() });
  });

  it("le contrôle des limites attrape bien un dépassement", () => {
    expect(depassementsDeMetadonnees({ cle: "x".repeat(501) })).toHaveLength(1);
    expect(depassementsDeMetadonnees({ ["c".repeat(41)]: "x" })).toHaveLength(1);
    expect(depassementsDeMetadonnees({ "a[b]": "x" })).toHaveLength(1);
    const trop = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`k${i}`, "v"]));
    expect(depassementsDeMetadonnees(trop)).toHaveLength(1);
  });

  it("refusent un morceau altéré, manquant, déplacé ou recopié sur une autre commande", () => {
    const meta = metadonneesDuPaiement(COMMANDE, configurationMaximale(), CLE_TEST);
    const altere = { ...meta, config_0: `${meta.config_0!.slice(0, -1)}${meta.config_0!.endsWith("A") ? "B" : "A"}` };
    expect(lireConfiguration(altere, CLE_TEST)).toEqual({ etat: "illisible" });
    const manquant = { ...meta };
    delete manquant.config_1;
    expect(lireConfiguration(manquant, CLE_TEST)).toEqual({ etat: "illisible" });
    const inverse = { ...meta, config_0: meta.config_1!, config_1: meta.config_0! };
    expect(lireConfiguration(inverse, CLE_TEST)).toEqual({ etat: "illisible" });
    // Même bloc, autre référence ou autre graine : le contexte authentifié ne correspond plus.
    expect(lireConfiguration({ ...meta, [CLES.reference]: "ZZZZZZZZZZZZZZZZZZZZZZ" }, CLE_TEST)).toEqual({ etat: "illisible" });
    expect(lireConfiguration({ ...meta, [CLES.graine]: "2222222222" }, CLE_TEST)).toEqual({ etat: "illisible" });
    // Une autre clé Stripe ne relit pas la commande.
    expect(lireConfiguration(meta, CLE_REELLE)).toEqual({ etat: "illisible" });
  });

  it("s'effacent en ne touchant qu'aux morceaux chiffrés", () => {
    const meta = metadonneesDuPaiement(COMMANDE, configurationMaximale(), CLE_TEST);
    const effacement = metadonneesDEffacement(meta);
    expect(effacement[CLES.etatConfiguration]).toBe("effacee");
    const touchees = Object.keys(effacement).filter((cle) => cle !== CLES.etatConfiguration);
    expect(touchees.sort()).toEqual(Object.keys(meta).filter((cle) => /^config_/.test(cle)).sort());
    expect(touchees.every((cle) => effacement[cle] === "")).toBe(true);

    const apres = { ...meta, ...effacement };
    for (const cle of touchees) delete apres[cle];
    expect(configurationPresente(apres)).toBe(false);
    expect(lireCommande(apres)).toEqual(COMMANDE);
    expect(lireConfiguration(apres, CLE_TEST)).toEqual({ etat: "effacee" });
  });
});
