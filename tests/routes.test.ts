import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dependances } from "@/vente/dependances";

/**
 * Hors d'une commande payée, aucune route ne sert le kit complet. Ce test
 * dresse la liste de toutes les routes du site, refuse qu'une nouvelle route
 * apparaisse sans être essayée ici, puis les essaie toutes.
 */
const injection = vi.hoisted(() => ({ deps: null as unknown }));
vi.mock("@/vente/dependances", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/vente/dependances")>();
  return { ...original, dependancesReelles: () => (injection.deps as Dependances | null) ?? original.dependancesReelles() };
});

import * as apercu from "@/app/api/apercu/route";
import * as commande from "@/app/api/commande/route";
import * as confirmation from "@/app/api/commande/[ref]/confirmation/route";
import * as kit from "@/app/api/commande/[ref]/kit/route";
import * as effacement from "@/app/api/effacement/route";
import * as renoncer from "@/app/api/renoncer/route";
import { VENDEUR } from "@/contenu/vendeur";
import { compterPages } from "./aide";
import { FauxEmail } from "./fauxEmail";
import {
  FauxStripe,
  SECRET_TACHE,
  configurationMarquee,
  corpsDeCommande,
  dependances,
  environnement,
  requeteJson,
} from "./fauxStripe";

const APP = path.join(process.cwd(), "src", "app");

function routesDuSite(dossier = APP): string[] {
  const trouvees: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = path.join(dossier, nom);
    if (statSync(chemin).isDirectory()) trouvees.push(...routesDuSite(chemin));
    else if (/^route\.(ts|tsx|js)$/.test(nom)) trouvees.push(path.relative(APP, chemin).split(path.sep).join("/"));
  }
  return trouvees.sort();
}

async function nEstPasLeKit(reponse: Response): Promise<void> {
  const octets = Buffer.from(await reponse.arrayBuffer());
  if (octets.subarray(0, 5).toString() !== "%PDF-") return;
  // Seul l'aperçu répond par un PDF : quatre pages au plus, jamais le kit.
  expect(compterPages(octets)).toBeLessThanOrEqual(4);
}

let stripe: FauxStripe;

beforeEach(() => {
  stripe = new FauxStripe();
  injection.deps = dependances(stripe, { email: new FauxEmail(), env: environnement({ secretTache: SECRET_TACHE }) });
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  injection.deps = null;
});

describe("toutes les routes", () => {
  it("sont connues de ce test", () => {
    expect(routesDuSite()).toEqual([
      "api/apercu/route.ts",
      "api/commande/[ref]/confirmation/route.ts",
      "api/commande/[ref]/kit/route.ts",
      "api/commande/route.ts",
      "api/effacement/route.ts",
      "api/renoncer/route.ts",
    ]);
  });

  it("aucune ne sert le kit complet hors d'une commande payée", async () => {
    // L'aperçu : quatre pages, même avec la graine d'une commande.
    await nEstPasLeKit(
      await apercu.POST(requeteJson("http://localhost/api/apercu", { configuration: configurationMarquee(), graine: "k7m2p9q4rs" })),
    );
    await nEstPasLeKit(apercu.GET());

    // La création de commande, vente ouverte puis fermée : une adresse de paiement, jamais un PDF.
    await nEstPasLeKit(await commande.POST(requeteJson("http://localhost/api/commande", corpsDeCommande())));
    injection.deps = dependances(stripe, { fiche: VENDEUR, env: environnement({ vercelEnv: "production" }) });
    await nEstPasLeKit(await commande.POST(requeteJson("http://localhost/api/commande", corpsDeCommande())));
    await nEstPasLeKit(commande.GET());
    injection.deps = dependances(stripe, { email: new FauxEmail(), env: environnement({ secretTache: SECRET_TACHE }) });

    // Le kit : une commande créée mais pas payée, une référence inventée, une visite.
    const { reference } = stripe.derniereSession();
    for (const ref of [reference, "AAAAAAAAAAAAAAAAAAAAAA", "../../etc/passwd"]) {
      const reponse = await kit.POST(requeteJson(`http://localhost/api/commande/${ref}/kit`, {}), {
        params: Promise.resolve({ ref }),
      });
      expect(reponse.status, ref).not.toBe(200);
      await nEstPasLeKit(reponse);
    }
    await nEstPasLeKit(kit.GET());

    // La confirmation : un état, jamais un PDF, même pour une commande payée.
    stripe.payer();
    for (const ref of [reference, "AAAAAAAAAAAAAAAAAAAAAA"]) {
      await nEstPasLeKit(
        await confirmation.POST(requeteJson(`http://localhost/api/commande/${ref}/confirmation`, {}), {
          params: Promise.resolve({ ref }),
        }),
      );
    }
    await nEstPasLeKit(confirmation.GET());

    // La rétractation : un accusé de réception, jamais un PDF.
    await nEstPasLeKit(
      await renoncer.POST(
        requeteJson("http://localhost/api/renoncer", {
          nom: "Martin",
          prenom: "Camille",
          reference,
          email: "delivered@resend.dev",
        }),
      ),
    );
    await nEstPasLeKit(renoncer.GET());

    // La tâche quotidienne : un état, et des compteurs dans le journal.
    await nEstPasLeKit(await effacement.GET(new Request("http://localhost/api/effacement")));
    await nEstPasLeKit(
      await effacement.GET(
        new Request("http://localhost/api/effacement", { headers: { Authorization: `Bearer ${SECRET_TACHE}` } }),
      ),
    );
  });

  it("chaque route qui produit un PDF embarque ses polices (et les icônes du kit) au déploiement", () => {
    const config = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    for (const cle of ['"/api/apercu"', '"/api/commande/\\\\[ref\\\\]/kit"']) {
      expect(config, cle).toContain(`${cle}: ["./public/fonts/**/*", "./public/icones/**/*"]`);
    }
    // Le PDF des CGV joint à la confirmation : la route de confirmation et la tâche quotidienne.
    for (const cle of ['"/api/commande/\\\\[ref\\\\]/confirmation"', '"/api/effacement"']) {
      expect(config, cle).toContain(`${cle}: ["./public/fonts/**/*"]`);
    }
  });
});

describe("le moteur reste indépendant", () => {
  function fichiers(dossier: string): string[] {
    return readdirSync(dossier).flatMap((nom) => {
      const chemin = path.join(dossier, nom);
      return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
    });
  }

  it("src/engine ne dépend ni de Next.js, ni de React, ni de Stripe, ni de Resend, ni de la vente", () => {
    const fautifs: string[] = [];
    for (const fichier of fichiers(path.join(process.cwd(), "src", "engine"))) {
      const source = readFileSync(fichier, "utf8");
      for (const importe of source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
        const cible = importe[1]!;
        if (/^(next|react|react-dom|stripe|resend|@react-pdf)(\/|$)/.test(cible) || /(^|\/)(vente|app|composants|pdf)(\/|$)/.test(cible)) {
          fautifs.push(`${path.relative(process.cwd(), fichier)} → ${cible}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });
});
