import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dependances } from "@/vente/dependances";

/**
 * La tâche quotidienne qui efface la configuration chiffrée des paiements de
 * plus de 30 jours, appelée par sa vraie route.
 */
const injection = vi.hoisted(() => ({ deps: null as unknown }));
vi.mock("@/vente/dependances", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/vente/dependances")>();
  return { ...original, dependancesReelles: () => (injection.deps as Dependances | null) ?? original.dependancesReelles() };
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { POST as commanderRoute } from "@/app/api/commande/route";
import { GET as effacer } from "@/app/api/effacement/route";
import { CLES, configurationPresente, lireCommande } from "@/vente/metadonnees";
import type { PaiementLu } from "@/vente/stripe";
import { FauxStripe, corpsDeCommande, dependances, environnement, marquesDans, requeteJson } from "./fauxStripe";

const MAINTENANT = new Date("2026-09-24T03:00:00.000Z");
const JOUR = 24 * 60 * 60 * 1000;

let stripe: FauxStripe;
let journaux: string[];

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

function ilYa(jours: number, secondes = 0): Date {
  return new Date(MAINTENANT.getTime() - jours * JOUR - secondes * 1000);
}

/** Une commande payée il y a `jours` jours (plus une marge en secondes). */
async function payeeIlYa(jours: number, secondes = 0, premiereTentative?: Date): Promise<PaiementLu> {
  const reponse = await commanderRoute(requeteJson("http://localhost/api/commande", corpsDeCommande()));
  expect(reponse.status).toBe(200);
  return stripe.payer({ payeLe: ilYa(jours, secondes), premiereTentative }).paiement;
}

async function lancer(): Promise<{ statut: number; bilan: Record<string, number | string> }> {
  const reponse = await effacer();
  return { statut: reponse.status, bilan: (await reponse.json()) as Record<string, number | string> };
}

function debitsDe(paiement: PaiementLu) {
  return [...stripe.debits.values()].filter((debit) => debit.id.startsWith(paiement.id.replace("pi_", "ch_")));
}

describe("effacement à 30 jours", () => {
  it("efface la configuration chiffrée du paiement et de son débit, et elle seule", async () => {
    const vieux = await payeeIlYa(31);
    const avant = structuredClone(stripe.paiements.get(vieux.id)!.metadonnees);
    expect(debitsDe(vieux).every((debit) => configurationPresente(debit.metadonnees))).toBe(true);

    const { statut, bilan } = await lancer();
    expect(statut).toBe(200);
    expect(bilan).toMatchObject({ tache: "effacement", paiementsEffaces: 1, debitsEffaces: 1, erreurs: 0 });

    const apres = stripe.paiements.get(vieux.id)!.metadonnees;
    expect(configurationPresente(apres)).toBe(false);
    expect(apres[CLES.etatConfiguration]).toBe("effacee");
    // La commande reste : référence, graine, version, pays, CGV et heure des accords.
    expect(lireCommande(apres)).toEqual(lireCommande(avant));
    expect(Object.keys(apres).filter((cle) => cle.startsWith("config_"))).toEqual([]);
    // La copie que Stripe a faite sur le débit disparaît aussi.
    for (const debit of debitsDe(vieux)) {
      expect(configurationPresente(debit.metadonnees), debit.id).toBe(false);
      expect(lireCommande(debit.metadonnees)).toEqual(lireCommande(avant));
    }
    // Stripe reçoit une valeur vide pour chaque morceau : c'est ainsi qu'on y supprime une clé.
    for (const envoi of [stripe.modifications[0]!, stripe.modificationsDeDebits[0]!]) {
      const vides = Object.entries(envoi.metadonnees).filter(([cle]) => cle !== CLES.etatConfiguration);
      expect(vides.length).toBeGreaterThan(1);
      expect(vides.every(([, valeur]) => valeur === "")).toBe(true);
    }
  });

  it("efface aussi le débit d'une tentative refusée", async () => {
    const vieux = await payeeIlYa(35, 0, ilYa(36));
    expect(debitsDe(vieux)).toHaveLength(2);
    const { bilan } = await lancer();
    expect(bilan).toMatchObject({ paiementsEffaces: 1, debitsEffaces: 2 });
    expect(debitsDe(vieux).some((debit) => configurationPresente(debit.metadonnees))).toBe(false);
  });

  it("compte les 30 jours à partir du débit réussi, pas de la première tentative", async () => {
    // Carte refusée il y a 31 jours, paiement réussi il y a 29 jours : le lien vaut encore.
    const paiement = await payeeIlYa(29, 0, ilYa(31));
    stripe.rechercheIgnoreLaDate = true;
    const { bilan } = await lancer();
    expect(configurationPresente(stripe.paiements.get(paiement.id)!.metadonnees)).toBe(true);
    expect(bilan).toMatchObject({ paiementsRecents: 1, paiementsEffaces: 0 });
    // Le débit refusé, lui, a plus de 30 jours : sa copie peut partir, la livraison ne la lit pas.
    expect(bilan).toMatchObject({ debitsEffaces: 1, debitsRecents: 1 });
  });

  it("ne touche rien de plus récent, même si la recherche de Stripe le renvoyait", async () => {
    const recent = await payeeIlYa(29);
    const limite = await payeeIlYa(30);
    const vieux = await payeeIlYa(30, 1);
    stripe.rechercheIgnoreLaDate = true;
    const { bilan } = await lancer();
    expect(bilan).toMatchObject({
      paiementsExamines: 3,
      paiementsEffaces: 1,
      paiementsRecents: 2,
      debitsExamines: 3,
      debitsEffaces: 1,
      debitsRecents: 2,
    });
    for (const paiement of [recent, limite]) {
      expect(configurationPresente(stripe.paiements.get(paiement.id)!.metadonnees)).toBe(true);
      expect(debitsDe(paiement).every((debit) => configurationPresente(debit.metadonnees))).toBe(true);
    }
    expect(configurationPresente(stripe.paiements.get(vieux.id)!.metadonnees)).toBe(false);
    expect(stripe.modifications.map((m) => m.id)).toEqual([vieux.id]);
  });

  it("peut tourner plusieurs fois sans dégât", async () => {
    await payeeIlYa(45);
    await payeeIlYa(2);
    const premier = await lancer();
    expect(premier.bilan).toMatchObject({ paiementsEffaces: 1, debitsEffaces: 1 });
    const modifications = stripe.modifications.length + stripe.modificationsDeDebits.length;
    const etat = JSON.stringify([...stripe.paiements.values(), ...stripe.debits.values()]);

    const second = await lancer();
    expect(second.bilan).toMatchObject({ paiementsExamines: 0, debitsExamines: 0, erreurs: 0 });
    // Même quand la recherche, en retard, renvoie encore les objets déjà effacés.
    stripe.rechercheIgnoreLEtat = true;
    const troisieme = await lancer();
    expect(troisieme.bilan).toMatchObject({ paiementsEffaces: 0, paiementsDejaEffaces: 1, debitsEffaces: 0, erreurs: 0 });
    expect(stripe.modifications.length + stripe.modificationsDeDebits.length).toBe(modifications);
    expect(JSON.stringify([...stripe.paiements.values(), ...stripe.debits.values()])).toBe(etat);
  });

  it("parcourt toutes les pages de résultats", async () => {
    stripe.taillePage = 2;
    const vieux: PaiementLu[] = [];
    for (let i = 0; i < 5; i += 1) vieux.push(await payeeIlYa(31 + i));
    const { bilan } = await lancer();
    expect(bilan).toMatchObject({ paiementsExamines: 5, paiementsEffaces: 5, debitsExamines: 5, debitsEffaces: 5 });
    for (const paiement of vieux) expect(configurationPresente(stripe.paiements.get(paiement.id)!.metadonnees)).toBe(false);
  });

  it("cherche les paiements et les débits créés avant la limite des 30 jours", async () => {
    await lancer();
    const limite = Math.floor((MAINTENANT.getTime() - 30 * JOUR) / 1000);
    expect(stripe.recherchesAEffacer[0]!.avant).toBe(limite);
    expect(stripe.recherchesDeDebits[0]!.avant).toBe(limite);
  });

  it("n'écrit dans les journaux que des compteurs", async () => {
    await payeeIlYa(40);
    await payeeIlYa(3);
    await lancer();
    expect(journaux).toHaveLength(1);
    const entree = JSON.parse(journaux[0]!) as Record<string, unknown>;
    expect(entree.tache).toBe("effacement");
    const autres = Object.entries(entree).filter(([cle]) => cle !== "tache");
    expect(autres.length).toBeGreaterThan(0);
    expect(autres.every(([, valeur]) => typeof valeur === "number")).toBe(true);
    expect(marquesDans(journaux.join("\n"))).toEqual([]);
  });

  it("peut être appelée par n'importe qui : sans clé, elle ne fait rien", async () => {
    injection.deps = dependances(null, { env: environnement({ cleStripe: undefined }) });
    const { statut, bilan } = await lancer();
    expect(statut).toBe(200);
    expect(bilan).toMatchObject({ paiementsEffaces: 0, debitsEffaces: 0, sansCle: 1 });
  });

  it("ne fait rien d'autre qu'effacer : aucune session, aucune lecture de commande", async () => {
    await payeeIlYa(40);
    const sessions = stripe.sessionsCreees.length;
    await lancer();
    expect(stripe.sessionsCreees).toHaveLength(sessions);
    expect(stripe.sessionsLues).toHaveLength(0);
    expect(stripe.recherchesParReference).toHaveLength(0);
  });

  it("signale une panne de Stripe par une erreur, sans rien casser", async () => {
    await payeeIlYa(40);
    stripe.enPanne = true;
    const { statut, bilan } = await lancer();
    expect(statut).toBe(500);
    expect(bilan).toMatchObject({ paiementsEffaces: 0, erreurs: 1 });
  });

  it("est déclarée comme tâche quotidienne dans vercel.json, compatible avec l'offre Hobby", () => {
    const config = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    expect(config.crons).toEqual([{ path: "/api/effacement", schedule: expect.stringMatching(/^\d{1,2} \d{1,2} \* \* \*$/) }]);
  });
});
