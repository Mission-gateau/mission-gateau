/**
 * nspell n'expose pas de types. Seule la petite part que les tests emploient
 * est déclarée ici : le correcteur sert uniquement en développement.
 */
declare module "nspell" {
  interface Dictionnaire {
    aff: Uint8Array;
    dic: Uint8Array;
  }
  interface Correcteur {
    correct(mot: string): boolean;
    suggest(mot: string): string[];
    add(mot: string): Correcteur;
  }
  export default function nspell(dictionnaire: Dictionnaire | Dictionnaire[]): Correcteur;
}
