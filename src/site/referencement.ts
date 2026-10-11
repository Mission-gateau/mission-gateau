import type { Metadata } from "next";
import { GUIDES, TEXTES_GUIDES } from "../contenu/guides";
import { PAGES_PUBLIQUES } from "../contenu/referencement";
import { SITE } from "../contenu/site";
import { enProduction, lireEnvironnement } from "../vente/environnement";

/**
 * Ce que voient les moteurs de recherche.
 *
 * Seule la production montre ses pages publiques — accueil, /creer, /guides
 * et chaque guide, pages légales et crédits — aux moteurs. Tout le reste
 * porte `noindex, nofollow`, en en-tête (`X-Robots-Tag`, posé par
 * src/proxy.ts) et en balise : les pages de commande, /renoncer, les routes
 * /api, la page 404, et tout ce qui n'est pas la production (préversions,
 * local), quel que soit le chemin. L'environnement est lu à chaque requête,
 * jamais au build. Aucun service de Google n'est appelé par le site.
 */

/** L'adresse canonique du site : celle de production, en `www`. */
export const ADRESSE_CANONIQUE = "https://www.missiongateau.com";

export const NOINDEX = "noindex, nofollow";

/** Les pages publiques, avec la date de la dernière modification de leur contenu. */
export function pagesPubliques(): { chemin: string; titre: string; description: string; modifieLe: string }[] {
  return [
    ...Object.entries(PAGES_PUBLIQUES).map(([chemin, page]) => ({ chemin, ...page })),
    {
      chemin: "/guides",
      titre: TEXTES_GUIDES.titre,
      description: TEXTES_GUIDES.description,
      modifieLe: GUIDES.map((guide) => guide.modifieLe).sort().at(-1)!,
    },
    ...GUIDES.map((guide) => ({
      chemin: `/guides/${guide.adresse}`,
      titre: guide.titre,
      description: guide.description,
      modifieLe: guide.modifieLe,
    })),
  ];
}

export function estPublique(chemin: string): boolean {
  return pagesPubliques().some((page) => page.chemin === chemin);
}

/** La production, lue à l'exécution (VERCEL_ENV). */
export function productionMaintenant(): boolean {
  return enProduction(lireEnvironnement());
}

/**
 * L'en-tête `X-Robots-Tag` d'une requête : `noindex, nofollow` partout hors
 * production ; en production, sur tout chemin de page qui n'est pas public
 * (commande, rétractation, routes /api, adresses inconnues qui mènent à la
 * page 404). Les fichiers servis tels quels (icônes, polices, robots.txt,
 * plan du site) n'en portent pas en production.
 */
export function enTeteRobots(chemin: string, production: boolean): string | null {
  if (!production) return NOINDEX;
  if (estPublique(chemin)) return null;
  const fichier = /\/[^/]+\.[a-z0-9]+$/i.test(chemin) && !chemin.startsWith("/api/");
  return fichier ? null : NOINDEX;
}

/** robots.txt : en production, tout sauf /api/, /commande/ et /renoncer, et le plan du site ; ailleurs, rien. */
export function robotsTxt(production: boolean): string {
  if (!production) return "User-Agent: *\nDisallow: /\n";
  return [
    "User-Agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /commande/",
    "Disallow: /renoncer",
    "",
    `Sitemap: ${ADRESSE_CANONIQUE}/sitemap.xml`,
    "",
  ].join("\n");
}

function echapperXml(texte: string): string {
  return texte.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Le plan du site : les pages publiques, adresses absolues en `www`, date réelle de la dernière modification. */
export function planDuSite(): string {
  const urls = pagesPubliques().map(
    (page) =>
      `  <url>\n    <loc>${echapperXml(`${ADRESSE_CANONIQUE}${page.chemin === "/" ? "/" : page.chemin}`)}</loc>\n    <lastmod>${page.modifieLe}</lastmod>\n  </url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/**
 * Les métadonnées d'une page publique : titre, description, adresse
 * canonique absolue en `www`, balises Open Graph (l'image est l'icône du
 * gâteau, servie par notre domaine), et `index, follow` en production
 * seulement. Lues à chaque requête : les pages sont rendues à la demande.
 */
export function metadonneesDePage(chemin: string, production = productionMaintenant()): Metadata {
  const page = pagesPubliques().find((candidate) => candidate.chemin === chemin);
  if (!page) throw new Error(`Page publique inconnue : ${chemin}`);
  const url = `${ADRESSE_CANONIQUE}${chemin === "/" ? "/" : chemin}`;
  return {
    title: chemin === "/" ? { absolute: page.titre } : page.titre,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      type: chemin.startsWith("/guides/") ? "article" : "website",
      locale: "fr_FR",
      siteName: SITE.nom,
      title: page.titre,
      description: page.description,
      url,
      images: [{ url: `${ADRESSE_CANONIQUE}/icones/gateau.png`, width: 128, height: 128, alt: SITE.nom }],
    },
    robots: production ? { index: true, follow: true } : { index: false, follow: false, nocache: true },
  };
}
