import { CONSIGNES, MESSAGES_FINAUX, SOLUTIONS, TITRES } from "@/contenu/consignes";
import { DEVINETTES } from "@/contenu/devinettes";
import { GUIDE } from "@/contenu/guide";
import { GABARITS_INDICES, INDICES_CACHETTES } from "@/contenu/indices";
import { GABARITS_LOGIQUE } from "@/contenu/logique";
import { FORMULAIRE } from "@/contenu/formulaire";
import { CREDITS, SITE } from "@/contenu/site";
import { LISTE_THEMES } from "@/contenu/themes";

export interface TexteRepere {
  chemin: string;
  texte: string;
}

function parcourir(valeur: unknown, chemin: string, resultat: TexteRepere[]): void {
  if (typeof valeur === "string") {
    resultat.push({ chemin, texte: valeur });
    return;
  }
  if (Array.isArray(valeur)) {
    valeur.forEach((element, index) => parcourir(element, `${chemin}[${index}]`, resultat));
    return;
  }
  if (valeur && typeof valeur === "object") {
    for (const [cle, sous] of Object.entries(valeur)) {
      parcourir(sous, chemin ? `${chemin}.${cle}` : cle, resultat);
    }
  }
}

/** Tous les textes des fichiers de contenu, avec leur chemin d'origine. */
export function tousLesTextes(): TexteRepere[] {
  const resultat: TexteRepere[] = [];
  const sources: [string, unknown][] = [
    ["consignes", CONSIGNES],
    ["titres", TITRES],
    ["solutions", SOLUTIONS],
    ["messagesFinaux", MESSAGES_FINAUX],
    ["devinettes", DEVINETTES],
    ["guide", GUIDE],
    ["indices", INDICES_CACHETTES],
    ["gabaritsIndices", GABARITS_INDICES],
    ["gabaritsLogique", GABARITS_LOGIQUE],
    ["formulaire", FORMULAIRE],
    ["site", SITE],
    ["credits", CREDITS],
    ["themes", LISTE_THEMES],
  ];
  for (const [nom, valeur] of sources) parcourir(valeur, nom, resultat);
  return resultat;
}

/**
 * Les textes de prose : on écarte les identifiants techniques, les adresses
 * et les prénoms inventés des personnages, qui ne sont pas des phrases.
 */
export function textesDeProse(): TexteRepere[] {
  return tousLesTextes().filter(
    ({ chemin, texte }) =>
      !/\.(id|cle|icone|icones|lien|lienLicence|codePoint|court|personnages)\b/.test(chemin) &&
      !/^https?:/.test(texte) &&
      texte.trim().length > 0,
  );
}

/** Les prénoms de personnages, vérifiés à part : ce sont des noms propres. */
export function personnagesDesThemes(): string[] {
  return LISTE_THEMES.flatMap((theme) => theme.personnages);
}
