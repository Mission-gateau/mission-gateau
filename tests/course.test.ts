import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Premier téléchargement et rétractation en même temps (src/vente/course.ts).
 *
 * Les deux routes — celle du kit et la fonction de rétractation — tournent
 * ensemble sur la même commande, avec un faux Stripe dont la mise à jour rend
 * le paiement à jour. Un ordonnanceur retient chaque appel à Stripe et choisit
 * quelle route passe la première ; le test explore ainsi, un par un, tous les
 * ordres possibles des lectures et des écritures des deux routes. Pour chacun :
 * jamais le PDF et le remboursement ensemble ; sans panne de Stripe, jamais ni
 * l'un ni l'autre.
 */

// Le rendu du PDF n'a rien à voir avec l'ordre des appels à Stripe : un faux PDF suffit, et va vite.
vi.mock("@/vente/livraison", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/vente/livraison")>();
  return {
    ...original,
    produireKitLivre: async () => ({ pdf: Buffer.from("%PDF-1.7 kit"), nomFichier: "mission-gateau-pirates-escape.pdf" }),
  };
});

import { etatDuPaiement } from "@/vente/commande";
import { autreMarque, issueDeLEcriture, marqueGagnante } from "@/vente/course";
import type { Dependances } from "@/vente/dependances";
import { CLES, lireSuivi } from "@/vente/metadonnees";
import { creerCommande, livrerKit, renoncer } from "@/vente/serveur";
import type { ClientStripe } from "@/vente/stripe";
import { tacheQuotidienne } from "@/vente/tache";
import { FauxEmail } from "./fauxEmail";
import { CLE_REELLE, FauxStripe, corpsDeCommande, dependances, environnement, requeteJson } from "./fauxStripe";

type Route = "kit" | "retractation";

const PRODUCTION = environnement({ vercelEnv: "production", cleStripe: CLE_REELLE });
const PAYEE_LE = new Date("2026-09-24T10:00:00.000Z");
/** La déclaration arrive à 10 h 30 (Paris), le premier téléchargement est écrit une seconde plus tard ou plus tôt. */
const RECUE_LE = new Date("2026-09-26T08:30:00.000Z");

/**
 * Retient les appels à Stripe des deux routes et décide qui passe. Il ne
 * décide que lorsque chaque route encore en cours attend à sa porte : les
 * choix successifs forment l'ordre des appels, et un préfixe de choix permet
 * de rejouer un ordre puis d'en explorer les variantes.
 */
class Ordonnanceur {
  readonly choix: { options: Route[]; pris: Route }[] = [];
  private readonly attente = new Map<Route, () => void>();
  private readonly actives: Set<Route>;

  constructor(
    private readonly prefixe: Route[],
    routes: Route[],
  ) {
    this.actives = new Set(routes);
  }

  porte(route: Route): Promise<void> {
    return new Promise((liberer) => {
      this.attente.set(route, liberer);
      this.decider();
    });
  }

  terminer(route: Route): void {
    this.actives.delete(route);
    this.decider();
  }

  private decider(): void {
    if (this.actives.size === 0) return;
    for (const route of this.actives) if (!this.attente.has(route)) return;
    const options = [...this.actives].sort();
    const rang = this.choix.length;
    const pris = rang < this.prefixe.length ? this.prefixe[rang]! : options[0]!;
    if (!options.includes(pris)) throw new Error(`ordre impossible au rang ${rang}`);
    this.choix.push({ options, pris });
    const liberer = this.attente.get(pris)!;
    this.attente.delete(pris);
    liberer();
  }
}

/** Le faux Stripe vu par une route : chaque appel attend son tour à la porte de l'ordonnanceur. */
function facade(stripe: FauxStripe, route: Route, ordonnanceur: Ordonnanceur): ClientStripe {
  return new Proxy(stripe, {
    get(cible, nom, recepteur) {
      const valeur = Reflect.get(cible, nom, recepteur) as unknown;
      if (typeof valeur !== "function" || typeof nom !== "string") return valeur;
      return async (...args: unknown[]) => {
        await ordonnanceur.porte(route);
        return (valeur as (...a: unknown[]) => unknown).apply(cible, args);
      };
    },
  }) as unknown as ClientStripe;
}

interface Scenario {
  nom: string;
  /** Heure à laquelle la route du kit écrit le premier téléchargement. */
  telechargementLe: Date;
  /** Pannes de Stripe à simuler. */
  panne?: (stripe: FauxStripe) => void;
  sansPanne: boolean;
}

interface Issue {
  ordre: Route[];
  pdf: boolean;
  statutKit: number;
  rembourse: boolean;
  demandesDeRemboursement: number;
  accuse: string;
  metadonnees: Record<string, string>;
  etatFinal: string;
  apresLaTache: { rembourse: boolean; pdf: boolean };
}

let journaux: string[];

beforeEach(() => {
  journaux = [];
  vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    journaux.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function jouer(prefixe: Route[], scenario: Scenario): Promise<{ choix: Ordonnanceur["choix"]; issue: Issue }> {
  const stripe = new FauxStripe();
  const emails = new FauxEmail();
  const base = (client: ClientStripe | null, maintenant: Date): Dependances =>
    dependances(client, { email: emails, env: PRODUCTION, maintenant: () => maintenant });

  // Une commande payée et confirmée, prête à être téléchargée ou rétractée.
  expect((await creerCommande(requeteJson("http://localhost/api/commande", corpsDeCommande()), base(stripe, PAYEE_LE))).status).toBe(200);
  const { reference, paiement } = stripe.payer({ payeLe: PAYEE_LE });
  stripe.paiements.get(paiement.id)!.metadonnees[CLES.confirmation] = "2026-09-24T10:00:05.000Z";
  scenario.panne?.(stripe);

  const ordonnanceur = new Ordonnanceur(prefixe, ["kit", "retractation"]);
  const kit = livrerKit(
    requeteJson(`http://localhost/api/commande/${reference}/kit`, {}),
    reference,
    base(facade(stripe, "kit", ordonnanceur), scenario.telechargementLe),
  ).finally(() => ordonnanceur.terminer("kit"));
  const retractation = renoncer(
    requeteJson("http://localhost/api/renoncer", { nom: "Martin", prenom: "Camille", reference, email: "delivered@resend.dev" }),
    base(facade(stripe, "retractation", ordonnanceur), RECUE_LE),
  ).finally(() => ordonnanceur.terminer("retractation"));
  const [reponseKit, reponseRetractation] = await Promise.all([kit, retractation]);

  const octets = Buffer.from(await reponseKit.arrayBuffer());
  const pdf = reponseKit.status === 200 && octets.subarray(0, 5).toString() === "%PDF-";
  const corps = (await reponseRetractation.json()) as { accuse?: { blocs: { type: string; lignes?: { libelle: string; valeur: string }[] }[] } };
  const statut = corps.accuse?.blocs
    .flatMap((bloc) => bloc.lignes ?? [])
    .find((ligne) => ligne.libelle === "Statut")?.valeur;
  const metadonnees = { ...stripe.paiements.get(paiement.id)!.metadonnees };
  const rembourse = stripe.remboursements.length > 0;
  const etatFinal = etatDuPaiement(stripe.paiements.get(paiement.id)!, reference, CLE_REELLE, RECUE_LE).etat;

  // La tâche quotidienne passe ensuite : elle suit la même règle.
  stripe.remboursementEnPanne = false;
  stripe.clesEnPanne.clear();
  await tacheQuotidienne(dependances(stripe, { email: emails, env: PRODUCTION, maintenant: () => new Date("2026-09-27T03:00:00.000Z") }));
  const apresKit = await livrerKit(
    requeteJson(`http://localhost/api/commande/${reference}/kit`, {}),
    reference,
    base(stripe, new Date("2026-09-27T03:00:00.000Z")),
  );

  return {
    choix: ordonnanceur.choix,
    issue: {
      ordre: ordonnanceur.choix.map((choix) => choix.pris),
      pdf,
      statutKit: reponseKit.status,
      rembourse,
      demandesDeRemboursement: stripe.demandesDeRemboursement.length,
      accuse: statut ?? `(aucun accusé : ${JSON.stringify(corps).slice(0, 80)})`,
      metadonnees,
      etatFinal,
      apresLaTache: {
        rembourse: stripe.remboursements.length > 0,
        pdf: apresKit.status === 200,
      },
    },
  };
}

/** Tous les ordres possibles, par exploration en profondeur des choix de l'ordonnanceur. */
async function explorer(scenario: Scenario): Promise<Issue[]> {
  const issues: Issue[] = [];
  const pile: Route[][] = [[]];
  while (pile.length > 0) {
    const prefixe = pile.pop()!;
    const { choix, issue } = await jouer(prefixe, scenario);
    for (let rang = prefixe.length; rang < choix.length; rang += 1) {
      for (const autre of choix[rang]!.options) {
        if (autre !== choix[rang]!.pris) pile.push([...choix.slice(0, rang).map((c) => c.pris), autre]);
      }
    }
    issues.push(issue);
  }
  return issues;
}

function decrire(issue: Issue): string {
  return `${issue.ordre.join(" → ")} : PDF ${issue.pdf}, remboursé ${issue.rembourse}, accusé « ${issue.accuse} », course ${issue.metadonnees.course ?? "—"}`;
}

const SCENARIOS: Scenario[] = [
  { nom: "déclaration reçue avant le début du téléchargement", telechargementLe: new Date(RECUE_LE.getTime() + 1000), sansPanne: true },
  { nom: "déclaration reçue après le début du téléchargement", telechargementLe: new Date(RECUE_LE.getTime() - 1000), sansPanne: true },
  {
    nom: "l'écriture de la course échoue",
    telechargementLe: new Date(RECUE_LE.getTime() + 1000),
    panne: (stripe) => stripe.clesEnPanne.add(CLES.course),
    sansPanne: false,
  },
  {
    nom: "le remboursement échoue",
    telechargementLe: new Date(RECUE_LE.getTime() - 1000),
    panne: (stripe) => (stripe.remboursementEnPanne = true),
    sansPanne: false,
  },
];

describe("premier téléchargement et rétractation en même temps", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.nom} : dans tous les ordres possibles, jamais le PDF et le remboursement ensemble`, async () => {
      const issues = await explorer(scenario);
      const gagnes = issues.filter((issue) => issue.pdf).length;
      process.stdout.write(
        `\n  Course « ${scenario.nom} » : ${issues.length} ordres explorés, PDF livré dans ${gagnes}, remboursement dans ${issues.filter((issue) => issue.rembourse).length}\n`,
      );
      // Assez d'ordres pour couvrir chaque façon de se croiser, et tous distincts.
      expect(issues.length).toBeGreaterThanOrEqual(10);
      expect(new Set(issues.map((issue) => issue.ordre.join(","))).size).toBe(issues.length);

      for (const issue of issues) {
        const ici = decrire(issue);
        expect(issue.pdf && issue.rembourse, ici).toBe(false);
        expect(issue.apresLaTache.pdf && issue.apresLaTache.rembourse, ici).toBe(false);
        expect(issue.pdf && issue.apresLaTache.rembourse, ici).toBe(false);
        expect(issue.demandesDeRemboursement > 0 && issue.pdf, ici).toBe(false);

        const deuxMarques = Boolean(issue.metadonnees.telechargement && issue.metadonnees.retractation);
        if (scenario.sansPanne) {
          // Sans panne de Stripe : l'un ou l'autre, jamais aucun des deux.
          expect(issue.pdf || issue.rembourse, ici).toBe(true);
          if (deuxMarques) expect(issue.metadonnees.course, ici).toBe(issue.pdf ? "telechargement" : "retractation");
          // La page, la tâche et la route du kit suivent ensuite la même marque.
          expect(issue.etatFinal, ici).toBe(issue.pdf ? "payee" : "retractee");
          expect(issue.apresLaTache.pdf, ici).toBe(issue.pdf);
        }
        if (issue.pdf) {
          // La rétractation a perdu : pas de remboursement, et un accusé qui le dit.
          const attendu =
            issue.metadonnees.retractation && new Date(issue.metadonnees.retractation) < new Date(issue.metadonnees.telechargement!)
              ? /arrivée en même temps que le premier téléchargement|traitée à la main/
              : /droit de rétractation éteint au premier téléchargement|traitée à la main/;
          expect(issue.accuse, ici).toMatch(attendu);
          expect(issue.statutKit, ici).toBe(200);
        } else if (issue.rembourse || issue.metadonnees.course === "retractation") {
          expect(issue.accuse, ici).toMatch(/^rétractation enregistrée/);
          expect(issue.statutKit, ici).toBe(410);
        }
        if (deuxMarques && !issue.metadonnees.course) {
          // La course n'a pas pu être écrite : « à examiner », ni livraison ni remboursement automatiques ensuite.
          expect(issue.etatFinal, ici).toBe("a_examiner");
          expect(issue.apresLaTache.pdf, ici).toBe(false);
          expect(issue.apresLaTache.rembourse, ici).toBe(issue.rembourse);
        }
      }

      // Les deux issues se produisent : chaque route gagne dans certains ordres.
      expect(issues.some((issue) => issue.pdf)).toBe(true);
      expect(issues.some((issue) => !issue.pdf)).toBe(true);
    });
  }

  it("la déclaration reçue avant le début du téléchargement qui l'emporte est dite « arrivée en même temps », le vendeur répondant sous 7 jours", async () => {
    const issues = await explorer(SCENARIOS[0]!);
    const battues = issues.filter((issue) => issue.pdf && issue.metadonnees.retractation);
    expect(battues.length).toBeGreaterThan(0);
    for (const issue of battues) {
      expect(issue.accuse, decrire(issue)).toBe(
        "déclaration arrivée en même temps que le premier téléchargement, examinée par le vendeur",
      );
    }
  });
});

describe("la règle, écrite une fois", () => {
  it("l'emporte la première marque écrite ; la course tranche quand les deux existent ; sans elle, à examiner", () => {
    expect(marqueGagnante({})).toBeNull();
    expect(marqueGagnante({ telechargement: "2026-09-26T08:30:00.000Z" })).toBe("telechargement");
    expect(marqueGagnante({ retractation: "2026-09-26T08:30:00.000Z" })).toBe("retractation");
    const deux = { telechargement: "2026-09-26T08:30:01.000Z", retractation: "2026-09-26T08:30:00.000Z" };
    expect(marqueGagnante(deux)).toBe("a_examiner");
    expect(marqueGagnante({ ...deux, course: "telechargement" })).toBe("telechargement");
    expect(marqueGagnante({ ...deux, course: "retractation" })).toBe("retractation");
    expect(marqueGagnante({ ...deux, course: "n'importe quoi" })).toBe("a_examiner");
    // Une marque illisible compte comme absente.
    expect(marqueGagnante({ telechargement: "pas une date", retractation: "2026-09-26" })).toBe("retractation");
  });

  it("chaque route décide sur le paiement renvoyé par sa propre écriture, pas sur les heures", () => {
    const apres = { telechargement: "2026-09-26T08:30:05.000Z", retractation: "2026-09-26T08:30:00.000Z" };
    // Même avec une heure plus tardive, la marque trouvée dans la réponse l'emporte : elle était écrite avant.
    expect(issueDeLEcriture("retractation", apres)).toBe("perd");
    expect(issueDeLEcriture("telechargement", apres)).toBe("perd");
    expect(issueDeLEcriture("retractation", { retractation: "2026-09-26T08:30:00.000Z" })).toBe("gagne");
    expect(issueDeLEcriture("telechargement", { telechargement: "2026-09-26T08:30:00.000Z" })).toBe("gagne");
    expect(autreMarque("telechargement")).toBe("retractation");
    expect(lireSuivi({ course: "retractation" }).course).toBe("retractation");
  });
});
