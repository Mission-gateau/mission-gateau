import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dependances } from "@/vente/dependances";

/**
 * Les pages telles que le serveur les rend, vente fermée puis ouverte.
 * L'état de la vente est commandé par le test ; la condition elle-même est
 * éprouvée dans tests/ouverture.test.ts.
 */
const etat = vi.hoisted(() => ({ ouverte: false, deps: null as unknown, kits: 0, rendus: 0 }));

vi.mock("@/vente/ouverture", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/vente/ouverture")>();
  return { ...original, venteOuverteMaintenant: () => etat.ouverte };
});
vi.mock("@/vente/dependances", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/vente/dependances")>();
  return { ...original, dependancesReelles: () => (etat.deps as Dependances | null) ?? original.dependancesReelles() };
});
// Compteurs : la page de commande ne doit jamais composer ni rendre un kit.
vi.mock("@/engine/kit", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/engine/kit")>();
  return {
    ...original,
    construireKit: (...args: Parameters<typeof original.construireKit>) => {
      etat.kits += 1;
      return original.construireKit(...args);
    },
  };
});
vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const original = await importOriginal<typeof import("@react-pdf/renderer")>();
  return {
    ...original,
    renderToBuffer: (...args: Parameters<typeof original.renderToBuffer>) => {
      etat.rendus += 1;
      return original.renderToBuffer(...args);
    },
  };
});

import Accueil from "@/app/page";
import Cgv from "@/app/cgv/page";
import PageCommande from "@/app/commande/[ref]/page";
import Confidentialite from "@/app/confidentialite/page";
import Creer from "@/app/creer/page";
import Credits from "@/app/credits/page";
import MentionsLegales from "@/app/mentions-legales/page";
import { POST as commanderRoute } from "@/app/api/commande/route";
import { BlocAchat } from "@/composants/BlocAchat";
import { PiedDeSite } from "@/composants/Chrome";
import { VENDEUR } from "@/contenu/vendeur";
import { piedDeFacture } from "@/vente/session";
import { PRIX_AFFICHE } from "@/vente/prix";
import { FauxStripe, configurationMarquee, corpsDeCommande, dependances, requeteJson } from "./fauxStripe";

const PAGES_FIXES: [string, () => React.ReactElement][] = [
  ["/", () => <Accueil />],
  ["/creer", () => <Creer />],
  ["/credits", () => <Credits />],
  ["/mentions-legales", () => <MentionsLegales />],
  ["/cgv", () => <Cgv />],
  ["/confidentialite", () => <Confidentialite />],
];

async function pageDeCommande(ref: string, sessionId?: string): Promise<string> {
  const element = await PageCommande({
    params: Promise.resolve({ ref }),
    searchParams: Promise.resolve(sessionId ? { session_id: sessionId } : {}),
  });
  return renderToStaticMarkup(element);
}

/** Tout le HTML du site, page de commande comprise. */
async function toutLeSite(): Promise<[string, string][]> {
  const pages: [string, string][] = PAGES_FIXES.map(([chemin, rendre]) => [chemin, renderToStaticMarkup(rendre())]);
  pages.push(["/commande/…", await pageDeCommande("AAAAAAAAAAAAAAAAAAAAAA")]);
  return pages;
}

/** Un prix, sous quelque forme que ce soit, ou le bouton d'achat. Les CGV peuvent nommer le bouton, pas l'afficher. */
const MARQUES_DE_PRIX = /€|12,90|1290|<button[^>]*>[^<]*Commander et payer/;
const MEDIATEUR = /Médiation Professionnelle|Alteritae|Salvaing|mediateur-consommation-smp/;

beforeEach(() => {
  etat.ouverte = false;
  etat.deps = dependances(new FauxStripe());
  etat.kits = 0;
  etat.rendus = 0;
});

afterEach(() => {
  etat.deps = null;
});

describe("vente fermée", () => {
  it("aucune page n'affiche de prix ni de bouton d'achat", async () => {
    for (const [chemin, html] of await toutLeSite()) {
      expect(html, chemin).not.toMatch(MARQUES_DE_PRIX);
    }
  });

  it("le pied de page dit toujours « site en préparation »", async () => {
    for (const [chemin, html] of await toutLeSite()) {
      expect(html, chemin).toContain("Mission Gâteau — site en préparation");
    }
  });
});

describe("vente ouverte", () => {
  beforeEach(() => {
    etat.ouverte = true;
  });

  it("l'accueil affiche 12,90 € et la mention de TVA", () => {
    const html = renderToStaticMarkup(<Accueil />);
    expect(html).toContain(PRIX_AFFICHE);
    expect(PRIX_AFFICHE).toBe("12,90\u00a0€");
    expect(html).toContain("TVA non applicable, article 293 B du CGI");
  });

  it("le pied de page nomme l'éditeur et ne dit plus « site en préparation »", async () => {
    for (const [chemin, html] of await toutLeSite()) {
      expect(html, chemin).not.toContain("site en préparation");
      expect(html, chemin).toContain("Mission Gâteau — édité par Quentin Courtois EI");
    }
  });

  it("les CGV donnent le prix", () => {
    expect(renderToStaticMarkup(<Cgv />)).toContain(`Le jeu complet coûte ${PRIX_AFFICHE}`);
  });

  it("le bloc d'achat présente le kit, le format, le prix, la livraison, le pays et les deux accords", () => {
    const html = renderToStaticMarkup(
      <BlocAchat
        configuration={configurationMarquee()}
        graine="k7m2p9q4rs"
        brouillon={{}}
        paysInitial={null}
        offre={{ prix: PRIX_AFFICHE, tva: VENDEUR.tva }}
      />,
    );
    for (const attendu of [
      "Le guide de l&#x27;organisateur",
      "Un PDF A4 à imprimer, lisible en noir et blanc\u00a0: un lecteur PDF et une imprimante suffisent.",
      `${PRIX_AFFICHE}</span> — TVA non applicable, article 293 B du CGI`,
      "Téléchargement immédiat après le paiement\u00a0; le lien reste valable 30 jours.",
      "Pays de résidence",
      "J&#x27;ai lu et j&#x27;accepte les ",
      ">conditions générales de vente<",
      "Je demande l&#x27;accès immédiat à mon jeu dès le paiement et je reconnais perdre ainsi mon droit de rétractation (article L221-28, 13° du Code de la consommation).",
      `Commander et payer ${PRIX_AFFICHE}`,
      'href="/cgv"',
      'href="/mentions-legales"',
      'href="/confidentialite"',
    ]) {
      expect(html, attendu).toContain(attendu);
    }
    // Deux cases distinctes, non cochées au départ ; la France par défaut.
    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html).not.toMatch(/checked/);
    expect(html).toMatch(/<option value="FR" selected="">France<\/option>/);
    expect(html.match(/<option /g)).toHaveLength(31);
    expect(html).toContain(">Un autre pays<");
  });
});

describe("pages légales et pied de page", () => {
  it("chaque page porte, dans son pied, les liens vers les trois pages légales et les crédits", async () => {
    for (const ouverte of [false, true]) {
      etat.ouverte = ouverte;
      for (const [chemin, html] of await toutLeSite()) {
        for (const lien of ["/mentions-legales", "/cgv", "/confidentialite", "/credits"]) {
          expect(html, `${chemin} → ${lien}`).toContain(`href="${lien}"`);
        }
      }
    }
  });

  it("tant que la convention n'est pas signée, le médiateur n'est nommé nulle part", async () => {
    for (const ouverte of [false, true]) {
      etat.ouverte = ouverte;
      for (const [chemin, html] of await toutLeSite()) expect(html, chemin).not.toMatch(MEDIATEUR);
    }
    expect(piedDeFacture(VENDEUR)).not.toMatch(MEDIATEUR);
    expect(renderToStaticMarkup(<PiedDeSite venteOuverte />)).not.toMatch(MEDIATEUR);
  });
});

describe("page d'une commande", () => {
  it("ne génère rien, même pour une commande payée : seul le bouton appelle la route du kit", async () => {
    const stripe = new FauxStripe();
    etat.deps = dependances(stripe);
    await commanderRoute(requeteJson("http://localhost/api/commande", corpsDeCommande()));
    const { reference, sessionId } = stripe.payer({ payeLe: new Date("2026-09-23T12:00:00.000Z") });
    etat.kits = 0;
    etat.rendus = 0;

    const html = await pageDeCommande(reference, sessionId);
    expect(html).toContain("Votre jeu est prêt");
    expect(html).toContain("Télécharger mon jeu (PDF)");
    expect(html).toContain("jusqu&#x27;au 23 octobre 2026");
    expect(html).toContain("e-mail envoyé par Stripe");
    expect(html).toContain(VENDEUR.email);
    expect(etat.kits).toBe(0);
    expect(etat.rendus).toBe(0);
    // La configuration déchiffrée ne quitte pas le serveur : aucun prénom dans la page.
    expect(html).not.toContain("Zéphyrine");
    expect(html).not.toContain("Mésanges");
  });

  it("dit « commande introuvable » pour une référence inventée", async () => {
    for (const ref of ["AAAAAAAAAAAAAAAAAAAAAA", "une-reference-inventee"]) {
      const html = await pageDeCommande(ref);
      expect(html).toContain("Commande introuvable");
      expect(html).not.toContain("Télécharger mon jeu");
    }
  });

  it("dit que la vérification est impossible quand il n'y a pas de clé", async () => {
    etat.deps = dependances(null);
    const html = await pageDeCommande("AAAAAAAAAAAAAAAAAAAAAA");
    expect(html).toContain("Vérification momentanément impossible");
  });

  it("ne recopie pas une référence mal formée", async () => {
    const html = await pageDeCommande("<script>alert(1)</script>");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("Référence de la commande");
  });
});
