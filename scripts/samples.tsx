/**
 * Produit les exemples versionnés dans samples/ :
 * les neuf kits complets, les neuf aperçus, et pour chaque kit un fichier
 * JSON décrivant sa structure, ses énigmes et leurs solutions.
 *
 *   npm run samples
 *
 * Les prénoms sont fictifs et les graines sont fixes : relancer la commande
 * doit redonner exactement les mêmes fichiers.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CACHETTES, cachette } from "../src/engine/cachettes";
import { LIBELLES_FORMATS, TRANCHES_AGE, formatPourAge } from "../src/engine/configuration";
import { construireKit, fichesEquipe } from "../src/engine/kit";
import { verifierKit } from "../src/engine/validation";
import type { Configuration, IdTheme } from "../src/engine/types";
import { documentApercu } from "../src/pdf/documents/apercu";
import { documentKit } from "../src/pdf/documents/kit";
import { deroule } from "../src/pdf/deroule";
import { indicesProgressifs } from "../src/pdf/indices";
import { enregistrerPolices } from "../src/pdf/ressources";

const RACINE = path.join(import.meta.dirname, "..");
const DOSSIER = path.join(RACINE, "samples");
const TOUTES = CACHETTES.map((c) => c.id);

/** Neuf exemples : chaque thème dans chacun des trois formats. */
const EXEMPLES: { theme: IdTheme; age: number; prenom: string; enfants: number; duree: 30 | 45 | 60; graine: string }[] = [
  { theme: "pirates", age: 5, prenom: "Maya", enfants: 6, duree: 45, graine: "exemple001" },
  { theme: "pirates", age: 8, prenom: "Tibo", enfants: 10, duree: 45, graine: "exemple002" },
  { theme: "pirates", age: 11, prenom: "Roxane", enfants: 14, duree: 60, graine: "exemple003" },
  { theme: "agents", age: 5, prenom: "Noé", enfants: 8, duree: 30, graine: "exemple004" },
  { theme: "agents", age: 8, prenom: "Jade", enfants: 12, duree: 60, graine: "exemple005" },
  { theme: "agents", age: 11, prenom: "Elio", enfants: 16, duree: 45, graine: "exemple006" },
  { theme: "dinosaures", age: 5, prenom: "Lilou", enfants: 4, duree: 60, graine: "exemple007" },
  { theme: "dinosaures", age: 8, prenom: "Marin", enfants: 7, duree: 30, graine: "exemple008" },
  { theme: "dinosaures", age: 11, prenom: "Sofia", enfants: 3, duree: 60, graine: "exemple009" },
];

function fiche(exemple: (typeof EXEMPLES)[number]): Configuration {
  return {
    theme: exemple.theme,
    age: exemple.age,
    prenom: exemple.prenom,
    nombreEnfants: exemple.enfants,
    duree: exemple.duree,
    cachettes: TOUTES,
    fete: {
      date: "samedi 18 octobre",
      heure: "14 h 30",
      adresse: "12 rue des Lilas",
      contact: "06 00 00 00 00",
      invites: ["Anaïs", "Basile", "Chloé", "Diego"].slice(0, Math.max(0, exemple.enfants - 1)),
    },
  };
}

/** Nombre de pages, lu dans l'arbre des pages du PDF. */
function compterPages(pdf: Buffer): number {
  const comptes = [...pdf.toString("latin1").matchAll(/\/Count (\d+)/g)].map((m) => Number(m[1]));
  return Math.max(...comptes);
}

async function principal(): Promise<void> {
  await mkdir(DOSSIER, { recursive: true });
  enregistrerPolices();
  const lignes: string[] = [];

  for (const exemple of EXEMPLES) {
    const configuration = fiche(exemple);
    const format = formatPourAge(exemple.age);
    const kit = construireKit(configuration, exemple.graine);
    const problemes = verifierKit(kit);
    if (problemes.length > 0) {
      console.error(`${exemple.theme}/${format} : ${problemes.join(" | ")}`);
      process.exitCode = 1;
      continue;
    }

    const base = `${exemple.theme}-${format}`;
    const debutKit = performance.now();
    const pdfKit = await renderToBuffer(documentKit(kit));
    const tempsKit = performance.now() - debutKit;
    const debutApercu = performance.now();
    const pdfApercu = await renderToBuffer(documentApercu(kit));
    const tempsApercu = performance.now() - debutApercu;

    await writeFile(path.join(DOSSIER, `kit-${base}.pdf`), pdfKit);
    await writeFile(path.join(DOSSIER, `apercu-${base}.pdf`), pdfApercu);

    const structure = {
      exemple: {
        theme: exemple.theme,
        format,
        formatLibelle: `${LIBELLES_FORMATS[format]} (${TRANCHES_AGE[format]})`,
        graine: exemple.graine,
      },
      configuration,
      codeFinal: kit.codeFinal,
      deroule: deroule(kit),
      parcours: kit.etapes.map((etape) => ({
        etape: etape.numero,
        cachette: cachette(etape.cachette).libelle,
        motCle: cachette(etape.cachette).motCle,
        cachetteSuivante: etape.cachetteSuivante ? cachette(etape.cachetteSuivante).libelle : "le trésor",
        indices: indicesProgressifs(etape.cachette),
      })),
      depart: kit.depart,
      equipes: kit.equipes.map((equipe) => ({
        nom: equipe.nom,
        symbole: equipe.symbole,
        chiffresDuCode: equipe.chiffres,
        fiches: fichesEquipe(equipe).map((f) => ({ numero: f.numero, etape: f.etape, enigme: f.enigme.titre })),
        cartes: equipe.cartes,
      })),
      pages: { kit: compterPages(pdfKit), apercu: compterPages(pdfApercu) },
    };
    await writeFile(path.join(DOSSIER, `kit-${base}.json`), `${JSON.stringify(structure, null, 2)}\n`, "utf8");

    lignes.push(
      `${base.padEnd(22)} ${String(structure.pages.kit).padStart(3)} pages  ` +
        `code ${(kit.codeFinal ?? "—").padEnd(5)} ` +
        `kit ${tempsKit.toFixed(0).padStart(4)} ms  aperçu ${tempsApercu.toFixed(0).padStart(4)} ms`,
    );
  }

  console.log(lignes.join("\n"));
  console.log(`\n${EXEMPLES.length} kits, ${EXEMPLES.length} aperçus et ${EXEMPLES.length} fichiers JSON dans samples/.`);
}

await principal();
