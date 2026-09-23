import { z } from "zod";
import { IDS_CACHETTES } from "./cachettes";
import type { Configuration, Duree, IdFormat, IdTheme, SymboleEquipe } from "./types";

export const THEMES: readonly IdTheme[] = ["pirates", "agents", "dinosaures"];
export const DUREES: readonly Duree[] = [30, 45, 60];

export const AGE_MIN = 4;
export const AGE_MAX = 12;
export const ENFANTS_MIN = 3;
export const ENFANTS_MAX = 16;
export const PRENOM_MAX = 20;

/** Âge fêté → format du jeu. Le parent ne choisit jamais le format. */
export function formatPourAge(age: number): IdFormat {
  if (age <= 6) return "chasse";
  if (age <= 9) return "mission";
  return "escape";
}

export const LIBELLES_FORMATS: Record<IdFormat, string> = {
  chasse: "Chasse au trésor",
  mission: "Mission",
  escape: "Escape game",
};

export const LIBELLES_THEMES: Record<IdTheme, string> = {
  pirates: "Pirates",
  agents: "Agents secrets",
  dinosaures: "Dinosaures",
};

export const TRANCHES_AGE: Record<IdFormat, string> = {
  chasse: "4-6 ans",
  mission: "7-9 ans",
  escape: "10-12 ans",
};

/** Nombre d'étapes : entre 4 et 8, selon le format et la durée. */
const ETAPES: Record<IdFormat, Record<Duree, number>> = {
  chasse: { 30: 4, 45: 5, 60: 6 },
  mission: { 30: 5, 45: 6, 60: 7 },
  escape: { 30: 5, 45: 7, 60: 8 },
};

export function nombreEtapes(format: IdFormat, duree: Duree): number {
  return ETAPES[format][duree];
}

/**
 * Nombre d'équipes.
 * En 4-6 ans, un seul groupe mené par l'adulte.
 * Sinon : une équipe jusqu'à 6, deux de 7 à 12, trois de 13 à 16.
 */
export function nombreEquipes(format: IdFormat, nombreEnfants: number): number {
  if (format === "chasse") return 1;
  if (nombreEnfants <= 6) return 1;
  if (nombreEnfants <= 12) return 2;
  return 3;
}

/** Longueur du code final : aucun code en 4-6 ans. */
export function longueurCode(format: IdFormat): number {
  if (format === "chasse") return 0;
  return format === "mission" ? 3 : 4;
}

export const SYMBOLES_EQUIPES: readonly SymboleEquipe[] = ["etoile", "lune", "soleil"];

export const NOMS_EQUIPES: Record<SymboleEquipe, string> = {
  etoile: "Étoile",
  lune: "Lune",
  soleil: "Soleil",
};

/** Cachettes minimum à cocher : au moins une par étape. */
export function cachettesMinimum(format: IdFormat, duree: Duree): number {
  return nombreEtapes(format, duree);
}

// --------------------------------------------------------------------------
// Validation
// --------------------------------------------------------------------------

/**
 * Prénoms acceptés : lettres (accents compris), espaces, tirets, apostrophes.
 * Doit commencer par une lettre. Aucune question sur le genre n'est posée et
 * aucun texte du kit ne s'accorde au genre de l'enfant.
 */
const MOTIF_PRENOM = /^\p{L}[\p{L} '’-]*$/u;

const prenomSchema = z
  .string()
  .trim()
  .min(1, { error: "Merci d'indiquer le prénom de l'enfant." })
  .max(PRENOM_MAX, { error: `Le prénom ne peut pas dépasser ${PRENOM_MAX} caractères.` })
  .refine((valeur) => MOTIF_PRENOM.test(valeur), {
    error: "Le prénom n'accepte que des lettres, des espaces, des tirets et des apostrophes.",
  });

const texteCourt = z.string().trim().max(120).optional();

export const schemaInfosFete = z.object({
  date: texteCourt,
  heure: texteCourt,
  adresse: z.string().trim().max(200).optional(),
  contact: texteCourt,
  invites: z.array(z.string().trim().max(PRENOM_MAX)).max(ENFANTS_MAX).optional(),
});

export const schemaConfiguration = z
  .object({
    theme: z.enum(["pirates", "agents", "dinosaures"], { error: "Merci de choisir un thème." }),
    age: z
      .number({ error: "Merci d'indiquer l'âge fêté." })
      .int({ error: "L'âge doit être un nombre entier." })
      .min(AGE_MIN, { error: `Ce jeu est prévu à partir de ${AGE_MIN} ans.` })
      .max(AGE_MAX, { error: `Ce jeu est prévu jusqu'à ${AGE_MAX} ans.` }),
    prenom: prenomSchema,
    nombreEnfants: z
      .number({ error: "Merci d'indiquer le nombre d'enfants." })
      .int({ error: "Le nombre d'enfants doit être un nombre entier." })
      .min(ENFANTS_MIN, { error: `Il faut au moins ${ENFANTS_MIN} enfants.` })
      .max(ENFANTS_MAX, { error: `Ce jeu est prévu pour ${ENFANTS_MAX} enfants au plus.` }),
    duree: z.union([z.literal(30), z.literal(45), z.literal(60)], {
      error: "Merci de choisir une durée.",
    }),
    cachettes: z
      .array(z.enum(IDS_CACHETTES as [string, ...string[]]), {
        error: "Merci de choisir des cachettes.",
      })
      .min(1, { error: "Merci de choisir au moins une cachette." }),
    fete: schemaInfosFete.optional(),
  })
  .superRefine((valeur, ctx) => {
    const uniques = new Set(valeur.cachettes);
    if (uniques.size !== valeur.cachettes.length) {
      ctx.addIssue({
        code: "custom",
        path: ["cachettes"],
        message: "Une cachette ne peut être choisie qu'une fois.",
      });
      return;
    }
    const format = formatPourAge(valeur.age);
    const minimum = cachettesMinimum(format, valeur.duree);
    if (uniques.size < minimum) {
      ctx.addIssue({
        code: "custom",
        path: ["cachettes"],
        message: `Ce jeu compte ${minimum} étapes : cochez au moins ${minimum} cachettes.`,
      });
    }
  });

export type ConfigurationValidee = z.infer<typeof schemaConfiguration>;

/** Valide et normalise. Lève une erreur si la configuration est invalide. */
export function analyserConfiguration(valeur: unknown): Configuration {
  return schemaConfiguration.parse(valeur) as Configuration;
}

/** Résumé des valeurs déduites de la configuration. */
export interface ReglesPartie {
  format: IdFormat;
  etapes: number;
  equipes: number;
  longueurCode: number;
  minutesParEtape: number;
}

export function reglesPartie(configuration: Configuration): ReglesPartie {
  const format = formatPourAge(configuration.age);
  const etapes = nombreEtapes(format, configuration.duree);
  return {
    format,
    etapes,
    equipes: nombreEquipes(format, configuration.nombreEnfants),
    longueurCode: longueurCode(format),
    minutesParEtape: Math.max(3, Math.round((configuration.duree - 10) / etapes)),
  };
}
