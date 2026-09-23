import { reglesPartie } from "../engine/configuration";
import { cachette } from "../engine/cachettes";
import type { Kit } from "../engine/types";

export interface MomentDeroule {
  debut: number;
  duree: number;
  titre: string;
  detail: string;
}

/**
 * Déroulé minute par minute.
 *
 * Les durées viennent de la configuration : la somme des étapes plus l'accueil
 * et la remise du trésor retombe sur la durée annoncée au parent.
 */
export function deroule(kit: Kit): MomentDeroule[] {
  const regles = reglesPartie(kit.configuration);
  const moments: MomentDeroule[] = [];
  let minute = 0;
  const ajouter = (duree: number, titre: string, detail: string) => {
    moments.push({ debut: minute, duree, titre, detail });
    minute += duree;
  };

  ajouter(
    5,
    "Accueil",
    regles.equipes > 1
      ? `Former ${regles.equipes} équipes et distribuer les symboles (étoile, lune, soleil).`
      : "Rassembler les enfants et distribuer le matériel.",
  );
  ajouter(3, "Lecture de l'histoire", "Lire l'introduction à voix haute, puis le briefing et la devinette de départ.");

  for (const etape of kit.etapes) {
    const lieu = cachette(etape.cachette);
    ajouter(
      kit.minutesParEtape,
      `Étape ${etape.numero}`,
      etape.cachetteSuivante === null
        ? `${lieu.libelle}. Dernière carte : les enfants reviennent vous voir.`
        : `${lieu.libelle}. La carte mène à la cachette suivante.`,
    );
  }

  ajouter(
    5,
    kit.codeFinal ? "Le code et le trésor" : "Le trésor",
    kit.codeFinal
      ? "Les équipes mettent leurs chiffres en commun, annoncent le code, et vous remettez le trésor."
      : "Vous conduisez le groupe jusqu'au trésor et vous l'ouvrez tous ensemble.",
  );
  ajouter(0, "Et ensuite", "Gâteau, cadeaux, et remise des diplômes.");
  return moments;
}

export function dureeTotale(kit: Kit): number {
  const moments = deroule(kit);
  const dernier = moments[moments.length - 1]!;
  return dernier.debut + dernier.duree;
}
