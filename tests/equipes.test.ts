import { renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it } from "vitest";
import { formatPourAge, nombreEquipes } from "@/engine/configuration";
import { construireKit } from "@/engine/kit";
import { documentKit } from "@/pdf/documents/kit";
import { enregistrerPolices } from "@/pdf/ressources";
import { AGES, THEMES, configuration } from "./aide";
import { texteDuPdf } from "./lirePdf";

/**
 * De 3 à 6 enfants, la mission et l'escape game se jouent à une seule équipe.
 * Le kit ne doit alors parler ni des autres équipes, ni d'un code que personne
 * ne détiendrait en entier : il n'y a personne d'autre. À plusieurs équipes,
 * au contraire, le briefing doit dire en une phrase que chaque équipe ne prend
 * que les cartes marquées de son symbole.
 */
const INTERDITS_A_UNE_EQUIPE = [
  "plusieurs équipes",
  "autres équipes",
  "aucune équipe",
  "toutes vos équipes",
  "les équipes mettent",
];

/** Effectifs qui donnent 1, 2 puis 3 équipes en mission et en escape game. */
const EFFECTIFS = [4, 10, 14];

function aplatir(texte: string): string {
  return texte.replace(/\s+/gu, " ").trim();
}

beforeAll(() => {
  enregistrerPolices();
});

describe("le kit dit vrai sur le nombre d'équipes", () => {
  it("à une seule équipe, aucun texte ne parle d'une autre équipe", async () => {
    const problemes: string[] = [];
    for (const theme of THEMES) {
      for (const age of AGES) {
        for (const nombreEnfants of EFFECTIFS) {
          const equipes = nombreEquipes(formatPourAge(age), nombreEnfants);
          if (equipes !== 1) continue;
          const kit = construireKit(configuration({ theme, age, nombreEnfants }), "equipes01");
          expect(kit.equipes).toHaveLength(1);
          const texte = aplatir(texteDuPdf(await renderToBuffer(documentKit(kit))));
          for (const interdit of INTERDITS_A_UNE_EQUIPE) {
            if (texte.toLowerCase().includes(interdit)) {
              problemes.push(`${theme}/${age} ans/${nombreEnfants} enfants : « ${interdit} »`);
            }
          }
        }
      }
    }
    expect(problemes).toEqual([]);
  });

  it("à plusieurs équipes, le briefing dit de ne prendre que les cartes de son symbole", async () => {
    const problemes: string[] = [];
    for (const theme of THEMES) {
      for (const age of [8, 11]) {
        for (const nombreEnfants of EFFECTIFS) {
          const equipes = nombreEquipes(formatPourAge(age), nombreEnfants);
          if (equipes < 2) continue;
          const kit = construireKit(configuration({ theme, age, nombreEnfants }), "equipes02");
          const texte = aplatir(texteDuPdf(await renderToBuffer(documentKit(kit))));
          if (!texte.includes("symbole")) {
            problemes.push(`${theme}/${age} ans/${nombreEnfants} enfants : aucune mention du symbole`);
          }
        }
      }
    }
    expect(problemes).toEqual([]);
  });

  it("les trois effectifs choisis donnent bien 1, 2 et 3 équipes", () => {
    for (const age of [8, 11]) {
      const format = formatPourAge(age);
      expect(EFFECTIFS.map((n) => nombreEquipes(format, n))).toEqual([1, 2, 3]);
    }
  });

  it("le contrôle attrape bien une phrase de trop", () => {
    const texte = aplatir("Aucune équipe ne détient le code complet.");
    expect(INTERDITS_A_UNE_EQUIPE.some((i) => texte.toLowerCase().includes(i))).toBe(true);
  });
});
