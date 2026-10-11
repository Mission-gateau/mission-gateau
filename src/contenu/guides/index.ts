import { typographier } from "../../engine/texte";
import { CACHETTES_ENIGMES } from "./cachettes";
import { CHASSE_4_6_ANS } from "./chasse";
import { DEROULE } from "./deroule";
import { ESCAPE_10_12_ANS } from "./escape";
import { MISSION_7_9_ANS } from "./mission";
import type { Guide } from "./types";

export type { BlocGuide, Guide, SectionGuide } from "./types";

/** Les guides, dans l'ordre de la page /guides. */
export const GUIDES: readonly Guide[] = [CHASSE_4_6_ANS, MISSION_7_9_ANS, ESCAPE_10_12_ANS, DEROULE, CACHETTES_ENIGMES];

export function guideParAdresse(adresse: string): Guide | null {
  return GUIDES.find((guide) => guide.adresse === adresse) ?? null;
}

/** Les textes communs aux pages des guides. */
export const TEXTES_GUIDES = typographier({
  titre: "Guides pour organiser un anniversaire à la maison",
  titreCourt: "Guides",
  description:
    "Chasse au trésor, mission d'agents secrets, escape game, déroulé, cachettes et énigmes selon l'âge : organiser un anniversaire d'enfant à la maison.",
  intro:
    "Ces guides vous aident à organiser un jeu d'anniversaire à la maison, avec ou sans Mission Gâteau : chacun suffit à préparer la fête. Les exemples d'énigmes sont produits par le même moteur que nos kits.",
  lienPied: "Guides",
  lireLeGuide: "Lire le guide",
  modifieLe: "Mis à jour le {date}",
  retour: "Tous les guides",

  titreExemple: "Exemple produit par Mission Gâteau",
  legendeExemple: "Produit pour {prenom}, {age} ans, thème {theme}, avec la graine {graine} : la même graine redonne toujours le même jeu.",
  exempleDevinette: "La devinette de départ, lue à voix haute",
  exempleOrdre: "L'ordre des cachettes",
  exempleSolution: "Réponse",
  exempleLegende: "La légende",
  exempleMot: "Le mot à lire",
  exempleChiffre: "Le message chiffré",
  exempleDecalage: "Le décalage, trouvé à l'étape précédente : {decalage}",
  exempleDeroule: "Le déroulé de la partie, minute par minute",
  exempleMinute: "À {debut} min",
  exempleDuree: "{duree} min",
  exempleAge: "À {age} ans",

  titreSecurite: "Les consignes de sécurité de nos kits",
  introSecurite: "Ce sont celles du guide de l'organisateur de chaque kit, et du formulaire au moment de choisir les cachettes :",

  titreCreer: "Composer votre jeu en quelques minutes",
  texteCreer:
    "Répondez à six questions : le site compose le jeu complet, cartes, énigmes, déroulé et solutions, et vous montre aussitôt un aperçu gratuit de quatre pages.",
  prixCreer: "Le jeu complet coûte {prix}.",
  boutonCreer: "Voir l'aperçu gratuit",
} as const);
