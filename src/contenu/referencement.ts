import { typographier } from "../engine/texte";

/**
 * Ce que les moteurs de recherche lisent des pages publiques : le titre (la
 * mise en page y ajoute « — Mission Gâteau », sauf pour l'accueil), la
 * description, et la date de la dernière modification de leur contenu
 * (AAAA-MM-JJ), qui sert au plan du site. Les guides portent les leurs dans
 * src/contenu/guides/.
 */
export const PAGES_PUBLIQUES = typographier({
  "/": {
    titre: "Mission Gâteau — le jeu d'anniversaire personnalisé, prêt à imprimer",
    description:
      "Jeu d'anniversaire à imprimer pour les 4 à 12 ans : chasse au trésor, mission ou escape game, composé avec les cachettes de votre maison.",
    modifieLe: "2026-10-11",
  },
  "/creer": {
    titre: "Créer un jeu d'anniversaire personnalisé",
    description:
      "Composez en six questions un jeu d'anniversaire à imprimer, adapté à l'âge, aux enfants et à vos cachettes, avec un aperçu gratuit.",
    modifieLe: "2026-09-27",
  },
  "/mentions-legales": {
    titre: "Mentions légales",
    description: "L'éditeur du site Mission Gâteau, son hébergeur et son prestataire de paiement.",
    modifieLe: "2026-10-11",
  },
  "/cgv": {
    titre: "Conditions générales de vente",
    description: "Les conditions de vente du jeu complet Mission Gâteau.",
    modifieLe: "2026-10-11",
  },
  "/confidentialite": {
    titre: "Politique de confidentialité",
    description: "Ce que Mission Gâteau fait de vos données, et combien de temps elles sont gardées.",
    modifieLe: "2026-10-11",
  },
  "/credits": {
    titre: "Crédits et licences",
    description: "Les polices, les icônes et les textes utilisés par Mission Gâteau, et leurs licences.",
    modifieLe: "2026-09-23",
  },
} as const);
