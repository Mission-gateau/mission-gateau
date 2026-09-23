import { renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it } from "vitest";
import { cachette } from "@/engine/cachettes";
import { construireKit, fichesEquipe } from "@/engine/kit";
import { verifierKit } from "@/engine/validation";
import { remplir } from "@/engine/texte";
import type { Kit } from "@/engine/types";
import { GUIDE } from "@/contenu/guide";
import { THEMES_CONTENU } from "@/contenu/themes";
import { valeursTextes } from "@/pdf/composants/sections";
import { documentKit } from "@/pdf/documents/kit";
import { indicesProgressifs } from "@/pdf/indices";
import { enregistrerPolices } from "@/pdf/ressources";
import { MENTION_PIED } from "@/pdf/styles";
import { AGES, THEMES, compterPages, configuration } from "./aide";
import { textesDesPages, texteDuPdf } from "./lirePdf";

beforeAll(() => {
  enregistrerPolices();
});

/** Compare en ramenant toutes les suites d'espaces à une seule. */
function aplatir(texte: string): string {
  return texte.replace(/\s+/gu, " ").trim();
}

/** Nombre de pages attendu, déduit de la structure du kit. */
function pagesAttendues(kit: Kit): { minimum: number; maximum: number } {
  const pagesGuide = 4;
  const pagesInvitations = Math.ceil(kit.nombreInvitations / 4);
  const pagesCartes = kit.equipes.length * Math.ceil(kit.etapes.length / 2);
  const pagesFiches = kit.equipes.reduce((total, equipe) => total + fichesEquipe(equipe).length, 0);
  const pagesDiplomes = Math.ceil((kit.nombreInvitations + 1) / 2);
  const minimum = pagesGuide + pagesInvitations + pagesCartes + pagesFiches + 1 + pagesDiplomes + 1;
  // Une section peut déborder d'une page ou deux selon la longueur des textes.
  return { minimum, maximum: minimum + 8 };
}

describe("kit complet", () => {
  it("les 9 combinaisons thème x format produisent un PDF cohérent", async () => {
    for (const theme of THEMES) {
      for (const age of AGES) {
        const kit = construireKit(configuration({ theme, age, nombreEnfants: 8 }), "pdf000001");
        expect(verifierKit(kit)).toEqual([]);
        const pdf = await renderToBuffer(documentKit(kit));
        const pages = compterPages(pdf);
        const attendu = pagesAttendues(kit);
        expect(pages, `${theme}/${age} ans : ${pages} pages`).toBeGreaterThanOrEqual(attendu.minimum);
        expect(pages, `${theme}/${age} ans : ${pages} pages`).toBeLessThanOrEqual(attendu.maximum);
        expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      }
    }
  });

  it("s'adapte à 3 comme à 16 enfants", async () => {
    for (const nombreEnfants of [3, 16]) {
      const kit = construireKit(configuration({ age: 11, nombreEnfants, duree: 60 }), "effectifs");
      const pdf = await renderToBuffer(documentKit(kit));
      const pages = compterPages(pdf);
      const attendu = pagesAttendues(kit);
      expect(pages).toBeGreaterThanOrEqual(attendu.minimum);
      expect(pages).toBeLessThanOrEqual(attendu.maximum);
    }
  });

  it("embarque les polices et les images", async () => {
    const kit = construireKit(configuration({ age: 8 }), "ressource");
    const pdf = await renderToBuffer(documentKit(kit));
    const texte = pdf.toString("latin1");
    expect(texte).toMatch(/Nunito/);
    expect(texte).toMatch(/Fredoka/);
    expect(texte).toMatch(/\/Subtype \/Image/);
    // Les polices sont incorporées, pas seulement nommées.
    expect(texte).toMatch(/\/FontFile2/);
  });
});

describe("ce qui est réellement imprimé", () => {
  it("porte la mention d'usage sur chaque page, sans exception", async () => {
    for (const age of AGES) {
      const kit = construireKit(configuration({ age, nombreEnfants: 10 }), "mention01");
      const pages = textesDesPages(await renderToBuffer(documentKit(kit)));
      expect(pages.length).toBeGreaterThan(10);
      const sansMention = pages
        .map((texte, index) => ({ texte, index }))
        .filter(({ texte }) => !texte.includes(MENTION_PIED))
        .map(({ index }) => index + 1);
      expect(sansMention, `${age} ans`).toEqual([]);
    }
  });

  it("contient bien chacune des six sections", async () => {
    const kit = construireKit(configuration({ age: 11, nombreEnfants: 10, duree: 60 }), "sections1");
    const texte = aplatir(texteDuPdf(await renderToBuffer(documentKit(kit))));
    for (const attendu of [
      GUIDE.sousTitre,
      GUIDE.titreMateriel,
      GUIDE.titrePlanPose,
      GUIDE.titreLecture,
      GUIDE.titreEtapes,
      GUIDE.titreSecurite,
      GUIDE.titreInvitations,
      GUIDE.titreCartes,
      GUIDE.titreFiches,
      GUIDE.titreDiplomes,
      GUIDE.titreTresor,
      GUIDE.titreSolutions,
      GUIDE.mentionSite,
      ...GUIDE.securite,
    ]) {
      expect(texte, attendu).toContain(aplatir(attendu));
    }
  });

  it("donne pour chaque étape sa solution et ses trois coups de pouce", async () => {
    const kit = construireKit(configuration({ age: 8, nombreEnfants: 8 }), "sections2");
    const texte = aplatir(texteDuPdf(await renderToBuffer(documentKit(kit))));
    for (const etape of kit.etapes) {
      for (const indice of indicesProgressifs(etape.cachette)) {
        expect(texte, indice).toContain(aplatir(indice));
      }
    }
    expect(texte).toContain(kit.codeFinal!);
  });

  it("rappelle sur chaque carte la cachette où la poser", async () => {
    const kit = construireKit(configuration({ age: 5, nombreEnfants: 6 }), "sections3");
    const texte = aplatir(texteDuPdf(await renderToBuffer(documentKit(kit))));
    for (const etape of kit.etapes) {
      expect(texte).toContain(aplatir(`${GUIDE.cartePoser} ${cachette(etape.cachette).libelle}`));
    }
  });

  it("imprime l'histoire à lire, les invitations nommées et les diplômes", async () => {
    const kit = construireKit(
      configuration({ age: 8, nombreEnfants: 4, fete: { invites: ["Nina", "Sacha", "Tom"] } }),
      "sections4",
    );
    const texte = aplatir(texteDuPdf(await renderToBuffer(documentKit(kit))));
    const contenu = THEMES_CONTENU[kit.configuration.theme].formats[kit.format];
    expect(texte).toContain(aplatir(remplir(contenu.histoire, valeursTextes(kit))));
    expect(texte).toContain(aplatir(remplir(contenu.tresor, valeursTextes(kit))));
    for (const invite of ["Nina", "Sacha", "Tom"]) expect(texte).toContain(invite);
    expect(texte).toContain(kit.configuration.prenom);
  });
});

