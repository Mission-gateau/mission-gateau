import { Alea } from "./alea";
import { cachette } from "./cachettes";
import { NOMS_EQUIPES, SYMBOLES_EQUIPES, reglesPartie } from "./configuration";
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
} from "./enigmes";
import { MESSAGES_FINAUX } from "../contenu/consignes";
import { theme } from "../contenu/themes";
import type { Carte, ChiffreCode, Configuration, Enigme, Equipe, Etape, IdFormat, Kit } from "./types";

/** Change quand la structure du kit évolue. Les exemples versionnés s'y réfèrent. */
export const VERSION_KIT = "1.0";

/** Suite des énigmes de navigation, par format. */
const CYCLES_NAVIGATION: Record<IdFormat, string[]> = {
  chasse: ["devinette"],
  mission: ["pictogrammes", "motsmeles", "miroir"],
  // Jamais de César en première étape : son décalage vient d'un chiffre
  // trouvé plus tôt par la même équipe.
  escape: ["morse", "cesar", "motsmeles"],
};

/** Suite des énigmes d'agrément en 4-6 ans. */
const CYCLE_BONUS_CHASSE = ["intrus", "suite", "comptage", "labyrinthe"];

/**
 * Construit le kit complet.
 *
 * Tout est déterministe : la même configuration et la même graine donnent
 * exactement le même kit, quelle que soit la machine. C'est ce qui permet de
 * montrer un aperçu au parent et de lui livrer plus tard le kit correspondant.
 */
export function construireKit(configuration: Configuration, graine: string): Kit {
  const regles = reglesPartie(configuration);
  const contenuTheme = theme(configuration.theme);
  const racine = new Alea(`${graine}|${configuration.theme}|${regles.format}|${configuration.duree}`);

  // 1. Le parcours : une cachette par étape, dans un ordre tiré de la graine.
  const choisies = racine.deriver("cachettes").melanger(configuration.cachettes).slice(0, regles.etapes);
  const etapes: Etape[] = choisies.map((id, index) => ({
    numero: index + 1,
    cachette: id,
    cachetteSuivante: index + 1 < choisies.length ? choisies[index + 1]! : null,
  }));

  // 2. Le code final : chaque position est confiée à une équipe, à tour de rôle.
  const positions = Array.from({ length: regles.longueurCode }, (_, i) => i + 1);
  const positionsParEquipe: number[][] = Array.from({ length: regles.equipes }, () => []);
  positions.forEach((position) => {
    positionsParEquipe[(position - 1) % regles.equipes]!.push(position);
  });

  const contexteBase = {
    format: regles.format,
    iconesTheme: contenuTheme.icones,
    personnages: contenuTheme.personnages,
    objetsLogique: contenuTheme.objetsLogique,
  };

  const chiffresParPosition = new Map<number, number>();

  const equipes: Equipe[] = positionsParEquipe.map((mesPositions, indexEquipe) => {
    const symbole = SYMBOLES_EQUIPES[indexEquipe]!;
    const aleaEquipe = racine.deriver(`equipe|${symbole}`);
    const cartes: Carte[] = [];
    const chiffres: ChiffreCode[] = [];
    let dernierChiffre: { valeur: number; etape: number } | null = null;

    for (let index = 0; index < etapes.length; index += 1) {
      const etape = etapes[index]!;
      const numero = etape.numero;
      const aleaCarte = aleaEquipe.deriver(`etape|${numero}`);
      const ctx = (suffixe: string): ContexteEnigme => ({
        ...contexteBase,
        alea: aleaCarte.deriver(suffixe),
        id: `e${numero}-${symbole}-${suffixe}`,
      });

      // ---- énigme de code ------------------------------------------------
      let code: Enigme | null = null;
      const rangChiffre = index; // les chiffres sont placés sur les premières étapes
      if (rangChiffre < mesPositions.length) {
        const position = mesPositions[rangChiffre]!;
        if (regles.format === "mission") {
          const chiffre = aleaCarte.deriver("chiffre").entre(1, 9);
          code = enigmeCalcul(ctx("code"), chiffre, position);
        } else {
          code =
            rangChiffre % 2 === 0
              ? enigmeSudoku(ctx("code"), position, rangChiffre === 0 ? 4 : 6)
              : enigmeLogique(ctx("code"), position);
        }
        const valeur = Number(code.reponse);
        chiffres.push({ position, etape: numero, chiffre: valeur });
        chiffresParPosition.set(position, valeur);
        dernierChiffre = { valeur, etape: numero };
      }

      // ---- énigme de navigation ------------------------------------------
      let navigation: Enigme | null = null;
      let messageFinal: string | null = null;
      const versTresor = etape.cachetteSuivante === null;
      if (versTresor) {
        messageFinal = MESSAGES_FINAUX[regles.format];
      } else {
        const cible = cachette(etape.cachetteSuivante!);
        const cycle = CYCLES_NAVIGATION[regles.format]!;
        const genre = cycle[index % cycle.length]!;
        const contexte = ctx("nav");
        switch (genre) {
          case "devinette":
            navigation = enigmeDevinette(contexte, cible);
            break;
          case "pictogrammes":
            navigation = enigmePictogrammes(contexte, cible);
            break;
          case "miroir":
            navigation = enigmeMiroir(contexte, cible);
            break;
          case "morse":
            navigation = enigmeMorse(contexte, cible);
            break;
          case "motsmeles":
            navigation = enigmeMotsMeles(contexte, cible, regles.format === "escape" ? 10 : 8);
            break;
          case "cesar": {
            if (!dernierChiffre) throw new Error("césar : aucun chiffre trouvé plus tôt");
            navigation = enigmeCesar(contexte, cible, {
              decalage: dernierChiffre.valeur,
              origine: `étape ${dernierChiffre.etape}`,
            });
            break;
          }
          default:
            throw new Error(`énigme de navigation inconnue : ${genre}`);
        }
      }

      // ---- énigme d'agrément ---------------------------------------------
      let bonus: Enigme | null = null;
      if (regles.format === "chasse") {
        const genre = CYCLE_BONUS_CHASSE[index % CYCLE_BONUS_CHASSE.length]!;
        const contexte = ctx("bonus");
        if (genre === "intrus") bonus = enigmeIntrus(contexte);
        else if (genre === "suite") bonus = enigmeSuite(contexte);
        else if (genre === "comptage") bonus = enigmeComptage(contexte);
        else bonus = enigmeLabyrinthe(contexte);
      } else if (versTresor) {
        // Le grand labyrinthe occupe la dernière étape, qui ne porte ni code
        // ni navigation : l'équipe a de quoi patienter avant la mise en commun.
        bonus = enigmeLabyrinthe(ctx("bonus"));
      }

      cartes.push({
        etape: numero,
        cachette: etape.cachette,
        ambiance: aleaCarte.deriver("ambiance").choisir(contenuTheme.ambiances),
        navigation,
        code,
        bonus,
        versTresor,
        messageFinal,
      });
    }

    return {
      id: symbole,
      nom: NOMS_EQUIPES[symbole],
      symbole,
      cartes,
      chiffres,
    };
  });

  const depart = enigmeDevinette(
    {
      ...contexteBase,
      alea: racine.deriver("depart"),
      id: "depart",
    },
    cachette(etapes[0]!.cachette),
  );

  const codeFinal =
    regles.longueurCode === 0
      ? null
      : positions.map((position) => String(chiffresParPosition.get(position) ?? "?")).join("");

  return {
    version: VERSION_KIT,
    graine,
    configuration,
    format: regles.format,
    etapes,
    depart,
    equipes,
    codeFinal,
    nombreInvitations: Math.max(0, configuration.nombreEnfants - 1),
    minutesParEtape: regles.minutesParEtape,
  };
}

/** Fiches d'une équipe : les énigmes trop grandes pour une carte. */
export function fichesEquipe(equipe: Equipe): { numero: number; etape: number; enigme: Enigme }[] {
  const fiches: { numero: number; etape: number; enigme: Enigme }[] = [];
  for (const carte of equipe.cartes) {
    for (const enigme of [carte.navigation, carte.code, carte.bonus]) {
      if (enigme && enigme.surFiche) {
        fiches.push({ numero: fiches.length + 1, etape: carte.etape, enigme });
      }
    }
  }
  return fiches;
}

/** Toutes les énigmes du kit, dans l'ordre. */
export function toutesLesEnigmes(kit: Kit): Enigme[] {
  const liste: Enigme[] = [kit.depart];
  for (const equipe of kit.equipes) {
    for (const carte of equipe.cartes) {
      for (const enigme of [carte.navigation, carte.code, carte.bonus]) {
        if (enigme) liste.push(enigme);
      }
    }
  }
  return liste;
}
