import { renderToBuffer } from "@react-pdf/renderer";
import { construireKit } from "../engine/kit";
import type { Configuration } from "../engine/types";
import { verifierKit } from "../engine/validation";
import { documentKit } from "../pdf/documents/kit";
import { enregistrerPolices } from "../pdf/ressources";

export class KitRefuse extends Error {
  constructor(readonly nombreDeProblemes: number) {
    super("Le kit n'a pas passé ses contrôles.");
  }
}

/**
 * Produit le kit complet d'une commande payée : exactement celui de
 * l'aperçu, puisque la configuration, la graine et la version sont les
 * mêmes. Il repasse par verifierKit avant d'être rendu ; un kit qui échoue
 * n'est jamais livré. Hors production (`essai`), chaque page porte la mention
 * « Exemplaire d'essai — sans valeur commerciale ».
 *
 * Le nom du fichier ne porte pas le prénom de l'enfant.
 */
export async function produireKitLivre(
  configuration: Configuration,
  graine: string,
  options: { essai: boolean },
): Promise<{ pdf: Buffer; nomFichier: string }> {
  enregistrerPolices();
  const kit = construireKit(configuration, graine);
  const problemes = verifierKit(kit);
  if (problemes.length > 0) throw new KitRefuse(problemes.length);
  const pdf = await renderToBuffer(documentKit(kit, { essai: options.essai }));
  return { pdf, nomFichier: `mission-gateau-${configuration.theme}-${kit.format}.pdf` };
}
