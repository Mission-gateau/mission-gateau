import { describe, expect, it } from "vitest";
import { cachette } from "@/engine/cachettes";
import {
  formatPourAge,
  longueurCode,
  nombreEquipes,
  nombreEtapes,
  schemaConfiguration,
} from "@/engine/configuration";
import { construireKit, toutesLesEnigmes } from "@/engine/kit";
import { deroule, dureeTotale } from "@/pdf/deroule";
import { verifierKit } from "@/engine/validation";
import type { IdFormat, TypeEnigme } from "@/engine/types";
import { AGES, DUREES, THEMES, TOUTES_CACHETTES, configuration, graines } from "./aide";

const GRAINES = graines(3, "kit");
const EFFECTIFS = [3, 8, 16];

describe("génération complète", () => {
  it("les 9 combinaisons thème x format passent tous les contrôles, pour 3 graines et 3, 8 et 16 enfants", () => {
    const echecs: string[] = [];
    let compte = 0;
    for (const theme of THEMES) {
      for (const age of AGES) {
        for (const graine of GRAINES) {
          for (const nombreEnfants of EFFECTIFS) {
            const kit = construireKit(configuration({ theme, age, nombreEnfants }), graine);
            const problemes = verifierKit(kit);
            compte += 1;
            if (problemes.length > 0) {
              echecs.push(`${theme}/${age} ans/${nombreEnfants} enfants/${graine} : ${problemes.join(" | ")}`);
            }
          }
        }
      }
    }
    expect(echecs).toEqual([]);
    expect(compte).toBe(81);
  });

  it("toutes les durées passent aussi", () => {
    const echecs: string[] = [];
    for (const age of AGES) {
      for (const duree of DUREES) {
        const kit = construireKit(configuration({ age, duree }), "durees001");
        const problemes = verifierKit(kit);
        if (problemes.length > 0) echecs.push(`${age} ans/${duree} min : ${problemes.join(" | ")}`);
      }
    }
    expect(echecs).toEqual([]);
  });

  it("fonctionne avec le strict minimum de cachettes cochées", () => {
    for (const age of AGES) {
      for (const duree of DUREES) {
        const format = formatPourAge(age);
        const minimum = nombreEtapes(format, duree);
        const kit = construireKit(
          configuration({ age, duree, cachettes: TOUTES_CACHETTES.slice(0, minimum) }),
          "minimum01",
        );
        expect(verifierKit(kit)).toEqual([]);
        expect(kit.etapes).toHaveLength(minimum);
      }
    }
  });
});

describe("le parcours", () => {
  it("forme une chaîne sans impasse, et chaque cachette ne sert qu'une fois", () => {
    for (const graine of graines(40, "chaine")) {
      const kit = construireKit(configuration({ age: 11, duree: 60 }), graine);
      const utilisees = kit.etapes.map((e) => e.cachette);
      expect(new Set(utilisees).size).toBe(utilisees.length);
      expect(kit.depart.reponse).toBe(cachette(utilisees[0]!).motCle);
      kit.etapes.forEach((etape, index) => {
        const attendue = index + 1 < kit.etapes.length ? utilisees[index + 1]! : null;
        expect(etape.cachetteSuivante).toBe(attendue);
      });
      for (const equipe of kit.equipes) {
        equipe.cartes.forEach((carte, index) => {
          const suivante = kit.etapes[index]!.cachetteSuivante;
          if (suivante === null) {
            expect(carte.navigation).toBeNull();
            expect(carte.versTresor).toBe(true);
          } else {
            expect(carte.navigation?.reponse).toBe(cachette(suivante).motCle);
          }
        });
      }
    }
  });

  it("n'emploie que des cachettes cochées par le parent", () => {
    const choisies = ["canape", "lit", "marmite", "porte", "tapis", "livre", "jouets", "boite"];
    for (const graine of graines(20, "choix")) {
      const kit = construireKit(configuration({ age: 11, duree: 60, cachettes: choisies }), graine);
      for (const etape of kit.etapes) expect(choisies).toContain(etape.cachette);
    }
  });
});

describe("équipes et code final", () => {
  it("compose les équipes selon l'effectif", () => {
    for (const nombreEnfants of [3, 6, 7, 12, 13, 16]) {
      for (const age of AGES) {
        const kit = construireKit(configuration({ age, nombreEnfants }), "equipes01");
        expect(kit.equipes).toHaveLength(nombreEquipes(formatPourAge(age), nombreEnfants));
      }
    }
  });

  it("en 4-6 ans, un seul groupe et aucun code", () => {
    for (const nombreEnfants of EFFECTIFS) {
      const kit = construireKit(configuration({ age: 5, nombreEnfants }), "chasse001");
      expect(kit.equipes).toHaveLength(1);
      expect(kit.codeFinal).toBeNull();
      expect(kit.equipes[0]!.chiffres).toEqual([]);
      expect(kit.equipes[0]!.cartes.at(-1)!.versTresor).toBe(true);
    }
  });

  it("le code final a la bonne longueur et se reconstitue à partir des réponses", () => {
    for (const age of [8, 11]) {
      for (const nombreEnfants of EFFECTIFS) {
        for (const graine of graines(10, `code${age}`)) {
          const kit = construireKit(configuration({ age, nombreEnfants }), graine);
          const attendue = longueurCode(formatPourAge(age));
          expect(kit.codeFinal).toHaveLength(attendue);
          const chiffres = kit.equipes.flatMap((e) => e.chiffres);
          expect(chiffres).toHaveLength(attendue);
          const reconstitue = chiffres
            .sort((a, b) => a.position - b.position)
            .map((c) => c.chiffre)
            .join("");
          expect(reconstitue).toBe(kit.codeFinal);
        }
      }
    }
  });

  it("aucune équipe ne détient le code entier quand il y en a plusieurs", () => {
    for (const age of [8, 11]) {
      const kit = construireKit(configuration({ age, nombreEnfants: 16 }), "coop00001");
      expect(kit.equipes.length).toBeGreaterThan(1);
      for (const equipe of kit.equipes) {
        expect(equipe.chiffres.length).toBeGreaterThan(0);
        expect(equipe.chiffres.length).toBeLessThan(kit.codeFinal!.length);
      }
    }
  });

  it("à chaque étape, deux équipes n'ont jamais la même énigme de route", () => {
    /**
     * Les pictogrammes, le miroir et le morse ne dépendent que du mot-réponse,
     * le même pour toutes les équipes : sans décalage du cycle, toutes les
     * équipes recevaient la carte identique à une étape donnée.
     */
    const problemes: string[] = [];
    for (const theme of THEMES) {
      for (const age of [8, 11]) {
        for (const nombreEnfants of [8, 12, 14, 16]) {
          for (const duree of DUREES) {
            for (const graine of graines(3, `propre${age}`)) {
              const kit = construireKit(
                configuration({ theme, age, nombreEnfants, duree }),
                graine,
              );
              if (kit.equipes.length < 2) continue;
              kit.etapes.forEach((etape, index) => {
                const empreintes = kit.equipes.map((equipe) => {
                  const enigme = equipe.cartes[index]!.navigation;
                  if (!enigme) return null;
                  const copie: Record<string, unknown> = { ...enigme };
                  delete copie.id;
                  return JSON.stringify(copie);
                });
                const presentes = empreintes.filter((e) => e !== null);
                if (new Set(presentes).size !== presentes.length) {
                  problemes.push(
                    `${theme}/${age} ans/${nombreEnfants} enfants/${duree} min/${graine} : étape ${etape.numero}`,
                  );
                }
              });
            }
          }
        }
      }
    }
    expect(problemes.slice(0, 10)).toEqual([]);
  });

  it("aucune équipe ne reçoit un César avant d'avoir trouvé un chiffre", () => {
    const problemes: string[] = [];
    for (const nombreEnfants of [3, 8, 12, 14, 16]) {
      for (const duree of DUREES) {
        for (const graine of graines(5, "cesar2")) {
          const kit = construireKit(configuration({ age: 11, nombreEnfants, duree }), graine);
          for (const equipe of kit.equipes) {
            let chiffreAnterieur = false;
            for (const carte of equipe.cartes) {
              if (carte.navigation?.type === "cesar" && !chiffreAnterieur) {
                problemes.push(`${equipe.nom} : César à l'étape ${carte.etape} sans chiffre connu`);
              }
              if (carte.code) chiffreAnterieur = true;
            }
          }
        }
      }
    }
    expect(problemes).toEqual([]);
  });

  it("toutes les équipes suivent le même parcours avec leurs propres énigmes", () => {
    const kit = construireKit(configuration({ age: 11, nombreEnfants: 16, duree: 60 }), "meme00001");
    const [a, b] = kit.equipes;
    expect(a!.cartes.map((c) => c.cachette)).toEqual(b!.cartes.map((c) => c.cachette));
    const enigmesA = a!.cartes.map((c) => JSON.stringify(c.navigation));
    const enigmesB = b!.cartes.map((c) => JSON.stringify(c.navigation));
    expect(enigmesA).not.toEqual(enigmesB);
    expect(new Set(kit.equipes.map((e) => e.symbole)).size).toBe(kit.equipes.length);
  });
});

describe("types d'énigmes attendus par format", () => {
  const REQUIS: Record<IdFormat, TypeEnigme[]> = {
    chasse: ["devinette", "intrus", "suite", "comptage", "labyrinthe"],
    mission: ["pictogrammes", "calcul", "motsmeles", "miroir", "labyrinthe"],
    escape: ["cesar", "sudoku", "logique", "morse", "motsmeles", "labyrinthe"],
  };

  it("chaque format emploie bien toutes ses familles d'énigmes", () => {
    const manquants: string[] = [];
    for (const age of AGES) {
      const format = formatPourAge(age);
      for (const duree of DUREES) {
        const kit = construireKit(configuration({ age, duree, nombreEnfants: 8 }), "familles1");
        const presents = new Set(toutesLesEnigmes(kit).map((e) => e.type));
        for (const requis of REQUIS[format]) {
          if (!presents.has(requis)) manquants.push(`${format}/${duree} min : ${requis}`);
        }
      }
    }
    expect(manquants).toEqual([]);
  });

  it("le César ne tombe jamais avant qu'un chiffre ait été trouvé", () => {
    for (const graine of graines(30, "cesar")) {
      for (const nombreEnfants of EFFECTIFS) {
        const kit = construireKit(configuration({ age: 11, nombreEnfants, duree: 60 }), graine);
        for (const equipe of kit.equipes) {
          let chiffreTrouve = false;
          for (const carte of equipe.cartes) {
            if (carte.navigation?.type === "cesar") expect(chiffreTrouve).toBe(true);
            if (carte.code) chiffreTrouve = true;
          }
        }
      }
    }
  });
});

describe("durée annoncée", () => {
  /**
   * Le parent choisit 30, 45 ou 60 minutes : le déroulé minute par minute doit
   * se terminer exactement là. Au lot 2 il dépassait de 2 à 3 minutes dans les
   * neuf combinaisons, l'accueil, la lecture et le trésor prenant 13 minutes
   * quand la formule n'en retirait que 10.
   */
  it("le déroulé se termine exactement à la durée choisie, dans les 9 combinaisons", () => {
    const ecarts: string[] = [];
    for (const age of AGES) {
      for (const duree of DUREES) {
        const kit = construireKit(configuration({ age, duree }), "duree0001");
        const total = dureeTotale(kit);
        if (total !== duree) ecarts.push(`${kit.format}/${duree} min → ${total} min`);
      }
    }
    expect(ecarts).toEqual([]);
  });

  it("chaque étape dure au moins trois minutes, et le déroulé ne saute rien", () => {
    for (const age of AGES) {
      for (const duree of DUREES) {
        const kit = construireKit(configuration({ age, duree }), "duree0002");
        expect(kit.minutesParEtape).toBeGreaterThanOrEqual(3);
        const moments = deroule(kit);
        // Accueil, lecture, une ligne par étape, le trésor, puis « et ensuite ».
        expect(moments).toHaveLength(kit.etapes.length + 4);
        moments.slice(0, -1).forEach((moment, index) => {
          if (index > 0) {
            expect(moment.debut).toBe(moments[index - 1]!.debut + moments[index - 1]!.duree);
          }
          expect(moment.duree).toBeGreaterThan(0);
        });
      }
    }
  });
});

describe("reproductibilité", () => {
  it("même configuration et même graine donnent la même structure de kit", () => {
    for (const theme of THEMES) {
      for (const age of AGES) {
        const config = configuration({ theme, age, nombreEnfants: 12, duree: 60 });
        const premier = construireKit(config, "repro0001");
        const second = construireKit(structuredClone(config), "repro0001");
        expect(JSON.stringify(second)).toBe(JSON.stringify(premier));
      }
    }
  });

  it("deux graines différentes donnent deux jeux différents", () => {
    const config = configuration({ age: 11, duree: 60 });
    const a = construireKit(config, "graineaaa");
    const b = construireKit(config, "grainebbb");
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe("validation de la configuration", () => {
  it("accepte une configuration correcte", () => {
    expect(schemaConfiguration.safeParse(configuration()).success).toBe(true);
  });

  it("refuse ce qui doit être refusé", () => {
    const cas: [string, unknown][] = [
      ["âge trop bas", configuration({ age: 3 })],
      ["âge trop haut", configuration({ age: 13 })],
      ["prénom vide", configuration({ prenom: "  " })],
      ["prénom trop long", configuration({ prenom: "Aaaaaaaaaaaaaaaaaaaaa" })],
      ["prénom avec des chiffres", configuration({ prenom: "Zoe2" })],
      ["prénom avec du code", configuration({ prenom: "<script>" })],
      ["trop peu d'enfants", configuration({ nombreEnfants: 2 })],
      ["trop d'enfants", configuration({ nombreEnfants: 17 })],
      ["durée inconnue", configuration({ duree: 90 as never })],
      ["thème inconnu", configuration({ theme: "licornes" as never })],
      ["cachette inconnue", configuration({ cachettes: ["four", "canape"] })],
      ["cachette en double", configuration({ cachettes: ["canape", "canape", "lit", "marmite", "porte", "tapis"] })],
      ["pas assez de cachettes", configuration({ cachettes: ["canape", "lit"] })],
    ];
    for (const [nom, valeur] of cas) {
      expect(schemaConfiguration.safeParse(valeur).success, nom).toBe(false);
    }
  });

  it("accepte les prénoms accentués, composés et avec apostrophe", () => {
    for (const prenom of ["Léa", "Jean-Baptiste", "N'Golo", "Marie Claire", "Chloé", "Aurélien"]) {
      expect(schemaConfiguration.safeParse(configuration({ prenom })).success, prenom).toBe(true);
    }
  });
});
