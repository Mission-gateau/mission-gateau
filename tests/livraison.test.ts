import { renderToBuffer } from "@react-pdf/renderer";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dependances } from "@/vente/dependances";

/**
 * La livraison d'une commande payée, et rien d'autre : chaque cas où le jeu
 * ne doit pas partir est essayé sur la vraie route, avec un faux Stripe.
 */
const injection = vi.hoisted(() => ({ deps: null as unknown }));
vi.mock("@/vente/dependances", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/vente/dependances")>();
  return { ...original, dependancesReelles: () => (injection.deps as Dependances | null) ?? original.dependancesReelles() };
});

import { POST as commanderRoute } from "@/app/api/commande/route";
import { GET as kitGet, POST as kitPost } from "@/app/api/commande/[ref]/kit/route";
import { VERSION_KIT, construireKit } from "@/engine/kit";
import type { Configuration } from "@/engine/types";
import { documentKit } from "@/pdf/documents/kit";
import { enregistrerPolices } from "@/pdf/ressources";
import { etatDeLaCommande } from "@/vente/commande";
import { CLES, lireConfiguration } from "@/vente/metadonnees";
import { compterPages, configuration } from "./aide";
import {
  CLE_REELLE,
  CLE_TEST,
  FauxStripe,
  configurationMarquee,
  corpsDeCommande,
  dependances,
  environnement,
  marquesDans,
  requeteJson,
} from "./fauxStripe";
import { CARACTERE_INCONNU, textesDesPages } from "./lirePdf";

const MAINTENANT = new Date("2026-09-24T12:00:00.000Z");
const JOUR = 24 * 60 * 60 * 1000;

let stripe: FauxStripe;
let journaux: string[];

beforeAll(() => {
  enregistrerPolices();
});

beforeEach(() => {
  stripe = new FauxStripe();
  injection.deps = dependances(stripe, { maintenant: () => MAINTENANT });
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

/** Passe une commande par la vraie route, puis simule son paiement. */
async function commandeReglee(
  options: { corps?: Record<string, unknown>; payeLe?: Date; statut?: string; indexe?: boolean } = {},
) {
  const reponse = await commanderRoute(requeteJson("http://localhost/api/commande", options.corps ?? corpsDeCommande()));
  expect(reponse.status).toBe(200);
  return stripe.payer({ payeLe: options.payeLe ?? new Date(MAINTENANT.getTime() - JOUR), statut: options.statut, indexe: options.indexe });
}

function telecharger(reference: string, corps: unknown = {}): Promise<Response> {
  return kitPost(requeteJson(`http://localhost/api/commande/${reference}/kit`, corps), {
    params: Promise.resolve({ ref: reference }),
  });
}

/**
 * Deux PDF portent le même texte, page pour page. Seule tolérance : le défaut
 * connu de @react-pdf/renderer (voir le README), qui peut laisser un glyphe
 * sans caractère — au plus un par document.
 */
function memesPages(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  let ecarts = 0;
  for (let page = 0; page < a.length; page += 1) {
    const x = a[page]!;
    const y = b[page]!;
    if (x === y) continue;
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i += 1) {
      if (x[i] === y[i]) continue;
      if (x[i] !== CARACTERE_INCONNU && y[i] !== CARACTERE_INCONNU) return false;
      ecarts += 1;
    }
  }
  return ecarts <= 2;
}

async function estUnPdf(reponse: Response): Promise<boolean> {
  const octets = Buffer.from(await reponse.clone().arrayBuffer());
  return octets.subarray(0, 5).toString() === "%PDF-" || /pdf/.test(reponse.headers.get("Content-Type") ?? "");
}

function etat(reference: string, sessionId: string | null = null, maintenant = MAINTENANT) {
  const deps = injection.deps as Dependances;
  return etatDeLaCommande({ reference, sessionId, client: deps.client, cleStripe: deps.env.cleStripe, maintenant });
}

describe("état d'une commande, vérifié chez Stripe", () => {
  it("payée : par la session au retour de Stripe, puis par la référence depuis l'e-mail", async () => {
    const { reference, sessionId } = await commandeReglee();
    expect((await etat(reference, sessionId)).etat).toBe("payee");
    expect((await etat(reference)).etat).toBe("payee");
  });

  it("au retour immédiat de Stripe, la session suffit même si la recherche ne voit pas encore le paiement", async () => {
    const { reference, sessionId } = await commandeReglee({ indexe: false });
    expect((await etat(reference, sessionId)).etat).toBe("payee");
    expect((await etat(reference)).etat).toBe("introuvable");
  });

  it("paiement non abouti : session impayée, ou paiement refusé", async () => {
    await commanderRoute(requeteJson("http://localhost/api/commande", corpsDeCommande()));
    const { id, reference } = stripe.derniereSession();
    expect((await etat(reference, id)).etat).toBe("non_aboutie");
    const refuse = await commandeReglee({ statut: "requires_payment_method" });
    expect((await etat(refuse.reference)).etat).toBe("non_aboutie");
  });

  it("introuvable : référence inconnue, mal formée, ou session d'une autre commande", async () => {
    const { sessionId } = await commandeReglee();
    expect((await etat("AAAAAAAAAAAAAAAAAAAAAA")).etat).toBe("introuvable");
    expect((await etat("AAAAAAAAAAAAAAAAAAAAAA", sessionId)).etat).toBe("introuvable");
    const recherches = stripe.recherchesParReference.length;
    for (const douteuse of ["abc", "../../etc/passwd", 'x"]:"y', ""]) {
      expect((await etat(douteuse)).etat).toBe("introuvable");
    }
    // Une référence mal formée n'est même pas cherchée chez Stripe.
    expect(stripe.recherchesParReference).toHaveLength(recherches);
  });

  it("expirée : plus de 30 jours après le paiement", async () => {
    const vieille = await commandeReglee({ payeLe: new Date(MAINTENANT.getTime() - 31 * JOUR) });
    expect((await etat(vieille.reference)).etat).toBe("expiree");
    const limite = await commandeReglee({ payeLe: new Date(MAINTENANT.getTime() - 30 * JOUR) });
    expect((await etat(limite.reference)).etat).toBe("payee");
    expect((await etat(limite.reference, null, new Date(MAINTENANT.getTime() + 1000))).etat).toBe("expiree");
  });

  it("remboursée en totalité : plus rien n'est livré", async () => {
    const { reference, sessionId, paiement } = await commandeReglee();
    stripe.rembourser(paiement.id);
    expect((await etat(reference)).etat).toBe("remboursee");
    expect((await etat(reference, sessionId)).etat).toBe("remboursee");
  });

  it("d'une autre version du kit : refusée, jamais remplacée par la version courante", async () => {
    const { reference, paiement } = await commandeReglee();
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.versionKit] = "1.1";
    expect((await etat(reference)).etat).toBe("autre_version");
  });

  it("illisible : contenu chiffré altéré, ou clé Stripe changée depuis la commande", async () => {
    const { reference, paiement } = await commandeReglee();
    const meta = stripe.paiements.get(paiement.id)!.metadonnees;
    const origine = meta.config_0!;
    meta.config_0 = `${origine.slice(0, -2)}${origine.endsWith("AA") ? "BB" : "AA"}`;
    expect((await etat(reference)).etat).toBe("illisible");
    meta.config_0 = origine;
    expect((await etat(reference)).etat).toBe("payee");
    injection.deps = dependances(stripe, {
      env: environnement({ vercelEnv: "production", cleStripe: CLE_REELLE }),
      maintenant: () => MAINTENANT,
    });
    expect((await etat(reference)).etat).toBe("illisible");
  });

  it("sans clé, aucune commande ne peut être trouvée ; quand Stripe ne répond pas, la vérification est indisponible", async () => {
    const { reference } = await commandeReglee();
    injection.deps = dependances(null, { env: environnement({ cleStripe: undefined }) });
    expect((await etat(reference)).etat).toBe("introuvable");
    injection.deps = dependances(stripe, { maintenant: () => MAINTENANT });
    stripe.enPanne = true;
    expect((await etat(reference)).etat).toBe("indisponible");
  });
});

describe("route du kit", () => {
  it("livre le PDF complet d'une commande payée, en pièce jointe, sans prénom dans le nom du fichier", async () => {
    const { reference, sessionId } = await commandeReglee();
    const reponse = await telecharger(reference, { session_id: sessionId });
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("Content-Type")).toBe("application/pdf");
    expect(reponse.headers.get("Content-Disposition")).toBe('attachment; filename="mission-gateau-pirates-escape.pdf"');
    expect(reponse.headers.get("Cache-Control")).toBe("no-store");
    expect(marquesDans(JSON.stringify([...reponse.headers.entries()]))).toEqual([]);
    const pdf = Buffer.from(await reponse.arrayBuffer());
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(compterPages(pdf)).toBeGreaterThan(10);
  });

  it("livre exactement le kit de l'aperçu : même configuration, même graine, même version", async () => {
    const { reference, paiement } = await commandeReglee();
    // Ce que Stripe a gardé redonne la configuration et la graine de l'aperçu…
    const lecture = lireConfiguration(paiement.metadonnees, CLE_TEST);
    expect(lecture).toEqual({ etat: "lue", configuration: configurationMarquee() });
    expect(paiement.metadonnees[CLES.graine]).toBe("k7m2p9q4rs");
    expect(paiement.metadonnees[CLES.versionKit]).toBe(VERSION_KIT);
    // … et le PDF livré est celui que ces deux-là produisent, page pour page.
    const livre = Buffer.from(await (await telecharger(reference)).arrayBuffer());
    const attendu = await renderToBuffer(documentKit(construireKit(configurationMarquee(), "k7m2p9q4rs")));
    expect(memesPages(textesDesPages(livre), textesDesPages(attendu))).toBe(true);
    expect(textesDesPages(livre).join(" ")).toContain("Zéphyrine");
  });

  it("ne sert aucun PDF hors d'une commande payée", async () => {
    const cas: [string, () => Promise<string>, number][] = [
      ["introuvable", async () => "AAAAAAAAAAAAAAAAAAAAAA", 404],
      ["mal formée", async () => "pas-une-reference", 404],
      [
        "impayée",
        async () => {
          await commanderRoute(requeteJson("http://localhost/api/commande", corpsDeCommande()));
          stripe.payer({ statut: "requires_payment_method" });
          return stripe.derniereSession().reference;
        },
        402,
      ],
      [
        "expirée",
        async () => (await commandeReglee({ payeLe: new Date(MAINTENANT.getTime() - 40 * JOUR) })).reference,
        410,
      ],
      [
        "remboursée",
        async () => {
          const { reference, paiement } = await commandeReglee();
          stripe.rembourser(paiement.id);
          return reference;
        },
        410,
      ],
      [
        "autre version",
        async () => {
          const { reference, paiement } = await commandeReglee();
          stripe.paiements.get(paiement.id)!.metadonnees[CLES.versionKit] = "1.3";
          return reference;
        },
        409,
      ],
      [
        "altérée",
        async () => {
          const { reference, paiement } = await commandeReglee();
          stripe.paiements.get(paiement.id)!.metadonnees.config_0 = "AAAA";
          return reference;
        },
        409,
      ],
    ];
    for (const [nom, preparer, statut] of cas) {
      const reponse = await telecharger(await preparer());
      expect(reponse.status, nom).toBe(statut);
      expect(await estUnPdf(reponse), nom).toBe(false);
      const corps = (await reponse.json()) as { erreur: string };
      expect(corps.erreur.length, nom).toBeGreaterThan(20);
    }
  });

  it("ne sert rien sans clé, ni quand Stripe est en panne", async () => {
    const { reference } = await commandeReglee();
    injection.deps = dependances(null, { env: environnement({ cleStripe: undefined }) });
    const sansCle = await telecharger(reference);
    expect(sansCle.status).toBe(404);
    expect(await estUnPdf(sansCle)).toBe(false);
    injection.deps = dependances(stripe, { maintenant: () => MAINTENANT });
    stripe.enPanne = true;
    const panne = await telecharger(reference);
    expect(panne.status).toBe(503);
    expect(await estUnPdf(panne)).toBe(false);
  });

  it("ne livre rien sur une simple visite, ni à une requête trop lourde", async () => {
    expect(kitGet().status).toBe(405);
    const { reference } = await commandeReglee();
    const lourde = await telecharger(reference, { session_id: "x".repeat(2000) });
    expect(lourde.status).toBe(413);
  });

  it("la livraison dépend de la clé, pas de l'ouverture de la vente", async () => {
    const { reference } = await commandeReglee();
    // Fiche incomplète (convention non signée) : la vente est fermée, la livraison continue.
    injection.deps = { ...dependances(stripe, { maintenant: () => MAINTENANT }), fiche: (await import("@/contenu/vendeur")).VENDEUR };
    expect((await telecharger(reference)).status).toBe(200);
  });

  it("n'écrit ni prénom, ni donnée de la fête, ni contenu chiffré dans les journaux", async () => {
    const { reference, paiement } = await commandeReglee();
    await telecharger(reference);
    stripe.paiements.get(paiement.id)!.metadonnees.config_0 = "AAAA";
    await telecharger(reference);
    stripe.enPanne = true;
    await telecharger(reference);
    const tout = journaux.join("\n");
    expect(marquesDans(tout)).toEqual([]);
    expect(tout).not.toContain(paiement.metadonnees.config_1!.slice(0, 30));
  });

  it("produit le kit le plus lourd en moins de 5 secondes", async () => {
    const lourde: Configuration = configuration({
      theme: "agents",
      age: 11,
      nombreEnfants: 16,
      duree: 60,
      prenom: "Zéphyrine",
      fete: configurationMarquee().fete,
    });
    const { reference } = await commandeReglee({ corps: corpsDeCommande({ configuration: lourde }) });
    const debut = performance.now();
    const reponse = await telecharger(reference);
    const duree = performance.now() - debut;
    expect(reponse.status).toBe(200);
    process.stdout.write(`\n  Temps de production du kit livré (16 enfants, 60 min) : ${duree.toFixed(0)} ms\n`);
    expect(duree).toBeLessThan(5000);
  });
});
