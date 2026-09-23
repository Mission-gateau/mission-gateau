/** Petites manipulations de texte, partagées par le moteur et les tests. */

/** Retire les accents (é → e) sans toucher au reste. */
export function sansAccents(texte: string): string {
  return texte.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Majuscules sans accent, sans espace : la forme des réponses d'énigmes. */
export function formeReponse(texte: string): string {
  return sansAccents(texte).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Comparaison souple : casse et accents ignorés. */
export function memeMot(a: string, b: string): boolean {
  return formeReponse(a) === formeReponse(b);
}

/**
 * Remplace les gabarits {cle} d'un texte.
 * Lève une erreur si un gabarit reste non résolu : un test le vérifie sur
 * l'ensemble des textes produits.
 */
export function remplir(gabarit: string, valeurs: Record<string, string | number>): string {
  const resultat = gabarit.replace(/\{(\w+)\}/g, (_, cle: string) => {
    const valeur = valeurs[cle];
    if (valeur === undefined) throw new Error(`Gabarit non résolu : {${cle}}`);
    return String(valeur);
  });
  if (/\{\w+\}/.test(resultat)) throw new Error(`Gabarit non résolu dans : ${resultat}`);
  return resultat;
}

/** Une apostrophe typographique partout, jamais l'apostrophe droite. */
export function apostrophes(texte: string): string {
  return texte.replace(/'/g, "’");
}

export const LETTRES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Typographie française : espace insécable avant la ponctuation double.
 *
 * Sans cela, « dans la maison ! Viens » peut se couper entre « maison » et
 * « ! », ce qui laisse un point d'exclamation orphelin en début de ligne.
 * L'espace insécable U+00A0 est employée plutôt que la fine U+202F, car
 * toutes les polices ne dessinent pas la seconde.
 */
export function typographie(texte: string): string {
  return texte
    .replace(/ +([!?;:»])/g, " $1")
    .replace(/(«) +/g, "$1 ");
}

/**
 * Applique la typographie à toutes les chaînes d'une structure, en gardant
 * sa forme. Les fichiers de contenu s'exportent à travers cette fonction :
 * le site et les PDF reçoivent ainsi des textes déjà corrects, sans avoir à
 * y penser à chaque endroit où ils sont affichés.
 */
export function typographier<T>(valeur: T): T {
  if (typeof valeur === "string") return typographie(valeur) as T;
  if (Array.isArray(valeur)) return valeur.map((element) => typographier(element)) as T;
  if (valeur && typeof valeur === "object") {
    const resultat: Record<string, unknown> = {};
    for (const [cle, sous] of Object.entries(valeur)) resultat[cle] = typographier(sous);
    return resultat as T;
  }
  return valeur;
}
