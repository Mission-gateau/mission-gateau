import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dependances } from "@/vente/dependances";

/**
 * Le contrôle commun à toutes les routes POST (src/vente/garde.ts) : du JSON
 * seulement, et jamais depuis un autre site. Chaque route est essayée ; une
 * route POST ajoutée sans être listée ici fait échouer le test.
 */
const injection = vi.hoisted(() => ({ deps: null as unknown }));
vi.mock("@/vente/dependances", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/vente/dependances")>();
  return { ...original, dependancesReelles: () => (injection.deps as Dependances | null) ?? original.dependancesReelles() };
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import * as apercu from "@/app/api/apercu/route";
import * as commande from "@/app/api/commande/route";
import * as confirmation from "@/app/api/commande/[ref]/confirmation/route";
import * as kit from "@/app/api/commande/[ref]/kit/route";
import * as renoncer from "@/app/api/renoncer/route";
import { hoteDeLaRequete, refusDeRequete } from "@/vente/garde";
import { configuration } from "./aide";
import { FauxEmail } from "./fauxEmail";
import { FauxStripe, corpsDeCommande, dependances } from "./fauxStripe";

const REFERENCE = "AbCdEfGhIjKlMnOpQrStUv";
const HOTE = "www.missiongateau.com";

interface RouteEssayee {
  chemin: string;
  corps: unknown;
  appeler: (requete: Request) => Promise<Response>;
}

const contexte = { params: Promise.resolve({ ref: REFERENCE }) };

const ROUTES: RouteEssayee[] = [
  { chemin: "/api/apercu", corps: { configuration: configuration() }, appeler: (r) => apercu.POST(r) },
  { chemin: "/api/commande", corps: corpsDeCommande(), appeler: (r) => commande.POST(r) },
  { chemin: `/api/commande/${REFERENCE}/confirmation`, corps: {}, appeler: (r) => confirmation.POST(r, contexte) },
  { chemin: `/api/commande/${REFERENCE}/kit`, corps: {}, appeler: (r) => kit.POST(r, contexte) },
  {
    chemin: "/api/renoncer",
    corps: { nom: "Martin", prenom: "Camille", reference: REFERENCE, email: "delivered@resend.dev" },
    appeler: (r) => renoncer.POST(r),
  },
];

let stripe: FauxStripe;
let emails: FauxEmail;

beforeEach(() => {
  stripe = new FauxStripe();
  emails = new FauxEmail();
  injection.deps = dependances(stripe, { email: emails });
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  injection.deps = null;
});

function requete(chemin: string, corps: unknown, entetes: Record<string, string>): Request {
  return new Request(`https://${HOTE}${chemin}`, {
    method: "POST",
    headers: entetes,
    body: JSON.stringify(corps),
  });
}

/** Les fichiers de route qui exportent POST. */
function routesPost(dossier = path.join(process.cwd(), "src", "app")): string[] {
  const trouvees: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = path.join(dossier, nom);
    if (statSync(chemin).isDirectory()) trouvees.push(...routesPost(chemin));
    else if (/^route\.tsx?$/.test(nom) && /export (async )?function POST/.test(readFileSync(chemin, "utf8"))) {
      trouvees.push(path.relative(path.join(process.cwd(), "src", "app"), chemin).split(path.sep).join("/"));
    }
  }
  return trouvees.sort();
}

describe("le contrôle des routes POST", () => {
  it("s'applique à chaque route POST du site, toutes essayées ici", () => {
    expect(routesPost()).toEqual([
      "api/apercu/route.ts",
      "api/commande/[ref]/confirmation/route.ts",
      "api/commande/[ref]/kit/route.ts",
      "api/commande/route.ts",
      "api/renoncer/route.ts",
    ]);
    expect(ROUTES).toHaveLength(routesPost().length);
  });

  for (const route of ROUTES) {
    describe(route.chemin, () => {
      it("refuse ce qui n'est pas du JSON : 415, en français", async () => {
        for (const type of ["text/plain", "text/plain;charset=UTF-8", "application/x-www-form-urlencoded", "multipart/form-data", ""]) {
          const reponse = await route.appeler(requete(route.chemin, route.corps, type ? { "Content-Type": type } : {}));
          expect(reponse.status, type || "sans type").toBe(415);
          expect(((await reponse.json()) as { erreur: string }).erreur).toBe(
            "Cette adresse n'accepte que des données envoyées au format JSON.",
          );
        }
      });

      it("refuse une requête venue d'un autre site : 403, en français", async () => {
        const autresSites: Record<string, string>[] = [
          { "Sec-Fetch-Site": "cross-site" },
          { Origin: "null" },
          { Origin: "https://pirate.example" },
          { Origin: `https://${HOTE}.pirate.example` },
          { Origin: `http://${HOTE}:8080` },
          { Origin: "pas une origine" },
          // Un en-tête Host menteur ne suffit pas : x-forwarded-host, posé par Vercel, passe avant.
          { Origin: "https://pirate.example", Host: "pirate.example", "X-Forwarded-Host": HOTE },
        ];
        for (const entetes of autresSites) {
          const reponse = await route.appeler(requete(route.chemin, route.corps, { "Content-Type": "application/json", ...entetes }));
          expect(reponse.status, JSON.stringify(entetes)).toBe(403);
          expect(((await reponse.json()) as { erreur: string }).erreur).toBe(
            "Cette demande ne peut venir que d'une page de Mission Gâteau : elle a été refusée.",
          );
        }
        // Un autre site, en text/plain, comme le ferait un formulaire piégé : refusé aussi.
        const piege = await route.appeler(
          requete(route.chemin, route.corps, { "Content-Type": "text/plain", Origin: "https://pirate.example", "Sec-Fetch-Site": "cross-site" }),
        );
        expect([403, 415]).toContain(piege.status);
      });

      it("accepte une requête de même origine, derrière x-forwarded-host, et le JSON avec ses paramètres", async () => {
        const memeOrigine: Record<string, string>[] = [
          { "Content-Type": "application/json", Origin: `https://${HOTE}`, "Sec-Fetch-Site": "same-origin", "X-Forwarded-Host": HOTE, Host: "interne.vercel.internal" },
          { "Content-Type": "application/json; charset=utf-8", Origin: `https://${HOTE.toUpperCase()}`, Host: HOTE },
          { "Content-Type": "Application/JSON", "Sec-Fetch-Site": "same-origin" },
          { "Content-Type": "application/json" },
        ];
        for (const entetes of memeOrigine) {
          const reponse = await route.appeler(requete(route.chemin, route.corps, entetes));
          expect([403, 415], JSON.stringify(entetes)).not.toContain(reponse.status);
        }
      });
    });
  }

  it("ne fait rien pour une requête refusée : ni Stripe, ni e-mail", async () => {
    for (const route of ROUTES) {
      await route.appeler(requete(route.chemin, route.corps, { "Content-Type": "text/plain" }));
      await route.appeler(requete(route.chemin, route.corps, { "Content-Type": "application/json", Origin: "https://pirate.example" }));
    }
    expect(stripe.sessionsCreees).toHaveLength(0);
    expect(stripe.recherchesParReference).toHaveLength(0);
    expect(stripe.sessionsLues).toHaveLength(0);
    expect(emails.appels).toHaveLength(0);
  });
});

describe("l'hôte de la requête", () => {
  it("prend la première valeur de x-forwarded-host, sinon host, sinon l'adresse de la requête", () => {
    const avec = (entetes: Record<string, string>) => new Request(`https://adresse.example/api/renoncer`, { method: "POST", headers: entetes });
    expect(hoteDeLaRequete(avec({ "X-Forwarded-Host": "www.missiongateau.com, proxy.interne", Host: "autre.example" }))).toBe(
      "www.missiongateau.com",
    );
    expect(hoteDeLaRequete(avec({ Host: "Autre.Example:3000" }))).toBe("autre.example:3000");
    expect(hoteDeLaRequete(avec({}))).toBe("adresse.example");
    expect(refusDeRequete(new Request("http://localhost:3000/api/renoncer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    }))).toBeNull();
  });
});
