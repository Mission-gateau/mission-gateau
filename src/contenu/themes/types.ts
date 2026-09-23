import type { CleIcone } from "../../engine/icones";
import type { IdFormat, IdTheme } from "../../engine/types";
import type { ValeurLogique } from "../logique";

/**
 * Un texte qui change selon le nombre d'équipes.
 *
 * De 3 à 6 enfants, la mission et l'escape game se jouent à une seule équipe :
 * le kit ne doit alors parler ni des « autres équipes », ni d'un code que
 * personne ne détiendrait en entier. Une chaîne simple sert aux textes qui ne
 * dépendent pas du nombre d'équipes.
 */
export type TexteSelonEquipes = string | { uneEquipe: string; plusieursEquipes: string };

/** Choisit la bonne version d'un texte. */
export function selonEquipes(texte: TexteSelonEquipes, nombreEquipes: number): string {
  if (typeof texte === "string") return texte;
  return nombreEquipes > 1 ? texte.plusieursEquipes : texte.uneEquipe;
}

/** Textes propres à un thème et à un format d'âge. */
export interface TextesFormat {
  /** Titre imprimé en couverture du guide et en haut des cartes. */
  titreKit: string;
  /** Histoire d'introduction, lue à voix haute par l'adulte. */
  histoire: TexteSelonEquipes;
  /** Briefing : ce que l'adulte annonce juste avant le départ. */
  briefing: TexteSelonEquipes;
  /** Petites phrases de réussite, à lire quand une étape est franchie. */
  reussites: string[];
  /** Texte de la page du trésor. */
  tresor: TexteSelonEquipes;
  diplomeTitre: string;
  diplomeTexte: string;
  /** Texte de l'invitation. */
  invitation: string;
}

export interface Theme {
  id: IdTheme;
  nom: string;
  /** Une phrase de présentation, pour le site. */
  accroche: string;
  /** Phrases d'ambiance posées avant la devinette de chaque carte. */
  ambiances: string[];
  /** Trois personnages pour la grille de logique. */
  personnages: string[];
  /** Trois objets pour la grille de logique. */
  objetsLogique: ValeurLogique[];
  /** Icônes de décor, pour les intrus, suites et comptages. */
  icones: CleIcone[];
  formats: Record<IdFormat, TextesFormat>;
}
