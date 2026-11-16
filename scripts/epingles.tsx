/**
 * Fabrique les images des épingles Pinterest, depuis le vrai moteur du jeu :
 *
 *   npm run epingles
 *
 * Pour chaque ligne du calendrier (src/epingles/calendrier.ts), le script
 * compose le jeu d'exemple (graine fixe, prénom d'exemple, aucun champ de la
 * fête), produit son kit complet en PDF, rend la page choisie en image
 * (pdf.js, sur le canevas de @napi-rs/canvas), sans retouche, et la pose
 * sur un fond aux couleurs du site, avec en haut un titre court en Fredoka
 * et en bas « Aperçu gratuit sur missiongateau.com ». L'image part en JPEG,
 * 1000 × 1500 px, 400 Ko au plus, dans public/epingles/ ; ses dimensions et
 * sa taille vont dans src/epingles/images.ts, que lisent les flux RSS.
 *
 * Même entrée, même image : graines fixes, aucune date ni hasard dans le
 * rendu. Les images qui ne figurent plus au calendrier sont effacées.
 *
 * pdfjs-dist (Apache 2.0) et @napi-rs/canvas (MIT) sont des dépendances de
 * développement : ce script tourne sur le poste du développeur, jamais en
 * production.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { createCanvas, GlobalFonts, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { CACHETTES } from "../src/engine/cachettes";
import { construireKit, fichesEquipe } from "../src/engine/kit";
import type { Configuration, Kit, TypeEnigme } from "../src/engine/types";
import { verifierKit } from "../src/engine/validation";
import { GUIDE } from "../src/contenu/guide";
import { TEXTES_EPINGLES } from "../src/contenu/epingles";
import { EPINGLES, JEUX, type Epingle, type IdJeu } from "../src/epingles/calendrier";
import { titreDeLImage } from "../src/epingles/flux";
import { documentKit } from "../src/pdf/documents/kit";
import { enregistrerPolices } from "../src/pdf/ressources";

const RACINE = path.join(import.meta.dirname, "..");
const DOSSIER = path.join(RACINE, "public", "epingles");
const MANIFESTE = path.join(RACINE, "src", "epingles", "images.ts");

export const LARGEUR = 1000;
export const HAUTEUR = 1500;
export const OCTETS_MAX = 400 * 1024;

/** Les couleurs du site (src/app/globals.css). */
const COULEURS = {
  fond: "#0f4c5c",
  titre: "#fdf8f0",
  sousTitre: "#f6b352",
  pied: "#f6b352",
  texteDuPied: "#1f2933",
};

/** Les mentions de bas de page du kit, qui disent à quelle partie appartient une page. */
const SECTIONS = new Set(["Guide", "Invitations", "Cartes", "Fiches", "Trésor", "Diplômes", "Solutions"]);

GlobalFonts.registerFromPath(path.join(RACINE, "public", "fonts", "Fredoka-SemiBold.ttf"), "Fredoka Epingle");
GlobalFonts.registerFromPath(path.join(RACINE, "public", "fonts", "Nunito-Bold.ttf"), "Nunito Epingle");

interface PageLue {
  section: string | null;
  texte: string;
}

interface JeuRendu {
  kit: Kit;
  document: Awaited<ReturnType<typeof getDocument>["promise"]>;
  pages: PageLue[];
}

/** La configuration du moteur : toutes les cachettes, et aucun champ de la fête. */
function configurationDe(id: IdJeu): Configuration {
  const jeu = JEUX[id];
  return {
    theme: jeu.theme,
    age: jeu.age,
    prenom: jeu.prenom,
    nombreEnfants: jeu.nombreEnfants,
    duree: jeu.duree,
    cachettes: CACHETTES.map((c) => c.id),
  };
}

async function rendreLeJeu(id: IdJeu): Promise<JeuRendu> {
  const kit = construireKit(configurationDe(id), JEUX[id].graine);
  const problemes = verifierKit(kit);
  if (problemes.length > 0) throw new Error(`${id} : ${problemes.join(" | ")}`);
  if (kit.configuration.fete) throw new Error(`${id} : un jeu d'épingle n'a aucun champ de la fête`);
  const pdf = await renderToBuffer(documentKit(kit));
  const document = await getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
  const pages: PageLue[] = [];
  for (let numero = 1; numero <= document.numPages; numero++) {
    const contenu = await (await document.getPage(numero)).getTextContent();
    const morceaux = contenu.items.map((item) => ("str" in item ? item.str.trim() : ""));
    pages.push({
      section: morceaux.find((morceau) => SECTIONS.has(morceau)) ?? null,
      texte: morceaux.join(" ").replace(/\s+/g, " "),
    });
  }
  return { kit, document, pages };
}

/** Les énigmes imprimées sur la n-ième page de cartes de la première équipe (deux cartes par page). */
function enigmesDesCartes(kit: Kit, rang: number): TypeEnigme[] {
  const cartes = kit.equipes[0]!.cartes.slice((rang - 1) * 2, rang * 2);
  return cartes.flatMap((carte) =>
    [carte.navigation, carte.code, carte.bonus].filter((e) => e !== null && !e.surFiche).map((e) => e!.type),
  );
}

/** L'indice (à partir de 0) de la page du PDF que montre l'épingle. */
function trouverLaPage(epingle: Epingle, jeu: JeuRendu): number {
  const { pages, kit } = jeu;
  const page = epingle.page;
  const nieme = (section: string, rang: number) => {
    const indices = pages.flatMap((p, i) => (p.section === section ? [i] : []));
    const indice = indices[rang - 1];
    if (indice === undefined) throw new Error(`${epingle.fichier} : pas de page ${rang} dans « ${section} »`);
    return indice;
  };
  const contenant = (texte: string) => {
    const indice = pages.findIndex((p) => p.texte.includes(texte));
    if (indice < 0) throw new Error(`${epingle.fichier} : aucune page ne contient « ${texte} »`);
    return indice;
  };
  const verifierEnigmes = (montrees: TypeEnigme[], attendues: readonly TypeEnigme[]) => {
    const manquantes = attendues.filter((type) => !montrees.includes(type));
    if (manquantes.length > 0) throw new Error(`${epingle.fichier} : la page ne montre pas ${manquantes.join(", ")}`);
  };

  switch (page.section) {
    case "deroule":
      if (pages[0]?.section !== "Guide" || !pages[0].texte.includes("Déroulé minute par minute")) {
        throw new Error(`${epingle.fichier} : la première page n'est pas le déroulé`);
      }
      return 0;
    case "preparation":
      return contenant(GUIDE.titrePreparation);
    case "briefing":
      return contenant(GUIDE.titreBriefing);
    case "tresor":
      return nieme("Trésor", 1);
    case "diplome":
      return nieme("Diplômes", 1);
    case "cartes": {
      const pagesDeLaPremiereEquipe = Math.ceil(kit.equipes[0]!.cartes.length / 2);
      if (page.rang > pagesDeLaPremiereEquipe) throw new Error(`${epingle.fichier} : la première équipe n'a que ${pagesDeLaPremiereEquipe} pages de cartes`);
      verifierEnigmes(enigmesDesCartes(kit, page.rang), page.enigmes);
      return nieme("Cartes", page.rang);
    }
    case "fiche": {
      const fiches = fichesEquipe(kit.equipes[0]!);
      const fiche = fiches[page.numero - 1];
      if (!fiche) throw new Error(`${epingle.fichier} : la première équipe n'a que ${fiches.length} fiches`);
      verifierEnigmes([fiche.enigme.type], page.enigmes);
      const indice = nieme("Fiches", page.numero);
      if (!pages[indice]!.texte.includes(`${GUIDE.ficheNumero} ${page.numero} `)) {
        throw new Error(`${epingle.fichier} : la page ${indice + 1} n'est pas la fiche ${page.numero}`);
      }
      return indice;
    }
  }
}

/** Coupe un titre en deux lignes de largeurs proches. */
function enDeuxLignes(ctx: SKRSContext2D, texte: string): string[] {
  const mots = texte.split(" ");
  let meilleure: string[] = [texte];
  let largeurMeilleure = Infinity;
  for (let i = 1; i < mots.length; i++) {
    const lignes = [mots.slice(0, i).join(" "), mots.slice(i).join(" ")];
    const largeur = Math.max(...lignes.map((ligne) => ctx.measureText(ligne).width));
    if (largeur < largeurMeilleure) {
      meilleure = lignes;
      largeurMeilleure = largeur;
    }
  }
  return meilleure;
}

/** Une ligne de texte, réduite jusqu'à `minimum` pour tenir dans `largeur`. */
function taillePourTenir(ctx: SKRSContext2D, texte: string, police: string, maximum: number, minimum: number, largeur: number): number {
  for (let taille = maximum; taille > minimum; taille -= 2) {
    ctx.font = `${taille}px "${police}"`;
    if (ctx.measureText(texte).width <= largeur) return taille;
  }
  return minimum;
}

async function composer(epingle: Epingle, jeu: JeuRendu, indice: number): Promise<Buffer> {
  const canevas = createCanvas(LARGEUR, HAUTEUR);
  const ctx = canevas.getContext("2d");
  ctx.fillStyle = COULEURS.fond;
  ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // En haut : le titre court, en Fredoka, sur une ou deux lignes, puis sa seconde ligne.
  const [titre, sousTitre] = titreDeLImage(epingle);
  const largeurUtile = LARGEUR - 100;
  let taille = taillePourTenir(ctx, titre, "Fredoka Epingle", 64, 54, largeurUtile);
  ctx.font = `${taille}px "Fredoka Epingle"`;
  let lignes = [titre];
  if (ctx.measureText(titre).width > largeurUtile) {
    taille = 60;
    ctx.font = `${taille}px "Fredoka Epingle"`;
    lignes = enDeuxLignes(ctx, titre);
  }
  let y = 40;
  ctx.fillStyle = COULEURS.titre;
  for (const ligne of lignes) {
    y += taille * 1.12;
    ctx.fillText(ligne, LARGEUR / 2, y);
  }
  const tailleSousTitre = taillePourTenir(ctx, sousTitre, "Fredoka Epingle", 36, 28, largeurUtile);
  ctx.font = `${tailleSousTitre}px "Fredoka Epingle"`;
  ctx.fillStyle = COULEURS.sousTitre;
  y += tailleSousTitre * 1.45;
  ctx.fillText(sousTitre, LARGEUR / 2, y);

  // En bas : la mention, sur un bandeau.
  const hauteurPied = 96;
  ctx.fillStyle = COULEURS.pied;
  ctx.fillRect(0, HAUTEUR - hauteurPied, LARGEUR, hauteurPied);
  ctx.font = `38px "Nunito Epingle"`;
  ctx.fillStyle = COULEURS.texteDuPied;
  ctx.textBaseline = "middle";
  ctx.fillText(TEXTES_EPINGLES.pied, LARGEUR / 2, HAUTEUR - hauteurPied / 2);

  // Au milieu : la page du jeu, entière, sans retouche, à la proportion du A4.
  const page = await jeu.document.getPage(indice + 1);
  const brute = page.getViewport({ scale: 1 });
  const haut = Math.round(y + 30);
  const hauteurPage = HAUTEUR - hauteurPied - 26 - haut;
  const largeurPage = Math.round((hauteurPage * brute.width) / brute.height);
  const gauche = Math.round((LARGEUR - largeurPage) / 2);

  // Rendue à deux fois la taille finale, puis réduite : un texte net.
  const echelle = (2 * largeurPage) / brute.width;
  const vue = page.getViewport({ scale: echelle });
  const rendu: Canvas = createCanvas(Math.round(vue.width), Math.round(vue.height));
  const ctxRendu = rendu.getContext("2d");
  ctxRendu.fillStyle = "#ffffff";
  ctxRendu.fillRect(0, 0, rendu.width, rendu.height);
  await page.render({ canvas: rendu as unknown as HTMLCanvasElement, viewport: vue }).promise;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(gauche, haut, largeurPage, hauteurPage);
  ctx.restore();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(rendu, gauche, haut, largeurPage, hauteurPage);

  for (let qualite = 90; qualite >= 60; qualite -= 5) {
    const jpeg = await canevas.encode("jpeg", qualite);
    if (jpeg.length <= OCTETS_MAX) return jpeg;
  }
  throw new Error(`${epingle.fichier} : plus de ${OCTETS_MAX} octets même en qualité 60`);
}

async function principal(): Promise<void> {
  await mkdir(DOSSIER, { recursive: true });
  enregistrerPolices();

  const fichiers = new Set<string>();
  for (const epingle of EPINGLES) {
    if (fichiers.has(epingle.fichier)) throw new Error(`Fichier en double au calendrier : ${epingle.fichier}`);
    if (!/^[a-z0-9-]+\.jpg$/.test(epingle.fichier)) throw new Error(`Nom de fichier refusé : ${epingle.fichier}`);
    fichiers.add(epingle.fichier);
  }

  const jeux = new Map<IdJeu, JeuRendu>();
  const manifeste: Record<string, { octets: number; largeur: number; hauteur: number }> = {};
  for (const epingle of EPINGLES) {
    let jeu = jeux.get(epingle.jeu);
    if (!jeu) {
      jeu = await rendreLeJeu(epingle.jeu);
      jeux.set(epingle.jeu, jeu);
    }
    const indice = trouverLaPage(epingle, jeu);
    const jpeg = await composer(epingle, jeu, indice);
    await writeFile(path.join(DOSSIER, epingle.fichier), jpeg);
    manifeste[epingle.fichier] = { octets: jpeg.length, largeur: LARGEUR, hauteur: HAUTEUR };
    console.log(`${epingle.fichier.padEnd(48)} page ${String(indice + 1).padStart(2)}  ${(jpeg.length / 1024).toFixed(0).padStart(4)} Ko`);
  }

  // Les images sorties du calendrier ne restent pas.
  for (const nom of await readdir(DOSSIER)) {
    if (nom.endsWith(".jpg") && !fichiers.has(nom)) {
      await rm(path.join(DOSSIER, nom));
      console.log(`${nom} : effacée (hors du calendrier)`);
    }
  }

  const lignes = Object.keys(manifeste)
    .sort()
    .map((nom) => {
      const { octets, largeur, hauteur } = manifeste[nom]!;
      return `  "${nom}": { octets: ${octets}, largeur: ${largeur}, hauteur: ${hauteur} },`;
    });
  await writeFile(
    MANIFESTE,
    [
      "/** Produit par `npm run epingles` : ne pas modifier à la main. La taille réelle de chaque image de public/epingles/. */",
      "export const IMAGES: Record<string, { octets: number; largeur: number; hauteur: number }> = {",
      ...lignes,
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  console.log(`\n${EPINGLES.length} images dans public/epingles/, tailles dans src/epingles/images.ts.`);
}

await principal();
