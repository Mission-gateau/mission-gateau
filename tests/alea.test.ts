import { describe, expect, it } from "vitest";
import { Alea, creerGraine, graineValide } from "@/engine/alea";

describe("générateur pseudo-aléatoire", () => {
  it("rend la même suite pour la même graine", () => {
    const a = new Alea("bonjour");
    const b = new Alea("bonjour");
    const suiteA = Array.from({ length: 50 }, () => a.flottant());
    const suiteB = Array.from({ length: 50 }, () => b.flottant());
    expect(suiteA).toEqual(suiteB);
  });

  it("rend une suite différente pour une autre graine", () => {
    const a = Array.from({ length: 20 }, (_, i) => new Alea("x").deriver(i).flottant());
    const b = Array.from({ length: 20 }, (_, i) => new Alea("y").deriver(i).flottant());
    expect(a).not.toEqual(b);
  });

  it("reste dans les bornes demandées", () => {
    const alea = new Alea("bornes");
    for (let i = 0; i < 2000; i += 1) {
      const valeur = alea.entre(3, 7);
      expect(valeur).toBeGreaterThanOrEqual(3);
      expect(valeur).toBeLessThanOrEqual(7);
      expect(Number.isInteger(valeur)).toBe(true);
    }
  });

  it("mélange sans rien perdre ni rien ajouter", () => {
    const source = Array.from({ length: 30 }, (_, i) => i);
    const melange = new Alea("melange").melanger(source);
    expect([...melange].sort((a, b) => a - b)).toEqual(source);
    expect(melange).not.toEqual(source);
  });

  it("produit des graines valides", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(graineValide(creerGraine())).toBe(true);
    }
    expect(graineValide("TROPCOURT")).toBe(false);
    expect(graineValide("0000000000")).toBe(false);
  });
});
