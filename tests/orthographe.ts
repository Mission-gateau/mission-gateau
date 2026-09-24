import nspell from "nspell";
import dictionnaire from "dictionary-fr";

/**
 * Correcteur orthographique français des tests.
 *
 * nspell (MIT) et dictionary-fr (MPL-2.0) sont des dépendances de
 * développement : elles servent ici et ne partent jamais en production.
 */
let correcteur: ReturnType<typeof nspell> | null = null;

function instance() {
  correcteur ??= nspell(dictionnaire as never);
  return correcteur;
}

/**
 * Liste blanche. Chaque entrée est là pour une raison précise : le
 * dictionnaire français ne contient ni les noms propres, ni les noms de
 * projets, ni les personnages que nous inventons.
 */
export const LISTE_BLANCHE = new Set(
  [
    // Nom du produit et son adresse.
    "missiongateau",
    // Polices, licences et projets cités sur la page des crédits.
    "Fredoka", "Nunito", "Noto", "Emoji", "Apache", "License", "SIL", "LLC", "PNG", "BY", "SA",
    // Auteurs des polices, tels qu'ils signent leur travail.
    "Cyreal", "Hafontia", "Brandão", "Bailly",
    // Personnages et lieux inventés pour les histoires.
    "Rovan", "Sorel", "Vermeil",
    // Terme anglais passé dans l'usage courant, employé tel quel.
    "game",
    // Forme que le dictionnaire ne reconnaît qu'entière.
    "aujourd'hui",
    // Entreprises nommées dans les pages légales : le prestataire de paiement
    // (Stripe Payments Europe, Limited ; Stripe, Inc.), l'hébergeur (Vercel
    // Inc.), et les portefeuilles Apple Pay et Google Pay.
    "Stripe", "Payments", "Limited", "Vercel", "Inc", "Pay",
    // Sigles juridiques : entrepreneur individuel, Code général des impôts,
    // registre du commerce, règlement général sur la protection des données.
    "EI", "CGI", "RCS", "RGPD",
    // Nom technique du stockage de l'onglet, cité dans la politique de confidentialité.
    "sessionStorage",
    // Suffixe ordinal de « 1er ».
    "er",
  ].map((mot) => mot.toLowerCase()),
);

/** Un mot est accepté s'il est connu, en l'état ou en minuscules. */
function connuTelQuel(mot: string): boolean {
  const spell = instance();
  return spell.correct(mot) || spell.correct(mot.toLowerCase());
}

/**
 * Vérifie un mot.
 *
 * Le français compose beaucoup : « apportez-moi », « fête-t-on »,
 * « l'équipage », « aujourd'hui ». On essaie donc le mot entier, puis ses
 * morceaux séparés par une apostrophe ou un trait d'union.
 */
export function motCorrect(mot: string): boolean {
  if (mot.length < 2) return true;
  if (LISTE_BLANCHE.has(mot.toLowerCase())) return true;
  if (connuTelQuel(mot)) return true;
  const morceaux = mot.split(/['’-]/).filter((m) => m.length > 1);
  if (morceaux.length < 2) return false;
  return morceaux.every((morceau) => LISTE_BLANCHE.has(morceau.toLowerCase()) || connuTelQuel(morceau));
}

/** Découpe un texte en mots à vérifier. */
export function motsDe(texte: string): string[] {
  return texte
    // Les gabarits {prenom} sont remplacés au moment de la génération.
    .replace(/\{\w+\}/g, " ")
    // Adresses électroniques, adresses et noms de domaine.
    .replace(/\S+@\S+/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b[\w-]+\.(com|fr|org|net)\b/g, " ")
    .split(/[^\p{L}'’-]+/u)
    .map((mot) => mot.replace(/^[-'’]+|[-'’]+$/g, ""))
    .filter((mot) => mot.length > 1);
}

/** Les mots d'un texte que le correcteur ne reconnaît pas. */
export function fautes(texte: string): string[] {
  return motsDe(texte).filter((mot) => !motCorrect(mot));
}
