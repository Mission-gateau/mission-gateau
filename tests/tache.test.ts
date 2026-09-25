import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dependances } from "@/vente/dependances";

/**
 * La tâche quotidienne, au-delà de l'effacement (tests/effacement.test.ts) :
 * les confirmations que personne n'est venu chercher, et les remboursements
 * des rétractations à retenter. Appelée par sa vraie route, avec le secret.
 */
const injection = vi.hoisted(() => ({ deps: null as unknown }));
vi.mock("@/vente/dependances", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/vente/dependances")>();
  return { ...original, dependancesReelles: () => (injection.deps as Dependances | null) ?? original.dependancesReelles() };
});

import { POST as commanderRoute } from "@/app/api/commande/route";
import { POST as confirmationPost } from "@/app/api/commande/[ref]/confirmation/route";
import { GET as tache } from "@/app/api/effacement/route";
import { POST as renoncerPost } from "@/app/api/renoncer/route";
import { CLES, lireSuivi } from "@/vente/metadonnees";
import { FauxEmail } from "./fauxEmail";
import {
  CLE_REELLE,
  FauxStripe,
  SECRET_TACHE,
  corpsDeCommande,
  dependances,
  environnement,
  marquesDans,
  requeteJson,
} from "./fauxStripe";

const MAINTENANT = new Date("2026-09-24T03:00:00.000Z");
const HEURE = 60 * 60 * 1000;
const JOUR = 24 * HEURE;

let stripe: FauxStripe;
let emails: FauxEmail;
let journaux: string[];
let horloge: Date;

beforeEach(() => {
  stripe = new FauxStripe();
  emails = new FauxEmail();
  horloge = MAINTENANT;
  injection.deps = dependances(stripe, {
    email: emails,
    env: environnement({ vercelEnv: "production", cleStripe: CLE_REELLE, secretTache: SECRET_TACHE }),
    maintenant: () => horloge,
  });
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

/** Une commande passée et payée `ilYa` millisecondes avant MAINTENANT, jamais revenue sur le site. */
async function payee(ilYa: number) {
  horloge = new Date(MAINTENANT.getTime() - ilYa);
  expect((await commanderRoute(requeteJson("http://localhost/api/commande", corpsDeCommande()))).status).toBe(200);
  const reglee = stripe.payer({ payeLe: horloge });
  horloge = MAINTENANT;
  return reglee;
}

async function lancer(): Promise<{ statut: number; bilan: Record<string, number | string> }> {
  const avant = journaux.length;
  const reponse = await tache(
    new Request("http://localhost/api/effacement", { headers: { Authorization: `Bearer ${SECRET_TACHE}` } }),
  );
  const bilan =
    journaux
      .slice(avant)
      .map((ligne) => JSON.parse(ligne) as Record<string, number | string>)
      .find((entree) => entree.tache === "quotidienne") ?? {};
  return { statut: reponse.status, bilan };
}

function confirmationsA(): number {
  return emails.envoyes.filter(({ message }) => message.objet.startsWith("Confirmation")).length;
}

describe("confirmations manquantes", () => {
  it("envoie la confirmation des commandes payées depuis plus d'une heure qui n'en ont pas", async () => {
    const oubliee = await payee(2 * HEURE);
    const recente = await payee(20 * 60 * 1000);
    const { statut, bilan } = await lancer();
    expect(statut).toBe(200);
    expect(bilan).toMatchObject({ confirmationsEnvoyees: 1, confirmationsTropRecentes: 1, erreurs: 0 });
    expect(lireSuivi(stripe.paiements.get(oubliee.paiement.id)!.metadonnees).confirmation).toEqual(MAINTENANT);
    expect(lireSuivi(stripe.paiements.get(recente.paiement.id)!.metadonnees).confirmation).toBeNull();
    expect(emails.envoyes[0]!.cle).toBe(`confirmation-${oubliee.reference}`);
  });

  it("n'en envoie jamais deux : ni après la page, ni au passage suivant", async () => {
    const venue = await payee(3 * HEURE);
    // L'acheteur est revenu sur la page : la confirmation est partie.
    horloge = new Date(MAINTENANT.getTime() - 3 * HEURE + 60_000);
    await confirmationPost(requeteJson(`http://localhost/api/commande/${venue.reference}/confirmation`, {}), {
      params: Promise.resolve({ ref: venue.reference }),
    });
    horloge = MAINTENANT;
    const oubliee = await payee(5 * HEURE);
    expect(confirmationsA()).toBe(1);

    const premier = await lancer();
    expect(premier.bilan).toMatchObject({ confirmationsEnvoyees: 1, confirmationsDejaFaites: 1 });
    expect(confirmationsA()).toBe(2);
    horloge = new Date(MAINTENANT.getTime() + 12 * HEURE);
    const second = await lancer();
    expect(second.bilan).toMatchObject({ confirmationsEnvoyees: 0, confirmationsDejaFaites: 2 });
    expect(confirmationsA()).toBe(2);
    expect(emails.envoyes.map((e) => e.cle).sort()).toEqual(
      [`confirmation-${venue.reference}`, `confirmation-${oubliee.reference}`].sort(),
    );
  });

  it("exclut les commandes rétractées, remboursées ou en litige", async () => {
    const retractee = await payee(3 * HEURE);
    stripe.paiements.get(retractee.paiement.id)!.metadonnees[CLES.retractation] = new Date(MAINTENANT.getTime() - HEURE).toISOString();
    stripe.rembourserHorsSite(retractee.paiement.id);
    const remboursee = await payee(3 * HEURE);
    stripe.rembourserHorsSite(remboursee.paiement.id);
    const contestee = await payee(3 * HEURE);
    stripe.contester(contestee.paiement.id);
    const { bilan } = await lancer();
    expect(bilan).toMatchObject({ confirmationsEnvoyees: 0, confirmationsExclues: 2 });
    expect(emails.appels).toHaveLength(0);
  });

  it("relit chaque paiement avant d'envoyer : la recherche de Stripe peut être en retard", async () => {
    const oubliee = await payee(3 * HEURE);
    // La recherche rend un paiement sans marque, mais il a été confirmé entre-temps.
    const recherche = stripe.paiementsAboutisDepuis.bind(stripe);
    stripe.paiementsAboutisDepuis = async (depuis, page) => {
      const resultat = await recherche(depuis, page);
      stripe.paiements.get(oubliee.paiement.id)!.metadonnees[CLES.confirmation] = MAINTENANT.toISOString();
      return resultat;
    };
    const { bilan } = await lancer();
    expect(bilan).toMatchObject({ confirmationsEnvoyees: 0, confirmationsDejaFaites: 1 });
    expect(stripe.paiementsRelus).toContain(oubliee.paiement.id);
    expect(emails.appels).toHaveLength(0);
  });

  it("compte un échec d'envoi, sans rien enregistrer, et réessaie au passage suivant", async () => {
    const oubliee = await payee(3 * HEURE);
    emails.refuse = true;
    const premier = await lancer();
    expect(premier.bilan).toMatchObject({ confirmationsEchouees: 1, confirmationsEnvoyees: 0 });
    expect(lireSuivi(stripe.paiements.get(oubliee.paiement.id)!.metadonnees).confirmation).toBeNull();
    emails.refuse = false;
    const second = await lancer();
    expect(second.bilan).toMatchObject({ confirmationsEnvoyees: 1 });
  });

  it("cherche les paiements aboutis des 45 derniers jours", async () => {
    await lancer();
    expect(stripe.recherchesAbouties[0]!.depuis).toBe(Math.floor((MAINTENANT.getTime() - 45 * JOUR) / 1000));
  });
});

describe("remboursements à retenter", () => {
  async function retracteeSansRemboursement() {
    horloge = new Date(MAINTENANT.getTime() - 2 * JOUR);
    expect((await commanderRoute(requeteJson("http://localhost/api/commande", corpsDeCommande()))).status).toBe(200);
    const reglee = stripe.payer({ payeLe: horloge });
    await confirmationPost(requeteJson(`http://localhost/api/commande/${reglee.reference}/confirmation`, {}), {
      params: Promise.resolve({ ref: reglee.reference }),
    });
    horloge = new Date(MAINTENANT.getTime() - JOUR);
    stripe.remboursementEnPanne = true;
    await renoncerPost(
      requeteJson("http://localhost/api/renoncer", {
        nom: "Martin",
        prenom: "Camille",
        reference: reglee.reference,
        email: "delivered@resend.dev",
      }),
    );
    stripe.remboursementEnPanne = false;
    horloge = MAINTENANT;
    expect(stripe.paiements.get(reglee.paiement.id)!.rembourseEnTotalite).toBe(false);
    return reglee;
  }

  it("retente le remboursement d'une rétractation enregistrée, une fois par jour, jamais deux fois", async () => {
    const { paiement, reference } = await retracteeSansRemboursement();
    const { bilan } = await lancer();
    expect(bilan).toMatchObject({ remboursementsRetentes: 1, remboursementsReussis: 1, remboursementsEchoues: 0 });
    expect(stripe.paiements.get(paiement.id)!.rembourseEnTotalite).toBe(true);
    const tentatives = stripe.demandesDeRemboursement.map((d) => d.cle);
    expect(tentatives).toEqual([`retractation-${reference}`, `retractation-${reference}-2026-09-24`]);
    expect(stripe.demandesDeRemboursement.every((d) => d.id === paiement.id)).toBe(true);
    expect(stripe.remboursements).toHaveLength(1);
    // Remboursée : plus rien à retenter.
    const second = await lancer();
    expect(second.bilan).toMatchObject({ remboursementsRetentes: 0 });
    expect(stripe.remboursements).toHaveLength(1);
  });

  it("compte un nouvel échec, et retente le lendemain avec une nouvelle clé", async () => {
    const { reference } = await retracteeSansRemboursement();
    stripe.remboursementEnPanne = true;
    expect((await lancer()).bilan).toMatchObject({ remboursementsRetentes: 1, remboursementsEchoues: 1 });
    stripe.remboursementEnPanne = false;
    horloge = new Date(MAINTENANT.getTime() + JOUR);
    expect((await lancer()).bilan).toMatchObject({ remboursementsReussis: 1 });
    expect(stripe.demandesDeRemboursement.at(-1)!.cle).toBe(`retractation-${reference}-2026-09-25`);
  });

  it("ne rembourse pas automatiquement une commande en litige", async () => {
    const { paiement } = await retracteeSansRemboursement();
    stripe.contester(paiement.id);
    const avant = stripe.demandesDeRemboursement.length;
    expect((await lancer()).bilan).toMatchObject({ remboursementsRetentes: 0 });
    expect(stripe.demandesDeRemboursement).toHaveLength(avant);
  });
});

describe("la tâche entière", () => {
  it("garde les compteurs déjà faits quand une étape tombe en panne", async () => {
    await payee(40 * JOUR);
    stripe.paiementsAboutisDepuis = async () => {
      throw Object.assign(new Error("panne simulée"), { type: "StripeConnectionError" });
    };
    const { statut, bilan } = await lancer();
    expect(statut).toBe(500);
    expect(bilan).toMatchObject({ paiementsEffaces: 1, debitsEffaces: 1, erreurs: 1 });
  });

  it("peut tourner deux fois de suite sans rien faire deux fois", async () => {
    await payee(3 * HEURE);
    await payee(40 * JOUR);
    await lancer();
    const etat = JSON.stringify([...stripe.paiements.values()]);
    const envois = emails.envoyes.length;
    const { bilan } = await lancer();
    expect(bilan).toMatchObject({ confirmationsEnvoyees: 0, paiementsEffaces: 0, erreurs: 0 });
    expect(JSON.stringify([...stripe.paiements.values()])).toBe(etat);
    expect(emails.envoyes).toHaveLength(envois);
  });

  it("n'écrit dans les journaux que des compteurs, sans donnée personnelle", async () => {
    await payee(3 * HEURE);
    journaux.length = 0;
    await lancer();
    const entree = journaux.map((ligne) => JSON.parse(ligne) as Record<string, unknown>).find((e) => e.tache === "quotidienne")!;
    const autres = Object.entries(entree).filter(([cle]) => cle !== "tache");
    expect(autres.every(([, valeur]) => typeof valeur === "number")).toBe(true);
    expect(marquesDans(journaux.join("\n"))).toEqual([]);
    expect(journaux.join("\n")).not.toContain("@");
  });

  it("ne tourne qu'avec le secret, même en préversion", async () => {
    injection.deps = dependances(stripe, { email: emails, env: environnement(), maintenant: () => horloge });
    const reponse = await tache(
      new Request("http://localhost/api/effacement", { headers: { Authorization: `Bearer ${SECRET_TACHE}` } }),
    );
    expect(reponse.status).toBe(401);
  });
});
