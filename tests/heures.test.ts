import { describe, expect, it } from "vitest";
import { heureIllisible, marqueRetenue } from "@/vente/examen";
import { CLES, MARQUES_HORODATEES, heuresIllisibles, lireSuivi } from "@/vente/metadonnees";

/**
 * Une heure n'est lisible que si elle suit l'ISO 8601 complet avec fuseau, et
 * si sa date et son heure existent : relue dans le fuseau écrit, elle redonne
 * l'année, le mois, le jour, l'heure et les minutes écrits (lot 9, § 2).
 */
describe("les dates impossibles sont illisibles (lot 9, § 2)", () => {
  const REFUSEES = [
    "2026-02-30T09:15:00Z", // JavaScript y lit le 2 mars
    "2026-02-29T10:00:00Z", // 2026 n'est pas bissextile
    "2026-13-01T10:00:00Z",
    "2026-10-02T24:30:00Z",
    "2026-10-02T24:00:00Z", // JavaScript y lit minuit le lendemain
    "2026-04-31T10:00:00+02:00",
    "2026-10-02T09:60:00Z",
    "2026-10-02T09:15:60Z",
    "2026-10-02T09:15:00+24:00",
    "2026-10-02T09:15:00+02:60",
    // Déjà refusées avant ce lot : pas d'ISO 8601 complet.
    "2026-10-02",
    "02/10/2026 09:15",
    "2026-10-02T09:15:00",
  ];
  const ACCEPTEES = [
    "2028-02-29T10:00:00Z", // 2028 est bissextile
    "2026-10-02T09:15:00+02:00",
    "2026-10-02T09:15+02:00",
    "2026-12-31T23:59:59.999-12:00",
    "2026-10-25T02:30:00+01:00", // l'heure d'hiver revient à Paris : le fuseau écrit fait foi
    new Date("2026-09-24T10:00:00.000Z").toISOString(),
    new Date().toISOString(),
  ];

  for (const cle of MARQUES_HORODATEES) {
    it(`${cle} : refuse chaque date ou heure qui n'existe pas`, () => {
      for (const valeur of REFUSEES) {
        expect(heuresIllisibles({ [cle]: valeur }), valeur).toEqual([cle]);
        expect(heureIllisible({ [cle]: valeur }), valeur).toBe(true);
        expect(marqueRetenue({ [cle]: valeur }), valeur).toBe("a_examiner");
      }
    });

    it(`${cle} : accepte les heures complètes qui existent, dont celles écrites par le code (toISOString)`, () => {
      for (const valeur of ACCEPTEES) {
        expect(heuresIllisibles({ [cle]: valeur }), valeur).toEqual([]);
        expect(heureIllisible({ [cle]: valeur }), valeur).toBe(false);
      }
    });
  }

  it("relit l'instant exact, dans le fuseau écrit", () => {
    expect(lireSuivi({ [CLES.retractation]: "2026-10-02T09:15:00+02:00" }).retractation).toEqual(new Date("2026-10-02T07:15:00.000Z"));
    expect(lireSuivi({ [CLES.telechargement]: "2028-02-29T10:00:00Z" }).telechargement).toEqual(new Date(Date.UTC(2028, 1, 29, 10)));
    expect(lireSuivi({ [CLES.retractation]: "2026-02-30T09:15:00Z" }).retractation).toBeNull();
  });

  it("une marque absente ou vide n'est pas illisible : la règle ordinaire de la course décide", () => {
    expect(heuresIllisibles({})).toEqual([]);
    expect(heuresIllisibles({ [CLES.retractation]: "  " })).toEqual([]);
    expect(marqueRetenue({})).toBeNull();
    expect(marqueRetenue({ [CLES.retractation]: "2026-09-25T08:00:00.000Z" })).toBe("retractation");
    expect(marqueRetenue({ [CLES.retractation]: "2026-09-25T08:00:00.000Z", [CLES.telechargement]: "2026-09-24" })).toBe("a_examiner");
  });
});
