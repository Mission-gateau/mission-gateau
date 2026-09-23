import { describe, expect, it } from "vitest";
import { CACHETTES } from "@/engine/cachettes";
import { DEVINETTES } from "@/contenu/devinettes";
import { INDICES_CACHETTES } from "@/contenu/indices";
import { MOTS_GRILLE } from "@/contenu/mots";
import { LISTE_THEMES } from "@/contenu/themes";
import { construireKit } from "@/engine/kit";
import { sansAccents } from "@/engine/texte";
import type { IdFormat } from "@/engine/types";
import { textesDeProse } from "./collecte";
import { fautes, motCorrect } from "./orthographe";
import { AGES, DUREES, THEMES, configuration } from "./aide";

const FORMATS: IdFormat[] = ["chasse", "mission", "escape"];

describe("orthographe", () => {
  it("tous les textes passent le correcteur français", () => {
    const problemes: string[] = [];
    for (const { chemin, texte } of textesDeProse()) {
      const inconnus = fautes(texte);
      if (inconnus.length > 0) problemes.push(`${chemin} : ${inconnus.join(", ")}`);
    }
    expect(problemes).toEqual([]);
  });

  it("chaque mot des grilles de mots mêlés est un mot français", () => {
    const inconnus = MOTS_GRILLE.filter((mot) => !motCorrect(mot.toLowerCase()));
    expect(inconnus).toEqual([]);
  });

  it("le correcteur repère bien une faute", () => {
    expect(fautes("Voici une frase avec une erreure.").sort()).toEqual(["erreure", "frase"]);
  });
});

/**
 * Marques et univers protégés. Le test cherche des mots entiers, sans tenir
 * compte de la casse ni des accents : « pokemon », « Pokémon » et « POKEMON »
 * sont trouvés de la même façon.
 */
const LISTE_NOIRE = [
  "Disney", "Pixar", "Marvel", "DC", "Pokémon", "Harry Potter", "Poudlard",
  "Star Wars", "Minecraft", "Fortnite", "Pat' Patrouille", "Reine des neiges",
  "Barbie", "Lego", "Playmobil", "Spider-Man", "Jurassic Park", "One Piece",
  "Barbapapa", "Peppa Pig",
];

function normaliser(texte: string): string {
  return ` ${sansAccents(texte).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function marquesTrouvees(texte: string): string[] {
  const normalise = normaliser(texte);
  return LISTE_NOIRE.filter((marque) => normalise.includes(normaliser(marque)));
}

describe("liste noire", () => {
  it("aucune marque protégée dans les fichiers de contenu", () => {
    const problemes: string[] = [];
    for (const { chemin, texte } of textesDeProse()) {
      const trouvees = marquesTrouvees(texte);
      if (trouvees.length > 0) problemes.push(`${chemin} : ${trouvees.join(", ")}`);
    }
    expect(problemes).toEqual([]);
  });

  it("aucune marque protégée dans les kits produits", () => {
    const problemes: string[] = [];
    for (const theme of THEMES) {
      for (const age of AGES) {
        const kit = construireKit(configuration({ theme, age, prenom: "Camille" }), "listenoire");
        const trouvees = marquesTrouvees(JSON.stringify(kit));
        if (trouvees.length > 0) problemes.push(`${theme}/${age} : ${trouvees.join(", ")}`);
      }
    }
    expect(problemes).toEqual([]);
  });

  it("le test attrape bien une marque, quelle que soit la casse ou l'accent", () => {
    expect(marquesTrouvees("On joue avec POKEMON ce soir.")).toEqual(["Pokémon"]);
    expect(marquesTrouvees("Un décor façon star wars.")).toEqual(["Star Wars"]);
    expect(marquesTrouvees("Une pièce de théâtre.")).toEqual([]);
  });
});

describe("complétude des textes", () => {
  it("chaque cachette a une devinette pour chaque format", () => {
    const manquantes: string[] = [];
    for (const lieu of CACHETTES) {
      for (const format of FORMATS) {
        if (!DEVINETTES[lieu.id]?.[format]?.trim()) manquantes.push(`${lieu.id}/${format}`);
      }
    }
    expect(manquantes).toEqual([]);
  });

  it("chaque cachette a son indice de dépannage", () => {
    const manquants = CACHETTES.filter((lieu) => !INDICES_CACHETTES[lieu.id]?.trim()).map((l) => l.id);
    expect(manquants).toEqual([]);
  });

  it("aucune devinette ne porte sur une cachette inconnue", () => {
    const connues = new Set(CACHETTES.map((c) => c.id));
    expect(Object.keys(DEVINETTES).filter((id) => !connues.has(id))).toEqual([]);
    expect(Object.keys(INDICES_CACHETTES).filter((id) => !connues.has(id))).toEqual([]);
  });

  it("chaque thème a les textes de ses trois formats", () => {
    const manquants: string[] = [];
    for (const theme of LISTE_THEMES) {
      expect(theme.ambiances.length).toBeGreaterThanOrEqual(4);
      expect(theme.personnages).toHaveLength(3);
      expect(theme.objetsLogique).toHaveLength(3);
      expect(theme.icones.length).toBeGreaterThanOrEqual(6);
      for (const format of FORMATS) {
        const textes = theme.formats[format];
        for (const [cle, valeur] of Object.entries(textes)) {
          const vide = Array.isArray(valeur) ? valeur.length === 0 : !String(valeur).trim();
          if (vide) manquants.push(`${theme.id}/${format}/${cle}`);
        }
        expect(textes.reussites.length).toBeGreaterThanOrEqual(3);
      }
    }
    expect(manquants).toEqual([]);
  });
});

describe("gabarits", () => {
  it("aucun gabarit non résolu dans les textes produits", () => {
    const restes: string[] = [];
    for (const theme of THEMES) {
      for (const age of AGES) {
        for (const duree of DUREES) {
          const kit = construireKit(configuration({ theme, age, duree }), "gabarits01");
          const trouves = JSON.stringify(kit).match(/\{\w+\}/g);
          if (trouves) restes.push(`${theme}/${age}/${duree} : ${[...new Set(trouves)].join(", ")}`);
        }
      }
    }
    expect(restes).toEqual([]);
  });

  it("les gabarits des fichiers de contenu n'emploient que des clés connues", () => {
    const connues = new Set([
      "prenom", "age", "code", "nom", "cachette", "reponse", "position", "libelle", "piece",
      "cible", "total", "ligne", "colonne", "intrus", "commun", "cases", "max", "decalage",
      "valeur", "valeurA", "valeurB", "nomA", "nomB", "courante", "total", "etapes", "minutes",
      "cochees", "minimum", "nombre", "format", "tranche",
    ]);
    const inconnues = new Set<string>();
    for (const { texte } of textesDeProse()) {
      for (const trouve of texte.matchAll(/\{(\w+)\}/g)) {
        if (!connues.has(trouve[1]!)) inconnues.add(trouve[1]!);
      }
    }
    expect([...inconnues]).toEqual([]);
  });
});

/**
 * Longueurs maximales : elles tiennent compte de la place réellement
 * disponible sur une carte, une invitation ou un diplôme. Dépasser ferait
 * déborder le texte de son cadre à l'impression.
 */
const LONGUEURS: { chemin: RegExp; max: number }[] = [
  { chemin: /^devinettes\./, max: 190 },
  { chemin: /^themes\[\d+\]\.ambiances/, max: 90 },
  { chemin: /^themes\[\d+\]\.formats\.\w+\.histoire$/, max: 900 },
  { chemin: /^themes\[\d+\]\.formats\.\w+\.briefing$/, max: 460 },
  { chemin: /^themes\[\d+\]\.formats\.\w+\.reussites/, max: 90 },
  { chemin: /^themes\[\d+\]\.formats\.\w+\.tresor$/, max: 400 },
  { chemin: /^themes\[\d+\]\.formats\.\w+\.diplomeTexte$/, max: 230 },
  { chemin: /^themes\[\d+\]\.formats\.\w+\.diplomeTitre$/, max: 46 },
  { chemin: /^themes\[\d+\]\.formats\.\w+\.invitation$/, max: 230 },
  { chemin: /^themes\[\d+\]\.formats\.\w+\.titreKit$/, max: 40 },
  { chemin: /^indices\./, max: 130 },
  { chemin: /^consignes\./, max: 260 },
  { chemin: /^titres\./, max: 34 },
  { chemin: /^messagesFinaux\./, max: 180 },
];

describe("longueurs", () => {
  it("chaque texte tient dans la place prévue", () => {
    const debordements: string[] = [];
    for (const { chemin, texte } of textesDeProse()) {
      for (const regle of LONGUEURS) {
        if (regle.chemin.test(chemin) && texte.length > regle.max) {
          debordements.push(`${chemin} : ${texte.length} caractères pour ${regle.max} au plus`);
        }
      }
    }
    expect(debordements).toEqual([]);
  });

  it("les devinettes en 4-6 ans tiennent en phrases très courtes", () => {
    const trop: string[] = [];
    for (const lieu of CACHETTES) {
      const texte = DEVINETTES[lieu.id]!.chasse;
      if (texte.length > 95) trop.push(`${lieu.id} : ${texte.length} caractères`);
      const phrases = texte.split(/[.!?]+/).map((p) => p.trim()).filter(Boolean);
      for (const phrase of phrases) {
        const mots = phrase.split(/\s+/).length;
        if (mots > 9) trop.push(`${lieu.id} : « ${phrase} » fait ${mots} mots`);
      }
    }
    expect(trop).toEqual([]);
  });
});

describe("neutralité", () => {
  /**
   * Aucun texte ne doit s'accorder au genre de l'enfant : le formulaire ne
   * pose pas la question, et le kit ne doit donc jamais avoir à deviner.
   */
  it("aucune tournure genrée autour du prénom", () => {
    // En JavaScript, \b ignore les accents : « général » contiendrait un
    // « né » entre deux frontières de mot. On borne donc les motifs à la main.
    const debut = "(?<![\\p{L}\\p{N}])";
    const fin = "(?![\\p{L}\\p{N}])";
    const formes = [
      new RegExp(`\\{prenom\\}\\s+est\\s+\\p{L}+ée${fin}`, "iu"),
      new RegExp(`${debut}l[ae]\\s+héro`, "iu"),
      new RegExp(`${debut}le\\s+petit\\s+\\{prenom\\}`, "iu"),
      new RegExp(`${debut}la\\s+petite\\s+\\{prenom\\}`, "iu"),
      new RegExp(`${debut}née?${fin}`, "u"),
      new RegExp(`${debut}(invité|invitée|content|contente|prêt|prête)\\s+\\{prenom\\}`, "iu"),
    ];
    const problemes: string[] = [];
    for (const { chemin, texte } of textesDeProse()) {
      for (const forme of formes) {
        if (forme.test(texte)) problemes.push(`${chemin} : ${forme}`);
      }
    }
    expect(problemes).toEqual([]);
  });

  it("le formulaire ne demande jamais le genre de l'enfant", () => {
    const suspects = /(?<![\p{L}\p{N}])(gar[çc]on|fille|sexe|genre)(?![\p{L}\p{N}])/iu;
    const problemes = textesDeProse()
      .filter(({ chemin }) => chemin.startsWith("formulaire"))
      .filter(({ texte }) => suspects.test(texte))
      .map(({ chemin }) => chemin);
    expect(problemes).toEqual([]);
  });
});
