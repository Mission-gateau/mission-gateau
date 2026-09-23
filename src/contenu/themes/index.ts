import { typographier } from "../../engine/texte";
import type { IdTheme } from "../../engine/types";
import { AGENTS } from "./agents";
import { DINOSAURES } from "./dinosaures";
import { PIRATES } from "./pirates";
import type { Theme } from "./types";

export type { TexteSelonEquipes, Theme, TextesFormat } from "./types";
export { selonEquipes } from "./types";

/**
 * Un thème = un fichier. En ajouter un ne touche à aucun code d'énigme :
 * il suffit de créer le fichier, de l'ajouter ici, et de déclarer son id dans
 * src/engine/configuration.ts.
 */
export const THEMES_CONTENU: Record<IdTheme, Theme> = typographier({
  pirates: PIRATES,
  agents: AGENTS,
  dinosaures: DINOSAURES,
});

export const LISTE_THEMES: Theme[] = [
  THEMES_CONTENU.pirates,
  THEMES_CONTENU.agents,
  THEMES_CONTENU.dinosaures,
];

export function theme(id: IdTheme): Theme {
  return THEMES_CONTENU[id];
}
