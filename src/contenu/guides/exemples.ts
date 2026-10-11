import { CACHETTES_PRESELECTIONNEES } from "../../engine/cachettes";
import type { Configuration } from "../../engine/types";

/**
 * Les exemples des guides, produits par le vrai moteur avec une graine fixe :
 * la même configuration et la même graine redonnent toujours la même énigme.
 * Le prénom est un prénom d'exemple.
 */
export type GenreDExemple =
  /** La devinette de départ et l'ordre des cachettes d'une chasse au trésor. */
  | "chasse"
  /** Une énigme d'alphabet en pictogrammes. */
  | "pictogrammes"
  /** Un message chiffré par décalage (César). */
  | "cesar"
  /** Le déroulé minute par minute du guide de l'organisateur. */
  | "deroule"
  /** La devinette de départ d'un même thème à 4, 7 et 10 ans. */
  | "devinettes_par_age";

export interface ExempleDeGuide {
  genre: GenreDExemple;
  /** Une ou plusieurs configurations (une par âge pour `devinettes_par_age`). */
  configurations: Configuration[];
  graine: string;
}

export const PRENOM_D_EXEMPLE = "Camille";

const BASE = { prenom: PRENOM_D_EXEMPLE, cachettes: [...CACHETTES_PRESELECTIONNEES] };

/** L'exemple de chaque guide, par son adresse. */
export const EXEMPLES_DES_GUIDES: Record<string, ExempleDeGuide> = {
  "chasse-au-tresor-anniversaire-4-6-ans": {
    genre: "chasse",
    configurations: [{ ...BASE, theme: "pirates", age: 5, nombreEnfants: 6, duree: 45 }],
    graine: "guide4a6ans",
  },
  "mission-agents-secrets-anniversaire-7-9-ans": {
    genre: "pictogrammes",
    configurations: [{ ...BASE, theme: "agents", age: 8, nombreEnfants: 8, duree: 45 }],
    graine: "guide7a9ans",
  },
  "escape-game-anniversaire-10-12-ans": {
    genre: "cesar",
    configurations: [{ ...BASE, theme: "pirates", age: 11, nombreEnfants: 8, duree: 60 }],
    graine: "guide10a12ans",
  },
  "deroule-anniversaire-enfant-maison": {
    genre: "deroule",
    configurations: [{ ...BASE, theme: "dinosaures", age: 7, nombreEnfants: 10, duree: 60 }],
    graine: "guidederoule",
  },
  "cachettes-enigmes-selon-age": {
    genre: "devinettes_par_age",
    configurations: [4, 7, 10].map((age) => ({ ...BASE, theme: "pirates" as const, age, nombreEnfants: 8, duree: 45 as const })),
    graine: "guidecachettes",
  },
};
