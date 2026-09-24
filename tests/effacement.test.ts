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
import {
  CLE_TEST,
  FauxStripe,
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

/** Une commande payée il y a `jours` jours (plus une marge en secondes). */
async function payeeIlYa(jours: number, secondes = 0): Promise<PaiementLu> {
  const reponse = await commanderRoute(requeteJson("http://localhost/api/commande", corpsDeCommande()));
  expect(reponse.status).toBe(200);
  return stripe.payer({ payeLe: new Date(MAINTENANT.getTime() - jours * JOUR - secondes * 1000) }).paiement;
}

async function lancer(): Promise<{ statut: number; bilan: Record<string, number | string> }> {
  const reponse = await effacer();
  return { statut: reponse.status, bilan: (await reponse.json()) as Record<string, number | string> };
}

describe("effacement à 30 jours", () => {
  it("efface la configuration chiffrée des paiements de plus de 30 jours, et elle seule", async () => {
    const vieux = await payeeIlYa(31);
    const avant = structuredClone(stripe.paiements.get(vieux.id)!.metadonnees);
    const { statut, bilan } = await lancer();
    expect(statut).toBe(200);
    expect(bilan).toMatchObject({ tache: "effacement", examines: 1, effaces: 1, erreurs: 0 });

    const apres = stripe.paiements.get(vieux.id)!.metadonnees;
    expect(configurationPresente(apres)).toBe(false);
    expect(apres[CLES.etatConfiguration]).toBe("effacee");
    // La commande reste : référence, graine, version, pays, CGV et heure des accords.
    expect(lireCommande(apres)).toEqual(lireCommande(avant));
    expect(Object.keys(apres).filter((cle) => cle.startsWith("config_"))).toEqual([]);
    // Stripe reçoit une valeur vide pour chaque morceau : c'est ainsi qu'on y supprime une clé.
    const envoye = stripe.modifications[0]!.metadonnees;
    expect(Object.entries(envoye).filter(([cle]) => cle !== CLES.etatConfiguration).every(([, v]) => v === "")).toBe(true);
    // Et la commande n'est plus livrable : elle est expirée.
  });

  it("ne touche rien de plus récent, même si la recherche de Stripe le renvoyait", async () => {
    const recent = await payeeIlYa(29);
    const limite = await payeeIlYa(30);
    const vieux = await payeeIlYa(30, 1);
    stripe.rechercheIgnoreLaDate = true;
    const { bilan } = await lancer();
    expect(bilan).toMatchObject({ examines: 3, effaces: 1, recents: 2 });
    expect(configurationPresente(stripe.paiements.get(recent.id)!.metadonnees)).toBe(true);
    expect(configurationPresente(stripe.paiements.get(limite.id)!.metadonnees)).toBe(true);
    expect(configurationPresente(stripe.paiements.get(vieux.id)!.metadonnees)).toBe(false);
    expect(stripe.modifications.map((m) => m.id)).toEqual([vieux.id]);
  });

  it("peut tourner plusieurs fois sans dégât", async () => {
    await payeeIlYa(45);
    await payeeIlYa(2);
    const premier = await lancer();
    expect(premier.bilan).toMatchObject({ effaces: 1 });
    const modifications = stripe.modifications.length;
    const etat = JSON.stringify([...stripe.paiements.values()]);

    const second = await lancer();
    expect(second.bilan).toMatchObject({ examines: 0, effaces: 0, erreurs: 0 });
    // Même quand la recherche, en retard, renvoie encore le paiement déjà effacé.
    stripe.rechercheIgnoreLEtat = true;
    const troisieme = await lancer();
    expect(troisieme.bilan).toMatchObject({ effaces: 0, dejaEffaces: 1, erreurs: 0 });
    expect(stripe.modifications).toHaveLength(modifications);
    expect(JSON.stringify([...stripe.paiements.values()])).toBe(etat);
  });

  it("parcourt toutes les pages de résultats", async () => {
    stripe.taillePage = 2;
    const vieux = [];
    for (let i = 0; i < 5; i += 1) vieux.push(await payeeIlYa(31 + i));
    const { bilan } = await lancer();
    expect(bilan).toMatchObject({ examines: 5, effaces: 5 });
    for (const paiement of vieux) expect(configurationPresente(stripe.paiements.get(paiement.id)!.metadonnees)).toBe(false);
  });

  it("cherche les paiements créés avant la limite des 30 jours", async () => {
    await lancer();
    expect(stripe.recherchesAEffacer[0]!.avant).toBe(Math.floor((MAINTENANT.getTime() - 30 * JOUR) / 1000));
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
    expect(bilan).toMatchObject({ effaces: 0, sansCle: 1 });
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
    expect(bilan).toMatchObject({ effaces: 0, erreurs: 1 });
  });

  it("est déclarée comme tâche quotidienne dans vercel.json, compatible avec l'offre Hobby", () => {
    const config = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    expect(config.crons).toEqual([{ path: "/api/effacement", schedule: expect.stringMatching(/^\d{1,2} \d{1,2} \* \* \*$/) }]);
  });

  it("utilise la clé de l'environnement : la configuration d'une autre clé reste intacte mais n'est jamais lue", async () => {
    const vieux = await payeeIlYa(40);
    injection.deps = dependances(stripe, { env: environnement({ cleStripe: CLE_TEST }), maintenant: () => MAINTENANT });
    await lancer();
    expect(configurationPresente(stripe.paiements.get(vieux.id)!.metadonnees)).toBe(false);
  });
});
