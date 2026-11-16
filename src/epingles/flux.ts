import { TEXTES_EPINGLES } from "../contenu/epingles";
import { CACHETTES_ENIGMES } from "../contenu/guides/cachettes";
import { CHASSE_4_6_ANS } from "../contenu/guides/chasse";
import { DEROULE } from "../contenu/guides/deroule";
import { ESCAPE_10_12_ANS } from "../contenu/guides/escape";
import { MISSION_7_9_ANS } from "../contenu/guides/mission";
import { formatPourAge, TRANCHES_AGE } from "../engine/configuration";
import { remplir } from "../engine/texte";
import type { IdFormat } from "../engine/types";
import { ADRESSE_CANONIQUE } from "../site/referencement";
import { EPINGLES, HEURE_DE_PUBLICATION, JEUX, type Epingle, type IdFlux, type IdGuideEpingle } from "./calendrier";
import { IMAGES } from "./images";

/**
 * Les flux RSS 2.0 des épingles, un par tableau Pinterest, servis sous
 * /epingles/<flux>.xml. Pinterest les lit et crée une épingle par article
 * nouveau : l'image vient de `<enclosure>` et de `<media:content>`, le titre
 * et la description de ceux de l'article, le lien mène au guide concerné.
 *
 * Un flux ne montre que les articles dont la date de publication est passée
 * à l'heure de la requête, du plus récent au plus ancien, 50 au plus.
 */

/** Les quatre flux, dans l'ordre du README. Changer une adresse oblige à rebrancher le compte Pinterest. */
export const FLUX: readonly IdFlux[] = ["chasse-4-6-ans", "mission-7-9-ans", "escape-game-10-12-ans", "idees-anniversaire"];

/** Le plus grand nombre d'articles d'un flux. */
export const ARTICLES_PAR_FLUX = 50;

/** La durée de mise en cache d'un flux, en secondes : une heure au plus. */
export const CACHE_DU_FLUX = 3600;

const GUIDES_EPINGLES: Record<IdGuideEpingle, { adresse: string }> = {
  chasse: CHASSE_4_6_ANS,
  mission: MISSION_7_9_ANS,
  escape: ESCAPE_10_12_ANS,
  deroule: DEROULE,
  cachettes: CACHETTES_ENIGMES,
};

/** Le lien d'un flux lui-même : le guide de son format, ou la liste des guides. */
const GUIDE_DU_FLUX: Record<IdFlux, IdGuideEpingle | null> = {
  "chasse-4-6-ans": "chasse",
  "mission-7-9-ans": "mission",
  "escape-game-10-12-ans": "escape",
  "idees-anniversaire": null,
};

export function adresseDuFlux(flux: IdFlux): string {
  return `${ADRESSE_CANONIQUE}/epingles/${flux}.xml`;
}

export function adresseDeLImage(fichier: string): string {
  return `${ADRESSE_CANONIQUE}/epingles/${fichier}`;
}

/** L'heure de publication d'une épingle. */
export function publicationDe(epingle: Epingle): Date {
  return new Date(`${epingle.date}T${HEURE_DE_PUBLICATION}`);
}

/** Le lien d'un article : le guide, avec les paramètres `utm_*` que garde la mesure d'audience. */
export function lienDe(epingle: Epingle): string {
  const parametres = new URLSearchParams({
    utm_source: "pinterest",
    utm_medium: "social",
    utm_campaign: epingle.flux,
    // Un lien distinct par épingle : Pinterest n'en confond pas deux, et la
    // mesure d'audience sait laquelle a amené la visite.
    utm_content: epingle.fichier.replace(/\.jpg$/, ""),
  });
  return `${ADRESSE_CANONIQUE}/guides/${GUIDES_EPINGLES[epingle.guide].adresse}?${parametres.toString()}`;
}

function valeursDe(epingle: Epingle): Record<string, string | number> {
  const jeu = JEUX[epingle.jeu];
  const format: IdFormat = formatPourAge(jeu.age);
  const page = epingle.page;
  const enigmes = "enigmes" in page ? page.enigmes.map((type) => TEXTES_EPINGLES.enigmes[type]) : [];
  return {
    age: jeu.age,
    prenom: jeu.prenom,
    theme: TEXTES_EPINGLES.themes[jeu.theme],
    tranche: TRANCHES_AGE[format],
    jeu: TEXTES_EPINGLES.formats[format].jeu,
    enigmes: enigmes.join(TEXTES_EPINGLES.et),
    enigme: enigmes[0] ?? "",
  };
}

/** Le titre écrit en haut de l'image, sur deux lignes. */
export function titreDeLImage(epingle: Epingle): [string, string] {
  const valeurs = valeursDe(epingle);
  const format = formatPourAge(JEUX[epingle.jeu].age);
  if (epingle.guide === "deroule" || epingle.guide === "cachettes") {
    return [TEXTES_EPINGLES.guides[epingle.guide].image, remplir(TEXTES_EPINGLES.sousTitreGuide, valeurs)];
  }
  return [TEXTES_EPINGLES.formats[format].image, remplir(TEXTES_EPINGLES.sousTitreFormat, valeurs)];
}

/** Le titre de l'article (et de l'épingle) : 100 caractères au plus. */
export function titreDe(epingle: Epingle): string {
  const valeurs = valeursDe(epingle);
  if (epingle.guide === "deroule" || epingle.guide === "cachettes") {
    return remplir(TEXTES_EPINGLES.guides[epingle.guide].titre, valeurs);
  }
  const format = formatPourAge(JEUX[epingle.jeu].age);
  const debut = remplir(TEXTES_EPINGLES.formats[format].titre, valeurs);
  const fin = remplir(TEXTES_EPINGLES.pages[epingle.page.section].titre, valeurs);
  return `${debut}, thème ${valeurs.theme} : ${fin}`;
}

/** La description de l'article (et de l'épingle), en texte simple : 500 caractères au plus. */
export function descriptionDe(epingle: Epingle): string {
  const valeurs = valeursDe(epingle);
  const page = remplir(TEXTES_EPINGLES.pages[epingle.page.section].phrase, valeurs);
  if (epingle.guide === "deroule" || epingle.guide === "cachettes") {
    return [page, TEXTES_EPINGLES.guides[epingle.guide].phrase, TEXTES_EPINGLES.finGuide].join(" ");
  }
  const format = formatPourAge(JEUX[epingle.jeu].age);
  return [page, remplir(TEXTES_EPINGLES.formats[format].phrase, valeurs), TEXTES_EPINGLES.finFormat].join(" ");
}

/** Les articles d'un flux publiés à l'heure dite, du plus récent au plus ancien, 50 au plus. */
export function articlesDuFlux(flux: IdFlux, maintenant: Date): Epingle[] {
  return EPINGLES.filter((epingle) => epingle.flux === flux && publicationDe(epingle).getTime() <= maintenant.getTime())
    .sort((a, b) => publicationDe(b).getTime() - publicationDe(a).getTime() || b.fichier.localeCompare(a.fichier))
    .slice(0, ARTICLES_PAR_FLUX);
}

function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function article(epingle: Epingle): string {
  const image = IMAGES[epingle.fichier];
  if (!image) throw new Error(`Image d'épingle absente de src/epingles/images.ts : ${epingle.fichier}`);
  const url = echapper(adresseDeLImage(epingle.fichier));
  return [
    "    <item>",
    `      <title>${echapper(titreDe(epingle))}</title>`,
    `      <link>${echapper(lienDe(epingle))}</link>`,
    `      <description>${echapper(descriptionDe(epingle))}</description>`,
    `      <guid isPermaLink="false">missiongateau-epingle-${echapper(epingle.fichier.replace(/\.jpg$/, ""))}</guid>`,
    `      <pubDate>${publicationDe(epingle).toUTCString()}</pubDate>`,
    `      <enclosure url="${url}" type="image/jpeg" length="${image.octets}"/>`,
    `      <media:content url="${url}" medium="image" type="image/jpeg" width="${image.largeur}" height="${image.hauteur}"/>`,
    "    </item>",
  ].join("\n");
}

/** Le flux RSS 2.0 complet, tel qu'il est servi à l'heure `maintenant`. */
export function fluxRss(flux: IdFlux, maintenant: Date): string {
  const textes = TEXTES_EPINGLES.flux[flux];
  const guide = GUIDE_DU_FLUX[flux];
  const lien = guide ? `${ADRESSE_CANONIQUE}/guides/${GUIDES_EPINGLES[guide].adresse}` : `${ADRESSE_CANONIQUE}/guides`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${echapper(textes.titre)}</title>`,
    `    <link>${echapper(lien)}</link>`,
    `    <description>${echapper(textes.description)}</description>`,
    "    <language>fr-FR</language>",
    `    <atom:link href="${echapper(adresseDuFlux(flux))}" rel="self" type="application/rss+xml"/>`,
    ...articlesDuFlux(flux, maintenant).map(article),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

/** La réponse HTTP d'un flux : lue à chaque requête, gardée une heure au plus par le CDN, jamais par le navigateur. */
export function reponseDuFlux(flux: IdFlux, maintenant = new Date()): Response {
  return new Response(fluxRss(flux, maintenant), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": `public, max-age=0, s-maxage=${CACHE_DU_FLUX}`,
    },
  });
}
