import { renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it } from "vitest";
import { construireKit } from "@/engine/kit";
import { remplir } from "@/engine/texte";
import { GUIDE } from "@/contenu/guide";
import { THEMES_CONTENU } from "@/contenu/themes";
import { valeursTextes } from "@/pdf/composants/sections";
import { documentApercu } from "@/pdf/documents/apercu";
import { documentKit } from "@/pdf/documents/kit";
import { enregistrerPolices } from "@/pdf/ressources";
import { AGES, compterPages, configuration } from "./aide";
import { textesDesPages, texteDuPdf } from "./lirePdf";

beforeAll(() => {
  enregistrerPolices();
});

/** Compare en ramenant toutes les suites d'espaces à une seule. */
function aplatir(texte: string): string {
  return texte.replace(/\s+/gu, " ").trim();
}

/**
 * Les aperçus sont éprouvés dans leur propre fichier.
 *
 * @react-pdf/renderer 4.9 réutilise ses polices d'un document à l'autre ; au
 * bout d'une vingtaine de documents produits dans le même processus, la table
 * qui relie les glyphes aux caractères (ToUnicode) finit par se décaler d'un
 * cran. Les pages imprimées restent justes — c'est le glyphe dessiné qui
 * compte — mais le texte que l'on peut copier depuis le PDF devient faux, et
 * la relecture automatique aussi. Vitest isolant chaque fichier de test dans
 * son propre processus, ce découpage garde la lecture fiable.
 */
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
      pages.forEach((page, index) =>
        expect(page, `${age} ans, page ${index + 1} : ${JSON.stringify(page.slice(0, 30))}`).toContain(
          GUIDE.apercuFiligrane,
        ),
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
      expect(texte).not.toContain(aplatir(remplir(contenu.tresor, valeursTextes(kit))));
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
