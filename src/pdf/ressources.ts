import { readFileSync } from "node:fs";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Polices et images des PDF.
 *
 * Tout est lu sur le disque, depuis public/ : aucune ressource n'est chargée
 * depuis un autre domaine au moment de produire un PDF. next.config.ts force
 * l'inclusion de ces fichiers dans la fonction déployée.
 */

const DOSSIER_PUBLIC = path.join(process.cwd(), "public");

function cheminPolice(fichier: string): string {
  return path.join(DOSSIER_PUBLIC, "fonts", fichier);
}

let policesEnregistrees = false;

export function enregistrerPolices(): void {
  if (policesEnregistrees) return;
  policesEnregistrees = true;

  Font.register({
    family: "Nunito",
    fonts: [
      { src: cheminPolice("Nunito-Regular.ttf"), fontWeight: 400 },
      { src: cheminPolice("Nunito-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Fredoka",
    fonts: [{ src: cheminPolice("Fredoka-SemiBold.ttf"), fontWeight: 600 }],
  });

  // Le découpage automatique des mots suit des règles anglaises : on le coupe.
  // Un mot français trop long passe à la ligne entier.
  Font.registerHyphenationCallback((mot) => [mot]);
}

const cacheIcones = new Map<string, Buffer>();

/** Charge un PNG d'icône. Les émojis ne sont jamais rendus comme du texte. */
export function imageIcone(cle: string): { data: Buffer; format: "png" } {
  let donnees = cacheIcones.get(cle);
  if (!donnees) {
    donnees = readFileSync(path.join(DOSSIER_PUBLIC, "icones", `${cle}.png`));
    cacheIcones.set(cle, donnees);
  }
  return { data: donnees, format: "png" };
}
