import { renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it } from "vitest";
import { construireKit } from "@/engine/kit";
import { documentApercu } from "@/pdf/documents/apercu";
import { documentKit } from "@/pdf/documents/kit";
import { enregistrerPolices } from "@/pdf/ressources";
import { AGES, THEMES, configuration, graines } from "./aide";
import { anomaliesDeLecture, glyphesInconnus, policesDuPdf } from "./lirePdf";

/**
 * Aucun caractère imprimé ne doit sortir d'une police absente du fichier.
 *
 * Au lot 1, la case à deviner du sudoku était marquée du caractère « ● ».
 * Ni Fredoka ni Nunito ne le dessinent : @react-pdf/renderer se rabattait sur
 * Helvetica, qui n'est pas incorporée, et le PDF imprimait « Ï ». Ces
 * contrôles relisent les fichiers produits pour que cela ne puisse pas
 * recommencer, ni pour ce caractère ni pour un autre.
 */
const POLICES_DE_SECOURS = /helvetica|times|courier|symbol|zapf/i;

beforeAll(() => {
  enregistrerPolices();
});

function controler(pdf: Buffer, quoi: string): string[] {
  const problemes: string[] = [];
  const polices = policesDuPdf(pdf);
  if (polices.length === 0) problemes.push(`${quoi} : aucune police trouvée`);
  for (const police of polices) {
    if (!police.incorporee) problemes.push(`${quoi} : « ${police.nom} » n'est pas incorporée`);
    if (POLICES_DE_SECOURS.test(police.nom)) {
      problemes.push(`${quoi} : « ${police.nom} » est une police de secours`);
    }
  }
  for (const souci of glyphesInconnus(pdf)) problemes.push(`${quoi} : ${souci}`);
  return problemes;
}

describe("polices incorporées", () => {
  it("les 9 kits et les 9 aperçus n'emploient que les polices du dépôt", async () => {
    const problemes: string[] = [];
    for (const theme of THEMES) {
      for (const age of AGES) {
        const kit = construireKit(configuration({ theme, age, nombreEnfants: 10 }), "polices01");
        problemes.push(...controler(await renderToBuffer(documentKit(kit)), `kit ${theme}/${age}`));
        problemes.push(
          ...controler(await renderToBuffer(documentApercu(kit)), `aperçu ${theme}/${age}`),
        );
      }
    }
    expect(problemes).toEqual([]);
  });

  it("un balayage de graines en 10-12 ans ne fait apparaître aucune police de secours", async () => {
    const problemes: string[] = [];
    for (const graine of graines(12, "police")) {
      const kit = construireKit(
        configuration({ age: 11, nombreEnfants: 14, duree: 60 }),
        graine,
      );
      problemes.push(...controler(await renderToBuffer(documentKit(kit)), `graine ${graine}`));
    }
    expect(problemes).toEqual([]);
  });

  /**
   * Défaut connu de @react-pdf/renderer 4.9 : un glyphe par document peut
   * être écrit sans le caractère qu'il représente. La page s'imprime bien ;
   * seul le texte copiable perd cette lettre. Ce contrôle borne le dégât :
   * si un changement le rendait plus fréquent, le test le dirait.
   */
  it("au plus un glyphe par document n'a pas de caractère", async () => {
    const problemes: string[] = [];
    for (const theme of THEMES) {
      for (const age of AGES) {
        const kit = construireKit(configuration({ theme, age, nombreEnfants: 10 }), "unicode01");
        for (const [quoi, pdf] of [
          ["kit", await renderToBuffer(documentKit(kit))],
          ["aperçu", await renderToBuffer(documentApercu(kit))],
        ] as const) {
          const manquants = anomaliesDeLecture(pdf);
          if (manquants.length > 1) {
            problemes.push(`${quoi} ${theme}/${age} : ${manquants.length} glyphes — ${manquants.join(" | ")}`);
          }
        }
      }
    }
    expect(problemes).toEqual([]);
  });

  it("le contrôle attrape bien une police de secours", () => {
    expect(POLICES_DE_SECOURS.test("Helvetica")).toBe(true);
    expect(POLICES_DE_SECOURS.test("CZZZZZ+Nunito-Regular")).toBe(false);
  });
});
