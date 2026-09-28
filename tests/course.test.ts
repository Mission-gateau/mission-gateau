import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Premier téléchargement et rétractation en même temps (src/vente/course.ts).
 *
 * Les routes — celle du kit et la fonction de rétractation, deux ou trois
 * requêtes à la fois — tournent ensemble sur la même commande, avec un faux
 * Stripe qui suit les règles de Stripe : la mise à jour rend le paiement à
 * jour, et une clé d'idempotence n'est exécutée qu'une fois. Un ordonnanceur
 * retient chaque appel à Stripe et choisit quelle requête passe la première ;
 * le test explore ainsi, un par un, tous les ordres possibles des lectures et
 * des écritures. Pour chacun : jamais le PDF et le remboursement ensemble ;
 * sans panne de Stripe, jamais ni l'un ni l'autre ; jamais un accusé annoncé
 * sans être parti.
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
import {
  ClesDeMarqueEpuisees,
  ESSAIS_DE_MARQUE,
  RelectureDeLaMarqueImpossible,
  autreMarque,
  cleDeMarque,
  ecrireLaMarque,
  issueDeLEcriture,
  marqueGagnante,
} from "@/vente/course";
import { courrielEnTexte, type DocumentCourriel } from "@/vente/courriels";
import type { Dependances } from "@/vente/dependances";
import type { ClientEmail } from "@/vente/envoi";
import { CLES, lireSuivi } from "@/vente/metadonnees";
import { cleDAccuse, cleDAccuseNumero, empreinteDeDeclaration } from "@/vente/retractation";
import { creerCommande, livrerKit, renoncer } from "@/vente/serveur";
import type { ClientStripe, PaiementLu } from "@/vente/stripe";
import { tacheQuotidienne } from "@/vente/tache";
import { FauxEmail } from "./fauxEmail";
import { CLE_REELLE, FauxStripe, corpsDeCommande, dependances, environnement, requeteJson, type PanneStripe } from "./fauxStripe";

const PRODUCTION = environnement({ vercelEnv: "production", cleStripe: CLE_REELLE });
const PAYEE_LE = new Date("2026-09-24T10:00:00.000Z");
/** La déclaration arrive à 10 h 30 (Paris), le premier téléchargement est écrit une seconde plus tard ou plus tôt. */
const RECUE_LE = new Date("2026-09-26T08:30:00.000Z");
const APRES = new Date(RECUE_LE.getTime() + 1000);
const AVANT = new Date(RECUE_LE.getTime() - 1000);
const LENDEMAIN = new Date("2026-09-27T03:00:00.000Z");
const EMAIL = "delivered@resend.dev";

const CAMILLE = { nom: "Martin", prenom: "Camille" };
const DOMINIQUE = { nom: "Martin", prenom: "Dominique" };

/**
 * Retient les appels à Stripe des requêtes et décide qui passe. Il ne décide
 * que lorsque chaque requête encore en cours attend à sa porte : les choix
 * successifs forment l'ordre des appels, et un préfixe de choix permet de
 * rejouer un ordre puis d'en explorer les variantes.
 */
class Ordonnanceur {
  readonly choix: { options: string[]; pris: string }[] = [];
  private readonly attente = new Map<string, () => void>();
  private readonly actives: Set<string>;

  constructor(
    private readonly prefixe: string[],
    routes: string[],
  ) {
    this.actives = new Set(routes);
  }

  porte(route: string): Promise<void> {
    return new Promise((liberer) => {
      this.attente.set(route, liberer);
      this.decider();
    });
  }

  terminer(route: string): void {
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

/** Les appels qui attendent leur tour à la porte de l'ordonnanceur ; les autres passent aussitôt. */
type Filtre = (methode: string, args: unknown[]) => boolean;

/** Tout ce qui lit ou écrit la commande chez Stripe, et les remboursements (la session de l'acheteur ne sert qu'à son adresse). */
const TOUT: Filtre = (methode) => methode !== "sessionDuPaiement";

/**
 * Avec trois requêtes, les seuls appels qui décident : lectures, écritures
 * des marques et de la course, remboursements. L'identifiant de l'accusé et
 * le compteur d'accusés s'écrivent sans attendre (leur ordre est éprouvé à
 * part, avec deux requêtes).
 */
const DECISIFS: Filtre = (methode, args) => {
  if (methode === "sessionDuPaiement") return false;
  if (methode !== "modifierMetadonnees") return true;
  const cles = Object.keys(args[1] as Record<string, string>);
  return cles.some((cle) => cle === CLES.telechargement || cle === CLES.retractation || cle === CLES.course);
};

/**
 * Sous panne : tout ce qui peut décider attend son tour ; seules la lecture de
 * la session de l'acheteur (sa copie cachée) et l'écriture de l'identifiant
 * de l'accusé passent aussitôt. Toutes, retenues ou non, peuvent recevoir la
 * panne injectée.
 */
const SOUS_PANNE: Filtre = (methode, args) =>
  methode !== "sessionDuPaiement" &&
  !(methode === "modifierMetadonnees" && CLES.accuseRetractation in (args[1] as Record<string, string>));

/**
 * Une panne injectée dans le `rang`-ième appel retenu d'une requête (appels à
 * Stripe et à Resend comptés ensemble) : une panne de Stripe si cet appel va
 * chez Stripe, un échec d'envoi s'il va chez Resend.
 */
interface Injection {
  route: string;
  rang: number;
  genre: PanneStripe | "resend";
  faite: boolean;
}

/** Les appels retenus de chaque requête, Stripe et Resend ensemble, dans l'ordre : chez qui chacun est allé. */
type Comptes = Map<string, ("stripe" | "resend")[]>;

function prendreUnRang(comptes: Comptes, route: string, chez: "stripe" | "resend"): number {
  const appels = comptes.get(route) ?? [];
  comptes.set(route, [...appels, chez]);
  return appels.length;
}

/** Le faux Stripe vu par une requête : chaque appel retenu attend son tour à la porte de l'ordonnanceur. */
function facade(
  stripe: FauxStripe,
  route: string,
  ordonnanceur: Ordonnanceur,
  filtre: Filtre,
  comptes: Comptes = new Map(),
  injection: Injection | null = null,
): ClientStripe {
  return new Proxy(stripe, {
    get(cible, nom, recepteur) {
      const valeur = Reflect.get(cible, nom, recepteur) as unknown;
      if (typeof valeur !== "function" || typeof nom !== "string") return valeur;
      return async (...args: unknown[]) => {
        if (filtre(nom, args)) await ordonnanceur.porte(route);
        const rang = prendreUnRang(comptes, route, "stripe");
        if (injection && injection.route === route && injection.rang === rang && injection.genre !== "resend") {
          // L'appel qui suit, tout de suite, est celui-ci.
          stripe.panneAuProchainAppel = injection.genre;
          injection.faite = true;
        }
        return (valeur as (...a: unknown[]) => unknown).apply(cible, args);
      };
    },
  }) as unknown as ClientStripe;
}

/** Le faux Resend vu par une requête : chaque envoi attend lui aussi son tour. */
function facadeEmail(
  emails: FauxEmail,
  route: string,
  ordonnanceur: Ordonnanceur,
  comptes: Comptes,
  injection: Injection | null,
): ClientEmail {
  return {
    async envoyer(message, cle) {
      await ordonnanceur.porte(route);
      const rang = prendreUnRang(comptes, route, "resend");
      if (injection && injection.route === route && injection.rang === rang && injection.genre === "resend") {
        emails.panneAuProchainEnvoi = true;
        injection.faite = true;
      }
      return emails.envoyer(message, cle);
    },
  };
}

interface Acteur {
  /** Son nom pour l'ordonnanceur. */
  nom: string;
  genre: "kit" | "retractation";
  /** L'heure de la requête : celle du premier téléchargement qu'elle écrit, ou de la réception de la déclaration. */
  le: Date;
  /** Qui déclare la rétractation. */
  declarant?: { nom: string; prenom: string };
}

interface Scenario {
  nom: string;
  acteurs: Acteur[];
  /** Métadonnées de la commande avant la course : premier téléchargement déjà écrit, accusés déjà partis… */
  avant?: Record<string, string>;
  /** Pannes de Stripe à simuler. */
  panne?: (stripe: FauxStripe) => void;
  sansPanne: boolean;
  filtre?: Filtre;
  /** L'ordonnanceur retient aussi les appels à Resend. */
  resend?: boolean;
  /** Le faux Resend garde la clé d'un envoi en échec (Resend ne dit pas s'il le fait). */
  garderLesClesEnEchec?: boolean;
}

interface ReponseDeclaration {
  issue: string;
  accuse?: DocumentCourriel;
  envoi?: { etat: string };
}

interface Issue {
  ordre: string[];
  /** Un PDF est parti, vers l'une des requêtes du kit. */
  pdf: boolean;
  statutsKit: number[];
  rembourse: boolean;
  remboursements: number;
  demandesDeRemboursement: number;
  declarations: { acteur: Acteur; reponse: ReponseDeclaration; statut: string }[];
  metadonnees: Record<string, string>;
  etatFinal: string;
  /** Accusés annoncés comme partis sans qu'aucun e-mail de ce texte ne soit parti. */
  accusesAnnoncesNonPartis: number;
  /** Les valeurs successives du compteur d'accusés, dans l'ordre où Stripe les a écrites. */
  compteurs: number[];
  /** Les clés Resend des accusés partis. */
  clesDesAccuses: string[];
  reference: string;
  apresLaTache: { rembourse: boolean; pdf: boolean };
  /** Les e-mails partis de la route de rétractation (la liste des commandes à traiter mise à part). */
  emailsDeLaRoute: { cle: string; texte: string }[];
  /** Les appels retenus de chaque requête, dans l'ordre : chez Stripe ou chez Resend. */
  appels: Record<string, ("stripe" | "resend")[]>;
  /** La panne injectée l'a-t-elle bien été ? */
  panneFaite: boolean;
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

function statutDe(reponse: ReponseDeclaration): string {
  if (reponse.issue !== "accuse") return `(${reponse.issue})`;
  return reponse.accuse!.blocs.flatMap((bloc) => (bloc.type === "lignes" ? bloc.lignes : [])).find((ligne) => ligne.libelle === "Statut")!.valeur;
}

function empreinteDe(acteur: Acteur, reference: string): string {
  return empreinteDeDeclaration({ ...(acteur.declarant ?? CAMILLE), reference, email: EMAIL });
}

async function jouer(
  prefixe: string[],
  scenario: Scenario,
  injection: Omit<Injection, "faite"> | null = null,
): Promise<{ choix: Ordonnanceur["choix"]; issue: Issue }> {
  const stripe = new FauxStripe();
  const emails = new FauxEmail();
  emails.garderLesClesEnEchec = scenario.garderLesClesEnEchec ?? false;
  const panne: Injection | null = injection ? { ...injection, faite: false } : null;
  const comptes: Comptes = new Map();
  const base = (client: ClientStripe | null, maintenant: Date): Dependances =>
    dependances(client, { email: emails, env: PRODUCTION, maintenant: () => maintenant });

  // Une commande payée et confirmée, prête à être téléchargée ou rétractée.
  expect((await creerCommande(requeteJson("http://localhost/api/commande", corpsDeCommande()), base(stripe, PAYEE_LE))).status).toBe(200);
  const { reference, paiement } = stripe.payer({ payeLe: PAYEE_LE });
  Object.assign(stripe.paiements.get(paiement.id)!.metadonnees, { [CLES.confirmation]: "2026-09-24T10:00:05.000Z" }, scenario.avant);
  scenario.panne?.(stripe);

  const ordonnanceur = new Ordonnanceur(
    prefixe,
    scenario.acteurs.map((acteur) => acteur.nom),
  );
  const reponses = await Promise.all(
    scenario.acteurs.map((acteur) => {
      const deps = base(facade(stripe, acteur.nom, ordonnanceur, scenario.filtre ?? TOUT, comptes, panne), acteur.le);
      if (scenario.resend) deps.email = facadeEmail(emails, acteur.nom, ordonnanceur, comptes, panne);
      const requete =
        acteur.genre === "kit"
          ? livrerKit(requeteJson(`http://localhost/api/commande/${reference}/kit`, {}), reference, deps)
          : renoncer(requeteJson("http://localhost/api/renoncer", { ...(acteur.declarant ?? CAMILLE), reference, email: EMAIL }), deps);
      return requete.finally(() => ordonnanceur.terminer(acteur.nom));
    }),
  );

  let pdf = false;
  const statutsKit: number[] = [];
  const declarations: Issue["declarations"] = [];
  for (const [rang, acteur] of scenario.acteurs.entries()) {
    const reponse = reponses[rang]!;
    if (acteur.genre === "kit") {
      const octets = Buffer.from(await reponse.arrayBuffer());
      statutsKit.push(reponse.status);
      if (reponse.status === 200 && octets.subarray(0, 5).toString() === "%PDF-") pdf = true;
    } else {
      const corps = (await reponse.json()) as ReponseDeclaration;
      declarations.push({ acteur, reponse: corps, statut: statutDe(corps) });
    }
  }
  const textesPartis = new Set(emails.envoyes.map((envoye) => envoye.message.texte));
  const accusesAnnoncesNonPartis = declarations.filter(
    ({ reponse }) => reponse.issue === "accuse" && reponse.envoi?.etat === "envoye" && !textesPartis.has(courrielEnTexte(reponse.accuse!)),
  ).length;
  const metadonnees = { ...stripe.paiements.get(paiement.id)!.metadonnees };
  const rembourse = stripe.remboursements.length > 0;
  const etatFinal = etatDuPaiement(stripe.paiements.get(paiement.id)!, reference, CLE_REELLE, RECUE_LE).etat;
  const compteurs = stripe.modifications.filter((m) => CLES.accuses in m.metadonnees).map((m) => Number(m.metadonnees[CLES.accuses]));
  const clesDesAccuses = emails.envoyes.map((envoye) => envoye.cle).filter((cle) => cle.startsWith("accuse-"));
  const emailsDeLaRoute = emails.envoyes
    .filter((envoye) => envoye.cle.startsWith("accuse-"))
    .map((envoye) => ({ cle: envoye.cle, texte: envoye.message.texte }));

  // La tâche quotidienne passe ensuite, puis une nouvelle demande du kit : elles suivent la même règle.
  stripe.remboursementEnPanne = false;
  stripe.clesEnPanne.clear();
  await tacheQuotidienne(dependances(stripe, { email: emails, env: PRODUCTION, maintenant: () => LENDEMAIN }));
  const apresKit = await livrerKit(requeteJson(`http://localhost/api/commande/${reference}/kit`, {}), reference, base(stripe, LENDEMAIN));

  return {
    choix: ordonnanceur.choix,
    issue: {
      ordre: ordonnanceur.choix.map((choix) => choix.pris),
      pdf,
      statutsKit,
      rembourse,
      remboursements: stripe.remboursements.length,
      demandesDeRemboursement: stripe.demandesDeRemboursement.length,
      declarations,
      metadonnees,
      etatFinal,
      accusesAnnoncesNonPartis,
      compteurs,
      clesDesAccuses,
      reference,
      apresLaTache: { rembourse: stripe.remboursements.length > 0, pdf: apresKit.status === 200 },
      emailsDeLaRoute,
      appels: Object.fromEntries(comptes),
      panneFaite: panne?.faite ?? false,
    },
  };
}

/** Tous les ordres possibles, par exploration en profondeur des choix de l'ordonnanceur. */
async function explorer(scenario: Scenario, injection: Omit<Injection, "faite"> | null = null): Promise<Issue[]> {
  const issues: Issue[] = [];
  const pile: string[][] = [[]];
  while (pile.length > 0) {
    const prefixe = pile.pop()!;
    const { choix, issue } = await jouer(prefixe, scenario, injection);
    for (let rang = prefixe.length; rang < choix.length; rang += 1) {
      for (const autre of choix[rang]!.options) {
        if (autre !== choix[rang]!.pris) pile.push([...choix.slice(0, rang).map((c) => c.pris), autre]);
      }
    }
    issues.push(issue);
  }
  // Tous distincts : chaque ordre n'est joué qu'une fois.
  expect(new Set(issues.map((issue) => issue.ordre.join(","))).size).toBe(issues.length);
  return issues;
}

function decrire(issue: Issue): string {
  const declarations = issue.declarations.map((d) => `${d.acteur.nom} « ${d.statut} »`).join(", ");
  return `${issue.ordre.join(" → ")} : PDF ${issue.pdf} (${issue.statutsKit.join("/")}), remboursé ${issue.rembourse}, ${declarations}, course ${issue.metadonnees.course ?? "—"}`;
}

function bilan(scenario: Scenario, issues: Issue[]): void {
  process.stdout.write(
    `\n  Course « ${scenario.nom} » : ${issues.length} ordres explorés, PDF livré dans ${issues.filter((i) => i.pdf).length}, remboursement dans ${issues.filter((i) => i.rembourse).length}\n`,
  );
}

const kit = (le: Date, nom = "kit"): Acteur => ({ nom, genre: "kit", le });
const declaration = (le: Date, declarant = CAMILLE, nom = "rétractation"): Acteur => ({ nom, genre: "retractation", le, declarant });

/**
 * Les invariants de la course, vrais dans chaque ordre : jamais le PDF et le
 * remboursement ensemble, ni pendant la course ni après la tâche ; sans panne,
 * l'un ou l'autre ; un remboursement au plus ; chaque accusé annoncé est
 * parti ; « déjà accusée » ne répond qu'à la déclaration enregistrée.
 */
function verifierLaCourse(scenario: Scenario, issue: Issue): void {
  const ici = decrire(issue);
  expect(issue.pdf && issue.rembourse, ici).toBe(false);
  expect(issue.apresLaTache.pdf && issue.apresLaTache.rembourse, ici).toBe(false);
  expect(issue.pdf && issue.apresLaTache.rembourse, ici).toBe(false);
  expect(issue.demandesDeRemboursement > 0 && issue.pdf, ici).toBe(false);
  expect(issue.remboursements, ici).toBeLessThanOrEqual(1);
  expect(issue.accusesAnnoncesNonPartis, ici).toBe(0);
  // 409 : la commande est « à examiner », le temps que la requête qui perd écrive la course.
  for (const statut of issue.statutsKit) expect([200, 409, 410, 503], ici).toContain(statut);

  const empreinte = issue.metadonnees[CLES.empreinteRetractation];
  for (const { acteur, reponse } of issue.declarations) {
    expect(["accuse", "deja_accusee", "en_cours"], ici).toContain(reponse.issue);
    if (reponse.issue === "deja_accusee") {
      // Seule la déclaration enregistrée (ou une identique) est « déjà accusée », et son accusé est parti.
      expect(empreinteDe(acteur, issue.reference), ici).toBe(empreinte);
      expect(issue.clesDesAccuses, ici).toContain(cleDAccuse(issue.reference));
    }
  }

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
    // Le premier téléchargement l'a emporté : aucune déclaration n'a enregistré de rétractation.
    for (const { statut } of issue.declarations) {
      expect(statut, ici).toMatch(
        /droit de rétractation éteint au premier téléchargement|arrivée en même temps que le premier téléchargement|traitée à la main|^\((deja_accusee|en_cours)\)$/,
      );
    }
    // Une déclaration reçue avant le début du premier téléchargement est dite « arrivée en même temps » ; après, le droit était éteint.
    const telechargeLe = new Date(issue.metadonnees.telechargement!);
    for (const { acteur, reponse, statut } of issue.declarations) {
      if (reponse.issue !== "accuse" || /traitée à la main/.test(statut)) continue;
      expect(statut, ici).toBe(
        acteur.le < telechargeLe
          ? "déclaration arrivée en même temps que le premier téléchargement, examinée par le vendeur"
          : "droit de rétractation éteint au premier téléchargement",
      );
    }
  } else if (issue.rembourse || issue.metadonnees.course === "retractation") {
    // La rétractation l'a emporté : aucun PDF, et seule la déclaration enregistrée dit « rétractation enregistrée ».
    expect(issue.statutsKit.every((statut) => statut !== 200), ici).toBe(true);
    for (const { acteur, statut } of issue.declarations) {
      if (/^rétractation enregistrée/.test(statut)) {
        expect(empreinteDe(acteur, issue.reference), ici).toBe(empreinte);
        expect(statut, ici).toMatch(/^rétractation enregistrée — (remboursement effectué|remboursement à venir)$/);
      } else {
        expect(statut, ici).toMatch(/^rétractation déjà enregistrée|traitée à la main|^\((deja_accusee|en_cours)\)$/);
      }
    }
  }
  if (deuxMarques && !issue.metadonnees.course) {
    // La course n'a pas pu être écrite : « à examiner », ni livraison ni remboursement automatiques ensuite.
    expect(issue.etatFinal, ici).toBe("a_examiner");
    expect(issue.apresLaTache.pdf, ici).toBe(false);
    expect(issue.apresLaTache.rembourse, ici).toBe(issue.rembourse);
  }
}

const SCENARIOS: Scenario[] = [
  { nom: "déclaration reçue avant le début du téléchargement", acteurs: [kit(APRES), declaration(RECUE_LE)], sansPanne: true },
  { nom: "déclaration reçue après le début du téléchargement", acteurs: [kit(AVANT), declaration(RECUE_LE)], sansPanne: true },
  {
    nom: "l'écriture de la course échoue",
    acteurs: [kit(APRES), declaration(RECUE_LE)],
    panne: (stripe) => stripe.clesEnPanne.add(CLES.course),
    sansPanne: false,
  },
  {
    nom: "le remboursement échoue",
    acteurs: [kit(AVANT), declaration(RECUE_LE)],
    panne: (stripe) => (stripe.remboursementEnPanne = true),
    sansPanne: false,
  },
  {
    nom: "deux onglets téléchargent et une déclaration arrive",
    acteurs: [kit(APRES), kit(new Date(APRES.getTime() + 1), "kit 2"), declaration(RECUE_LE)],
    sansPanne: true,
    filtre: DECISIFS,
  },
  {
    nom: "un téléchargement et deux déclarations différentes",
    acteurs: [kit(APRES), declaration(RECUE_LE), declaration(new Date(RECUE_LE.getTime() + 1), DOMINIQUE, "rétractation 2")],
    sansPanne: true,
    filtre: DECISIFS,
  },
  {
    nom: "un téléchargement et deux déclarations différentes, remboursement en échec",
    acteurs: [kit(AVANT), declaration(RECUE_LE), declaration(new Date(RECUE_LE.getTime() + 1), DOMINIQUE, "rétractation 2")],
    panne: (stripe) => (stripe.remboursementEnPanne = true),
    sansPanne: false,
    filtre: DECISIFS,
  },
  {
    nom: "un téléchargement et la même déclaration envoyée deux fois",
    acteurs: [kit(APRES), declaration(RECUE_LE), declaration(new Date(RECUE_LE.getTime() + 1), CAMILLE, "rétractation 2")],
    sansPanne: true,
    filtre: DECISIFS,
  },
];

describe("premier téléchargement et rétractation en même temps", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.nom} : dans tous les ordres possibles, jamais le PDF et le remboursement ensemble`, async () => {
      const issues = await explorer(scenario);
      bilan(scenario, issues);
      // Assez d'ordres pour couvrir chaque façon de se croiser.
      expect(issues.length).toBeGreaterThanOrEqual(scenario.acteurs.length === 2 ? 10 : 100);
      for (const issue of issues) verifierLaCourse(scenario, issue);
      // Les deux issues se produisent : chaque côté gagne dans certains ordres.
      expect(issues.some((issue) => issue.pdf)).toBe(true);
      expect(issues.some((issue) => !issue.pdf)).toBe(true);
    });
  }

  it("la déclaration reçue avant le début du téléchargement qui l'emporte est dite « arrivée en même temps », le vendeur répondant sous 7 jours", async () => {
    const issues = await explorer(SCENARIOS[0]!);
    // Qu'elle ait écrit sa marque après le premier téléchargement, ou trouvé celui-ci déjà écrit.
    const battues = issues.filter((issue) => issue.pdf);
    expect(battues.some((issue) => issue.metadonnees.retractation)).toBe(true);
    expect(battues.some((issue) => !issue.metadonnees.retractation)).toBe(true);
    for (const issue of battues) {
      expect(issue.declarations[0]!.statut, decrire(issue)).toBe(
        "déclaration arrivée en même temps que le premier téléchargement, examinée par le vendeur",
      );
    }
  });

  it("deux onglets : le second téléchargement ne réécrit ni la marque ni la course (défaut B1 du lot 5)", async () => {
    const issues = await explorer(SCENARIOS[4]!);
    for (const issue of issues) {
      const ici = decrire(issue);
      // Quand un PDF est parti, la course ne désigne jamais la rétractation.
      if (issue.pdf) expect(issue.metadonnees.course ?? "telechargement", ici).toBe("telechargement");
      // Le premier téléchargement n'est écrit qu'une fois : par l'un des deux onglets, jamais réécrit par l'autre.
      const ecritures = issue.metadonnees.telechargement;
      expect([APRES.toISOString(), new Date(APRES.getTime() + 1).toISOString(), undefined], ici).toContain(ecritures);
    }
  });

  it("deux déclarations différentes : la seconde n'écrase ni l'heure ni l'empreinte de la première (défaut B2 du lot 5)", async () => {
    const issues = await explorer(SCENARIOS[5]!);
    for (const issue of issues) {
      const ici = decrire(issue);
      // Aucune des deux n'est « déjà accusée » : ce sont deux déclarations différentes.
      expect(issue.declarations.every((d) => d.reponse.issue !== "deja_accusee"), ici).toBe(true);
      if (!issue.metadonnees.retractation) continue;
      // L'heure et l'empreinte écrites sont celles d'une même déclaration.
      const auteur = issue.declarations.find((d) => empreinteDe(d.acteur, issue.reference) === issue.metadonnees[CLES.empreinteRetractation]);
      expect(auteur, ici).toBeDefined();
      expect(issue.metadonnees.retractation, ici).toBe(auteur!.acteur.le.toISOString());
    }
  });
});

/**
 * Les invariants qui tiennent même quand un appel à Stripe ou à Resend
 * échoue : jamais le PDF et le remboursement ensemble ; un remboursement au
 * plus ; aucun accusé annoncé sans être parti ; un compteur d'accusés qui ne
 * fait que monter ; parmi les e-mails de la route de rétractation, aucune clé
 * hors de `accuse-<ref>` et `accuse-<ref>-1` à `-3`, et quatre au plus ;
 * « non transmise » seulement si aucun e-mail de la route n'est parti pour
 * cette déclaration.
 */
function verifierSousPanne(issue: Issue, ici: string): void {
  expect(issue.pdf && issue.rembourse, ici).toBe(false);
  expect(issue.pdf && issue.apresLaTache.rembourse, ici).toBe(false);
  expect(issue.apresLaTache.pdf && issue.apresLaTache.rembourse, ici).toBe(false);
  expect(issue.remboursements, ici).toBeLessThanOrEqual(1);
  expect(issue.accusesAnnoncesNonPartis, ici).toBe(0);
  for (let rang = 1; rang < issue.compteurs.length; rang += 1) {
    expect(issue.compteurs[rang]!, ici).toBeGreaterThanOrEqual(issue.compteurs[rang - 1]!);
  }
  // Un accusé réaffiché (« déjà accusée ») est toujours un e-mail réellement parti de la route.
  const textes = new Set(issue.emailsDeLaRoute.map(({ texte }) => texte));
  for (const { acteur, reponse } of issue.declarations) {
    if (reponse.issue === "deja_accusee" && reponse.accuse) {
      expect(textes.has(courrielEnTexte(reponse.accuse)), `${ici} — ${acteur.nom} réaffiche un accusé qui n'est pas parti`).toBe(true);
    }
  }
  const permises = new Set([`accuse-${issue.reference}`, ...[1, 2, 3].map((n) => `accuse-${issue.reference}-${n}`)]);
  for (const { cle } of issue.emailsDeLaRoute) expect(permises.has(cle), `${ici} — clé ${cle}`).toBe(true);
  expect(issue.emailsDeLaRoute.length, ici).toBeLessThanOrEqual(4);
  for (const { acteur, reponse } of issue.declarations) {
    if (reponse.issue !== "non_transmise") continue;
    const prenom = `Prénom : ${(acteur.declarant ?? CAMILLE).prenom}\n`;
    const partis = issue.emailsDeLaRoute.filter(({ texte }) => texte.replace(/[\u00a0\u202f]/g, " ").includes(prenom));
    expect(partis, `${ici} — ${acteur.nom} non transmise`).toEqual([]);
  }
}

/**
 * Un appel à Stripe reçoit un 500 gardé sous sa clé, un 500 alors qu'il
 * s'est appliqué, un 429 ou une coupure du réseau ; un envoi à Resend, un
 * échec.
 */
const GENRES_DE_PANNE: Injection["genre"][] = ["500", "500_appliquee", "429", "connexion", "resend"];

/**
 * Une exploration sans panne, puis une par appel retenu de chaque requête et
 * par genre de panne (500 gardé par Stripe, 500 appliqué, 429, coupure du
 * réseau pour un appel à Stripe ; échec d'envoi pour un appel à Resend) :
 * chacune parcourt tous les ordres possibles.
 */
async function balayer(scenario: Scenario): Promise<{ configurations: number; ordres: number; pannes: number }> {
  const sansPanne = await explorer(scenario);
  for (const issue of sansPanne) verifierSousPanne(issue, decrire(issue));
  // Chez qui va chaque appel, rang par rang, dans les ordres sans panne.
  const chez = new Map<string, Set<string>[]>();
  for (const issue of sansPanne) {
    for (const [route, appels] of Object.entries(issue.appels)) {
      const rangs = chez.get(route) ?? [];
      appels.forEach((destination, rang) => (rangs[rang] ??= new Set()).add(destination));
      chez.set(route, rangs);
    }
  }
  let configurations = 0;
  let ordres = sansPanne.length;
  let pannes = 0;
  for (const [route, rangs] of chez) {
    for (const [rang, destinations] of rangs.entries()) {
      for (const genre of GENRES_DE_PANNE) {
        if (!destinations.has(genre === "resend" ? "resend" : "stripe")) continue;
        const issues = await explorer(scenario, { route, rang, genre });
        configurations += 1;
        ordres += issues.length;
        for (const issue of issues) {
          if (issue.panneFaite) pannes += 1;
          verifierSousPanne(issue, `${route}, appel n° ${rang + 1} en panne (${genre}) — ${decrire(issue)}`);
        }
      }
    }
  }
  return { configurations, ordres, pannes };
}

describe("avec une panne injectée à chaque appel à Stripe et à Resend, dans tous les ordres", () => {
  const TELECHARGEE = { [CLES.telechargement]: "2026-09-25T09:00:00.000Z" };
  const SCENARIOS_SOUS_PANNE: Scenario[] = [
    {
      nom: "un téléchargement et une déclaration reçue avant son début",
      acteurs: [kit(APRES), declaration(RECUE_LE)],
      sansPanne: false,
      filtre: SOUS_PANNE,
      resend: true,
    },
    {
      nom: "un téléchargement et une déclaration reçue après son début",
      acteurs: [kit(AVANT), declaration(RECUE_LE)],
      sansPanne: false,
      filtre: SOUS_PANNE,
      resend: true,
    },
    {
      nom: "deux déclarations différentes sur une commande rétractable",
      acteurs: [declaration(RECUE_LE), declaration(new Date(RECUE_LE.getTime() + 1), DOMINIQUE, "rétractation 2")],
      sansPanne: false,
      filtre: SOUS_PANNE,
      resend: true,
    },
    {
      nom: "deux déclarations sur une commande téléchargée, un accusé déjà parti",
      acteurs: [declaration(RECUE_LE), declaration(new Date(RECUE_LE.getTime() + 1), DOMINIQUE, "rétractation 2")],
      avant: { ...TELECHARGEE, [CLES.accuses]: "1" },
      sansPanne: false,
      filtre: SOUS_PANNE,
      resend: true,
    },
  ];

  for (const scenario of SCENARIOS_SOUS_PANNE) {
    for (const garder of [false, true]) {
      it(`${scenario.nom} — Resend ${garder ? "garde" : "ne garde pas"} la clé d'un envoi en échec`, async () => {
        const { configurations, ordres, pannes } = await balayer({ ...scenario, garderLesClesEnEchec: garder });
        process.stdout.write(
          `\n  Pannes « ${scenario.nom} », clé ${garder ? "gardée" : "oubliée"} : ${configurations} pannes, ${ordres} ordres explorés, ${pannes} avec la panne\n`,
        );
        expect(configurations).toBeGreaterThanOrEqual(10);
        expect(pannes).toBeGreaterThan(0);
      }, 120_000);
    }
  }
});

describe("déclarations qui n'enregistrent rien, en même temps", () => {
  const TELECHARGEE = { [CLES.telechargement]: "2026-09-25T09:00:00.000Z" };

  it("le compteur d'accusés ne recule jamais, chaque numéro ne part qu'une fois, et chaque accusé annoncé est parti (défaut B3 du lot 5)", async () => {
    for (const deja of [0, 1, 2]) {
      const scenario: Scenario = {
        nom: `deux déclarations sur une commande téléchargée, ${deja} accusé(s) déjà parti(s)`,
        acteurs: [declaration(RECUE_LE), declaration(new Date(RECUE_LE.getTime() + 1), DOMINIQUE, "rétractation 2")],
        avant: { ...TELECHARGEE, ...(deja > 0 ? { [CLES.accuses]: String(deja) } : {}) },
        sansPanne: true,
      };
      const issues = await explorer(scenario);
      bilan(scenario, issues);
      expect(issues.length).toBeGreaterThanOrEqual(5);
      const attendus = Math.min(2, 3 - deja);
      for (const issue of issues) {
        const ici = `${scenario.nom} — ${decrire(issue)} — compteurs ${issue.compteurs.join(",")}`;
        expect(issue.accusesAnnoncesNonPartis, ici).toBe(0);
        expect(issue.rembourse || issue.pdf, ici).toBe(false);
        // Les valeurs écrites ne font que monter, et le compteur final compte les accusés partis.
        for (let rang = 1; rang < issue.compteurs.length; rang += 1) {
          expect(issue.compteurs[rang]!, ici).toBeGreaterThanOrEqual(issue.compteurs[rang - 1]!);
        }
        expect(Number(issue.metadonnees[CLES.accuses]), ici).toBe(deja + attendus);
        // Chaque numéro n'est parti qu'une fois, et jamais au-delà de trois.
        expect([...issue.clesDesAccuses].sort(), ici).toEqual(
          Array.from({ length: attendus }, (_, rang) => cleDAccuseNumero(issue.reference, deja + rang + 1)).sort(),
        );
        // Chacune reçoit son accusé par e-mail, ou l'affiche sans le recevoir quand trois sont déjà partis.
        const etats = issue.declarations.map((d) => (d.reponse.issue === "accuse" ? d.reponse.envoi!.etat : d.reponse.issue)).sort();
        expect(etats, ici).toEqual(deja === 2 ? ["envoye", "plafond"] : ["envoye", "envoye"]);
        for (const { statut } of issue.declarations) expect(statut, ici).toBe("droit de rétractation éteint au premier téléchargement");
      }
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

describe("une marque ne s'écrit qu'une fois (ecrireLaMarque)", () => {
  async function commande(): Promise<{ stripe: FauxStripe; paiement: PaiementLu; reference: string }> {
    const stripe = new FauxStripe();
    const deps = dependances(stripe, { env: PRODUCTION, maintenant: () => PAYEE_LE });
    expect((await creerCommande(requeteJson("http://localhost/api/commande", corpsDeCommande()), deps)).status).toBe(200);
    const { reference, paiement } = stripe.payer({ payeLe: PAYEE_LE });
    return { stripe, paiement, reference };
  }

  const marque = (le: Date) => ({ [CLES.retractation]: le.toISOString() });

  it("la première écriture pose la marque ; une seconde, aux valeurs différentes, n'écrase rien et relit le paiement", async () => {
    const { stripe, paiement, reference } = await commande();
    const premiere = await ecrireLaMarque(stripe, paiement, reference, "retractation", marque(RECUE_LE));
    expect(premiere.issue).toBe("ecrite");
    const seconde = await ecrireLaMarque(stripe, paiement, reference, "retractation", marque(APRES));
    expect(seconde).toMatchObject({ issue: "deja_ecrite", apres: { metadonnees: { retractation: RECUE_LE.toISOString() } } });
    expect(stripe.paiements.get(paiement.id)!.metadonnees.retractation).toBe(RECUE_LE.toISOString());
    expect(stripe.modifications.filter((m) => CLES.retractation in m.metadonnees)).toHaveLength(1);
    // Les deux requêtes portaient la même clé.
    expect(stripe.demandesDeModification.map((d) => d.cle)).toEqual([
      cleDeMarque("retractation", reference, 1),
      cleDeMarque("retractation", reference, 1),
    ]);
  });

  it("la même requête, rejouée, reçoit la même réponse sans rien exécuter", async () => {
    const { stripe, paiement, reference } = await commande();
    await ecrireLaMarque(stripe, paiement, reference, "retractation", marque(RECUE_LE));
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.course] = "telechargement";
    const rejouee = await ecrireLaMarque(stripe, paiement, reference, "retractation", marque(RECUE_LE));
    // La réponse gardée par Stripe : celle de la première écriture, sans la course écrite depuis.
    expect(rejouee.issue).toBe("ecrite");
    expect(rejouee.issue === "ecrite" ? rejouee.apres.metadonnees.course : "absente").toBeUndefined();
    expect(stripe.modifications.filter((m) => CLES.retractation in m.metadonnees)).toHaveLength(1);
  });

  it("une autre requête de même clé encore en cours : « en_cours », rien n'est écrit", async () => {
    const { stripe, paiement, reference } = await commande();
    stripe.clesDIdempotenceEnCours.add(cleDeMarque("retractation", reference, 1));
    expect(await ecrireLaMarque(stripe, paiement, reference, "retractation", marque(RECUE_LE))).toEqual({ issue: "en_cours" });
    expect(stripe.paiements.get(paiement.id)!.metadonnees.retractation).toBeUndefined();
  });

  it("un échec gardé par Stripe sous une clé fait passer à la clé suivante ; dix échecs gardés, et la panne remonte", async () => {
    const { stripe, paiement, reference } = await commande();
    stripe.metadonneesEnPanne = true;
    await expect(ecrireLaMarque(stripe, paiement, reference, "retractation", marque(RECUE_LE))).rejects.toThrow("panne simulée");
    stripe.metadonneesEnPanne = false;
    const reprise = await ecrireLaMarque(stripe, paiement, reference, "retractation", marque(APRES));
    expect(reprise.issue).toBe("ecrite");
    expect(stripe.demandesDeModification.at(-1)!.cle).toBe(cleDeMarque("retractation", reference, 2));

    const autre = await commande();
    for (let essai = 1; essai <= ESSAIS_DE_MARQUE; essai += 1) {
      autre.stripe.metadonneesEnPanne = true;
      await expect(
        ecrireLaMarque(autre.stripe, autre.paiement, autre.reference, "retractation", marque(new Date(RECUE_LE.getTime() + essai))),
      ).rejects.toThrow();
      autre.stripe.metadonneesEnPanne = false;
    }
    // Les dix clés ont servi à des échecs gardés : la marque ne peut plus s'écrire avant que Stripe les oublie (24 heures).
    expect(ESSAIS_DE_MARQUE).toBe(10);
    await expect(ecrireLaMarque(autre.stripe, autre.paiement, autre.reference, "retractation", marque(APRES))).rejects.toBeInstanceOf(
      ClesDeMarqueEpuisees,
    );
    expect(autre.stripe.paiements.get(autre.paiement.id)!.metadonnees.retractation).toBeUndefined();
    autre.stripe.oublierLesClesDIdempotence();
    expect((await ecrireLaMarque(autre.stripe, autre.paiement, autre.reference, "retractation", marque(APRES))).issue).toBe("ecrite");
  });

  it("Stripe injoignable pendant la relecture : la panne remonte, signalée comme une panne de lecture, rien n'est écrasé", async () => {
    const { stripe, paiement, reference } = await commande();
    await ecrireLaMarque(stripe, paiement, reference, "retractation", marque(RECUE_LE));
    const lire = stripe.lirePaiement.bind(stripe);
    stripe.lirePaiement = async () => {
      throw Object.assign(new Error("panne simulée"), { type: "StripeConnectionError" });
    };
    const erreur = await ecrireLaMarque(stripe, paiement, reference, "retractation", marque(APRES)).catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(RelectureDeLaMarqueImpossible);
    expect((erreur as RelectureDeLaMarqueImpossible).erreur).toMatchObject({ message: "panne simulée" });
    stripe.lirePaiement = lire;
    expect(stripe.paiements.get(paiement.id)!.metadonnees.retractation).toBe(RECUE_LE.toISOString());
  });
});
