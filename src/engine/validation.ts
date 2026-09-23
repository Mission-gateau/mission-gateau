import { cachette } from "./cachettes";
import { reglesPartie } from "./configuration";
import { toutesLesEnigmes } from "./kit";
import type { Kit } from "./types";
import { verifierEnigme } from "./verif";

/**
 * Contrôle complet d'un kit, avant impression.
 *
 * Ce qui est vérifié ici, c'est le jeu lui-même : que le parcours forme une
 * chaîne sans impasse, qu'aucune cachette ne serve deux fois, que le code
 * final corresponde bien aux réponses trouvées, et que chaque énigme résiste
 * à son propre contrôle indépendant.
 */
export function verifierKit(kit: Kit): string[] {
  const problemes: string[] = [];
  const regles = reglesPartie(kit.configuration);

  // ---- le parcours ---------------------------------------------------------
  if (kit.etapes.length !== regles.etapes) {
    problemes.push(`${kit.etapes.length} étapes au lieu de ${regles.etapes}`);
  }
  const vues = new Set<string>();
  kit.etapes.forEach((etape, index) => {
    if (vues.has(etape.cachette)) {
      problemes.push(`la cachette « ${etape.cachette} » sert à deux étapes`);
    }
    vues.add(etape.cachette);
    if (!kit.configuration.cachettes.includes(etape.cachette)) {
      problemes.push(`la cachette « ${etape.cachette} » n'a pas été choisie par le parent`);
    }
    const suivante = index + 1 < kit.etapes.length ? kit.etapes[index + 1]!.cachette : null;
    if (etape.cachetteSuivante !== suivante) {
      problemes.push(`étape ${etape.numero} : la cachette suivante annoncée est fausse`);
    }
  });

  const premiere = kit.etapes[0];
  if (!premiere) {
    problemes.push("aucune étape");
    return problemes;
  }
  if (kit.depart.reponse !== cachette(premiere.cachette).motCle) {
    problemes.push("la devinette de départ ne mène pas à la première cachette");
  }

  // ---- les équipes ---------------------------------------------------------
  if (kit.equipes.length !== regles.equipes) {
    problemes.push(`${kit.equipes.length} équipes au lieu de ${regles.equipes}`);
  }
  for (const equipe of kit.equipes) {
    if (equipe.cartes.length !== kit.etapes.length) {
      problemes.push(`équipe ${equipe.nom} : ${equipe.cartes.length} cartes au lieu de ${kit.etapes.length}`);
      continue;
    }
    equipe.cartes.forEach((carte, index) => {
      const etape = kit.etapes[index]!;
      if (carte.cachette !== etape.cachette) {
        problemes.push(`équipe ${equipe.nom}, carte ${carte.etape} : mauvaise cachette`);
      }
      if (!carte.ambiance.trim()) {
        problemes.push(`équipe ${equipe.nom}, carte ${carte.etape} : phrase d'ambiance vide`);
      }
      if (etape.cachetteSuivante === null) {
        if (!carte.versTresor) problemes.push(`équipe ${equipe.nom} : la dernière carte ne mène pas au trésor`);
        if (carte.navigation) problemes.push(`équipe ${equipe.nom} : la dernière carte porte encore une énigme de route`);
        if (!carte.messageFinal) problemes.push(`équipe ${equipe.nom} : la dernière carte n'a pas de message`);
      } else {
        if (carte.versTresor) problemes.push(`équipe ${equipe.nom}, carte ${carte.etape} : trésor annoncé trop tôt`);
        if (!carte.navigation) {
          problemes.push(`équipe ${equipe.nom}, carte ${carte.etape} : aucune énigme de route`);
        } else if (carte.navigation.reponse !== cachette(etape.cachetteSuivante).motCle) {
          problemes.push(
            `équipe ${equipe.nom}, carte ${carte.etape} : l'énigme ne mène pas à la cachette suivante`,
          );
        }
      }
      if (carte.code && carte.code.role !== "code") {
        problemes.push(`équipe ${equipe.nom}, carte ${carte.etape} : énigme de code mal étiquetée`);
      }
    });

    for (const chiffre of equipe.chiffres) {
      const carte = equipe.cartes.find((c) => c.etape === chiffre.etape);
      if (!carte?.code) {
        problemes.push(`équipe ${equipe.nom} : chiffre annoncé à l'étape ${chiffre.etape} sans énigme`);
      } else if (Number(carte.code.reponse) !== chiffre.chiffre) {
        problemes.push(`équipe ${equipe.nom} : le chiffre de l'étape ${chiffre.etape} ne suit pas son énigme`);
      }
    }
  }

  // ---- le code final -------------------------------------------------------
  const tousChiffres = kit.equipes.flatMap((e) => e.chiffres);
  if (regles.longueurCode === 0) {
    if (kit.codeFinal !== null) problemes.push("un code final apparaît là où il ne devrait pas y en avoir");
    if (tousChiffres.length > 0) problemes.push("des chiffres de code apparaissent en 4-6 ans");
  } else {
    if (!kit.codeFinal || kit.codeFinal.length !== regles.longueurCode) {
      problemes.push(`code final de ${kit.codeFinal?.length ?? 0} chiffres au lieu de ${regles.longueurCode}`);
    }
    const parPosition = new Map<number, number>();
    for (const chiffre of tousChiffres) {
      if (parPosition.has(chiffre.position)) {
        problemes.push(`deux équipes donnent le chiffre n° ${chiffre.position}`);
      }
      parPosition.set(chiffre.position, chiffre.chiffre);
    }
    for (let position = 1; position <= regles.longueurCode; position += 1) {
      if (!parPosition.has(position)) problemes.push(`le chiffre n° ${position} n'est trouvé par personne`);
    }
    const reconstitue = Array.from({ length: regles.longueurCode }, (_, i) => parPosition.get(i + 1) ?? "?").join("");
    if (reconstitue !== kit.codeFinal) {
      problemes.push(`le code final « ${kit.codeFinal} » ne correspond pas aux réponses (« ${reconstitue} »)`);
    }
    if (regles.equipes > 1) {
      const equipesAvecChiffre = kit.equipes.filter((e) => e.chiffres.length > 0).length;
      if (equipesAvecChiffre !== regles.equipes) {
        problemes.push("une équipe ne trouve aucun chiffre : le jeu ne serait plus coopératif");
      }
    }
  }

  // ---- les énigmes ---------------------------------------------------------
  const enigmes = toutesLesEnigmes(kit);
  const identifiants = new Set<string>();
  for (const enigme of enigmes) {
    if (identifiants.has(enigme.id)) problemes.push(`deux énigmes partagent l'identifiant « ${enigme.id} »`);
    identifiants.add(enigme.id);
    problemes.push(...verifierEnigme(enigme));
  }

  return problemes;
}
