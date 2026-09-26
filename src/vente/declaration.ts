import { z } from "zod";
import { referenceValide, sessionValide } from "./reference";

/**
 * Les entrées de la fonction « Renoncer au contrat ici », vérifiées de la
 * même façon par le formulaire (dans le navigateur) et par la route (zod).
 * Ce module ne dépend que de zod : le formulaire l'importe tel quel.
 *
 * - Référence : exactement 22 caractères `A-Z a-z 0-9 _ -`, ou tout texte
 *   dont le chemin contient `/commande/<référence>` (le lien de la page de la
 *   commande, collé). Seule la référence extraite est gardée : l'accusé et la
 *   page ne reprennent jamais le texte saisi.
 * - Nom et prénom, après normalisation NFC : 1 à 60 caractères, lettres de
 *   toute écriture (`\p{L}` et leurs signes combinants `\p{M}`), espaces,
 *   apostrophes (' et ’) et traits d'union, avec au moins une lettre. Ni
 *   chiffre, ni `@`, ni `:`, ni `/`, ni point, ni caractère de contrôle ou de
 *   mise en forme (dont ceux qui changent le sens de lecture) : un nom ne peut
 *   porter ni lien, ni adresse, ni texte déguisé.
 * - E-mail : 254 caractères au plus.
 */

export const LONGUEUR_MAX_NOM = 60;
export const LONGUEUR_MAX_EMAIL = 254;
/** Le lien d'une commande, avec son `?session_id=` de Stripe, tient largement dans 300 caractères. */
export const LONGUEUR_MAX_REFERENCE = 300;

/** Un nom tel qu'il est gardé : forme NFC, sans espace autour. */
export function normaliserNom(saisie: string): string {
  return saisie.normalize("NFC").trim();
}

const CARACTERES_DU_NOM = /^[\p{L}\p{M}' ’-]+$/u;

/** Le nom (ou le prénom), déjà normalisé, est-il acceptable ? */
export function nomValide(nom: string): boolean {
  const longueur = Array.from(nom).length;
  return longueur >= 1 && longueur <= LONGUEUR_MAX_NOM && CARACTERES_DU_NOM.test(nom) && /\p{L}/u.test(nom);
}

/**
 * La référence d'une commande dans ce qu'a saisi l'acheteur : la référence
 * seule, ou un texte dont un lien a un chemin (ce qui précède `?` et `#`)
 * qui contient `/commande/<référence>`. Null si rien n'y ressemble, ou si le
 * texte porte un caractère de contrôle ou de mise en forme.
 */
export function extraireReference(saisie: string): string | null {
  const propre = saisie.trim();
  if (propre.length > LONGUEUR_MAX_REFERENCE || /[\p{Cc}\p{Cf}]/u.test(propre)) return null;
  const seule = referenceValide(propre) ? propre : null;
  if (seule) return seule;
  for (const morceau of propre.split(/\s+/)) {
    const chemin = morceau.split(/[?#]/)[0]!;
    const trouve = /\/commande\/([A-Za-z0-9_-]{22})(?:\/|$)/.exec(chemin);
    if (trouve && referenceValide(trouve[1])) return trouve[1];
  }
  return null;
}

/** L'adresse e-mail, sans espace autour. */
export function normaliserEmail(saisie: string): string {
  return saisie.trim();
}

const schemaEmail = z.email();

export function emailValide(email: string): boolean {
  return email.length <= LONGUEUR_MAX_EMAIL && schemaEmail.safeParse(email).success;
}

export type ChampDeclaration = "nom" | "prenom" | "reference" | "email";

/** Une déclaration telle que la fonction de rétractation la reçoit et la garde : champs normalisés, référence extraite. */
export interface Declaration {
  nom: string;
  prenom: string;
  /** La référence extraite de ce qui a été saisi. */
  reference: string;
  email: string;
}

/** Les champs refusés d'une saisie, dans l'ordre du formulaire ; vide si tout va bien. */
export function champsRefuses(saisie: { nom: string; prenom: string; reference: string; email: string }): ChampDeclaration[] {
  const refuses: ChampDeclaration[] = [];
  if (!nomValide(normaliserNom(saisie.nom))) refuses.push("nom");
  if (!nomValide(normaliserNom(saisie.prenom))) refuses.push("prenom");
  if (extraireReference(saisie.reference) === null) refuses.push("reference");
  if (!emailValide(normaliserEmail(saisie.email))) refuses.push("email");
  return refuses;
}

const champNom = z
  .string()
  .max(4 * LONGUEUR_MAX_NOM)
  .transform(normaliserNom)
  .refine(nomValide);

/**
 * Ce que le formulaire envoie. `session_id` (facultatif) vient du lien
 * « Renoncer au contrat ici » de la page de la commande ; `champ_libre` est le
 * piège à robots : un humain le laisse vide.
 */
export const schemaDeclaration = z
  .object({
    nom: champNom,
    prenom: champNom,
    reference: z
      .string()
      .max(LONGUEUR_MAX_REFERENCE + 20)
      .transform((saisie, contexte) => {
        const reference = extraireReference(saisie);
        if (reference === null) {
          contexte.addIssue({ code: "custom", message: "référence" });
          return z.NEVER;
        }
        return reference;
      }),
    email: z.string().max(LONGUEUR_MAX_EMAIL + 20).transform(normaliserEmail).refine(emailValide),
    session_id: z.string().refine(sessionValide).optional(),
    champ_libre: z.string().max(500).optional(),
  })
  .strict();
