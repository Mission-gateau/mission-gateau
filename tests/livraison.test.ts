import { renderToBuffer } from "@react-pdf/renderer";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dependances } from "@/vente/dependances";

/**
 * La livraison d'une commande payée et confirmée, et rien d'autre : chaque
 * cas où le jeu ne doit pas partir est essayé sur la vraie route, avec un
 * faux Stripe et un faux Resend.
 */
const injection = vi.hoisted(() => ({ deps: null as unknown }));
vi.mock("@/vente/dependances", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/vente/dependances")>();
  return { ...original, dependancesReelles: () => (injection.deps as Dependances | null) ?? original.dependancesReelles() };
});

import { POST as commanderRoute } from "@/app/api/commande/route";
import { POST as confirmationPost } from "@/app/api/commande/[ref]/confirmation/route";
import { GET as kitGet, POST as kitPost } from "@/app/api/commande/[ref]/kit/route";
import { VERSION_KIT, construireKit } from "@/engine/kit";
import type { Configuration } from "@/engine/types";
import { documentKit } from "@/pdf/documents/kit";
import { enregistrerPolices } from "@/pdf/ressources";
import { etatDeLaCommande } from "@/vente/commande";
import { CLES, lireConfiguration, lireSuivi } from "@/vente/metadonnees";
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
import { FauxEmail } from "./fauxEmail";
import { CARACTERE_INCONNU, textesDesPages } from "./lirePdf";

const MAINTENANT = new Date("2026-09-24T12:00:00.000Z");
const JOUR = 24 * 60 * 60 * 1000;

let stripe: FauxStripe;
let emails: FauxEmail;
let journaux: string[];

beforeAll(() => {
  enregistrerPolices();
});

beforeEach(() => {
  stripe = new FauxStripe();
  emails = new FauxEmail();
  injection.deps = dependances(stripe, { email: emails, maintenant: () => MAINTENANT });
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

function confirmer(reference: string, corps: unknown = {}): Promise<Response> {
  return confirmationPost(requeteJson(`http://localhost/api/commande/${reference}/confirmation`, corps), {
    params: Promise.resolve({ ref: reference }),
  });
}

/** Une commande payée, puis confirmée par la route que la page appelle à son chargement. */
async function commandeConfirmee(options: Parameters<typeof commandeReglee>[0] = {}) {
  const reglee = await commandeReglee(options);
  const reponse = await confirmer(reglee.reference, { session_id: reglee.sessionId });
  expect(reponse.status).toBe(200);
  return reglee;
}

/** Le texte de chaque page contient-il `phrase`, au défaut connu de @react-pdf près (un glyphe sans caractère) ? */
function porteSurChaquePage(pages: string[], phrase: string): boolean {
  return pages.every((page) => {
    for (let debut = 0; debut + phrase.length <= page.length; debut += 1) {
      let inconnus = 0;
      let ok = true;
      for (let i = 0; i < phrase.length && ok; i += 1) {
        const c = page[debut + i];
        if (c === phrase[i]) continue;
        if (c === CARACTERE_INCONNU && inconnus < 2) inconnus += 1;
        else ok = false;
      }
      if (ok) return true;
    }
    return false;
  });
}

const FILIGRANE_ESSAI = "Exemplaire d'essai — sans valeur commerciale";

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

  it("les 30 jours courent à partir du débit réussi, pas d'une tentative refusée", async () => {
    // Carte refusée il y a 31 jours, puis paiement réussi il y a 29 jours : le lien vaut encore.
    const reessaye = await commandeReglee({ payeLe: new Date(MAINTENANT.getTime() - 29 * JOUR) });
    stripe.paiements.get(reessaye.paiement.id)!.cree = Math.floor((MAINTENANT.getTime() - 31 * JOUR) / 1000);
    const etatReessaye = await etat(reessaye.reference);
    expect(etatReessaye.etat).toBe("payee");
    expect(etatReessaye.etat === "payee" && etatReessaye.expireLe.getTime()).toBe(
      MAINTENANT.getTime() - 29 * JOUR + 30 * JOUR,
    );
  });

  it("remboursée en totalité : plus rien n'est livré", async () => {
    const { reference, sessionId, paiement } = await commandeReglee();
    stripe.rembourserHorsSite(paiement.id);
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
  it("livre le PDF complet d'une commande payée et confirmée, en pièce jointe, sans prénom dans le nom du fichier", async () => {
    const { reference, sessionId } = await commandeConfirmee();
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
    const { reference, paiement } = await commandeConfirmee();
    // Ce que Stripe a gardé redonne la configuration et la graine de l'aperçu…
    const lecture = lireConfiguration(paiement.metadonnees, CLE_TEST);
    expect(lecture).toEqual({ etat: "lue", configuration: configurationMarquee() });
    expect(paiement.metadonnees[CLES.graine]).toBe("k7m2p9q4rs");
    expect(paiement.metadonnees[CLES.versionKit]).toBe(VERSION_KIT);
    // … et le PDF livré est celui que ces deux-là produisent, page pour page.
    const livre = Buffer.from(await (await telecharger(reference)).arrayBuffer());
    // Hors production, le kit livré porte en plus le filigrane d'essai.
    const attendu = await renderToBuffer(documentKit(construireKit(configurationMarquee(), "k7m2p9q4rs"), { essai: true }));
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
          const { reference, paiement } = await commandeConfirmee();
          stripe.rembourserHorsSite(paiement.id);
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
    const { reference } = await commandeConfirmee();
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

  it("refuse la livraison tant que la confirmation n'est pas partie", async () => {
    const { reference, sessionId, paiement } = await commandeReglee();
    const avant = await telecharger(reference, { session_id: sessionId });
    expect(avant.status).toBe(409);
    expect(await estUnPdf(avant)).toBe(false);
    expect(((await avant.json()) as { etat: string; erreur: string }).etat).toBe("non_confirmee");
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).telechargement).toBeNull();
    // Un envoi refusé par Resend ne débloque rien non plus.
    emails.refuse = true;
    expect((await confirmer(reference, { session_id: sessionId })).status).toBe(503);
    expect((await telecharger(reference, { session_id: sessionId })).status).toBe(409);
    emails.refuse = false;
    expect((await confirmer(reference, { session_id: sessionId })).status).toBe(200);
    expect((await telecharger(reference, { session_id: sessionId })).status).toBe(200);
  });

  it("enregistre le premier téléchargement juste avant de livrer, et une seule fois", async () => {
    const { reference, paiement } = await commandeConfirmee();
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).telechargement).toBeNull();
    const premier = await telecharger(reference);
    expect(premier.status).toBe(200);
    const heure = stripe.paiements.get(paiement.id)!.metadonnees[CLES.telechargement];
    expect(heure).toBe(MAINTENANT.toISOString());
    const ecritures = stripe.modifications.filter((m) => CLES.telechargement in m.metadonnees);
    expect(ecritures).toHaveLength(1);

    injection.deps = dependances(stripe, { email: emails, maintenant: () => new Date(MAINTENANT.getTime() + 3600_000) });
    expect((await telecharger(reference)).status).toBe(200);
    expect((await telecharger(reference)).status).toBe(200);
    expect(stripe.paiements.get(paiement.id)!.metadonnees[CLES.telechargement]).toBe(heure);
    expect(stripe.modifications.filter((m) => CLES.telechargement in m.metadonnees)).toHaveLength(1);
  });

  it("ne livre aucun PDF si le premier téléchargement ne peut pas être enregistré", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.metadonneesEnPanne = true;
    const reponse = await telecharger(reference);
    expect(reponse.status).toBe(503);
    expect(await estUnPdf(reponse)).toBe(false);
    expect(((await reponse.json()) as { erreur: string }).erreur).toBe(
      "Votre téléchargement n'a pas pu être enregistré\u00a0: le jeu ne vous est pas envoyé pour le moment. Réessayez dans quelques minutes.",
    );
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).telechargement).toBeNull();
  });

  it("refuse la livraison après une rétractation, et pendant un litige", async () => {
    const retractee = await commandeConfirmee();
    stripe.paiements.get(retractee.paiement.id)!.metadonnees[CLES.retractation] = MAINTENANT.toISOString();
    const apresRetractation = await telecharger(retractee.reference);
    expect(apresRetractation.status).toBe(410);
    expect(await estUnPdf(apresRetractation)).toBe(false);
    expect(((await apresRetractation.json()) as { etat: string }).etat).toBe("retractee");

    const contestee = await commandeConfirmee();
    stripe.contester(contestee.paiement.id);
    const pendantLitige = await telecharger(contestee.reference);
    expect(pendantLitige.status).toBe(409);
    expect(await estUnPdf(pendantLitige)).toBe(false);
    const corps = (await pendantLitige.json()) as { etat: string; erreur: string };
    expect(corps.etat).toBe("litige");
    expect(corps.erreur).toMatch(/contestation/);
  });

  it("refuse un premier téléchargement qu'une rétractation a précédé chez Stripe : elle l'emporte, et la course est écrite", async () => {
    const { reference, paiement } = await commandeConfirmee();
    const modifier = stripe.modifierMetadonnees.bind(stripe);
    // La rétractation est écrite entre la vérification de la commande et l'écriture du premier téléchargement.
    stripe.modifierMetadonnees = async (id: string, metadonnees: Record<string, string>) => {
      if (CLES.telechargement in metadonnees) {
        stripe.paiements.get(paiement.id)!.metadonnees[CLES.retractation] = MAINTENANT.toISOString();
      }
      return modifier(id, metadonnees);
    };
    const reponse = await telecharger(reference);
    expect(reponse.status).toBe(410);
    expect(await estUnPdf(reponse)).toBe(false);
    expect(((await reponse.json()) as { etat: string }).etat).toBe("retractee");
    const meta = stripe.paiements.get(paiement.id)!.metadonnees;
    expect(meta[CLES.course]).toBe("retractation");
    // Les deux marques existent ; la page dit « rétractée ».
    expect((await etat(reference)).etat).toBe("retractee");
  });

  it("si la course ne peut pas être écrite, la commande est « à examiner » : ni PDF, ni remboursement automatique", async () => {
    const { reference, paiement } = await commandeConfirmee();
    const modifier = stripe.modifierMetadonnees.bind(stripe);
    stripe.modifierMetadonnees = async (id: string, metadonnees: Record<string, string>) => {
      if (CLES.telechargement in metadonnees) {
        stripe.paiements.get(paiement.id)!.metadonnees[CLES.retractation] = MAINTENANT.toISOString();
      }
      return modifier(id, metadonnees);
    };
    stripe.clesEnPanne.add(CLES.course);
    const reponse = await telecharger(reference);
    expect(reponse.status).toBe(410);
    expect(await estUnPdf(reponse)).toBe(false);
    expect(journaux.map((ligne) => JSON.parse(ligne) as Record<string, string>)).toContainEqual({
      route: "kit",
      evenement: "course_non_enregistree",
      reference,
    });
    expect((await etat(reference)).etat).toBe("a_examiner");
    const ensuite = await telecharger(reference);
    expect(ensuite.status).toBe(409);
    expect(((await ensuite.json()) as { etat: string; erreur: string }).erreur).toContain("le vendeur examine votre commande");
  });

  it("un téléchargement qui a gagné la course continue d'être livré, même avec une rétractation battue", async () => {
    const { reference, paiement } = await commandeConfirmee();
    expect((await telecharger(reference)).status).toBe(200);
    const meta = stripe.paiements.get(paiement.id)!.metadonnees;
    meta[CLES.retractation] = new Date(MAINTENANT.getTime() + 1000).toISOString();
    meta[CLES.course] = "telechargement";
    expect((await telecharger(reference)).status).toBe(200);
  });

  it("en production avec une clé de test : aucun client Stripe, rien n'est livré ni envoyé", async () => {
    const { reference } = await commandeConfirmee();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("STRIPE_SECRET_KEY", CLE_TEST);
    vi.stubEnv("RESEND_API_KEY", "re_fauxfauxfauxfauxfauxfaux");
    try {
      const { dependancesReelles } = await vi.importActual<typeof import("@/vente/dependances")>("@/vente/dependances");
      const reelles = dependancesReelles();
      expect(reelles.client).toBeNull();
      injection.deps = { ...reelles, email: emails };
      const appels = emails.appels.length;
      const kit = await telecharger(reference);
      expect(kit.status).toBe(404);
      expect(await estUnPdf(kit)).toBe(false);
      const confirmation = await confirmer(reference);
      expect(confirmation.status).toBe(404);
      expect(emails.appels).toHaveLength(appels);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("porte le filigrane d'essai sur chaque page hors production, et jamais en production", async () => {
    const essai = await commandeConfirmee();
    const pagesEssai = textesDesPages(Buffer.from(await (await telecharger(essai.reference)).arrayBuffer()));
    expect(pagesEssai.length).toBeGreaterThan(10);
    expect(porteSurChaquePage(pagesEssai, FILIGRANE_ESSAI)).toBe(true);

    injection.deps = dependances(stripe, {
      email: emails,
      env: environnement({ vercelEnv: "production", cleStripe: CLE_REELLE }),
      maintenant: () => MAINTENANT,
    });
    const reelle = await commandeConfirmee();
    const pagesReelles = textesDesPages(Buffer.from(await (await telecharger(reelle.reference)).arrayBuffer()));
    expect(pagesReelles.length).toBe(pagesEssai.length);
    for (const page of pagesReelles) {
      expect(page).not.toMatch(/xemplaire|essai|valeur commerciale/i);
    }
  });

  it("la livraison dépend de la clé, pas de l'ouverture de la vente", async () => {
    const { reference } = await commandeConfirmee();
    // Fiche incomplète (convention non signée) : la vente est fermée, la livraison continue.
    injection.deps = { ...dependances(stripe, { maintenant: () => MAINTENANT }), fiche: (await import("@/contenu/vendeur")).VENDEUR };
    expect((await telecharger(reference)).status).toBe(200);
  });

  it("n'écrit ni prénom, ni donnée de la fête, ni contenu chiffré dans les journaux", async () => {
    const { reference, paiement } = await commandeConfirmee();
    await telecharger(reference);
    stripe.paiements.get(paiement.id)!.metadonnees.config_0 = "AAAA";
    await telecharger(reference);
    stripe.enPanne = true;
    await telecharger(reference);
    const tout = journaux.join("\n");
    expect(marquesDans(tout)).toEqual([]);
    expect(tout).not.toContain(paiement.metadonnees.config_1!.slice(0, 30));
  });

  it("livre un kit dont les invités ont des prénoms inhabituels mais permis", async () => {
    const invites = ["Léa B.", "O'Neil", "Jean-Luc 2", "Anaïs & Zoé", "M'Baye", "Ève (cousine)"];
    const { reference } = await commandeConfirmee({
      corps: corpsDeCommande({ configuration: configuration({ age: 8, nombreEnfants: 8, fete: { invites } }) }),
    });
    const reponse = await telecharger(reference);
    expect(reponse.status).toBe(200);
    expect(textesDesPages(Buffer.from(await reponse.arrayBuffer())).join(" ")).toContain("Ève (cousine)");
  });

  it("refuse dès la commande une accolade, qui rendrait le kit impossible à produire", async () => {
    for (const fete of [{ invites: ["{Tom}"] }, { date: "le {samedi}" }, { adresse: "3 rue {x}" }, { contact: "}" }]) {
      const reponse = await commanderRoute(
        requeteJson("http://localhost/api/commande", corpsDeCommande({ configuration: configuration({ fete }) })),
      );
      expect(reponse.status, JSON.stringify(fete)).toBe(422);
      const corps = (await reponse.json()) as { details: { message: string }[] };
      expect(corps.details.map((d) => d.message)).toContain(
        "Les accolades { } ne sont pas acceptées dans les détails de la fête.",
      );
    }
    expect(stripe.sessionsCreees).toHaveLength(0);
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
    const { reference } = await commandeConfirmee({ corps: corpsDeCommande({ configuration: lourde }) });
    const debut = performance.now();
    const reponse = await telecharger(reference);
    const duree = performance.now() - debut;
    expect(reponse.status).toBe(200);
    process.stdout.write(`\n  Temps de production du kit livré (16 enfants, 60 min) : ${duree.toFixed(0)} ms\n`);
    expect(duree).toBeLessThan(5000);
  });
});
