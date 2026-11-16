import { renderToBuffer } from "@react-pdf/renderer";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, describe, expect, it } from "vitest";
import { construireKit } from "@/engine/kit";
import { documentKit } from "@/pdf/documents/kit";
import { enregistrerPolices } from "@/pdf/ressources";
import { configuration, graines } from "./aide";

/**
 * Le code final s'imprime sur une seule ligne, chiffre après chiffre, sur la
 * page du trésor et sur celle des solutions. Jusqu'au correctif, le code à
 * quatre chiffres de l'escape game débordait de son cadre sur la page du
 * trésor : le dernier chiffre passait à la ligne.
 *
 * Le PDF est relu par pdf.js, qui donne la position de chaque morceau de
 * texte : les chiffres du code (une case par chiffre) doivent former, dans
 * l'ordre, une seule ligne.
 */

beforeAll(() => enregistrerPolices());

interface Morceau {
  texte: string;
  x: number;
  y: number;
}

/** Les morceaux de texte de chaque page, avec leur position. */
async function morceauxDesPages(pdf: Buffer): Promise<Morceau[][]> {
  const document = await getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
  const pages: Morceau[][] = [];
  for (let numero = 1; numero <= document.numPages; numero++) {
    const contenu = await (await document.getPage(numero)).getTextContent();
    pages.push(
      contenu.items.flatMap((item) =>
        "str" in item && item.str.trim() ? [{ texte: item.str.trim(), x: item.transform[4]!, y: item.transform[5]! }] : [],
      ),
    );
  }
  return pages;
}

/**
 * Les lignes de chiffres imprimées après `titre`, sur la dernière page qui le contient
 * (« Code final » figure aussi dans la fiche technique, en page 1) :
 * pdf.js réunit les cases voisines d'une même ligne (« 4 3 7 »), et chaque
 * ligne de la page donne ici la suite de ses chiffres.
 */
function lignesDeChiffresApres(pages: Morceau[][], titre: string): string[] {
  const page = pages.findLast((morceaux) => morceaux.some((m) => m.texte === titre));
  if (!page) throw new Error(`Aucune page « ${titre} »`);
  const suite = page.slice(page.findIndex((m) => m.texte === titre) + 1).filter((m) => /^[\d ]+$/.test(m.texte));
  const lignes = new Map<number, Morceau[]>();
  for (const morceau of suite) {
    const y = Math.round(morceau.y);
    lignes.set(y, [...(lignes.get(y) ?? []), morceau]);
  }
  return [...lignes.values()].map((ligne) =>
    ligne
      .sort((a, b) => a.x - b.x)
      .map((m) => m.texte.replace(/ /g, ""))
      .join(""),
  );
}

describe("le code final tient sur une ligne", () => {
  for (const age of [8, 11]) {
    it(`${age} ans : page du trésor et page des solutions, pour chaque thème et plusieurs graines`, async () => {
      const problemes: string[] = [];
      for (const theme of ["pirates", "agents", "dinosaures"] as const) {
        for (const graine of graines(3, `code-${age}-`)) {
          const kit = construireKit(configuration({ theme, age, nombreEnfants: 10, duree: 60 }), graine);
          const code = kit.codeFinal!;
          expect(code).toHaveLength(age >= 10 ? 4 : 3);
          const pages = await morceauxDesPages(await renderToBuffer(documentKit(kit)));
          for (const titre of ["Le trésor", "Code final"]) {
            const lignes = lignesDeChiffresApres(pages, titre);
            // Le code, entier, sur une seule ligne : la première ligne de chiffres après le titre.
            if (lignes[0] !== code) problemes.push(`${theme}/${graine}/${titre} : ${code} imprimé ${JSON.stringify(lignes.slice(0, 2))}`);
          }
        }
      }
      expect(problemes).toEqual([]);
    });
  }
});
