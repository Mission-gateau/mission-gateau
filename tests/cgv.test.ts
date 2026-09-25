import { createHash } from "node:crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { VERSIONS_CGV, VERSION_CGV, VERSION_EN_VIGUEUR, conditionsGenerales, versionCgv } from "@/contenu/cgv";
import { CROCHET_DU_FORMULAIRE, MODELE_FORMULAIRE, formulaireRempli } from "@/contenu/formulaireRetractation";
import { VENDEUR } from "@/contenu/vendeur";
import { construireKit } from "@/engine/kit";
import { documentCgv } from "@/pdf/documents/cgv";
import { documentKit } from "@/pdf/documents/kit";
import { enregistrerPolices, preparerPolicesCgv } from "@/pdf/ressources";
import { nomDuPdfCgv, pdfDesCgv } from "@/vente/cgvPdf";
import { configuration } from "./aide";
import { FICHE_NEUTRE } from "./collecte";
import { glyphesInconnus, policesDuPdf, texteDuPdf } from "./lirePdf";
import { FORMULAIRE_OFFICIEL } from "./officiels";

/**
 * Les versions des conditions générales de vente : chacune reste dans le
 * code, indexée par son identifiant, et n'est plus jamais modifiée une fois
 * publiée. Leur PDF, joint à la confirmation de commande, est identique d'un
 * rendu à l'autre.
 */

/**
 * Empreinte du texte de chaque version publiée, rendu avec une fiche neutre :
 * elle ne dépend que de la prose. Si ce test échoue, une version publiée a
 * été modifiée : il faut la rétablir et publier une nouvelle version dans un
 * nouveau fichier.
 */
const EMPREINTES: Record<string, string> = {
  "2026-09-24": "290562b5e237af72e0e276cd1390ba1c4184f9dd64a90f2d1169704f9c8cf9d1",
  "2026-09-25": "cce01811edbe4be5ea9f823f9b0508fb8c8d51f53df160dddf01fb8dba6cb307",
};

describe("versions des CGV", () => {
  it("gardent chaque version publiée, dans l'ordre, la dernière en vigueur", () => {
    expect(VERSIONS_CGV.map((v) => v.identifiant)).toEqual(["2026-09-24", "2026-09-25"]);
    expect(VERSION_EN_VIGUEUR.identifiant).toBe("2026-09-25");
    expect(VERSION_CGV).toEqual({ identifiant: "2026-09-25", libelle: "25 septembre 2026" });
    expect(versionCgv("2026-09-24")?.libelle).toBe("24 septembre 2026");
    expect(versionCgv("2026-09-23")).toBeNull();
    expect(versionCgv("")).toBeNull();
    // La page /cgv affiche la version en vigueur.
    expect(conditionsGenerales(VENDEUR, { prix: null }).date).toBe("Version du 25 septembre 2026");
  });

  it("ne modifient jamais une version publiée", () => {
    for (const version of VERSIONS_CGV) {
      const empreinte = createHash("sha256")
        .update(JSON.stringify(version.conditions(FICHE_NEUTRE, { prix: "{prix}" })))
        .digest("hex");
      expect(empreinte, version.identifiant).toBe(EMPREINTES[version.identifiant]);
    }
  });

  it("datent chaque PDF du jour de sa version, et le nomment d'après elle", () => {
    for (const version of VERSIONS_CGV) {
      expect(version.date.toISOString()).toBe(`${version.identifiant}T00:00:00.000Z`);
      expect(nomDuPdfCgv(version)).toBe(`cgv-mission-gateau-${version.identifiant}.pdf`);
    }
  });

  it("citent l'article de la garantie légale de conformité", () => {
    for (const version of VERSIONS_CGV) {
      const titre = version.conditions(VENDEUR, { prix: null }).sections.map((s) => s.titre)[version.articleGarantie - 1];
      expect(titre, version.identifiant).toBe(`${version.articleGarantie}. Garantie légale de conformité`);
    }
  });
});

describe("formulaire type de rétractation", () => {
  it("reprend mot pour mot l'annexe à l'article R221-1 du Code de la consommation", () => {
    expect(MODELE_FORMULAIRE.join("\n")).toBe(FORMULAIRE_OFFICIEL);
    expect(FORMULAIRE_OFFICIEL).toContain(CROCHET_DU_FORMULAIRE);
  });

  it("remplace le crochet par le nom, l'adresse géographique et l'adresse électronique du vendeur", () => {
    const rempli = formulaireRempli(VENDEUR).map((ligne) => ligne.replace(/[  ]/g, " "));
    expect(rempli[2]).toBe(
      "A l'attention de Quentin Courtois EI, 7 impasse des Bosquets, 34670 Baillargues, France, quentin.courtois090+missiongateau@gmail.com :",
    );
    expect(rempli.join("\n")).not.toContain("[");
    expect(rempli.filter((_, i) => i !== 2)).toEqual(MODELE_FORMULAIRE.filter((_, i) => i !== 2));
  });
});

describe("PDF des CGV", () => {
  async function rendu(identifiant: string): Promise<Buffer> {
    await preparerPolicesCgv();
    const version = versionCgv(identifiant)!;
    return renderToBuffer(documentCgv(version.conditions(VENDEUR, { prix: "12,90 €" }), { creation: version.date }));
  }

  it("est identique octet pour octet d'un rendu à l'autre, même après des kits aux capitales accentuées", async () => {
    const avant = await rendu("2026-09-25");
    const autre = await rendu("2026-09-24");
    enregistrerPolices();
    // Des kits dont le texte fait créer à fontkit des glyphes « composants » (É, À, Ç…).
    for (const age of [5, 8, 11]) {
      await renderToBuffer(
        documentKit(construireKit(configuration({ age, prenom: "Élodie", fete: { invites: ["Àlan", "Çali", "Ève"] } }), "cgvdeterm")),
      );
    }
    expect(Buffer.compare(await rendu("2026-09-25"), avant)).toBe(0);
    expect(Buffer.compare(await rendu("2026-09-24"), autre)).toBe(0);
    // Le producteur du PDF joint : même mécanisme, mis en cache.
    expect(Buffer.compare(await pdfDesCgv(versionCgv("2026-09-25")!, VENDEUR, "12,90 €"), avant)).toBe(0);
  });

  it("n'emploie que les polices du dépôt, incorporées, sans glyphe privé de caractère", async () => {
    const pdf = await rendu("2026-09-25");
    const polices = policesDuPdf(pdf);
    expect(polices.length).toBeGreaterThan(0);
    for (const police of polices) {
      expect(police.incorporee, police.nom).toBe(true);
      expect(police.nom, police.nom).toMatch(/\+(Nunito-Regular|Nunito-Bold|Fredoka-SemiBold)$/);
    }
    expect(pdf.toString("latin1")).not.toMatch(/Helvetica/);
    expect(glyphesInconnus(pdf)).toEqual([]);
  });

  it("porte la date de création de sa version, le prix, l'article 8 et le formulaire type en annexe", async () => {
    const pdf = await rendu("2026-09-25");
    // La date de création est écrite dans son propre objet : « (D:20260925000000Z) ».
    expect(pdf.toString("latin1")).toMatch(/\/CreationDate \d+ 0 R/);
    expect(pdf.toString("latin1")).toContain("(D:20260925000000Z)");
    const texte = texteDuPdf(pdf).replace(/[  ]/g, " ");
    for (const attendu of [
      "Conditions générales de vente",
      "Version du 25 septembre 2026",
      "Le jeu complet coûte 12,90 €",
      "8. Droit de rétractation",
      "Annexe : formulaire type de rétractation",
      "MODÈLE DE FORMULAIRE DE RÉTRACTATION",
      "Rayez la mention inutile.",
    ]) {
      expect(texte, attendu).toContain(attendu);
    }
  });
});
