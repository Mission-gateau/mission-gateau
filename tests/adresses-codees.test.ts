import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";
import { FLUX } from "@/epingles/flux";
import { creerReference } from "@/vente/reference";
import { cheminRefuse, enTeteRobots, pagesPubliques } from "@/site/referencement";

/**
 * Les adresses dont le chemin contient un caractère codé en `%XX` (lot 11).
 * Sur Vercel, et seulement là, `/creer%2F`, `/cr%65er`… répondaient 500
 * (« Cannot find module './.next/server/pages/creer%2F.js' ») : le proxy y
 * répond désormais 404 `noindex`, comme aux adresses en `%5C` depuis le
 * lot 10. `next start` répond 404 de lui-même : seul ce test, qui appelle le
 * proxy, et la mesure en production montrent la règle.
 */

const SITE = "https://www.missiongateau.com";

/** Les sept adresses mesurées à 500 en production le 16/11/2026. */
const MESUREES_A_500 = ["/creer%2F", "/creer%2f", "/cgv%2F", "/guides%2F", "/%2F", "/api%2Fcommande", "/cr%65er"];

function enMinuscules(chemin: string): string {
  return chemin.replace(/%[0-9A-F]{2}/gi, (code) => code.toLowerCase());
}

function enMajuscules(chemin: string): string {
  return chemin.replace(/%[0-9A-F]{2}/gi, (code) => code.toUpperCase());
}

const REFUSEES = [
  ...MESUREES_A_500.map(enMajuscules),
  ...MESUREES_A_500.map(enMinuscules),
  // Celles qui répondaient déjà 404, et doivent continuer.
  "/creer%20",
  "/creer%2E",
  "/creer%3F",
  "/creer%255C",
  // Les adresses en %5C du lot 10.
  "/creer%5C",
  "/creer%5c",
  "/cgv%5C",
  "/%5C",
  "/guides/%5Cchasse",
  // Un % ailleurs dans le chemin, sur une page, une route ou un fichier, avec ou sans paramètres.
  "/guides/chasse-au-tresor-anniversaire-4-6-ans%2F",
  "/epingles/chasse-4-6-ans%2Exml",
  "/api/commande%2F",
  "/commande/AbCdEfGhIjKlMnOpQrStUv%2F",
  "/cr%65er?utm_source=pinterest",
  "/%",
  "/creer%",
];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function demander(chemin: string, methode = "GET"): Response {
  return proxy(new NextRequest(`${SITE}${chemin}`, { method: methode }));
}

describe("les adresses dont le chemin contient un %", () => {
  for (const environnement of ["production", "preview", undefined]) {
    it(`${environnement ?? "local"} : les sept adresses mesurées à 500, en majuscules et en minuscules, et les %5C répondent 404 avec noindex`, async () => {
      if (environnement) vi.stubEnv("VERCEL_ENV", environnement);
      const erreurs = vi.spyOn(console, "error");
      for (const chemin of REFUSEES) {
        for (const methode of ["GET", "POST", "HEAD"]) {
          const reponse = demander(chemin, methode);
          expect(reponse.status, `${methode} ${chemin}`).toBe(404);
          expect(reponse.headers.get("X-Robots-Tag"), chemin).toBe("noindex, nofollow");
          expect(reponse.headers.get("Cache-Control"), chemin).toBe("no-store");
          // La réponse est finale : rien ne continue vers la page ni la route.
          expect(reponse.headers.get("x-middleware-next"), chemin).toBeNull();
          expect(reponse.headers.get("x-middleware-rewrite"), chemin).toBeNull();
        }
        expect(await demander(chemin).text()).toBe("Page introuvable.\n");
      }
      expect(erreurs).not.toHaveBeenCalled();
    });
  }

  it("la règle lit le chemin tel qu'il arrive, jamais la partie après « ? »", () => {
    expect(REFUSEES.every((chemin) => cheminRefuse(chemin.split("?")[0]!))).toBe(true);
    for (const chemin of ["/creer", "/", "/guides/deroule-anniversaire-enfant-maison", "/commande/AbCdEfGhIjKlMnOpQrStUv"]) {
      expect(cheminRefuse(chemin), chemin).toBe(false);
    }
  });
});

describe("les adresses du site restent inchangées", () => {
  /** Une référence de la forme réelle : 16 octets au hasard, en base64url (22 caractères). */
  const reference = creerReference();
  const INCHANGEES = [
    ...pagesPubliques().map((page) => page.chemin),
    "/renoncer",
    "/renoncer?ref=AbCdEfGhIjKlMnOpQrStUv",
    `/commande/${reference}`,
    `/commande/${reference}?session_id=cs_test_a1B2c3`,
    `/api/commande/${reference}/kit`,
    `/api/commande/${reference}/confirmation`,
    "/api/commande",
    "/api/apercu",
    "/api/renoncer",
    "/api/effacement",
    ...FLUX.map((flux) => `/epingles/${flux}.xml`),
    "/epingles/chasse-dinosaures-tresor-alba.jpg",
    "/robots.txt",
    "/sitemap.xml",
    "/favicon.ico",
    "/creer?x=%2F",
    "/creer?x=%5C",
    "/guides/chasse-au-tresor-anniversaire-4-6-ans?utm_source=pinterest&utm_medium=social&utm_campaign=chasse-4-6-ans&utm_content=chasse-dinosaures-tresor-alba",
  ];

  it("les 12 adresses du plan du site y figurent", () => {
    expect(pagesPubliques()).toHaveLength(12);
  });

  for (const environnement of ["production", "preview"]) {
    it(`${environnement} : le proxy les laisse passer, avec le même en-tête X-Robots-Tag qu'avant`, () => {
      vi.stubEnv("VERCEL_ENV", environnement);
      for (const chemin of INCHANGEES) {
        for (const methode of ["GET", "POST"]) {
          const reponse = demander(chemin, methode);
          expect(reponse.status, chemin).toBe(200);
          expect(reponse.headers.get("x-middleware-next"), chemin).toBe("1");
          const sansParametres = chemin.split("?")[0]!;
          expect(reponse.headers.get("X-Robots-Tag"), chemin).toBe(enTeteRobots(sansParametres, environnement === "production"));
        }
      }
    });
  }

  it("en production, les pages publiques, les flux et les images ne portent pas noindex", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    for (const chemin of [...pagesPubliques().map((page) => page.chemin), "/creer?x=%2F", "/epingles/chasse-4-6-ans.xml", "/epingles/chasse-dinosaures-tresor-alba.jpg"]) {
      expect(demander(chemin).headers.get("X-Robots-Tag"), chemin).toBeNull();
    }
    expect(demander("/renoncer").headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });
});
