import { CONSIGNES, MESSAGES_FINAUX, SOLUTIONS, TITRES } from "@/contenu/consignes";
import { DEVINETTES } from "@/contenu/devinettes";
import { GUIDE } from "@/contenu/guide";
import { GABARITS_INDICES, INDICES_CACHETTES } from "@/contenu/indices";
import { GABARITS_LOGIQUE } from "@/contenu/logique";
import { FORMULAIRE } from "@/contenu/formulaire";
import { CREDITS, SITE } from "@/contenu/site";
import { LISTE_THEMES } from "@/contenu/themes";
import { mentionsLegales, politiqueDeConfidentialite } from "@/contenu/legal";
import { VERSIONS_CGV } from "@/contenu/cgv";
import { ACCUSE, A_TRAITER, CONFIRMATION } from "@/contenu/emails";
import { MODELE_FORMULAIRE } from "@/contenu/formulaireRetractation";
import { REPONSES_RETRACTATION, RETRACTATION } from "@/contenu/retractation";
import { VENDEUR, type FicheVendeur } from "@/contenu/vendeur";
import { ACHAT, COMMANDE, NOMS_PAYS, REPONSES_COMMANDE, TEXTES_STRIPE } from "@/contenu/vente";

export interface TexteRepere {
  chemin: string;
  texte: string;
}

function parcourir(valeur: unknown, chemin: string, resultat: TexteRepere[]): void {
  if (typeof valeur === "string") {
    resultat.push({ chemin, texte: valeur });
    return;
  }
  if (Array.isArray(valeur)) {
    valeur.forEach((element, index) => parcourir(element, `${chemin}[${index}]`, resultat));
    return;
  }
  if (valeur && typeof valeur === "object") {
    for (const [cle, sous] of Object.entries(valeur)) {
      parcourir(sous, chemin ? `${chemin}.${cle}` : cle, resultat);
    }
  }
}

/**
 * Une fiche du vendeur dont chaque champ est un gabarit : les pages légales
 * construites avec elle ne contiennent que la prose écrite pour le site. Les
 * données du vendeur elles-mêmes sont relues à part, depuis la vraie fiche.
 */
export const FICHE_NEUTRE: FicheVendeur = {
  nom: "{nom}",
  mention: "{mention}",
  statut: "{statut}",
  capital: "{capital}",
  nomCommercial: "{nomCommercial}",
  directeurPublication: "{directeur}",
  siret: "{siret}",
  rcs: "{rcs}",
  adresse: { rue: "{rue}", codePostal: "{codePostal}", ville: "{ville}", pays: "{pays}" },
  telephone: "{telephone}",
  email: "{email}",
  tva: "{tva}",
  mediateur: { nom: "{nom}", adresse: "{adresse}", site: "https://{site}", demande: "https://{demande}", conventionSignee: true },
  hebergeur: { nom: "{nom}", adresse: "{adresse}", telephone: "{telephone}", site: "https://{site}" },
  paiement: { nom: "{nom}", adresse: "{adresse}" },
};

/** Tous les textes des fichiers de contenu, avec leur chemin d'origine. */
export function tousLesTextes(): TexteRepere[] {
  const resultat: TexteRepere[] = [];
  const sources: [string, unknown][] = [
    ["consignes", CONSIGNES],
    ["titres", TITRES],
    ["solutions", SOLUTIONS],
    ["messagesFinaux", MESSAGES_FINAUX],
    ["devinettes", DEVINETTES],
    ["guide", GUIDE],
    ["indices", INDICES_CACHETTES],
    ["gabaritsIndices", GABARITS_INDICES],
    ["gabaritsLogique", GABARITS_LOGIQUE],
    ["formulaire", FORMULAIRE],
    ["site", SITE],
    ["credits", CREDITS],
    ["themes", LISTE_THEMES],
    ["achat", ACHAT],
    ["reponsesCommande", REPONSES_COMMANDE],
    ["commande", COMMANDE],
    ["stripe", TEXTES_STRIPE],
    ["pays", NOMS_PAYS],
    ["vendeur", VENDEUR],
    ["mentionsLegales", mentionsLegales(FICHE_NEUTRE)],
    ...VERSIONS_CGV.map(
      (version): [string, unknown] => [`cgv[${version.identifiant}]`, version.conditions(FICHE_NEUTRE, { prix: "{prix}" })],
    ),
    ["confidentialite", politiqueDeConfidentialite(FICHE_NEUTRE)],
    ["retractation", RETRACTATION],
    ["reponsesRetractation", REPONSES_RETRACTATION],
    ["formulaireRetractation", MODELE_FORMULAIRE],
    ["emailConfirmation", CONFIRMATION],
    ["emailAccuse", ACCUSE],
    ["emailATraiter", A_TRAITER],
  ];
  for (const [nom, valeur] of sources) parcourir(valeur, nom, resultat);
  return resultat;
}

/**
 * Les textes de prose : on écarte les identifiants techniques, les adresses
 * et les prénoms inventés des personnages, qui ne sont pas des phrases.
 */
export function textesDeProse(): TexteRepere[] {
  return tousLesTextes().filter(
    ({ chemin, texte }) =>
      !/\.(id|cle|icone|icones|lien|lienLicence|codePoint|court|personnages|type)\b/.test(chemin) &&
      // Les adresses postales de la fiche du vendeur sont des données, pas de la prose.
      !/^vendeur\.(adresse\.|\w+\.adresse$)/.test(chemin) &&
      !/^https?:/.test(texte) &&
      texte.trim().length > 0,
  );
}

/** Les prénoms de personnages, vérifiés à part : ce sont des noms propres. */
export function personnagesDesThemes(): string[] {
  return LISTE_THEMES.flatMap((theme) => theme.personnages);
}
