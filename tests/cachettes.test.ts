import { describe, expect, it } from "vitest";
import { CACHETTES, CACHETTES_PRESELECTIONNEES } from "@/engine/cachettes";
import { DEVINETTES } from "@/contenu/devinettes";
import { INDICES_CACHETTES } from "@/contenu/indices";
import { GUIDE } from "@/contenu/guide";
import { ICONES } from "@/engine/icones";
import { nombreEtapes } from "@/engine/configuration";
import { sansAccents } from "@/engine/texte";
import type { IdFormat } from "@/engine/types";

/**
 * La promesse de sécurité doit être vraie.
 *
 * Le site, le guide et le formulaire affirment qu'aucune cachette n'est un
 * appareil, une prise, une fenêtre, un balcon ou un escalier, qu'aucune
 * n'oblige à grimper et qu'aucune n'est dehors ni dans la salle de bains. Ce
 * test relit tout ce qu'une cachette apporte au kit — son libellé, ses trois
 * devinettes, son indice de dépannage et le nom de son icône — et refuse le
 * moindre mot qui contredirait cette promesse.
 */
const INTERDITS = [
  "four",
  "plaque",
  "machine",
  "frigo",
  "réfrigérateur",
  "prise",
  "électrique",
  "fenêtre",
  "rideau",
  "balcon",
  "escalier",
  "grimper",
  "porte d'entrée",
  "dehors",
  "salle de bains",
  "médicament",
  "produit ménager",
];

const FORMATS: IdFormat[] = ["chasse", "mission", "escape"];

function normaliser(texte: string): string {
  return sansAccents(texte).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Mot entier, pluriel compris, sans tenir compte de la casse ni des accents. */
function motifInterdit(terme: string): RegExp {
  const mots = normaliser(terme).split(" ").map((mot) => `${mot}s?`);
  return new RegExp(`(?<![a-z0-9])${mots.join("\\s+")}(?![a-z0-9])`, "u");
}

const MOTIFS = INTERDITS.map((terme) => ({ terme, motif: motifInterdit(terme) }));

function motsInterdits(texte: string): string[] {
  const normalise = normaliser(texte);
  return MOTIFS.filter(({ motif }) => motif.test(normalise)).map(({ terme }) => terme);
}

/** Tout ce qu'une cachette fait apparaître dans le kit ou dans le formulaire. */
function textesDeLaCachette(id: string): { source: string; texte: string }[] {
  const lieu = CACHETTES.find((c) => c.id === id)!;
  const textes = [
    { source: "libellé", texte: lieu.libelle },
    { source: "mot-clé", texte: lieu.motCle },
    { source: "icône", texte: ICONES[lieu.icone as keyof typeof ICONES].libelle },
    { source: "indice", texte: INDICES_CACHETTES[id] ?? "" },
  ];
  for (const format of FORMATS) {
    textes.push({ source: `devinette ${format}`, texte: DEVINETTES[id]?.[format] ?? "" });
  }
  return textes;
}

describe("sécurité des cachettes", () => {
  it("aucune cachette n'évoque un four, une machine, une prise, une fenêtre ou la sortie", () => {
    const problemes: string[] = [];
    for (const lieu of CACHETTES) {
      for (const { source, texte } of textesDeLaCachette(lieu.id)) {
        const trouves = motsInterdits(texte);
        if (trouves.length > 0) {
          problemes.push(`${lieu.id} / ${source} : ${trouves.join(", ")} — « ${texte} »`);
        }
      }
    }
    expect(problemes).toEqual([]);
  });

  it("le test attrape bien un mot interdit, au pluriel comme au singulier", () => {
    expect(motsInterdits("Derrière le rideau de la fenêtre")).toEqual(["fenêtre", "rideau"]);
    expect(motsInterdits("Rangez les produits ménagers")).toEqual(["produit ménager"]);
    expect(motsInterdits("Sur les plaques de cuisson")).toEqual(["plaque"]);
    expect(motsInterdits("Derrière la porte d'entrée")).toEqual(["porte d'entrée"]);
    expect(motsInterdits("Dans le REFRIGERATEUR")).toEqual(["réfrigérateur"]);
    // Rien d'interdit dans ces phrases : les mots voisins ne doivent pas mordre.
    expect(motsInterdits("Derrière la porte de la chambre")).toEqual([]);
    expect(motsInterdits("Une fourchette et une surprise au fourneau")).toEqual([]);
  });

  it("ni frigo ni rideau ne subsistent dans le catalogue", () => {
    const ids = CACHETTES.map((c) => c.id);
    expect(ids).not.toContain("frigo");
    expect(ids).not.toContain("rideau");
    expect(Object.keys(DEVINETTES)).not.toContain("frigo");
    expect(Object.keys(DEVINETTES)).not.toContain("rideau");
    expect(Object.keys(INDICES_CACHETTES)).not.toContain("frigo");
    expect(Object.keys(INDICES_CACHETTES)).not.toContain("rideau");
    expect(Object.keys(ICONES)).not.toContain("frigo");
    expect(Object.keys(ICONES)).not.toContain("rideau");
  });

  it("il reste assez de cachettes, et assez de cachettes cochées d'avance", () => {
    const maximumEtapes = Math.max(
      ...FORMATS.flatMap((format) => [30, 45, 60].map((duree) => nombreEtapes(format, duree as 30))),
    );
    expect(CACHETTES.length).toBeGreaterThanOrEqual(maximumEtapes);
    expect(CACHETTES.length).toBeGreaterThanOrEqual(15);
    expect(CACHETTES_PRESELECTIONNEES.length).toBeGreaterThanOrEqual(8);
    expect(CACHETTES_PRESELECTIONNEES.length).toBeGreaterThanOrEqual(maximumEtapes);
  });

  it("les consignes de sécurité du guide disent vrai", () => {
    const consignes = GUIDE.securite.join(" ");
    expect(consignes).toMatch(/hauteur d'enfant/);
    expect(consignes).toMatch(/n'est un appareil/);
    expect(consignes).toMatch(/salle de bains/);
  });
});
