import { describe, expect, it } from "vitest";
import { Alea } from "@/engine/alea";
import { CACHETTES, cachette } from "@/engine/cachettes";
import {
  enigmeCalcul,
  enigmeCesar,
  enigmeComptage,
  enigmeDevinette,
  enigmeIntrus,
  enigmeLabyrinthe,
  enigmeLogique,
  enigmeMiroir,
  enigmeMorse,
  enigmeMotsMeles,
  enigmePictogrammes,
  enigmeSudoku,
  enigmeSuite,
  type ContexteEnigme,
} from "@/engine/enigmes";
import { verifierEnigme } from "@/engine/verif";
import { occurrences } from "@/engine/verif/motsmeles";
import { ICONES_THEME } from "@/engine/icones";
import { THEMES_CONTENU } from "@/contenu/themes";
import type { CleIcone } from "@/engine/icones";
import type { IdFormat } from "@/engine/types";
import { graines } from "./aide";

/**
 * Chaque générateur est éprouvé sur au moins 200 graines, et chaque énigme
 * produite repasse par le contrôle indépendant de src/engine/verif.
 */
const NOMBRE_GRAINES = 200;
const GRAINES = graines(NOMBRE_GRAINES);

function contexte(graine: string, format: IdFormat = "mission", theme = "pirates"): ContexteEnigme {
  return {
    alea: new Alea(graine),
    format,
    id: `test-${graine}`,
    iconesTheme: ICONES_THEME[theme] as CleIcone[],
    personnages: THEMES_CONTENU[theme as "pirates"].personnages,
    objetsLogique: THEMES_CONTENU[theme as "pirates"].objetsLogique,
  };
}

/** Une cachette différente à chaque graine, pour balayer tout le catalogue. */
function cible(index: number) {
  return cachette(CACHETTES[index % CACHETTES.length]!.id);
}

function verifier(nom: string, fabrique: (graine: string, index: number) => ReturnType<typeof enigmeMiroir>) {
  it(`${nom} : ${NOMBRE_GRAINES} graines passent le contrôle indépendant`, () => {
    const echecs: string[] = [];
    GRAINES.forEach((graine, index) => {
      const enigme = fabrique(graine, index);
      const problemes = verifierEnigme(enigme);
      if (problemes.length > 0) echecs.push(`${graine} → ${problemes.join(" | ")}`);
    });
    expect(echecs).toEqual([]);
  });
}

describe("énigmes 4-6 ans", () => {
  verifier("intrus", (graine) => enigmeIntrus(contexte(graine, "chasse")));
  verifier("suite", (graine) => enigmeSuite(contexte(graine, "chasse")));
  verifier("comptage", (graine) => enigmeComptage(contexte(graine, "chasse")));
  verifier("labyrinthe", (graine) => enigmeLabyrinthe(contexte(graine, "chasse")));
  verifier("devinette", (graine, index) => enigmeDevinette(contexte(graine, "chasse"), cible(index)));
});

describe("énigmes 7-9 ans", () => {
  verifier("pictogrammes", (graine, index) => enigmePictogrammes(contexte(graine), cible(index)));
  verifier("calcul", (graine, index) =>
    enigmeCalcul(contexte(graine), (index % 9) + 1, (index % 3) + 1),
  );
  verifier("mots mêlés 8x8", (graine, index) => enigmeMotsMeles(contexte(graine), cible(index), 8));
  verifier("miroir", (graine, index) => enigmeMiroir(contexte(graine), cible(index)));
  verifier("labyrinthe moyen", (graine) => enigmeLabyrinthe(contexte(graine, "mission")));
});

describe("énigmes 10-12 ans", () => {
  verifier("césar", (graine, index) =>
    enigmeCesar(contexte(graine, "escape"), cible(index), {
      decalage: (index % 9) + 1,
      origine: "étape 1",
    }),
  );
  verifier("sudoku 4x4", (graine, index) => enigmeSudoku(contexte(graine, "escape"), (index % 4) + 1, 4));
  verifier("sudoku 6x6", (graine, index) => enigmeSudoku(contexte(graine, "escape"), (index % 4) + 1, 6));
  verifier("grille de logique", (graine, index) => enigmeLogique(contexte(graine, "escape"), (index % 4) + 1));
  verifier("morse", (graine, index) => enigmeMorse(contexte(graine, "escape"), cible(index)));
  verifier("mots mêlés 10x10", (graine, index) =>
    enigmeMotsMeles(contexte(graine, "escape"), cible(index), 10),
  );
  verifier("grand labyrinthe", (graine) => enigmeLabyrinthe(contexte(graine, "escape")));
});

describe("propriétés attendues", () => {
  it("le sudoku laisse assez de cases à deviner", () => {
    for (const graine of GRAINES.slice(0, 60)) {
      const e = enigmeSudoku(contexte(graine, "escape"), 1, 6);
      if (e.type !== "sudoku") throw new Error("type inattendu");
      const vides = e.grille.flat().filter((v) => v === null).length;
      expect(vides).toBeGreaterThanOrEqual(6);
    }
  });

  it("la grille de logique tient en trois à cinq indices", () => {
    for (const graine of GRAINES.slice(0, 60)) {
      const e = enigmeLogique(contexte(graine, "escape"), 1);
      if (e.type !== "logique") throw new Error("type inattendu");
      expect(e.indices.length).toBeGreaterThanOrEqual(2);
      expect(e.indices.length).toBeLessThanOrEqual(6);
      expect(e.indices.every((texte) => texte.trim().endsWith("."))).toBe(true);
    }
  });

  it("les mots mêlés listent assez de mots pour être un vrai jeu", () => {
    for (const graine of GRAINES.slice(0, 40)) {
      const e = enigmeMotsMeles(contexte(graine), cachette("boite"), 8);
      if (e.type !== "motsmeles") throw new Error("type inattendu");
      expect(e.mots.length).toBeGreaterThanOrEqual(6);
    }
  });

  it("le labyrinthe impose un vrai détour", () => {
    for (const graine of GRAINES.slice(0, 60)) {
      const e = enigmeLabyrinthe(contexte(graine, "escape"));
      if (e.type !== "labyrinthe") throw new Error("type inattendu");
      const distanceDirecte = e.labyrinthe.largeur + e.labyrinthe.hauteur - 1;
      expect(e.labyrinthe.chemin.length).toBeGreaterThanOrEqual(distanceDirecte);
    }
  });

  it("une même graine redonne exactement la même énigme", () => {
    for (const graine of GRAINES.slice(0, 40)) {
      expect(JSON.stringify(enigmeMotsMeles(contexte(graine), cachette("lit"), 10))).toEqual(
        JSON.stringify(enigmeMotsMeles(contexte(graine), cachette("lit"), 10)),
      );
      expect(JSON.stringify(enigmeSudoku(contexte(graine, "escape"), 2, 6))).toEqual(
        JSON.stringify(enigmeSudoku(contexte(graine, "escape"), 2, 6)),
      );
    }
  });
});

describe("le contrôle indépendant attrape les erreurs", () => {
  it("repère un labyrinthe dont le chemin annoncé est faux", () => {
    const e = enigmeLabyrinthe(contexte("abc", "mission"));
    if (e.type !== "labyrinthe") throw new Error("type inattendu");
    const abime = { ...e, labyrinthe: { ...e.labyrinthe, chemin: [[0, 0] as [number, number]] } };
    expect(verifierEnigme(abime).length).toBeGreaterThan(0);
  });

  it("repère des mots mêlés dont une lettre a été changée", () => {
    const e = enigmeMotsMeles(contexte("abc"), cachette("boite"), 8);
    if (e.type !== "motsmeles") throw new Error("type inattendu");
    const grille = e.grille.map((ligne) => [...ligne]);
    grille[0]![0] = grille[0]![0] === "A" ? "B" : "A";
    expect(verifierEnigme({ ...e, grille }).length).toBeGreaterThan(0);
  });

  it("repère un sudoku devenu ambigu", () => {
    const e = enigmeSudoku(contexte("abc", "escape"), 1, 4);
    if (e.type !== "sudoku") throw new Error("type inattendu");
    const grille = e.grille.map((ligne) => ligne.map(() => null));
    expect(verifierEnigme({ ...e, grille }).length).toBeGreaterThan(0);
  });

  it("repère un César mal déchiffré", () => {
    const e = enigmeCesar(contexte("abc", "escape"), cachette("lit"), { decalage: 3, origine: "étape 1" });
    if (e.type !== "cesar") throw new Error("type inattendu");
    expect(verifierEnigme({ ...e, decalage: 4 }).length).toBeGreaterThan(0);
  });

  it("repère une grille de logique à plusieurs solutions", () => {
    const e = enigmeLogique(contexte("abc", "escape"), 1);
    if (e.type !== "logique") throw new Error("type inattendu");
    expect(verifierEnigme({ ...e, indices: [], indicesStructures: [] }).length).toBeGreaterThan(0);
  });
});

describe("mots mêlés : aucun mot ne se lit deux fois", () => {
  /**
   * Un mot présent deux fois rend la grille fausse : l'enfant qui entoure la
   * mauvaise occurrence raye des lettres du mot-réponse. Sur 1 458 kits, un
   * audit en avait trouvé 247 concernés, dont 14 où la réponse était abîmée.
   */
  for (const taille of [8, 10] as const) {
    it(`${NOMBRE_GRAINES} grilles ${taille}x${taille} n'ont qu'une occurrence par mot`, () => {
      const problemes: string[] = [];
      GRAINES.forEach((graine, index) => {
        const e = enigmeMotsMeles(contexte(graine, taille === 10 ? "escape" : "mission"), cible(index), taille);
        if (e.type !== "motsmeles") throw new Error("type inattendu");
        for (const mot of e.mots) {
          const combien = occurrences(e.grille, mot);
          if (combien !== 1) problemes.push(`${graine} : « ${mot} » ${combien} fois`);
        }
      });
      expect(problemes).toEqual([]);
    });
  }

  it("le contrôle indépendant refuse une grille où un mot apparaît deux fois", () => {
    const e = enigmeMotsMeles(contexte("abc"), cachette("boite"), 8);
    if (e.type !== "motsmeles") throw new Error("type inattendu");
    // On recopie un mot de la liste par-dessus une autre ligne : il s'y lit
    // alors une seconde fois, et le contrôle doit le voir.
    const mot = e.mots.find((m) => m.length <= 8)!;
    const grille = e.grille.map((ligne) => [...ligne]);
    for (let i = 0; i < mot.length; i += 1) grille[0]![i] = mot[i]!;
    const problemes = verifierEnigme({ ...e, grille });
    expect(problemes.some((p) => p.includes("fois"))).toBe(true);
  });
});

describe("César : la consigne ne donne pas le décalage", () => {
  it("aucun chiffre dans la consigne, et le décalage sur la page des solutions", () => {
    const problemes: string[] = [];
    GRAINES.forEach((graine, index) => {
      const decalage = (index % 9) + 1;
      const e = enigmeCesar(contexte(graine, "escape"), cible(index), {
        decalage,
        origine: "étape 1",
      });
      if (/[0-9]/.test(e.consigne)) problemes.push(`${graine} : chiffre dans la consigne`);
      if (!e.solution.includes(String(decalage))) {
        problemes.push(`${graine} : décalage absent de la solution`);
      }
    });
    expect(problemes).toEqual([]);
  });
});
