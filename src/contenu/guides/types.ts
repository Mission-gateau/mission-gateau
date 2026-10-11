/**
 * La forme d'un guide : des pages de conseils, utiles par elles-mêmes, sans
 * achat. Le texte vit ici ; la page (src/app/guides/[adresse]/page.tsx) le
 * rend, y insère l'exemple produit par le moteur et le lien vers /creer.
 */

export type BlocGuide =
  | { type: "paragraphe"; texte: string }
  /** Une liste à puces. */
  | { type: "liste"; elements: string[] }
  /** Une liste numérotée : des étapes à suivre dans l'ordre. */
  | { type: "etapes"; elements: string[] }
  /** L'exemple produit par le moteur (src/contenu/guides/exemples.ts), rendu en HTML. */
  | { type: "exemple" }
  /** Les consignes de sécurité des kits et du formulaire, reprises mot pour mot de src/contenu/. */
  | { type: "securite" }
  /** Le lien vers /creer, avec l'aperçu gratuit (et le prix, si la vente est ouverte). */
  | { type: "versCreer" };

export interface SectionGuide {
  titre: string;
  blocs: BlocGuide[];
}

export interface Guide {
  /** Le dernier segment de l'adresse : /guides/<adresse>. */
  adresse: string;
  /** Le titre de la page (balise h1 et <title>). */
  titre: string;
  /** Le titre court, dans la liste des guides et le pied de page. */
  titreCourt: string;
  /** La description (balise meta description et Open Graph), 160 caractères au plus. */
  description: string;
  /** Date de la dernière modification du texte, AAAA-MM-JJ : elle sert au plan du site. */
  modifieLe: string;
  /** Le paragraphe d'ouverture, sous le titre. */
  chapeau: string;
  sections: SectionGuide[];
}
