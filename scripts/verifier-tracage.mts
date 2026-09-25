/**
 * Vérifie, sur le build, que chaque fonction qui produit un PDF embarque ce
 * qu'elle lit sur le disque : polices et icônes pour le kit et l'aperçu,
 * polices pour le PDF des CGV joint à la confirmation de commande (route de
 * confirmation et tâche quotidienne). Sans elles, la fonction déployée
 * échouerait au premier PDF. Lit le fichier de traçage de chaque route
 * (.nft.json) écrit par `next build`.
 *
 *   npm run build && npm run verifier:tracage
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const RACINE = path.join(import.meta.dirname, "..");
const ROUTES: Record<string, string[]> = {
  "api/apercu": ["public/fonts", "public/icones"],
  "api/commande/[ref]/kit": ["public/fonts", "public/icones"],
  "api/commande/[ref]/confirmation": ["public/fonts"],
  "api/effacement": ["public/fonts"],
};

let echec = false;
for (const [route, dossiers] of Object.entries(ROUTES)) {
  const attendus = dossiers.flatMap((dossier) =>
    readdirSync(path.join(RACINE, dossier)).map((nom) => `${dossier}/${nom}`),
  );
  const fichier = path.join(RACINE, ".next", "server", "app", route, "route.js.nft.json");
  if (!existsSync(fichier)) {
    console.error(`${route} : pas de fichier de traçage (${path.relative(RACINE, fichier)}). Lancer d'abord npm run build.`);
    echec = true;
    continue;
  }
  const trace = JSON.parse(readFileSync(fichier, "utf8")) as { files: string[] };
  const embarques = new Set(
    trace.files.map((f) => path.relative(RACINE, path.resolve(path.dirname(fichier), f)).split(path.sep).join("/")),
  );
  const manquants = attendus.filter((f) => !embarques.has(f));
  const polices = attendus.filter((f) => f.startsWith("public/fonts/") && embarques.has(f)).length;
  const icones = attendus.filter((f) => f.startsWith("public/icones/") && embarques.has(f)).length;
  console.log(
    dossiers.includes("public/icones")
      ? `${route} : ${polices} fichiers de polices et ${icones} fichiers d'icônes embarqués.`
      : `${route} : ${polices} fichiers de polices embarqués.`,
  );
  if (manquants.length > 0) {
    console.error(`${route} : manquent ${manquants.join(", ")}`);
    echec = true;
  }
}
if (echec) process.exit(1);
