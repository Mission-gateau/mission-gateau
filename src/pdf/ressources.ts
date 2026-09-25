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

/**
 * Les polices du PDF des conditions générales de vente, enregistrées sous
 * leurs propres noms et amorcées une fois pour toutes.
 *
 * Ce PDF part en pièce jointe de la confirmation de commande, avec une clé
 * d'idempotence : une nouvelle tentative doit envoyer exactement le même
 * fichier. Or fontkit garde en cache les glyphes de chaque police, et un
 * glyphe créé d'abord comme composant d'une lettre accentuée (le « A » de
 * « À ») y reste sans caractère : un document produit ensuite l'écrit sans
 * correspondance Unicode (le défaut décrit dans le README). Le fichier
 * dépendrait alors de ce que le processus a rendu avant lui.
 *
 * D'où deux précautions : des polices réservées à ce document, que les kits
 * ne touchent jamais, et, dès leur chargement, un glyphe créé pour chaque
 * caractère de la police, avec ce caractère. Le PDF des CGV ne dépend plus
 * que de son contenu et de sa date de création, fixée à celle de la version.
 */
export const POLICES_CGV = { texte: "Nunito CGV", titre: "Fredoka CGV" } as const;

let policesCgv: Promise<void> | null = null;

export function preparerPolicesCgv(): Promise<void> {
  policesCgv ??= (async () => {
    enregistrerPolices();
    Font.register({
      family: POLICES_CGV.texte,
      fonts: [
        { src: cheminPolice("Nunito-Regular.ttf"), fontWeight: 400 },
        { src: cheminPolice("Nunito-Bold.ttf"), fontWeight: 700 },
      ],
    });
    Font.register({
      family: POLICES_CGV.titre,
      fonts: [{ src: cheminPolice("Fredoka-SemiBold.ttf"), fontWeight: 600 }],
    });
    for (const descripteur of [
      { fontFamily: POLICES_CGV.texte, fontWeight: 400 },
      { fontFamily: POLICES_CGV.texte, fontWeight: 700 },
      { fontFamily: POLICES_CGV.titre, fontWeight: 600 },
    ] as const) {
      const source = Font.getFont(descripteur);
      await source.load();
      const police = source.data;
      if (!police || !("characterSet" in police)) continue;
      for (const caractere of police.characterSet) police.glyphForCodePoint(caractere);
    }
  })().catch((erreur: unknown) => {
    policesCgv = null;
    throw erreur;
  });
  return policesCgv;
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
