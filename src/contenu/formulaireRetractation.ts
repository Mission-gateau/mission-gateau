import { typographier } from "../engine/texte";
import { adresseSurUneLigne, denomination } from "../vente/fiche";
import type { FicheVendeur } from "./vendeur";

/**
 * Le modèle de formulaire de rétractation de l'annexe à l'article R221-1 du
 * Code de la consommation (version du 28 mai 2022), mot pour mot, un
 * paragraphe par ligne. tests/cgv.test.ts le compare au texte officiel.
 */
export const MODELE_FORMULAIRE = [
  "MODÈLE DE FORMULAIRE DE RÉTRACTATION",
  "(Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat.)",
  "A l'attention de [le professionnel insère ici son nom, son adresse géographique et son adresse électronique] :",
  "Je/nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la vente du bien (*)/pour la prestation de services (*) ci-dessous :",
  "Commandé le (*)/reçu le (*) :",
  "Nom du (des) consommateur(s) :",
  "Adresse du (des) consommateur(s) :",
  "Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur papier) :",
  "Date :",
  "(*) Rayez la mention inutile.",
] as const;

/** Le crochet que le professionnel remplace par son nom, son adresse géographique et son adresse électronique. */
export const CROCHET_DU_FORMULAIRE =
  "[le professionnel insère ici son nom, son adresse géographique et son adresse électronique]";

/** Le formulaire rempli avec le nom, l'adresse géographique et l'e-mail du vendeur, lus dans sa fiche. */
export function formulaireRempli(fiche: FicheVendeur): string[] {
  const vendeur = [denomination(fiche), adresseSurUneLigne(fiche.adresse), fiche.email.trim()].join(", ");
  return typographier(MODELE_FORMULAIRE.map((ligne) => ligne.replace(CROCHET_DU_FORMULAIRE, vendeur)));
}
