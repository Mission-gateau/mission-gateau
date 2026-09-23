import type { CleIcone } from "../../engine/icones";
import type { IdFormat, IdTheme } from "../../engine/types";
import type { ValeurLogique } from "../logique";

/** Textes propres à un thème et à un format d'âge. */
export interface TextesFormat {
  /** Titre imprimé en couverture du guide et en haut des cartes. */
  titreKit: string;
  /** Histoire d'introduction, lue à voix haute par l'adulte. */
  histoire: string;
  /** Briefing : ce que l'adulte annonce juste avant le départ. */
  briefing: string;
  /** Petites phrases de réussite, à lire quand une étape est franchie. */
  reussites: string[];
  /** Texte de la page du trésor. */
  tresor: string;
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
