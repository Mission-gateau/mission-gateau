/**
 * Types du moteur. Ce dossier est du TypeScript pur : il ne connaît ni
 * Next.js, ni React, et peut être testé seul.
 */

export type IdTheme = "pirates" | "agents" | "dinosaures";

/** Le format découle de l'âge fêté, il n'est jamais choisi directement. */
export type IdFormat = "chasse" | "mission" | "escape";

export type Duree = 30 | 45 | 60;

export type SymboleEquipe = "etoile" | "lune" | "soleil";

/** Ce que le parent remplit dans le formulaire. */
export interface Configuration {
  theme: IdTheme;
  age: number;
  prenom: string;
  nombreEnfants: number;
  duree: Duree;
  cachettes: string[];
  fete?: InfosFete;
}

/** Facultatif : sert aux invitations et aux diplômes. */
export interface InfosFete {
  date?: string;
  heure?: string;
  adresse?: string;
  contact?: string;
  invites?: string[];
}

/** Une cachette du catalogue fermé. */
export interface Cachette {
  id: string;
  /** Libellé complet, tel qu'il apparaît dans le plan de pose. */
  libelle: string;
  /** Mot-réponse en majuscules non accentuées, 8 lettres au plus. */
  motCle: string;
  /** Clé d'icône (voir src/engine/icones.ts). */
  icone: string;
  /** Pièce, pour regrouper la liste du formulaire. */
  piece: "salon" | "chambre" | "cuisine" | "entree";
  /** Cochée d'avance dans le formulaire. */
  preselectionnee: boolean;
}

// --------------------------------------------------------------------------
// Énigmes
// --------------------------------------------------------------------------

export type RoleEnigme = "navigation" | "code" | "bonus";

export interface BaseEnigme {
  id: string;
  titre: string;
  consigne: string;
  /** Réponse attendue, en majuscules non accentuées (ou un chiffre). */
  reponse: string;
  role: RoleEnigme;
  /** true = trop grande pour une carte, imprimée sur une fiche à part. */
  surFiche: boolean;
  /** Phrase de solution, pour la page réservée à l'adulte. */
  solution: string;
}

export interface Labyrinthe {
  largeur: number;
  hauteur: number;
  /** murs[y][x] : murs à droite et en bas de la case. */
  murs: { droite: boolean; bas: boolean }[][];
  depart: [number, number];
  arrivee: [number, number];
  /** Chemin unique départ → arrivée, calculé par le solveur. */
  chemin: [number, number][];
}

export interface GrilleLogiqueColonne {
  titre: string;
  valeurs: string[];
}

/**
 * Indices de la grille de logique, sous forme exploitable.
 * Le texte imprimé en est la traduction mot à mot : le solveur travaille donc
 * exactement sur ce que l'enfant lit.
 */
export type IndiceLogique =
  | { type: "pasValeur"; ligne: number; colonne: number; valeur: number }
  | { type: "lien"; colonneA: number; valeurA: number; colonneB: number; valeurB: number }
  | { type: "pasLien"; colonneA: number; valeurA: number; colonneB: number; valeurB: number }
  | { type: "compare"; ligneA: number; ligneB: number; colonne: number };

export type Enigme =
  | (BaseEnigme & { type: "devinette"; texte: string })
  | (BaseEnigme & {
      type: "intrus";
      grille: string[][];
      icone: string;
      iconeIntrus: string;
      position: [number, number];
    })
  | (BaseEnigme & {
      type: "suite";
      motif: string[];
      affichee: (string | null)[];
      choix: string[];
      indexManquant: number;
    })
  | (BaseEnigme & { type: "comptage"; grille: string[][]; iconeCible: string; total: number })
  | (BaseEnigme & { type: "labyrinthe"; labyrinthe: Labyrinthe })
  | (BaseEnigme & {
      type: "pictogrammes";
      legende: { lettre: string; icone: string }[];
      suite: string[];
    })
  | (BaseEnigme & { type: "calcul"; lignes: string[]; expression: string })
  | (BaseEnigme & {
      type: "motsmeles";
      taille: number;
      grille: string[][];
      mots: string[];
      /** Cases occupées par les mots : sert à la vérification et aux solutions. */
      placements: { mot: string; cases: [number, number][] }[];
    })
  | (BaseEnigme & { type: "miroir"; texteMiroir: string })
  | (BaseEnigme & {
      type: "cesar";
      texteChiffre: string;
      decalage: number;
      origineDecalage: string;
    })
  | (BaseEnigme & {
      type: "sudoku";
      taille: 4 | 6;
      blocLargeur: number;
      blocHauteur: number;
      grille: (number | null)[][];
      /** Grille résolue. Nommée à part : `solution` est déjà le texte adulte. */
      grilleSolution: number[][];
      caseCle: [number, number];
    })
  | (BaseEnigme & {
      type: "logique";
      lignes: string[];
      colonnes: GrilleLogiqueColonne[];
      indices: string[];
      indicesStructures: IndiceLogique[];
      /** attribution[i][c] = index de la valeur de la colonne c pour la ligne i. */
      attribution: number[][];
      /** Ligne dont on demande la valeur, et colonne concernée. */
      ligneQuestion: number;
      colonneQuestion: number;
      question: string;
    })
  | (BaseEnigme & { type: "morse"; codes: string[]; legende: { lettre: string; code: string }[] });

export type TypeEnigme = Enigme["type"];

// --------------------------------------------------------------------------
// Parcours et kit
// --------------------------------------------------------------------------

export interface Etape {
  /** 1 pour la première étape. */
  numero: number;
  /** Cachette où sont posées les cartes de cette étape. */
  cachette: string;
  /** Cachette de l'étape suivante, ou null si la carte mène au trésor. */
  cachetteSuivante: string | null;
}

export interface Carte {
  etape: number;
  cachette: string;
  /** Phrase d'ambiance du thème, imprimée avant l'énigme. */
  ambiance: string;
  /** Mène à la cachette suivante. null sur la dernière carte. */
  navigation: Enigme | null;
  /** Donne un chiffre du code final. */
  code: Enigme | null;
  /** Énigme d'agrément, sans conséquence sur le parcours. */
  bonus: Enigme | null;
  versTresor: boolean;
  /** Texte de la dernière carte, celle qui renvoie au maître du jeu. */
  messageFinal: string | null;
}

export interface ChiffreCode {
  /** Position dans le code final, à partir de 1. */
  position: number;
  etape: number;
  chiffre: number;
}

export interface Equipe {
  id: string;
  nom: string;
  symbole: SymboleEquipe;
  cartes: Carte[];
  chiffres: ChiffreCode[];
}

export interface Kit {
  /** Version du format de kit : change si la structure évolue. */
  version: string;
  graine: string;
  configuration: Configuration;
  format: IdFormat;
  etapes: Etape[];
  /** Devinette du départ, lue à voix haute : elle désigne la cachette n° 1. */
  depart: Enigme;
  equipes: Equipe[];
  /** null en 4-6 ans : la dernière carte mène directement au trésor. */
  codeFinal: string | null;
  /** Nombre d'invitations à imprimer (nombre d'enfants moins un). */
  nombreInvitations: number;
  /** Durée conseillée de chaque étape, en minutes. */
  minutesParEtape: number;
}
