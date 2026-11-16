import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GUIDES } from "@/contenu/guides";
import { TEXTES_EPINGLES } from "@/contenu/epingles";
import { formatPourAge, TRANCHES_AGE } from "@/engine/configuration";
import { EPINGLES, JEUX, type IdFlux } from "@/epingles/calendrier";
import { articlesDuFlux, descriptionDe, FLUX, fluxRss, lienDe, titreDe } from "@/epingles/flux";
import { IMAGES } from "@/epingles/images";
import { proxy } from "@/proxy";
import { GET as fluxChasse } from "@/app/epingles/chasse-4-6-ans.xml/route";
import { GET as fluxMission } from "@/app/epingles/mission-7-9-ans.xml/route";
import { GET as fluxEscape } from "@/app/epingles/escape-game-10-12-ans.xml/route";
import { GET as fluxIdees } from "@/app/epingles/idees-anniversaire.xml/route";
import { fautes } from "./orthographe";

/**
 * Les épingles Pinterest (lot 10) : les images de public/epingles/, le
 * calendrier, les quatre flux RSS 2.0 et le refus des adresses en %5C.
 */

const SITE = "https://www.missiongateau.com";
const DOSSIER = path.join(process.cwd(), "public", "epingles");
const MEDIA = "http://search.yahoo.com/mrss/";
const ROUTES: Record<IdFlux, () => Response> = {
  "chasse-4-6-ans": fluxChasse,
  "mission-7-9-ans": fluxMission,
  "escape-game-10-12-ans": fluxEscape,
  "idees-anniversaire": fluxIdees,
};
const FORMATS: { flux: IdFlux; guide: string }[] = [
  { flux: "chasse-4-6-ans", guide: "chasse" },
  { flux: "mission-7-9-ans", guide: "mission" },
  { flux: "escape-game-10-12-ans", guide: "escape" },
];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** Relit un flux avec un vrai analyseur XML (celui de jsdom) ; une erreur de syntaxe fait échouer le test. */
function lireXml(xml: string): Document {
  const document = new new JSDOM("").window.DOMParser().parseFromString(xml, "application/xml");
  const erreur = document.getElementsByTagName("parsererror")[0];
  if (erreur) throw new Error(`XML invalide : ${erreur.textContent}`);
  return document;
}

interface ArticleLu {
  titre: string;
  lien: string;
  description: string;
  guid: string;
  guidPermalien: string | null;
  pubDate: string;
  enclosure: { url: string; type: string; length: string };
  media: { url: string; medium: string; type: string; width: string; height: string };
}

/** Le flux relu : vérifie au passage la forme RSS 2.0 et rend ses articles. */
function lireFlux(xml: string): { titre: string; lien: string; articles: ArticleLu[] } {
  const document = lireXml(xml);
  const rss = document.documentElement;
  expect(rss.tagName).toBe("rss");
  expect(rss.getAttribute("version")).toBe("2.0");
  const canaux = Array.from(rss.children).filter((e) => e.tagName === "channel");
  expect(canaux).toHaveLength(1);
  const canal = canaux[0]!;
  const enfant = (parent: Element, nom: string) => {
    const trouves = Array.from(parent.children).filter((e) => e.tagName === nom);
    expect(trouves, nom).toHaveLength(1);
    return trouves[0]!;
  };
  for (const nom of ["title", "link", "description"]) expect(enfant(canal, nom).textContent!.length).toBeGreaterThan(0);
  const articles = Array.from(canal.children)
    .filter((e) => e.tagName === "item")
    .map((item): ArticleLu => {
      const guid = enfant(item, "guid");
      const enclosure = enfant(item, "enclosure");
      const medias = item.getElementsByTagNameNS(MEDIA, "content");
      expect(medias).toHaveLength(1);
      const media = medias[0]!;
      return {
        titre: enfant(item, "title").textContent!,
        lien: enfant(item, "link").textContent!,
        description: enfant(item, "description").textContent!,
        guid: guid.textContent!,
        guidPermalien: guid.getAttribute("isPermaLink"),
        pubDate: enfant(item, "pubDate").textContent!,
        enclosure: {
          url: enclosure.getAttribute("url")!,
          type: enclosure.getAttribute("type")!,
          length: enclosure.getAttribute("length")!,
        },
        media: {
          url: media.getAttribute("url")!,
          medium: media.getAttribute("medium")!,
          type: media.getAttribute("type")!,
          width: media.getAttribute("width")!,
          height: media.getAttribute("height")!,
        },
      };
    });
  return { titre: enfant(canal, "title").textContent!, lien: enfant(canal, "link").textContent!, articles };
}

/** Largeur et hauteur d'un JPEG, lues dans son en-tête de trame (SOF). */
function dimensionsJpeg(octets: Buffer): { largeur: number; hauteur: number } {
  expect(octets[0]).toBe(0xff);
  expect(octets[1]).toBe(0xd8);
  let i = 2;
  while (i < octets.length) {
    if (octets[i] !== 0xff) throw new Error("JPEG illisible");
    const marqueur = octets[i + 1]!;
    const longueur = octets.readUInt16BE(i + 2);
    if (marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur)) {
      return { hauteur: octets.readUInt16BE(i + 5), largeur: octets.readUInt16BE(i + 7) };
    }
    i += 2 + longueur;
  }
  throw new Error("JPEG sans en-tête de trame");
}

describe("les flux RSS des épingles", () => {
  it("les quatre flux sont du XML valide en RSS 2.0, à toute date du calendrier", () => {
    for (const flux of FLUX) {
      for (const date of ["2026-11-16T12:00:00Z", "2026-11-17T12:00:00Z", "2026-12-25T12:00:00Z", "2030-01-01T00:00:00Z"]) {
        const lu = lireFlux(fluxRss(flux, new Date(date)));
        expect(lu.titre).toBe(TEXTES_EPINGLES.flux[flux].titre);
        expect(lu.lien.startsWith(`${SITE}/guides`)).toBe(true);
      }
    }
  });

  it("seuls les articles publiés y figurent : vide avant le 17/11, un le 17/11, trois le 21/11", () => {
    for (const flux of FLUX) {
      expect(lireFlux(fluxRss(flux, new Date("2026-11-16T23:59:59Z"))).articles, flux).toHaveLength(0);
      expect(lireFlux(fluxRss(flux, new Date("2026-11-17T12:00:00Z"))).articles, flux).toHaveLength(1);
      expect(lireFlux(fluxRss(flux, new Date("2026-11-19T12:00:00Z"))).articles, flux).toHaveLength(2);
      const le21 = lireFlux(fluxRss(flux, new Date("2026-11-21T12:00:00Z"))).articles;
      expect(le21, flux).toHaveLength(3);
      // Du plus récent au plus ancien.
      const dates = le21.map((article) => Date.parse(article.pubDate));
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
      expect(new Date(dates[0]!).toISOString()).toBe("2026-11-21T06:00:00.000Z");
      expect(new Date(dates[2]!).toISOString()).toBe("2026-11-17T06:00:00.000Z");
    }
  });

  it("un article n'apparaît qu'à son heure de publication, et un flux en garde 50 au plus", () => {
    expect(articlesDuFlux("chasse-4-6-ans", new Date("2026-11-17T05:59:59Z"))).toHaveLength(0);
    expect(articlesDuFlux("chasse-4-6-ans", new Date("2026-11-17T06:00:00Z"))).toHaveLength(1);
    for (const flux of FLUX) {
      const tous = EPINGLES.filter((epingle) => epingle.flux === flux).length;
      expect(articlesDuFlux(flux, new Date("2040-01-01T00:00:00Z"))).toHaveLength(Math.min(50, tous));
    }
  });

  it("les routes lisent l'heure à chaque requête et servent application/rss+xml, gardé une heure au plus", async () => {
    vi.useFakeTimers();
    for (const [flux, route] of Object.entries(ROUTES) as [IdFlux, () => Response][]) {
      vi.setSystemTime(new Date("2026-11-16T12:00:00Z"));
      let reponse = route();
      expect(reponse.status).toBe(200);
      expect(reponse.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8");
      const cache = reponse.headers.get("Cache-Control")!;
      const durees = [...cache.matchAll(/(?:s-)?max-age=(\d+)/g)].map((m) => Number(m[1]));
      expect(durees.length).toBeGreaterThan(0);
      for (const duree of durees) expect(duree).toBeLessThanOrEqual(3600);
      expect(cache).not.toMatch(/stale-while-revalidate|immutable/);
      expect(lireFlux(await reponse.text()).articles, flux).toHaveLength(0);

      vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
      reponse = route();
      expect(lireFlux(await reponse.text()).articles, flux).toHaveLength(3);
    }
  });

  it("chaque lien et chaque image sont en https://www.missiongateau.com ; le lien mène au guide, avec les paramètres utm", () => {
    const adressesDesGuides = new Set(GUIDES.map((guide) => `/guides/${guide.adresse}`));
    for (const flux of FLUX) {
      for (const article of lireFlux(fluxRss(flux, new Date("2040-01-01T00:00:00Z"))).articles) {
        for (const adresse of [article.lien, article.enclosure.url, article.media.url]) {
          expect(adresse.startsWith(`${SITE}/`), adresse).toBe(true);
        }
        const lien = new URL(article.lien);
        expect(adressesDesGuides.has(lien.pathname), article.lien).toBe(true);
        expect(lien.searchParams.get("utm_source")).toBe("pinterest");
        expect(lien.searchParams.get("utm_medium")).toBe("social");
        expect(lien.searchParams.get("utm_campaign")).toBe(flux);
        expect(article.enclosure.url).toBe(article.media.url);
        expect(article.enclosure.type).toBe("image/jpeg");
        expect(article.media).toMatchObject({ medium: "image", type: "image/jpeg", width: "1000", height: "1500" });
        expect(article.guidPermalien).toBe("false");
      }
    }
  });

  it("un flux de format mène au guide de son format ; le flux des idées, aux guides du déroulé et des cachettes", () => {
    const adresse = (cle: string) => GUIDES.find((guide) => guide.adresse.startsWith(cle))!.adresse;
    const attendu: Record<IdFlux, string[]> = {
      "chasse-4-6-ans": [adresse("chasse-au-tresor")],
      "mission-7-9-ans": [adresse("mission")],
      "escape-game-10-12-ans": [adresse("escape-game")],
      "idees-anniversaire": [adresse("deroule"), adresse("cachettes")],
    };
    for (const epingle of EPINGLES) {
      expect(attendu[epingle.flux].map((a) => `/guides/${a}`), epingle.fichier).toContain(new URL(lienDe(epingle)).pathname);
    }
  });

  it("chaque image citée existe dans public/epingles/, fait 1000 × 1500 px et 400 Ko au plus, et length vaut sa taille réelle", () => {
    for (const flux of FLUX) {
      for (const article of lireFlux(fluxRss(flux, new Date("2040-01-01T00:00:00Z"))).articles) {
        const fichier = path.join(DOSSIER, article.enclosure.url.slice(`${SITE}/epingles/`.length));
        const octets = readFileSync(fichier);
        expect(octets.length, fichier).toBeLessThanOrEqual(400 * 1024);
        expect(Number(article.enclosure.length), fichier).toBe(statSync(fichier).size);
        expect(dimensionsJpeg(octets), fichier).toEqual({ largeur: 1000, hauteur: 1500 });
      }
    }
  });

  it("public/epingles/ ne contient que les images du calendrier, et src/epingles/images.ts dit vrai", () => {
    const fichiers = readdirSync(DOSSIER).sort();
    expect(fichiers).toEqual(EPINGLES.map((epingle) => epingle.fichier).sort());
    expect(Object.keys(IMAGES).sort()).toEqual(fichiers);
    for (const fichier of fichiers) {
      const octets = readFileSync(path.join(DOSSIER, fichier));
      expect(IMAGES[fichier], fichier).toEqual({ octets: octets.length, ...dimensionsJpeg(octets) });
    }
  });

  it("titres de 100 caractères au plus, descriptions de 500 au plus, en texte simple", () => {
    for (const epingle of EPINGLES) {
      const titre = titreDe(epingle);
      const description = descriptionDe(epingle);
      expect(titre.length, titre).toBeLessThanOrEqual(100);
      expect(description.length, description).toBeLessThanOrEqual(500);
      expect(description.length, epingle.fichier).toBeGreaterThan(150);
      for (const texte of [titre, description]) {
        expect(texte, texte).not.toMatch(/[<>{}]|https?:/);
      }
    }
  });

  it("aucun titre ni aucune description ne contient de prix, de chiffre de ventes, d'avis ou d'adresse e-mail", () => {
    const interdits: [string, RegExp][] = [
      ["prix", /€|\beuros?\b|\bEUR\b|\bprix\b|\btarif|\bgratuit\s+puis\b|\d+[,.]\d{2}\b/i],
      ["ventes", /\bvend(u|us|ues|ons)\b|\bventes?\b|\bclients?\b|\bcommandes?\b|\bfamilles?\s+(nous\s+)?(ont|font)\b|\d+\s*(000|k)\b/i],
      ["avis", /\bavis\b|\bnotes?\b|\bnoté|★|☆|⭐|\d\s*\/\s*5\b|\bétoiles?\b|\bavis\s+client|\brecommand/i],
      ["e-mail", /@|\b[\w.+-]+@[\w-]+\.[\w.]+\b|\bmail\b|\be-mail\b/i],
    ];
    for (const epingle of EPINGLES) {
      for (const texte of [titreDe(epingle), descriptionDe(epingle)]) {
        for (const [nom, motif] of interdits) expect(texte, `${nom} : ${texte}`).not.toMatch(motif);
      }
    }
    // Le contrôle attrape bien ce qu'il cherche.
    expect("Le jeu complet coûte 12,90 €.").toMatch(interdits[0]![1]);
    expect("Déjà 500 familles l'ont adopté, 4,8/5 d'avis.").toMatch(interdits[2]![1]);
    expect("Écrivez à contact@missiongateau.com").toMatch(interdits[3]![1]);
  });

  it("titres et descriptions passent le correcteur français (les prénoms d'exemple mis à part)", () => {
    const problemes: string[] = [];
    for (const epingle of EPINGLES) {
      const prenom = JEUX[epingle.jeu].prenom;
      for (const texte of [titreDe(epingle), descriptionDe(epingle)]) {
        const inconnus = fautes(texte.replaceAll(prenom, ""));
        if (inconnus.length > 0) problemes.push(`${epingle.fichier} : ${inconnus.join(", ")}`);
      }
    }
    expect(problemes).toEqual([]);
  });

  it("aucun guid en double, aucun fichier en double, des noms de fichier stables", () => {
    const guids = FLUX.flatMap((flux) => lireFlux(fluxRss(flux, new Date("2040-01-01T00:00:00Z"))).articles.map((a) => a.guid));
    expect(guids).toHaveLength(EPINGLES.length);
    expect(new Set(guids).size).toBe(guids.length);
    expect(new Set(EPINGLES.map((epingle) => epingle.fichier)).size).toBe(EPINGLES.length);
    for (const epingle of EPINGLES) expect(epingle.fichier).toMatch(/^[a-z0-9-]+\.jpg$/);
  });
});

describe("le calendrier des épingles", () => {
  it("chaque flux commence le 17/11/2026, puis un article tous les deux jours, sans trou ni doublon", () => {
    for (const flux of FLUX) {
      const dates = EPINGLES.filter((epingle) => epingle.flux === flux).map((epingle) => epingle.date);
      expect(dates[0], flux).toBe("2026-11-17");
      for (let i = 1; i < dates.length; i++) {
        expect(Date.parse(dates[i]!) - Date.parse(dates[i - 1]!), `${flux} ${dates[i]}`).toBe(2 * 24 * 3600 * 1000);
      }
      expect(dates.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)))).toBe(true);
    }
  });

  it("les trois flux de format couvrent au moins jusqu'au 02/01/2027, avec 24 images au moins chacun, 8 par thème", () => {
    for (const { flux, guide } of FORMATS) {
      const epingles = EPINGLES.filter((epingle) => epingle.flux === flux);
      expect(epingles.length, flux).toBeGreaterThanOrEqual(24);
      expect(epingles.at(-1)!.date >= "2027-01-02", flux).toBe(true);
      for (const theme of ["pirates", "agents", "dinosaures"] as const) {
        const duTheme = epingles.filter((epingle) => JEUX[epingle.jeu].theme === theme);
        expect(duTheme.length, `${flux} ${theme}`).toBeGreaterThanOrEqual(8);
        // Des pages de sortes différentes : déroulé, briefing, cartes ou fiches d'énigmes de plusieurs types, diplôme.
        const sections = new Set(duTheme.map((epingle) => epingle.page.section));
        for (const section of ["deroule", "briefing", "diplome"]) expect(sections.has(section as never), `${flux} ${theme} ${section}`).toBe(true);
        const enigmes = new Set(duTheme.flatMap((epingle) => ("enigmes" in epingle.page ? epingle.page.enigmes : [])));
        expect(enigmes.size, `${flux} ${theme}`).toBeGreaterThanOrEqual(3);
        // Plusieurs jeux, des prénoms et des âges différents.
        expect(new Set(duTheme.map((epingle) => epingle.jeu)).size).toBeGreaterThanOrEqual(2);
      }
      for (const epingle of epingles) {
        expect(epingle.guide).toBe(guide);
        expect(TRANCHES_AGE[formatPourAge(JEUX[epingle.jeu].age)], epingle.fichier).toBe(TRANCHES_AGE[guide as "chasse"]);
      }
    }
    expect(EPINGLES.filter((epingle) => epingle.flux !== "idees-anniversaire").length).toBeGreaterThanOrEqual(72);
  });

  it("au moins 10 images pour les guides « déroulé » et « cachettes »", () => {
    const idees = EPINGLES.filter((epingle) => epingle.flux === "idees-anniversaire");
    expect(idees.length).toBeGreaterThanOrEqual(10);
    expect(new Set(idees.map((epingle) => epingle.guide))).toEqual(new Set(["deroule", "cachettes"]));
  });

  it("les jeux d'exemple n'ont aucun champ de la fête, et leurs âges varient dans la tranche du format", () => {
    for (const [id, jeu] of Object.entries(JEUX)) {
      expect(Object.keys(jeu).sort(), id).toEqual(["age", "duree", "graine", "nombreEnfants", "prenom", "theme"]);
      expect(id.startsWith(formatPourAge(jeu.age)), id).toBe(true);
    }
    for (const format of ["chasse", "mission", "escape"]) {
      const ages = new Set(Object.values(JEUX).filter((jeu) => formatPourAge(jeu.age) === format).map((jeu) => jeu.age));
      expect(ages.size, format).toBe(3);
    }
  });
});

describe("les adresses avec une barre oblique inversée", () => {
  function demander(chemin: string) {
    return proxy(new NextRequest(`${SITE}${chemin}`));
  }

  for (const environnement of ["production", "preview"]) {
    it(`${environnement} : /creer%5C, /cgv%5c, /guides%5C… répondent 404 avec noindex`, () => {
      vi.stubEnv("VERCEL_ENV", environnement);
      for (const chemin of ["/creer%5C", "/cgv%5c", "/guides%5C", "/renoncer%5C", "/%5C", "/guides/%5Cchasse", "/creer%5C?utm_source=pinterest"]) {
        const reponse = demander(chemin);
        expect(reponse.status, chemin).toBe(404);
        expect(reponse.headers.get("X-Robots-Tag"), chemin).toMatch(/\bnoindex\b/);
        // Pas de poursuite vers la page : la réponse est finale.
        expect(reponse.headers.get("x-middleware-next"), chemin).toBeNull();
      }
    });
  }

  it("les adresses normales sont inchangées", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    for (const chemin of ["/", "/creer", "/cgv", "/guides", "/guides/chasse-au-tresor-anniversaire-4-6-ans", "/epingles/chasse-4-6-ans.xml"]) {
      const reponse = demander(chemin);
      expect(reponse.headers.get("x-middleware-next"), chemin).toBe("1");
      expect(reponse.headers.get("X-Robots-Tag"), chemin).toBeNull();
    }
    expect(demander("/renoncer").headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(demander("/renoncer").headers.get("x-middleware-next")).toBe("1");
  });
});
