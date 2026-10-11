import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Le site visible de Google (lot 8, § 3) et la mesure d'audience (§ 5).
 * L'environnement est commandé par VERCEL_ENV, lu à chaque requête.
 */
const etat = vi.hoisted(() => ({ ouverte: false, apercus: [] as unknown[] }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }), notFound: () => { throw new Error("404"); } }));
vi.mock("@/vente/ouverture", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/vente/ouverture")>();
  return { ...original, venteOuverteMaintenant: () => etat.ouverte };
});
// Le composant de mesure ne s'exécute que dans un navigateur : un repère suffit à savoir s'il est rendu.
vi.mock("@/composants/MesureDAudience", () => ({ MesureDAudience: () => <meta name="mesure-d-audience" /> }));
vi.mock("@vercel/analytics", () => ({ track: (...args: unknown[]) => etat.apercus.push(args) }));

import RootLayout from "@/app/layout";
import Accueil, { generateMetadata as metaAccueil } from "@/app/page";
import Cgv, { generateMetadata as metaCgv } from "@/app/cgv/page";
import Confidentialite, { generateMetadata as metaConfidentialite } from "@/app/confidentialite/page";
import Creer, { generateMetadata as metaCreer } from "@/app/creer/page";
import Credits, { generateMetadata as metaCredits } from "@/app/credits/page";
import Guides, { generateMetadata as metaGuides } from "@/app/guides/page";
import PageDUnGuide, { generateMetadata as metaGuide } from "@/app/guides/[adresse]/page";
import MentionsLegales, { generateMetadata as metaMentions } from "@/app/mentions-legales/page";
import { metadata as metaLayout } from "@/app/layout";
import { metadata as metaRenoncer } from "@/app/renoncer/page";
import { metadata as metaCommande } from "@/app/commande/[ref]/page";
import { GET as robots } from "@/app/robots.txt/route";
import { GET as planDuSite } from "@/app/sitemap.xml/route";
import { adresseMesuree, avantEnvoi, compterLApercu } from "@/composants/mesure";
import { GUIDES } from "@/contenu/guides";
import { PAGES_PUBLIQUES } from "@/contenu/referencement";
import { proxy } from "@/proxy";
import { ADRESSE_CANONIQUE, enTeteRobots, pagesPubliques } from "@/site/referencement";
import { ressourcesExternes } from "./ressources-externes";

const PUBLIQUES = [
  "/",
  "/creer",
  "/guides",
  ...GUIDES.map((guide) => `/guides/${guide.adresse}`),
  "/mentions-legales",
  "/cgv",
  "/confidentialite",
  "/credits",
];
const MASQUEES = ["/commande/AbCdEfGhIjKlMnOpQrStUv", "/renoncer", "/api/renoncer", "/api/commande", "/api/effacement", "/une-adresse-inconnue", "/guides/inconnu"];

function enProduction(): void {
  vi.stubEnv("VERCEL_ENV", "production");
}

afterEach(() => {
  vi.unstubAllEnvs();
  etat.ouverte = false;
  etat.apercus = [];
});

async function enTeteDuProxy(chemin: string): Promise<string | null> {
  const reponse = proxy(new NextRequest(`https://www.missiongateau.com${chemin}`));
  return reponse.headers.get("X-Robots-Tag");
}

describe("noindex selon l'environnement et le chemin", () => {
  it("en production : les pages publiques sans noindex ; commande, rétractation, /api et 404 en noindex", async () => {
    enProduction();
    for (const chemin of PUBLIQUES) expect(await enTeteDuProxy(chemin), chemin).toBeNull();
    for (const chemin of MASQUEES) expect(await enTeteDuProxy(chemin), chemin).toBe("noindex, nofollow");
    // Les fichiers servis tels quels n'en portent pas ; une adresse avec paramètres reste la même page.
    expect(await enTeteDuProxy("/favicon.ico")).toBeNull();
    expect(await enTeteDuProxy("/icones/gateau.png")).toBeNull();
    expect(await enTeteDuProxy("/?utm_source=pinterest")).toBeNull();
  });

  for (const environnement of ["preview", "development", undefined]) {
    it(`hors production (${environnement ?? "local"}) : tout en noindex, quel que soit le chemin`, async () => {
      if (environnement) vi.stubEnv("VERCEL_ENV", environnement);
      for (const chemin of [...PUBLIQUES, ...MASQUEES, "/favicon.ico", "/robots.txt", "/sitemap.xml"]) {
        expect(await enTeteDuProxy(chemin), chemin).toBe("noindex, nofollow");
      }
    });
  }

  it("la balise : index en production pour les pages publiques seulement ; noindex partout ailleurs", async () => {
    const metas = [metaAccueil, metaCreer, metaGuides, metaMentions, metaCgv, metaConfidentialite, metaCredits];
    for (const production of [true, false]) {
      vi.unstubAllEnvs();
      if (production) enProduction();
      else vi.stubEnv("VERCEL_ENV", "preview");
      for (const meta of metas) {
        expect(meta().robots, String(production)).toEqual(production ? { index: true, follow: true } : { index: false, follow: false, nocache: true });
      }
      for (const guide of GUIDES) {
        expect((await metaGuide({ params: Promise.resolve({ adresse: guide.adresse }) })).robots).toEqual(
          production ? { index: true, follow: true } : { index: false, follow: false, nocache: true },
        );
      }
    }
    // Le défaut de la mise en page (et donc de la page 404), la commande et la rétractation : jamais indexées.
    expect(metaLayout.robots).toMatchObject({ index: false, follow: false });
    expect(metaRenoncer.robots).toMatchObject({ index: false, follow: false });
    expect(metaCommande.robots).toMatchObject({ index: false, follow: false });
  });

  it("next.config.ts ne pose plus de noindex fixe : l'en-tête dépend de l'environnement", () => {
    expect(readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8")).not.toMatch(/value: "noindex/);
    expect(enTeteRobots("/", true)).toBeNull();
    expect(enTeteRobots("/", false)).toBe("noindex, nofollow");
  });
});

describe("robots.txt et plan du site", () => {
  it("robots.txt : en production, tout sauf /api/, /commande/ et /renoncer, avec le plan du site ; ailleurs, rien", async () => {
    enProduction();
    const production = await robots().text();
    expect(production).toBe(
      "User-Agent: *\nAllow: /\nDisallow: /api/\nDisallow: /commande/\nDisallow: /renoncer\n\nSitemap: https://www.missiongateau.com/sitemap.xml\n",
    );
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(await robots().text()).toBe("User-Agent: *\nDisallow: /\n");
    vi.unstubAllEnvs();
    expect(await robots().text()).toBe("User-Agent: *\nDisallow: /\n");
  });

  it("/sitemap.xml : les pages publiques, en adresses absolues www, avec la date réelle de leur contenu ; 404 hors production", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(planDuSite().status).toBe(404);
    enProduction();
    const reponse = planDuSite();
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("Content-Type")).toContain("application/xml");
    const xml = await reponse.text();
    const adresses = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((trouve) => trouve[1]);
    expect(adresses.sort()).toEqual(PUBLIQUES.map((chemin) => `https://www.missiongateau.com${chemin}`).sort());
    const dates = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((trouve) => trouve[1]!);
    expect(dates).toHaveLength(PUBLIQUES.length);
    // La date du contenu, écrite avec lui, jamais celle du build : aucune n'est dans le futur, chacune vient du contenu.
    for (const page of pagesPubliques()) expect(xml).toContain(`<loc>${ADRESSE_CANONIQUE}${page.chemin}</loc>\n    <lastmod>${page.modifieLe}</lastmod>`);
    for (const date of dates) expect(date <= "2026-10-11" || date <= new Date().toISOString().slice(0, 10), date).toBe(true);
    expect(PAGES_PUBLIQUES["/credits"].modifieLe).toBe("2026-09-23");
  });

  it("/favicon.ico sert l'icône du gâteau existante", () => {
    const ico = readFileSync(path.join(process.cwd(), "src/app/favicon.ico"));
    const png = readFileSync(path.join(process.cwd(), "src/app/icon.png"));
    expect(ico.subarray(0, 4)).toEqual(Buffer.from([0, 0, 1, 0]));
    expect(ico.subarray(22)).toEqual(png);
  });
});

describe("les pages publiques", () => {
  it("ont chacune un titre et une description propres, une adresse canonique absolue en www et Open Graph", async () => {
    enProduction();
    const metas = [
      metaAccueil(),
      metaCreer(),
      metaGuides(),
      metaMentions(),
      metaCgv(),
      metaConfidentialite(),
      metaCredits(),
      ...(await Promise.all(GUIDES.map((guide) => metaGuide({ params: Promise.resolve({ adresse: guide.adresse }) })))),
    ];
    const titres = new Set<string>();
    const descriptions = new Set<string>();
    for (const [rang, meta] of metas.entries()) {
      const titre = typeof meta.title === "string" ? meta.title : (meta.title as { absolute: string }).absolute;
      titres.add(titre);
      descriptions.add(String(meta.description));
      expect(String(meta.description).length, titre).toBeLessThanOrEqual(160);
      const canonique = String(meta.alternates?.canonical);
      expect(canonique, titre).toMatch(/^https:\/\/www\.missiongateau\.com\//);
      expect(meta.openGraph, titre).toMatchObject({ title: titre, description: meta.description, url: canonique, locale: "fr_FR" });
      const image = (meta.openGraph!.images as { url: string }[])[0]!.url;
      expect(image).toBe("https://www.missiongateau.com/icones/gateau.png");
      expect(rang === 0 ? canonique === "https://www.missiongateau.com/" : true).toBe(true);
    }
    expect(titres.size).toBe(metas.length);
    expect(descriptions.size).toBe(metas.length);
  });

  it("aucune ne charge de ressource d'un autre domaine, vente fermée ou ouverte, et la langue est le français", async () => {
    enProduction();
    for (const ouverte of [false, true]) {
      etat.ouverte = ouverte;
      const pages: [string, React.ReactElement][] = [
        ["/", <Accueil key="a" />],
        ["/creer", <Creer key="c" />],
        ["/guides", <Guides key="g" />],
        ["/mentions-legales", <MentionsLegales key="m" />],
        ["/cgv", <Cgv key="v" />],
        ["/confidentialite", <Confidentialite key="p" />],
        ["/credits", <Credits key="r" />],
      ];
      for (const guide of GUIDES) pages.push([guide.adresse, await PageDUnGuide({ params: Promise.resolve({ adresse: guide.adresse }) })]);
      for (const [chemin, element] of pages) {
        const html = renderToStaticMarkup(<RootLayout>{element}</RootLayout>);
        expect(ressourcesExternes(html), chemin).toEqual([]);
        expect(html, chemin).toMatch(/^<html lang="fr"/);
      }
    }
  });

  it("l'accueil et le pied de page mènent aux guides", () => {
    const html = renderToStaticMarkup(<Accueil />);
    expect(html).toContain('href="/guides"');
    for (const guide of GUIDES) expect(html).toContain(`href="/guides/${guide.adresse}"`);
  });
});

describe("mesure des visites (Vercel Web Analytics)", () => {
  function avecMesure(): boolean {
    return renderToStaticMarkup(<RootLayout><main /></RootLayout>).includes('name="mesure-d-audience"');
  }

  it("n'est rendue qu'en production", () => {
    expect(avecMesure()).toBe(false);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(avecMesure()).toBe(false);
    enProduction();
    expect(avecMesure()).toBe(true);
  });

  it("n'envoie jamais de référence de commande, de session Stripe ni d'adresse e-mail ; garde la provenance utm", () => {
    expect(adresseMesuree("https://www.missiongateau.com/commande/AbCdEfGhIjKlMnOpQrStUv?session_id=cs_test_a1b2c3")).toBe(
      "https://www.missiongateau.com/commande/[ref]",
    );
    expect(adresseMesuree("https://www.missiongateau.com/renoncer?ref=AbCdEfGhIjKlMnOpQrStUv&session_id=cs_test_a1b2c3")).toBe(
      "https://www.missiongateau.com/renoncer",
    );
    expect(adresseMesuree("https://www.missiongateau.com/?utm_source=pinterest&email=parent%40exemple.fr#haut")).toBe(
      "https://www.missiongateau.com/?utm_source=pinterest",
    );
    expect(adresseMesuree("https://www.missiongateau.com/guides?utm_source=instagram")).toBe("https://www.missiongateau.com/guides?utm_source=instagram");
    expect(avantEnvoi({ type: "pageview", url: "https://www.missiongateau.com/commande/AbCdEfGhIjKlMnOpQrStUv" })).toEqual({
      type: "pageview",
      url: "https://www.missiongateau.com/commande/[ref]",
    });
    expect(avantEnvoi({ url: "pas une adresse" })).toBeNull();
  });

  it("le compteur des aperçus n'envoie que l'âge et la durée", () => {
    compterLApercu(8, 45);
    expect(etat.apercus).toEqual([["apercu", { age: 8, duree: 45 }]]);
  });
});
