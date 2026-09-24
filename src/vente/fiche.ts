import type { Adresse, FicheVendeur } from "../contenu/vendeur";

/**
 * Lecture de la fiche du vendeur : ce qui est obligatoire, et comment
 * l'afficher. La fiche elle-même vit dans src/contenu/vendeur.ts.
 */

/**
 * Champs sans lesquels la vente ne peut pas ouvrir. Le RCS et le capital sont
 * facultatifs ; tout le reste est exigé par les mentions légales, les CGV ou
 * la facture.
 */
export const CHAMPS_OBLIGATOIRES = [
  "nom",
  "mention",
  "statut",
  "nomCommercial",
  "directeurPublication",
  "siret",
  "adresse.rue",
  "adresse.codePostal",
  "adresse.ville",
  "adresse.pays",
  "telephone",
  "email",
  "tva",
  "mediateur.nom",
  "mediateur.adresse",
  "mediateur.site",
  "hebergeur.nom",
  "hebergeur.adresse",
  "hebergeur.telephone",
  "hebergeur.site",
  "paiement.nom",
  "paiement.adresse",
] as const;

function valeur(fiche: FicheVendeur, chemin: string): unknown {
  return chemin.split(".").reduce<unknown>(
    (objet, cle) => (objet && typeof objet === "object" ? (objet as Record<string, unknown>)[cle] : undefined),
    fiche,
  );
}

/** Ce qui manque à la fiche pour ouvrir la vente. Vide quand tout y est. */
export function manquesDeLaFiche(fiche: FicheVendeur): string[] {
  const manques: string[] = CHAMPS_OBLIGATOIRES.filter((chemin) => {
    const v = valeur(fiche, chemin);
    return typeof v !== "string" || v.trim() === "";
  });
  if (!/^\d{14}$/.test(fiche.siret.replace(/\s/g, "")) && !manques.includes("siret")) manques.push("siret");
  if (fiche.mediateur.conventionSignee !== true) manques.push("mediateur.conventionSignee");
  return manques;
}

export function ficheComplete(fiche: FicheVendeur): boolean {
  return manquesDeLaFiche(fiche).length === 0;
}

/** « Quentin Courtois EI » : le nom et sa mention, accolés. */
export function denomination(fiche: FicheVendeur): string {
  return [fiche.nom.trim(), fiche.mention.trim()].filter(Boolean).join(" ");
}

export function adresseSurUneLigne(adresse: Adresse): string {
  const ville = [adresse.codePostal.trim(), adresse.ville.trim()].filter(Boolean).join(" ");
  return [adresse.rue.trim(), ville, adresse.pays.trim()].filter(Boolean).join(", ");
}

/**
 * Le médiateur, seulement si la convention est signée et que ses coordonnées
 * sont remplies. On ne cite jamais un médiateur sans convention.
 */
export function mediateurCite(fiche: FicheVendeur): FicheVendeur["mediateur"] | null {
  const m = fiche.mediateur;
  if (m.conventionSignee !== true) return null;
  if (![m.nom, m.adresse, m.site].every((champ) => champ.trim() !== "")) return null;
  return m;
}

/** Un champ facultatif, ou null s'il est vide : jamais de texte provisoire. */
export function siRempli(texte: string): string | null {
  return texte.trim() === "" ? null : texte.trim();
}
