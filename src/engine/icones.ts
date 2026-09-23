/**
 * Catalogue des icônes.
 *
 * Chaque icône est un fichier PNG servi par le site (`/icones/<cle>.png`),
 * téléchargé une fois par `npm run assets` depuis Noto Emoji (Apache-2.0).
 * Les émojis ne sont jamais rendus comme du texte : ni dans le site, ni dans
 * les PDF. Le « point de code » sert uniquement au script de téléchargement.
 */

export interface DefinitionIcone {
  /** Point(s) de code Unicode, tels que Noto Emoji nomme ses fichiers. */
  codePoint: string;
  /** Nom français, lu par les lecteurs d'écran et imprimé dans les légendes. */
  libelle: string;
}

export const ICONES = {
  // ---- cachettes -----------------------------------------------------------
  canape: { codePoint: "1f6cb", libelle: "canapé" },
  coussin: { codePoint: "1fab6", libelle: "plume" },
  table: { codePoint: "1f37d", libelle: "assiette" },
  chaise: { codePoint: "1fa91", libelle: "chaise" },
  lit: { codePoint: "1f6cf", libelle: "lit" },
  oreiller: { codePoint: "1f4a4", libelle: "sommeil" },
  tapis: { codePoint: "1f9f6", libelle: "pelote de laine" },
  rideau: { codePoint: "1fa9f", libelle: "fenêtre" },
  porte: { codePoint: "1f6aa", libelle: "porte" },
  livre: { codePoint: "1f4da", libelle: "livres" },
  frigo: { codePoint: "1f9ca", libelle: "glaçon" },
  panier: { codePoint: "1f9fa", libelle: "panier" },
  boite: { codePoint: "1f4e6", libelle: "carton" },
  crayons: { codePoint: "1f58d", libelle: "crayon de couleur" },
  torchon: { codePoint: "1f9fd", libelle: "éponge" },
  marmite: { codePoint: "1f372", libelle: "marmite" },
  cartable: { codePoint: "1f392", libelle: "cartable" },
  manteau: { codePoint: "1f9e5", libelle: "manteau" },
  jouets: { codePoint: "1f9f8", libelle: "ours en peluche" },
  fruits: { codePoint: "1f34e", libelle: "pomme" },

  // ---- symboles d'équipe ---------------------------------------------------
  etoile: { codePoint: "2b50", libelle: "étoile" },
  lune: { codePoint: "1f319", libelle: "lune" },
  soleil: { codePoint: "2600", libelle: "soleil" },

  // ---- trésor, diplôme, matériel ------------------------------------------
  gateau: { codePoint: "1f382", libelle: "gâteau" },
  cadeau: { codePoint: "1f381", libelle: "cadeau" },
  medaille: { codePoint: "1f3c5", libelle: "médaille" },
  coupe: { codePoint: "1f3c6", libelle: "coupe" },
  ciseaux: { codePoint: "2702", libelle: "ciseaux" },
  trombone: { codePoint: "1f4ce", libelle: "trombone" },
  enveloppe: { codePoint: "2709", libelle: "enveloppe" },
  cadenas: { codePoint: "1f512", libelle: "cadenas" },

  // ---- alphabet de pictogrammes (une icône par lettre) --------------------
  lettre_a: { codePoint: "1f34d", libelle: "ananas" },
  lettre_b: { codePoint: "1f34c", libelle: "banane" },
  lettre_c: { codePoint: "1f335", libelle: "cactus" },
  lettre_d: { codePoint: "1f42c", libelle: "dauphin" },
  lettre_e: { codePoint: "1f418", libelle: "éléphant" },
  lettre_f: { codePoint: "1f353", libelle: "fraise" },
  lettre_g: { codePoint: "1f3b8", libelle: "guitare" },
  lettre_h: { codePoint: "1f994", libelle: "hérisson" },
  lettre_i: { codePoint: "1f3dd", libelle: "île" },
  lettre_j: { codePoint: "1f0cf", libelle: "joker" },
  lettre_k: { codePoint: "1f95d", libelle: "kiwi" },
  lettre_l: { codePoint: "1f981", libelle: "lion" },
  lettre_m: { codePoint: "1f3d4", libelle: "montagne" },
  lettre_n: { codePoint: "2744", libelle: "neige" },
  lettre_o: { codePoint: "1f43b", libelle: "ours" },
  lettre_p: { codePoint: "1f355", libelle: "pizza" },
  lettre_q: { codePoint: "1f3b3", libelle: "quilles" },
  lettre_r: { codePoint: "1f916", libelle: "robot" },
  lettre_s: { codePoint: "1f40d", libelle: "serpent" },
  lettre_t: { codePoint: "1f422", libelle: "tortue" },
  lettre_u: { codePoint: "1f3ed", libelle: "usine" },
  lettre_v: { codePoint: "1f30b", libelle: "volcan" },
  lettre_w: { codePoint: "1f683", libelle: "wagon" },
  lettre_x: { codePoint: "1fa97", libelle: "accordéon" },
  lettre_y: { codePoint: "1f9d8", libelle: "yoga" },
  lettre_z: { codePoint: "1f993", libelle: "zèbre" },

  // ---- décor des thèmes ----------------------------------------------------
  ancre: { codePoint: "2693", libelle: "ancre" },
  perroquet: { codePoint: "1f99c", libelle: "perroquet" },
  carte_tresor: { codePoint: "1f5fa", libelle: "carte" },
  boussole: { codePoint: "1f9ed", libelle: "boussole" },
  voilier: { codePoint: "26f5", libelle: "voilier" },
  coquillage: { codePoint: "1f41a", libelle: "coquillage" },
  crabe: { codePoint: "1f980", libelle: "crabe" },
  poisson: { codePoint: "1f420", libelle: "poisson" },

  loupe: { codePoint: "1f50d", libelle: "loupe" },
  cle: { codePoint: "1f511", libelle: "clé" },
  valise: { codePoint: "1f4bc", libelle: "valise" },
  lampe: { codePoint: "1f526", libelle: "lampe de poche" },
  radio: { codePoint: "1f4fb", libelle: "radio" },
  satellite: { codePoint: "1f4e1", libelle: "antenne" },
  chapeau: { codePoint: "1f3a9", libelle: "chapeau" },
  montre: { codePoint: "231a", libelle: "montre" },

  dinosaure: { codePoint: "1f995", libelle: "dinosaure" },
  tyrannosaure: { codePoint: "1f996", libelle: "tyrannosaure" },
  oeuf: { codePoint: "1f95a", libelle: "œuf" },
  os: { codePoint: "1f9b4", libelle: "os" },
  feuille: { codePoint: "1f343", libelle: "feuille" },
  palmier: { codePoint: "1f334", libelle: "palmier" },
  empreinte: { codePoint: "1f43e", libelle: "empreintes" },
  meteore: { codePoint: "2604", libelle: "comète" },
} as const satisfies Record<string, DefinitionIcone>;

export type CleIcone = keyof typeof ICONES;

export const CLES_ICONES = Object.keys(ICONES) as CleIcone[];

export function libelleIcone(cle: string): string {
  const def = (ICONES as Record<string, DefinitionIcone | undefined>)[cle];
  if (!def) throw new Error(`Icône inconnue : ${cle}`);
  return def.libelle;
}

export function cheminIcone(cle: string): string {
  return `/icones/${cle}.png`;
}

/** Lettre → clé d'icône, pour l'alphabet de pictogrammes. */
export const ALPHABET_PICTO: Record<string, CleIcone> = Object.fromEntries(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((lettre) => [
    lettre,
    `lettre_${lettre.toLowerCase()}` as CleIcone,
  ]),
);

/** Icônes de décor propres à chaque thème (intrus, suites, comptages). */
export const ICONES_THEME: Record<string, CleIcone[]> = {
  pirates: ["ancre", "perroquet", "carte_tresor", "boussole", "voilier", "coquillage", "crabe", "poisson"],
  agents: ["loupe", "cle", "valise", "lampe", "radio", "satellite", "chapeau", "montre"],
  dinosaures: ["dinosaure", "tyrannosaure", "oeuf", "os", "feuille", "palmier", "empreinte", "meteore"],
};
