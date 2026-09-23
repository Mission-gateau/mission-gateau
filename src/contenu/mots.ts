/**
 * Réservoir de mots pour les mots mêlés.
 *
 * Tous sans accent : une grille de mots mêlés s'écrit en capitales non
 * accentuées, et la liste imprimée doit rester du français correct. Un test
 * passe chaque mot au correcteur orthographique et vérifie qu'aucun ne
 * coïncide avec un mot-clé de cachette (ce qui rendrait une grille ambiguë).
 */
export const MOTS_GRILLE: readonly string[] = [
  // 3 lettres
  "MER", "SAC", "RAT", "LAC", "FIL", "NID", "POT", "CRI", "JEU", "EAU",
  "ROC", "MUR", "RUE", "TAS", "VOL", "ZOO", "AMI", "ART", "BUS", "PIC",
  "SOL", "VER", "NEZ", "BOL", "DUO", "CAP", "LOI", "TRI", "OIE", "RIZ",
  "DOS", "BEC", "AIL", "BAS",
  // 4 lettres
  "LUNE", "ROSE", "PONT", "TOUR", "NUIT", "VENT", "PORT", "MAIN", "PIED",
  "CIEL", "BOIS", "LOUP", "OURS", "CHAT", "SAUT", "CAVE", "GANT", "BANC",
  "SEAU", "DENT", "POIL", "NOIX", "PAIN", "MIEL", "SOIR", "JOUR", "MOIS",
  "CUBE", "RAIL", "TOIT", "MOTO", "AILE", "LION", "NAGE", "PUMA", "ROIS",
  // 5 lettres
  "VOILE", "SABLE", "CORDE", "TRAIN", "PLAGE", "ROUTE", "MAGIE", "NUAGE",
  "PIANO", "ROBOT", "TIGRE", "FLEUR", "ARBRE", "POMME", "SINGE", "PLUME",
  "CRABE", "PERLE", "CARTE", "CANOT", "PISTE", "TRACE", "SIGNE", "ROCHE",
  "MARIN", "PHARE", "VAGUE", "BILLE", "CANNE", "RADIS", "LAINE", "LAMPE",
  "MALLE", "NOTES", "CADRE", "PLANS", "VILLE", "HIBOU",
  // 6 lettres
  "BATEAU", "SOLEIL", "JARDIN", "MAISON", "ORANGE", "BALLON", "CANARD",
  "SOURIS", "BANANE", "CARTON", "CHEVAL", "DRAGON", "MOUTON", "NAVIRE",
  "TORCHE", "GROTTE", "INDICE", "RENARD", "LAPINS", "PIRATE", "MARINS",
  "VOYAGE", "RADEAU", "MOUSSE", "CABANE", "CASQUE", "GRELOT", "MIROIR",
  "MOULIN", "POTION", "RUBANS", "VALISE", "VOLCAN", "ANIMAL", "TORTUE",
  // 7 lettres
  "POISSON", "CHAPEAU", "CADENAS", "DRAPEAU", "SERPENT", "CAVERNE",
  "SIFFLET", "SENTIER", "COLLINE", "BALEINE", "MOUETTE", "GALOPER",
  "CAPTURE", "SIGNAUX", "TRAJETS", "VOYAGES", "PARASOL",
  // 8 lettres
  "BOUSSOLE", "BOUCLIER", "MARMOTTE", "COQUILLE", "PLONGEUR", "NAVIGUER",
  "AVENTURE", "MONTAGNE", "TRAVERSE", "GRIMPEUR", "CARAVANE", "CASCADES",
  "COLLIERS", "HORIZONS", "LUNETTES", "SARDINES", "TREMPLIN", "VOILIERS",
];
