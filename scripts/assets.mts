/**
 * Télécharge une fois pour toutes les polices et les icônes, puis les range
 * dans public/. Les fichiers obtenus sont versionnés : le site et les PDF ne
 * chargent jamais rien depuis un autre domaine à l'exécution.
 *
 *   npm run assets           n'écrit que ce qui manque
 *   npm run assets -- --force  retélécharge tout
 *
 * Licences : polices sous OFL (Fredoka, Nunito, via github.com/google/fonts),
 * icônes sous Apache-2.0 (Noto Emoji, dossier 2D/png/128).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { ICONES } from "../src/engine/icones";

const RACINE = path.join(import.meta.dirname, "..");
const DOSSIER_POLICES = path.join(RACINE, "public", "fonts");
const DOSSIER_ICONES = path.join(RACINE, "public", "icones");
const FORCE = process.argv.includes("--force");

/**
 * Un navigateur d'avant WOFF : l'API des polices Google renvoie alors des
 * fichiers TrueType statiques, que @react-pdf/renderer sait lire, au lieu de
 * fichiers WOFF2 ou d'une police variable.
 */
const NAVIGATEUR_ANCIEN =
  "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_5_7; en-us) AppleWebKit/530.17 (KHTML, like Gecko) Version/4.0 Safari/530.17";

const POLICES = [
  { fichier: "Nunito-Regular.ttf", famille: "Nunito", graisse: 400 },
  { fichier: "Nunito-Bold.ttf", famille: "Nunito", graisse: 700 },
  { fichier: "Fredoka-SemiBold.ttf", famille: "Fredoka", graisse: 600 },
];

const LICENCES = [
  { fichier: "OFL-Nunito.txt", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/OFL.txt" },
  { fichier: "OFL-Fredoka.txt", url: "https://raw.githubusercontent.com/google/fonts/main/ofl/fredoka/OFL.txt" },
];

const BASE_NOTO = "https://raw.githubusercontent.com/googlefonts/noto-emoji/main/2D/png/128";

async function telecharger(url: string, entetes: Record<string, string> = {}): Promise<Buffer> {
  const reponse = await fetch(url, { headers: entetes });
  if (!reponse.ok) throw new Error(`${reponse.status} sur ${url}`);
  return Buffer.from(await reponse.arrayBuffer());
}

async function ecrire(destination: string, contenu: Buffer): Promise<void> {
  await writeFile(destination, contenu);
  console.log(`  écrit ${path.relative(RACINE, destination)} (${(contenu.length / 1024).toFixed(0)} ko)`);
}

async function police(fichier: string, famille: string, graisse: number): Promise<void> {
  const destination = path.join(DOSSIER_POLICES, fichier);
  if (existsSync(destination) && !FORCE) return;
  const css = await telecharger(
    `https://fonts.googleapis.com/css?family=${encodeURIComponent(famille)}:${graisse}`,
    { "User-Agent": NAVIGATEUR_ANCIEN },
  );
  const urls = [...css.toString("utf8").matchAll(/url\((https:\/\/[^)]+\.ttf)\)/g)].map((m) => m[1]!);
  if (urls.length === 0) throw new Error(`aucun TrueType pour ${famille} ${graisse}`);
  const ttf = await telecharger(urls[0]!);
  if (ttf.readUInt32BE(0) !== 0x00010000 && ttf.subarray(0, 4).toString() !== "true") {
    throw new Error(`${fichier} : ce n'est pas un fichier TrueType`);
  }
  await ecrire(destination, ttf);
}

async function icone(cle: string, codePoint: string): Promise<void> {
  const destination = path.join(DOSSIER_ICONES, `${cle}.png`);
  if (existsSync(destination) && !FORCE) return;
  const png = await telecharger(`${BASE_NOTO}/emoji_u${codePoint}.png`);
  if (png.subarray(1, 4).toString() !== "PNG") throw new Error(`${cle} : ce n'est pas un PNG`);
  await ecrire(destination, png);
}

async function principal(): Promise<void> {
  await mkdir(DOSSIER_POLICES, { recursive: true });
  await mkdir(DOSSIER_ICONES, { recursive: true });

  console.log("Polices (OFL)");
  for (const p of POLICES) await police(p.fichier, p.famille, p.graisse);
  for (const l of LICENCES) {
    const destination = path.join(DOSSIER_POLICES, l.fichier);
    if (existsSync(destination) && !FORCE) continue;
    await ecrire(destination, await telecharger(l.url));
  }

  console.log("Icônes (Noto Emoji, Apache-2.0)");
  const entrees = Object.entries(ICONES);
  let manquantes = 0;
  for (const [cle, def] of entrees) {
    try {
      await icone(cle, def.codePoint);
    } catch (erreur) {
      manquantes += 1;
      console.error(`  ÉCHEC ${cle} (${def.codePoint}) : ${(erreur as Error).message}`);
    }
  }
  const licence = path.join(DOSSIER_ICONES, "LICENSE-noto-emoji.txt");
  if (!existsSync(licence) || FORCE) {
    await ecrire(
      licence,
      Buffer.from(
        [
          "Icônes : Noto Emoji (googlefonts/noto-emoji), dossier 2D/png/128.",
          "Les images du dépôt sont publiées sous Apache License 2.0.",
          "Texte complet : https://www.apache.org/licenses/LICENSE-2.0",
          "Source : https://github.com/googlefonts/noto-emoji",
          "",
        ].join("\n"),
        "utf8",
      ),
    );
  }

  const presentes = entrees.filter(([cle]) => existsSync(path.join(DOSSIER_ICONES, `${cle}.png`))).length;
  console.log(`\n${presentes}/${entrees.length} icônes présentes, ${POLICES.length} polices.`);
  if (manquantes > 0) process.exitCode = 1;
}

await principal();
