import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CACHETTES } from "@/engine/cachettes";
import { ALPHABET_PICTO, CLES_ICONES, ICONES, ICONES_THEME } from "@/engine/icones";
import { LISTE_THEMES } from "@/contenu/themes";
import { CREDITS } from "@/contenu/site";

const PUBLIC = path.join(process.cwd(), "public");
const POLICES = ["Nunito-Regular.ttf", "Nunito-Bold.ttf", "Fredoka-SemiBold.ttf"];

describe("icônes", () => {
  it("chaque icône déclarée a son fichier PNG", () => {
    const manquantes = CLES_ICONES.filter(
      (cle) => !existsSync(path.join(PUBLIC, "icones", `${cle}.png`)),
    );
    expect(manquantes).toEqual([]);
  });

  it("aucun PNG orphelin dans public/icones", () => {
    const connues = new Set(CLES_ICONES);
    const orphelins = readdirSync(path.join(PUBLIC, "icones"))
      .filter((nom) => nom.endsWith(".png"))
      .map((nom) => nom.replace(/\.png$/, ""))
      .filter((cle) => !connues.has(cle as never));
    expect(orphelins).toEqual([]);
  });

  it("chaque cachette, chaque thème et chaque lettre pointe vers une icône connue", () => {
    const connues = new Set<string>(CLES_ICONES);
    const inconnues: string[] = [];
    for (const lieu of CACHETTES) if (!connues.has(lieu.icone)) inconnues.push(`cachette ${lieu.id}`);
    for (const theme of LISTE_THEMES) {
      for (const cle of theme.icones) if (!connues.has(cle)) inconnues.push(`thème ${theme.id} : ${cle}`);
    }
    for (const [lettre, cle] of Object.entries(ALPHABET_PICTO)) {
      if (!connues.has(cle)) inconnues.push(`lettre ${lettre}`);
    }
    for (const [theme, cles] of Object.entries(ICONES_THEME)) {
      if (cles.length < 6) inconnues.push(`thème ${theme} : moins de six icônes de décor`);
    }
    expect(inconnues).toEqual([]);
  });

  it("l'alphabet de pictogrammes couvre les vingt-six lettres", () => {
    expect(Object.keys(ALPHABET_PICTO)).toHaveLength(26);
    expect(new Set(Object.values(ALPHABET_PICTO)).size).toBe(26);
  });

  it("deux cachettes n'ont jamais la même icône ni le même mot-clé", () => {
    expect(new Set(CACHETTES.map((c) => c.icone)).size).toBe(CACHETTES.length);
    expect(new Set(CACHETTES.map((c) => c.motCle)).size).toBe(CACHETTES.length);
    expect(new Set(CACHETTES.map((c) => c.id)).size).toBe(CACHETTES.length);
  });

  it("chaque icône porte un libellé lisible", () => {
    const sansLibelle = Object.entries(ICONES).filter(([, def]) => !def.libelle.trim());
    expect(sansLibelle).toEqual([]);
  });
});

describe("mots-clés des cachettes", () => {
  it("tiennent dans une grille 8x8 et n'emploient que des lettres", () => {
    for (const lieu of CACHETTES) {
      expect(lieu.motCle, lieu.id).toMatch(/^[A-Z]{3,8}$/);
    }
  });

  it("le catalogue compte une vingtaine de cachettes, assez pour la plus longue partie", () => {
    expect(CACHETTES.length).toBeGreaterThanOrEqual(18);
    expect(CACHETTES.filter((c) => c.preselectionnee).length).toBeGreaterThanOrEqual(8);
  });
});

describe("polices", () => {
  it("les trois fichiers sont présents et ressemblent à du TrueType", () => {
    for (const nom of POLICES) {
      const chemin = path.join(PUBLIC, "fonts", nom);
      expect(existsSync(chemin), nom).toBe(true);
      expect(statSync(chemin).size).toBeGreaterThan(10_000);
    }
  });

  it("les licences accompagnent les polices et les icônes", () => {
    for (const nom of ["OFL-Nunito.txt", "OFL-Fredoka.txt"]) {
      expect(existsSync(path.join(PUBLIC, "fonts", nom)), nom).toBe(true);
    }
    expect(existsSync(path.join(PUBLIC, "icones", "LICENSE-noto-emoji.txt"))).toBe(true);
  });
});

describe("page des crédits", () => {
  it("cite chaque ressource livrée avec sa licence et son lien", () => {
    const noms = CREDITS.ressources.map((r) => r.nom);
    expect(noms).toContain("Noto Emoji");
    expect(noms).toContain("Nunito");
    expect(noms).toContain("Fredoka");
    for (const ressource of CREDITS.ressources) {
      expect(ressource.licence.length, ressource.nom).toBeGreaterThan(0);
      expect(ressource.lien, ressource.nom).toMatch(/^https:\/\//);
      expect(ressource.lienLicence, ressource.nom).toMatch(/^https:\/\//);
      expect(ressource.credit.length, ressource.nom).toBeGreaterThan(0);
    }
  });

  it("n'emploie que des licences autorisées", () => {
    const autorisees = [/MIT/, /Apache/i, /Open Font License/i, /CC0/, /CC BY 4\.0/];
    for (const ressource of CREDITS.ressources) {
      expect(
        autorisees.some((motif) => motif.test(ressource.licence)),
        `${ressource.nom} : ${ressource.licence}`,
      ).toBe(true);
      expect(ressource.licence).not.toMatch(/BY-SA|NonCommercial|NC\b/i);
    }
  });
});
