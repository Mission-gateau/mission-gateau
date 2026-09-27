import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dependances } from "@/vente/dependances";

/**
 * La tâche quotidienne, pour sa part d'effacement : elle efface la
 * configuration chiffrée des paiements de plus de 30 jours. Appelée par sa
 * vraie route, avec le secret que Vercel envoie. Les confirmations et les
 * remboursements de la même tâche sont éprouvés dans tests/tache.test.ts.
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
import {
  CLE_TEST,
  FauxStripe,
  SECRET_TACHE,
  corpsDeCommande,
  dependances,
  environnement,
  marquesDans,
  requeteJson,
} from "./fauxStripe";

const MAINTENANT = new Date("2026-09-24T03:00:00.000Z");
const JOUR = 24 * 60 * 60 * 1000;

let stripe: FauxStripe;
let journaux: string[];

beforeEach(() => {
  stripe = new FauxStripe();
  injection.deps = dependances(stripe, { env: environnement({ secretTache: SECRET_TACHE }), maintenant: () => MAINTENANT });
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

/**
 * Lance la tâche comme Vercel : GET avec le secret. Ses compteurs ne sont
 * plus dans la réponse, seulement dans le journal, une ligne par phase : on
 * relit ici celle de l'effacement (ou celle qui dit qu'il n'y a pas de clé).
 */
async function lancer(): Promise<{ statut: number; corps: unknown; bilan: Record<string, number | string> }> {
  const avant = journaux.length;
  const reponse = await effacer(
    new Request("http://localhost/api/effacement", { headers: { Authorization: `Bearer ${SECRET_TACHE}` } }),
  );
  const entrees = journaux.slice(avant).map((ligne) => JSON.parse(ligne) as Record<string, number | string>);
  const bilan =
    entrees.find((entree) => entree.tache === "quotidienne" && (entree.phase === "effacement" || entree.sansCle === 1)) ?? {};
  return { statut: reponse.status, corps: await reponse.json(), bilan };
}

function debitsDe(paiement: PaiementLu) {
  return [...stripe.debits.values()].filter((debit) => debit.id.startsWith(paiement.id.replace("pi_", "ch_")));
}

describe("effacement à 30 jours", () => {
  it("efface la configuration chiffrée du paiement et de son débit, et elle seule", async () => {
    const vieux = await payeeIlYa(31);
    const avant = structuredClone(stripe.paiements.get(vieux.id)!.metadonnees);
    expect(debitsDe(vieux).every((debit) => configurationPresente(debit.metadonnees))).toBe(true);

    const { statut, corps, bilan } = await lancer();
    expect(statut).toBe(200);
    expect(corps).toEqual({ ok: true });
    expect(bilan).toMatchObject({ tache: "quotidienne", paiementsEffaces: 1, debitsEffaces: 1, erreurs: 0 });

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

  it("n'écrit dans les journaux que des compteurs, et ne les rend plus publics", async () => {
    await payeeIlYa(40);
    await payeeIlYa(3);
    journaux.length = 0;
    const { corps } = await lancer();
    expect(corps).toEqual({ ok: true });
    const lignes = journaux.map((ligne) => JSON.parse(ligne) as Record<string, unknown>);
    // Une ligne par phase, dans l'ordre, faite de compteurs.
    const phases = lignes.filter((ligne) => ligne.tache === "quotidienne");
    expect(phases.map((ligne) => ligne.phase)).toEqual(["effacement", "confirmations", "remboursements"]);
    for (const entree of phases) {
      const autres = Object.entries(entree).filter(([cle]) => cle !== "tache" && cle !== "phase");
      expect(autres.length).toBeGreaterThan(0);
      expect(autres.every(([, valeur]) => typeof valeur === "number")).toBe(true);
    }
    expect(marquesDans(journaux.join("\n"))).toEqual([]);
  });

  it("sans le secret, ou sans CRON_SECRET, répond 401 et ne fait rien d'autre", async () => {
    await payeeIlYa(40);
    const modifications = stripe.modifications.length;
    journaux.length = 0;
    const essais: [Request, string | undefined][] = [
      [new Request("http://localhost/api/effacement"), SECRET_TACHE],
      [new Request("http://localhost/api/effacement", { headers: { Authorization: "Bearer mauvais" } }), SECRET_TACHE],
      [new Request("http://localhost/api/effacement", { headers: { Authorization: SECRET_TACHE } }), SECRET_TACHE],
      [new Request("http://localhost/api/effacement", { headers: { Authorization: `Bearer ${SECRET_TACHE}x` } }), SECRET_TACHE],
      [new Request("http://localhost/api/effacement", { headers: { Authorization: "Bearer " } }), undefined],
      [new Request("http://localhost/api/effacement", { headers: { Authorization: `Bearer ${SECRET_TACHE}` } }), undefined],
    ];
    for (const [requete, secret] of essais) {
      injection.deps = dependances(stripe, { env: environnement({ secretTache: secret }), maintenant: () => MAINTENANT });
      const reponse = await effacer(requete);
      expect(reponse.status).toBe(401);
      expect(await reponse.text()).toBe("");
    }
    expect(stripe.recherchesAEffacer).toHaveLength(0);
    expect(stripe.recherchesAbouties).toHaveLength(0);
    expect(stripe.modifications).toHaveLength(modifications);
    expect(journaux).toHaveLength(0);
  });

  it("autorisée mais sans clé Stripe, elle ne fait rien, et le dit dans le journal", async () => {
    injection.deps = dependances(null, { env: environnement({ cleStripe: undefined, secretTache: SECRET_TACHE }) });
    journaux.length = 0;
    const { statut, bilan } = await lancer();
    expect(statut).toBe(200);
    expect(bilan).toEqual({ tache: "quotidienne", sansCle: 1 });
    expect(journaux).toHaveLength(1);
  });

  it("en production avec une clé de test, les vraies dépendances ne créent aucun client : la tâche ne touche à rien", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("STRIPE_SECRET_KEY", CLE_TEST);
    vi.stubEnv("CRON_SECRET", SECRET_TACHE);
    try {
      injection.deps = null;
      journaux.length = 0;
      const { statut, bilan } = await lancer();
      expect(statut).toBe(200);
      expect(bilan).toEqual({ tache: "quotidienne", sansCle: 1 });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("n'efface que la configuration : aucune session créée, aucune commande cherchée par sa référence", async () => {
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
    const { statut, corps, bilan } = await lancer();
    expect(statut).toBe(500);
    expect(corps).toEqual({ ok: false });
    expect(bilan).toMatchObject({ paiementsEffaces: 0 });
    expect(Number(bilan.erreurs)).toBeGreaterThan(0);
  });

  it("une panne en cours de route ne fait pas perdre les compteurs déjà faits", async () => {
    await payeeIlYa(40);
    await payeeIlYa(41);
    // Les paiements s'effacent ; la recherche des débits tombe en panne ensuite.
    stripe.debitsAvecConfiguration = async () => {
      throw Object.assign(new Error("panne simulée"), { type: "StripeConnectionError" });
    };
    const { statut, bilan } = await lancer();
    expect(statut).toBe(500);
    expect(bilan).toMatchObject({ paiementsExamines: 2, paiementsEffaces: 2, debitsEffaces: 0, erreurs: 1 });
  });

  it("passe deux fois par jour, vers 3 h et 15 h UTC, chaque tâche une fois par jour comme l'exige l'offre Hobby", () => {
    const config = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    expect(config.crons).toEqual([
      { path: "/api/effacement", schedule: "0 3 * * *" },
      { path: "/api/effacement", schedule: "0 15 * * *" },
    ]);
    // Chaque expression ne se déclenche qu'une fois par jour : minute et heure fixes.
    for (const { schedule } of config.crons) expect(schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
  });
});
