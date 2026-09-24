import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dependances } from "@/vente/dependances";

/**
 * La route de création de commande, appelée telle que Next l'appelle, avec
 * un faux Stripe à la place du vrai.
 */
const injection = vi.hoisted(() => ({ deps: null as unknown }));
vi.mock("@/vente/dependances", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/vente/dependances")>();
  return { ...original, dependancesReelles: () => (injection.deps as Dependances | null) ?? original.dependancesReelles() };
});

import { GET, POST } from "@/app/api/commande/route";
import { VENDEUR } from "@/contenu/vendeur";
import { CLES, LIMITES_METADONNEES, depassementsDeMetadonnees, lireConfiguration } from "@/vente/metadonnees";
import { referenceValide } from "@/vente/reference";
import {
  CLE_REELLE,
  CLE_TEST,
  DOMAINE_PREVERSION,
  DOMAINE_PRODUCTION,
  FauxStripe,
  FICHE_COMPLETE,
  configurationMarquee,
  corpsDeCommande,
  dependances,
  environnement,
  marquesDans,
  requeteJson,
} from "./fauxStripe";

const URL_COMMANDE = "http://localhost/api/commande";

let stripe: FauxStripe;
let journaux: string[];

beforeEach(() => {
  stripe = new FauxStripe();
  injection.deps = dependances(stripe);
  journaux = [];
  for (const niveau of ["log", "info", "warn", "error", "debug"] as const) {
    vi.spyOn(console, niveau).mockImplementation((...args: unknown[]) => {
      journaux.push(args.map(String).join(" "));
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  injection.deps = null;
});

function commander(corps: unknown = corpsDeCommande(), entetes: Record<string, string> = {}): Promise<Response> {
  return POST(requeteJson(URL_COMMANDE, corps, entetes));
}

async function erreurDe(reponse: Response): Promise<string> {
  return ((await reponse.json()) as { erreur: string }).erreur;
}

describe("vente fermée", () => {
  it("répond 503 avec un message en français tant que la convention n'est pas signée", async () => {
    injection.deps = dependances(stripe, {
      env: environnement({ vercelEnv: "production", cleStripe: CLE_REELLE }),
      fiche: VENDEUR,
    });
    const reponse = await commander();
    expect(reponse.status).toBe(503);
    expect(await erreurDe(reponse)).toBe("La vente du jeu complet n'est pas encore ouverte.");
    expect(stripe.sessionsCreees).toHaveLength(0);
  });

  it("répond 503 sans clé, ou avec une clé de la mauvaise nature", async () => {
    for (const env of [
      environnement({ cleStripe: undefined }),
      environnement({ vercelEnv: "production", cleStripe: CLE_TEST }),
      environnement({ vercelEnv: "preview", cleStripe: CLE_REELLE }),
    ]) {
      injection.deps = dependances(stripe, { env });
      expect((await commander()).status).toBe(503);
    }
    expect(stripe.sessionsCreees).toHaveLength(0);
  });

  it("ne sert rien sur une simple visite", async () => {
    expect(GET().status).toBe(405);
  });
});

describe("contrôles de la commande", () => {
  it("borne la taille de la requête comme la route de l'aperçu", async () => {
    expect((await commander({ ...corpsDeCommande(), bourrage: "z".repeat(9000) })).status).toBe(413);
    expect((await commander(corpsDeCommande(), { "Content-Length": "999999" })).status).toBe(413);
  });

  it("refuse une requête illisible", async () => {
    expect((await commander("{ pas du JSON")).status).toBe(400);
    expect((await commander("[1, 2]")).status).toBe(400);
    expect((await commander('"texte"')).status).toBe(400);
  });

  it("refuse une configuration invalide et dit pourquoi", async () => {
    const reponse = await commander(corpsDeCommande({ configuration: { ...configurationMarquee(), age: 2 } }));
    expect(reponse.status).toBe(422);
    const corps = (await reponse.json()) as { details: { champ: string }[] };
    expect(corps.details.map((d) => d.champ)).toContain("age");
  });

  it("refuse une graine fantaisiste", async () => {
    for (const graine of [undefined, "", "PAS-UNE-GRAINE", 1234567890]) {
      expect((await commander(corpsDeCommande({ graine }))).status, String(graine)).toBe(422);
    }
  });

  it("refuse un pays hors de la liste, avec le message affiché au parent", async () => {
    for (const pays of ["AUTRE", "GB", "US", "fr", "", undefined]) {
      const reponse = await commander(corpsDeCommande({ pays }));
      expect(reponse.status, String(pays)).toBe(422);
      expect(await erreurDe(reponse)).toBe("Nous ne pouvons pas encore vendre dans votre pays.");
    }
    expect(stripe.sessionsCreees).toHaveLength(0);
  });

  it("exige les deux accords, chacun vraiment donné", async () => {
    for (const accord of [false, undefined, "true", 1]) {
      const sansCgv = await commander(corpsDeCommande({ accordCgv: accord }));
      expect(sansCgv.status).toBe(422);
      expect(await erreurDe(sansCgv)).toMatch(/conditions générales de vente/);
      const sansAcces = await commander(corpsDeCommande({ accordAccesImmediat: accord }));
      expect(sansAcces.status).toBe(422);
      expect(await erreurDe(sansAcces)).toMatch(/accès immédiat/);
    }
    expect(stripe.sessionsCreees).toHaveLength(0);
  });
});

describe("session Stripe Checkout", () => {
  it("renvoie l'adresse de la page de paiement hébergée par Stripe", async () => {
    const reponse = await commander();
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("Cache-Control")).toBe("no-store");
    const { url } = (await reponse.json()) as { url: string };
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    expect(stripe.sessionsCreees).toHaveLength(1);
  });

  it("demande un paiement unique de 12,90 €, en français, par carte seulement", async () => {
    await commander();
    const { parametres } = stripe.derniereSession();
    expect(parametres.mode).toBe("payment");
    expect(parametres.ui_mode).toBe("hosted_page");
    expect(parametres.locale).toBe("fr");
    expect(parametres.payment_method_types).toEqual(["card"]);
    expect(parametres.adaptive_pricing).toEqual({ enabled: false });
    expect(parametres.billing_address_collection).toBe("required");
    expect(parametres.payment_intent_data?.capture_method).toBe("automatic");
    expect(parametres.line_items).toHaveLength(1);
    const ligne = parametres.line_items![0]!;
    expect(ligne.quantity).toBe(1);
    expect(ligne.price).toBeUndefined();
    expect(ligne.price_data?.currency).toBe("eur");
    expect(ligne.price_data?.unit_amount).toBe(1290);
    expect(ligne.price_data?.product_data?.name).toBe(
      "Jeu d'anniversaire Mission Gâteau — kit personnalisé à imprimer (PDF)",
    );
    // Le thème et la tranche d'âge, jamais un prénom.
    expect(ligne.price_data?.product_data?.description).toBe("Thème Pirates, 10-12 ans");
  });

  it("crée une facture qui porte le lien, l'accès immédiat, la renonciation, les CGV et le vendeur", async () => {
    await commander();
    const { parametres, reference } = stripe.derniereSession();
    const lien = `https://${DOMAINE_PREVERSION}/commande/${reference}`;
    const facture = parametres.invoice_creation!;
    expect(facture.enabled).toBe(true);
    expect(facture.invoice_data?.custom_fields).toEqual([{ name: "Votre jeu", value: lien }]);
    const description = facture.invoice_data!.description!;
    expect(description).toContain("accès immédiat");
    expect(description).toContain("renoncé ainsi à votre droit de rétractation");
    expect(description).toContain("article L221-28, 13° du Code de la consommation");
    expect(description).toContain("valable 30 jours");
    expect(description).toContain("version du 24 septembre 2026");
    const pied = facture.invoice_data!.footer!;
    for (const attendu of [
      "Quentin Courtois EI",
      "Mission Gâteau",
      "SIRET 992 667 006 00017",
      "7 impasse des Bosquets, 34670 Baillargues, France",
      VENDEUR.email,
      "TVA non applicable, article 293 B du CGI",
      "Société Médiation Professionnelle",
      "https://www.mediateur-consommation-smp.fr",
    ]) {
      expect(pied, attendu).toContain(attendu);
    }
    expect(pied).not.toMatch(/RCS|Capital/);
    expect(description.length).toBeLessThanOrEqual(500);
    expect(pied.length).toBeLessThanOrEqual(500);
    expect(lien.length).toBeLessThanOrEqual(140);
  });

  it("met le même lien dans la description du paiement, qui figure sur le reçu", async () => {
    await commander();
    const { parametres, reference } = stripe.derniereSession();
    expect(parametres.payment_intent_data?.description).toContain(
      `https://${DOMAINE_PREVERSION}/commande/${reference}`,
    );
  });

  it("rappelle l'accès immédiat et la renonciation près du bouton de paiement", async () => {
    await commander();
    const message = stripe.derniereSession().parametres.custom_text?.submit;
    expect(message && "message" in message ? message.message : "").toMatch(
      /accès immédiat[\s\S]*renon[\s\S]*rétractation[\s\S]*L221-28, 13°/,
    );
  });

  it("revient sur la page de la commande après paiement, et sur /creer après annulation", async () => {
    await commander();
    const { parametres, reference } = stripe.derniereSession();
    expect(referenceValide(reference)).toBe(true);
    expect(parametres.success_url).toBe(
      `https://${DOMAINE_PREVERSION}/commande/${reference}?session_id={CHECKOUT_SESSION_ID}`,
    );
    expect(parametres.cancel_url).toBe(`https://${DOMAINE_PREVERSION}/creer`);
    expect(parametres.metadata).toEqual({ ref: reference });
    expect(parametres.client_reference_id).toBe(reference);
    expect(stripe.sessionsCreees[0]!.cleIdempotence).toBe(reference);
  });

  it("vise la production en production, et localhost en local", async () => {
    injection.deps = dependances(stripe, { env: environnement({ vercelEnv: "production", cleStripe: CLE_REELLE }) });
    await commander();
    let session = stripe.derniereSession();
    expect(session.parametres.success_url).toBe(
      `https://${DOMAINE_PRODUCTION}/commande/${session.reference}?session_id={CHECKOUT_SESSION_ID}`,
    );
    injection.deps = dependances(stripe, { env: environnement({ vercelEnv: undefined }) });
    await commander();
    session = stripe.derniereSession();
    expect(session.parametres.cancel_url).toBe("http://localhost:3000/creer");
  });

  it("refuse de créer la commande si l'adresse du déploiement est inconnue", async () => {
    injection.deps = dependances(stripe, {
      env: environnement({ vercelEnv: "production", cleStripe: CLE_REELLE, domaineProduction: undefined }),
    });
    expect((await commander()).status).toBe(503);
    expect(stripe.sessionsCreees).toHaveLength(0);
  });

  it("tire une référence nouvelle à chaque commande", async () => {
    await commander();
    const premiere = stripe.derniereSession().reference;
    await commander();
    expect(stripe.derniereSession().reference).not.toBe(premiere);
  });
});

describe("ce que Stripe garde de la commande", () => {
  it("garde la référence, la version, la graine, le pays, les CGV et l'heure du serveur pour les deux accords", async () => {
    await commander(corpsDeCommande({ pays: "BE" }));
    const { parametres, reference } = stripe.derniereSession();
    const meta = parametres.payment_intent_data!.metadata as Record<string, string>;
    expect(meta[CLES.reference]).toBe(reference);
    expect(meta[CLES.versionKit]).toBe("1.2");
    expect(meta[CLES.graine]).toBe("k7m2p9q4rs");
    expect(meta[CLES.pays]).toBe("BE");
    expect(meta[CLES.versionCgv]).toBe("2026-09-24");
    expect(meta[CLES.accordCgv]).toBe("2026-09-24T12:00:00.000Z");
    expect(meta[CLES.accordAccesImmediat]).toBe("2026-09-24T12:00:00.000Z");
    expect(depassementsDeMetadonnees(meta)).toEqual([]);
    expect(Object.keys(meta).length).toBeLessThanOrEqual(LIMITES_METADONNEES.cles);
  });

  it("garde la configuration complète, chiffrée avec une clé dérivée de STRIPE_SECRET_KEY", async () => {
    await commander();
    const meta = stripe.derniereSession().parametres.payment_intent_data!.metadata as Record<string, string>;
    expect(lireConfiguration(meta, CLE_TEST)).toEqual({ etat: "lue", configuration: configurationMarquee() });
    expect(lireConfiguration(meta, CLE_REELLE)).toEqual({ etat: "illisible" });
  });

  it("n'envoie aucune donnée saisie en clair : ni métadonnée, ni description, ni facture", async () => {
    await commander();
    const envoye = JSON.stringify(stripe.sessionsCreees);
    expect(marquesDans(envoye)).toEqual([]);
    // Les autres champs du formulaire non plus : seuls le thème et la tranche d'âge décrivent le jeu.
    expect(envoye).not.toMatch(/"prenom"|"invites"|"cachettes"|nombreEnfants/);
  });

  it("n'écrit aucune donnée saisie dans les journaux, même quand Stripe refuse", async () => {
    await commander();
    stripe.enPanne = true;
    const reponse = await commander();
    expect(reponse.status).toBe(502);
    expect(await erreurDe(reponse)).toBe("Le paiement n'a pas pu être préparé. Réessayez dans quelques minutes.");
    expect(journaux.length).toBeGreaterThan(0);
    expect(marquesDans(journaux.join("\n"))).toEqual([]);
    const meta = JSON.stringify(stripe.sessionsCreees[0]!.parametres.payment_intent_data!.metadata);
    const morceau = (JSON.parse(meta) as Record<string, string>).config_0!;
    expect(journaux.join("\n")).not.toContain(morceau.slice(0, 40));
  });

  it("fiche complète exigée : la fiche réelle, convention non signée, garde la vente fermée", async () => {
    injection.deps = dependances(stripe, { fiche: { ...FICHE_COMPLETE, mediateur: VENDEUR.mediateur } });
    expect((await commander()).status).toBe(503);
  });
});
