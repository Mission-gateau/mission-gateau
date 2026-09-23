import { renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it } from "vitest";
import { cachette } from "@/engine/cachettes";
import { construireKit, fichesEquipe } from "@/engine/kit";
import { verifierKit } from "@/engine/validation";
import { remplir } from "@/engine/texte";
import type { Kit } from "@/engine/types";
import { GUIDE } from "@/contenu/guide";
import { selonEquipes, THEMES_CONTENU } from "@/contenu/themes";
import { valeursTextes } from "@/pdf/composants/sections";
import { documentApercu } from "@/pdf/documents/apercu";
import { documentKit } from "@/pdf/documents/kit";
import { indicesProgressifs } from "@/pdf/indices";
import { enregistrerPolices } from "@/pdf/ressources";
import { MENTION_PIED } from "@/pdf/styles";
import { AGES, THEMES, compterPages, configuration } from "./aide";
import { CARACTERE_INCONNU, textesDesPages, texteDuPdf } from "./lirePdf";

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
    expect(texte).toContain(
      aplatir(remplir(selonEquipes(contenu.histoire, kit.equipes.length), valeursTextes(kit))),
    );
    expect(texte).toContain(
      aplatir(remplir(selonEquipes(contenu.tresor, kit.equipes.length), valeursTextes(kit))),
    );
    for (const invite of ["Nina", "Sacha", "Tom"]) expect(texte).toContain(invite);
    expect(texte).toContain(kit.configuration.prenom);
  });
});

describe("mise en page", () => {
  /**
   * Un titre seul en bas de page laisse le lecteur devant une promesse sans
   * suite. Au lot 1, « Le matériel » restait ainsi en bas de la première page
   * du guide dans deux kits sur trois en 10-12 ans.
   */
  const TITRES = [
    GUIDE.titreMateriel,
    GUIDE.titrePreparation,
    GUIDE.titrePlanPose,
    GUIDE.titreMaitreDuJeu,
    GUIDE.titreSecurite,
    GUIDE.titreEtapes,
    GUIDE.titreLecture,
    GUIDE.titreBriefing,
    GUIDE.titreDepart,
    GUIDE.titreSolutions,
    GUIDE.titreInvitations,
    GUIDE.titreCartes,
    GUIDE.titreFiches,
    GUIDE.titreDiplomes,
    GUIDE.titreTresor,
    "Déroulé minute par minute",
    "Solution de chaque énigme",
  ].map(aplatir);

  it("aucun titre ne reste seul en bas d'une page", async () => {
    const problemes: string[] = [];
    for (const theme of THEMES) {
      for (const age of AGES) {
        for (const nombreEnfants of [6, 14]) {
          const kit = construireKit(
            configuration({ theme, age, nombreEnfants, duree: 60 }),
            "orphelin1",
          );
          const pages = textesDesPages(await renderToBuffer(documentKit(kit)));
          pages.forEach((page, index) => {
            const texte = aplatir(page);
            for (const titre of TITRES) {
              if (texte.endsWith(titre)) {
                problemes.push(
                  `${theme}/${age} ans/${nombreEnfants} enfants : page ${index + 1} finit sur « ${titre} »`,
                );
              }
            }
          });
        }
      }
    }
    expect(problemes).toEqual([]);
  });
});

describe("aperçu gratuit", () => {
  it("fait trois à quatre pages", async () => {
    for (const age of AGES) {
      const kit = construireKit(configuration({ age }), "apercu001");
      const pages = compterPages(await renderToBuffer(documentApercu(kit)));
      expect(pages).toBeGreaterThanOrEqual(3);
      expect(pages).toBeLessThanOrEqual(4);
    }
  });

  it("porte le filigrane sur chaque page et ne livre ni solutions ni code final", async () => {
    for (const age of AGES) {
      const kit = construireKit(configuration({ age, nombreEnfants: 12 }), "apercu002");
      const pages = textesDesPages(await renderToBuffer(documentApercu(kit)));
      // Chaque lettre du filigrane doit être imprimée. Une lettre peut avoir
      // perdu le caractère qu'elle représente — voir « Limite connue » dans le
      // README : @react-pdf/renderer laisse parfois cette correspondance vide.
      // Le glyphe est dessiné, il est seulement illisible à la copie.
      const motifFiligrane = new RegExp(
        [...GUIDE.apercuFiligrane].map((lettre) => `[${lettre}${CARACTERE_INCONNU}]`).join(""),
      );
      pages.forEach((page, index) =>
        expect(
          motifFiligrane.test(page),
          `${age} ans, page ${index + 1} : ${JSON.stringify(page.slice(0, 30))}`,
        ).toBe(true),
      );
      const texte = aplatir(pages.join(" "));
      if (kit.codeFinal) expect(texte).not.toContain(kit.codeFinal);
      const solutions = [
        kit.depart,
        ...kit.equipes
          .flatMap((e) => e.cartes)
          .flatMap((c) => [c.navigation, c.code, c.bonus])
          .filter((e) => e !== null),
      ].map((e) => e.solution);
      for (const solution of solutions) expect(texte).not.toContain(aplatir(solution));
      const contenu = THEMES_CONTENU[kit.configuration.theme].formats[kit.format];
      expect(texte).not.toContain(aplatir(GUIDE.titreSolutions));
      expect(texte).not.toContain(aplatir(GUIDE.titreDiplomes));
      expect(texte).not.toContain(
        aplatir(remplir(selonEquipes(contenu.tresor, kit.equipes.length), valeursTextes(kit))),
      );
    }
  });

  it("montre bien les quatre pages annoncées", async () => {
    const kit = construireKit(configuration({ age: 8, nombreEnfants: 10 }), "apercu003");
    const texte = aplatir(texteDuPdf(await renderToBuffer(documentApercu(kit))));
    expect(texte).toContain(aplatir(GUIDE.titreInvitations));
    expect(texte).toContain(aplatir(GUIDE.titreCartes));
    expect(texte).toContain(aplatir(GUIDE.titreMateriel));
    expect(texte).toContain(aplatir(GUIDE.apercuSansSolution));
    expect(texte).toContain(aplatir(GUIDE.mentionSite));
  });
});

describe("temps de génération", () => {
  it("un kit complet sort en moins de 5 secondes", async () => {
    const kit = construireKit(configuration({ age: 11, nombreEnfants: 16, duree: 60 }), "chrono001");
    const debut = performance.now();
    await renderToBuffer(documentKit(kit));
    const duree = performance.now() - debut;
    expect(duree, `${duree.toFixed(0)} ms`).toBeLessThan(5000);
  });

  it("un aperçu sort en moins de 3 secondes", async () => {
    const kit = construireKit(configuration({ age: 11, nombreEnfants: 16, duree: 60 }), "chrono002");
    const debut = performance.now();
    await renderToBuffer(documentApercu(kit));
    const duree = performance.now() - debut;
    expect(duree, `${duree.toFixed(0)} ms`).toBeLessThan(3000);
  });
});
