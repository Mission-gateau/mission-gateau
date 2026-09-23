/**
 * Générateur pseudo-aléatoire déterministe.
 *
 * Même graine + même suite d'appels = mêmes valeurs, sur n'importe quelle
 * machine. C'est ce qui garantit qu'un kit regénéré plus tard avec la même
 * configuration et la même graine est identique à l'aperçu montré au parent.
 */

/** Hachage de chaîne (xmur3) : transforme une graine texte en entier 32 bits. */
function hacher(texte: string): number {
  let h = 1779033703 ^ texte.length;
  for (let i = 0; i < texte.length; i += 1) {
    h = Math.imul(h ^ texte.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** Suite pseudo-aléatoire mulberry32 : rapide, stable, sans dépendance. */
function mulberry32(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Alea {
  readonly graine: string;
  private readonly suivant: () => number;

  constructor(graine: string) {
    this.graine = graine;
    this.suivant = mulberry32(hacher(graine));
  }

  /** Crée un générateur indépendant, dérivé de celui-ci par une étiquette. */
  deriver(etiquette: string | number): Alea {
    return new Alea(`${this.graine}|${etiquette}`);
  }

  /** Flottant dans [0, 1). */
  flottant(): number {
    return this.suivant();
  }

  /** Entier dans [0, maxExclu). */
  entier(maxExclu: number): number {
    return Math.floor(this.suivant() * maxExclu);
  }

  /** Entier dans [min, maxInclus]. */
  entre(min: number, maxInclus: number): number {
    return min + this.entier(maxInclus - min + 1);
  }

  booleen(probabilite = 0.5): boolean {
    return this.suivant() < probabilite;
  }

  choisir<T>(elements: readonly T[]): T {
    if (elements.length === 0) throw new Error("Alea.choisir : liste vide");
    return elements[this.entier(elements.length)]!;
  }

  /** Copie mélangée (Fisher-Yates). L'entrée n'est pas modifiée. */
  melanger<T>(elements: readonly T[]): T[] {
    const copie = [...elements];
    for (let i = copie.length - 1; i > 0; i -= 1) {
      const j = this.entier(i + 1);
      [copie[i], copie[j]] = [copie[j]!, copie[i]!];
    }
    return copie;
  }

  /** n éléments distincts, tirés au hasard. */
  echantillon<T>(elements: readonly T[], n: number): T[] {
    if (n > elements.length) {
      throw new Error(`Alea.echantillon : ${n} demandés pour ${elements.length} disponibles`);
    }
    return this.melanger(elements).slice(0, n);
  }
}

/** Alphabet des graines : sans caractères ambigus (0/O, 1/l/I). */
const ALPHABET_GRAINE = "23456789abcdefghjkmnpqrstuvwxyz";
const LONGUEUR_GRAINE = 10;

/** Tire une graine nouvelle. Appelé une seule fois, au moment de l'aperçu. */
export function creerGraine(hasard: () => number = Math.random): string {
  let graine = "";
  for (let i = 0; i < LONGUEUR_GRAINE; i += 1) {
    graine += ALPHABET_GRAINE[Math.floor(hasard() * ALPHABET_GRAINE.length)];
  }
  return graine;
}

const MOTIF_GRAINE = new RegExp(`^[${ALPHABET_GRAINE}]{${LONGUEUR_GRAINE}}$`);

export function graineValide(valeur: string): boolean {
  return MOTIF_GRAINE.test(valeur);
}
