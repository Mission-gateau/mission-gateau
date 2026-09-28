import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rembourseEnTotalite } from "@/vente/remboursement";
import type { Dependances } from "@/vente/dependances";

/**
 * La fonction « Renoncer au contrat ici », éprouvée par sa vraie route, sur
 * des commandes passées, payées et confirmées par les vraies routes. Une
 * déclaration n'est reçue que si elle désigne un paiement abouti retrouvé
 * chez Stripe ; chaque cas est ensuite jugé sur le paiement lui-même.
 */
const injection = vi.hoisted(() => ({ deps: null as unknown }));
vi.mock("@/vente/dependances", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/vente/dependances")>();
  return { ...original, dependancesReelles: () => (injection.deps as Dependances | null) ?? original.dependancesReelles() };
});

import { POST as commanderRoute } from "@/app/api/commande/route";
import { POST as confirmationPost } from "@/app/api/commande/[ref]/confirmation/route";
import { POST as kitPost } from "@/app/api/commande/[ref]/kit/route";
import { GET as renoncerGet, POST as renoncerPost } from "@/app/api/renoncer/route";
import { VENDEUR } from "@/contenu/vendeur";
import { courrielEnTexte, type DocumentCourriel } from "@/vente/courriels";
import { extraireReference } from "@/vente/declaration";
import { CLES, lireSuivi } from "@/vente/metadonnees";
import { empreinteDeDeclaration } from "@/vente/retractation";
import { tacheQuotidienne } from "@/vente/tache";
import { FauxEmail, empreinteDe } from "./fauxEmail";
import {
  CLE_REELLE,
  CLE_TEST,
  EMAIL_ACHETEUR,
  FauxStripe,
  corpsDeCommande,
  dependances,
  environnement,
  marquesDans,
  requeteJson,
} from "./fauxStripe";

/** Payée le jeudi 24 septembre 2026 à 12 h (Paris) : dernier jour du délai, le jeudi 8 octobre. */
const PAYEE_LE = new Date("2026-09-24T10:00:00.000Z");
const RECUE_LE = new Date("2026-09-26T08:30:00.000Z"); // samedi 26 septembre, 10 h 30 à Paris
const PRODUCTION = environnement({ vercelEnv: "production", cleStripe: CLE_REELLE });
const SAISIE = "camille.martin@exemple.fr";
const INVENTEE = "AbCdEfGhIjKlMnOpQrStUv";

let stripe: FauxStripe;
let emails: FauxEmail;
let journaux: string[];
let horloge: Date;

function deps(partiel: Partial<Dependances> = {}): Dependances {
  return dependances(stripe, { email: emails, env: PRODUCTION, maintenant: () => horloge, ...partiel });
}

beforeEach(() => {
  stripe = new FauxStripe();
  emails = new FauxEmail();
  horloge = PAYEE_LE;
  injection.deps = deps();
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

/** Une commande passée, payée et confirmée par les vraies routes. */
async function commandeConfirmee(options: { payeLe?: Date; email?: string; indexe?: boolean } = {}) {
  horloge = options.payeLe ?? PAYEE_LE;
  expect((await commanderRoute(requeteJson("http://localhost/api/commande", corpsDeCommande()))).status).toBe(200);
  const reglee = stripe.payer({ payeLe: horloge, email: options.email, indexe: options.indexe });
  const confirmation = await confirmationPost(
    requeteJson(`http://localhost/api/commande/${reglee.reference}/confirmation`, { session_id: reglee.sessionId }),
    { params: Promise.resolve({ ref: reglee.reference }) },
  );
  expect(confirmation.status).toBe(200);
  horloge = RECUE_LE;
  return reglee;
}

interface Reponse {
  issue: "accuse" | "non_transmise" | "deja_accusee" | "en_cours";
  accuse?: DocumentCourriel;
  envoi?: { etat: string; adresse?: string; saisie?: string; remplacee?: boolean };
  cause?: string;
  message?: string;
  mailto?: string;
  date?: string;
  heure?: string;
}

async function renoncer(corps: Record<string, unknown>): Promise<{ statut: number; reponse: Reponse }> {
  const resultat = await renoncerPost(requeteJson("http://localhost/api/renoncer", corps));
  return { statut: resultat.status, reponse: (await resultat.json()) as Reponse };
}

function declaration(reference: string, partiel: Record<string, unknown> = {}): Record<string, unknown> {
  return { nom: "Martin", prenom: "Camille", reference, email: SAISIE, champ_libre: "", ...partiel };
}

async function telecharger(reference: string): Promise<Response> {
  return kitPost(requeteJson(`http://localhost/api/commande/${reference}/kit`, {}), {
    params: Promise.resolve({ ref: reference }),
  });
}

/** Les accusés de réception partis (la confirmation de commande mise à part). */
function accuses() {
  return emails.envoyes.filter(({ message }) => message.objet.startsWith("Accusé de réception"));
}

function texte(document: DocumentCourriel): string {
  return courrielEnTexte(document).replace(/[\u00a0\u202f]/g, " ");
}

function lignesDuJournal(): Record<string, string | number>[] {
  return journaux.map((ligne) => JSON.parse(ligne) as Record<string, string | number>);
}

describe("rétractation valable", () => {
  it("l'enregistre avec son empreinte, bloque la livraison, rembourse tout par Stripe et en accuse réception", async () => {
    const { reference, paiement } = await commandeConfirmee();
    const { statut, reponse } = await renoncer(declaration(reference));
    expect(statut).toBe(200);
    expect(reponse.issue).toBe("accuse");

    // Enregistrée, à l'heure du serveur, avec l'empreinte de la déclaration.
    const meta = stripe.paiements.get(paiement.id)!.metadonnees;
    expect(meta[CLES.retractation]).toBe(RECUE_LE.toISOString());
    expect(meta[CLES.empreinteRetractation]).toBe(
      empreinteDeDeclaration({ nom: "Martin", prenom: "Camille", reference, email: SAISIE }),
    );
    expect(meta[CLES.empreinteRetractation]).toMatch(/^[0-9a-f]{16}$/);
    // Écrite avant de chercher l'adresse de l'acheteur, et avant de rembourser.
    const ecriture = stripe.modifications.findIndex((m) => CLES.retractation in m.metadonnees);
    expect(ecriture).toBeGreaterThanOrEqual(0);
    expect(stripe.modifications[ecriture]!.metadonnees).toEqual({
      [CLES.retractation]: RECUE_LE.toISOString(),
      [CLES.empreinteRetractation]: meta[CLES.empreinteRetractation],
    });
    // Remboursée en totalité, avec la clé d'idempotence tirée de la référence.
    expect(stripe.demandesDeRemboursement).toEqual([
      { id: paiement.id, cle: `retractation-${reference}`, metadonnees: { ref: reference, motif: "retractation" } },
    ]);
    expect(stripe.remboursements).toHaveLength(1);
    // La livraison est bloquée.
    const kit = await telecharger(reference);
    expect(kit.status).toBe(410);
    expect(((await kit.json()) as { etat: string }).etat).toBe("retractee");

    // Un accusé de réception, à l'adresse saisie, copie cachée à l'acheteur (adresse différente) et au vendeur.
    expect(accuses()).toHaveLength(1);
    const { message, cle } = accuses()[0]!;
    expect(cle).toBe(`accuse-${reference}`);
    expect(message.a).toEqual([SAISIE]);
    expect(message.copieCachee).toEqual([EMAIL_ACHETEUR, VENDEUR.email]);
    expect(message.repondreA).toBe(VENDEUR.email);
    expect(message.de).toBe("Mission Gâteau <commandes@missiongateau.com>");
    expect(message.piecesJointes).toEqual([]);
    expect(stripe.paiements.get(paiement.id)!.metadonnees[CLES.accuseRetractation]).toBe(accuses()[0]!.id);

    const corps = message.texte.replace(/[\u00a0\u202f]/g, " ");
    for (const attendu of [
      "Nom : Martin",
      "Prénom : Camille",
      `Référence de la commande : ${reference}`,
      `Adresse e-mail : ${SAISIE}`,
      "Envoyée le : 26 septembre 2026 à 10 h 30 (heure de Paris)",
      "Statut : rétractation enregistrée — remboursement effectué",
      "Votre rétractation est enregistrée : votre jeu n'est plus disponible au téléchargement.",
      "Nous vous avons remboursé 12,90 € sur la carte utilisée pour le paiement",
    ]) {
      expect(corps, attendu).toContain(attendu);
    }
    // La page affiche exactement ce contenu, et dit où l'accusé est parti, sans dire si l'adresse est celle de l'acheteur.
    expect(texte(reponse.accuse!)).toBe(corps);
    expect(reponse.envoi).toEqual({ etat: "envoye", adresse: SAISIE, saisie: SAISIE, remplacee: false });
  });

  it("écrit la rétractation dès que le paiement est jugé rétractable, avant de chercher l'adresse de l'acheteur et de rembourser", async () => {
    const { reference } = await commandeConfirmee();
    const ordre: string[] = [];
    const modifier = stripe.modifierMetadonnees.bind(stripe);
    const session = stripe.sessionDuPaiement.bind(stripe);
    const rembourser = stripe.rembourser.bind(stripe);
    stripe.modifierMetadonnees = async (id, metadonnees) => {
      ordre.push(`écriture ${Object.keys(metadonnees).sort().join("+")}`);
      return modifier(id, metadonnees);
    };
    stripe.sessionDuPaiement = async (id) => {
      ordre.push("adresse de l'acheteur");
      return session(id);
    };
    stripe.rembourser = async (id, cle, metadonnees) => {
      ordre.push("remboursement");
      return rembourser(id, cle, metadonnees);
    };
    await renoncer(declaration(reference));
    expect(ordre).toEqual([
      "écriture retractation+retractation_empreinte",
      "remboursement",
      "adresse de l'acheteur",
      "écriture retractation_accuse",
    ]);
  });

  it("accepte le lien complet de la commande, et ne reprend que la référence extraite", async () => {
    const { reference, paiement } = await commandeConfirmee();
    const lien = `  https://mission-gateau.vercel.app/commande/${reference}?session_id=cs_test_abcdefgh  `;
    const { reponse } = await renoncer(declaration(lien));
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).not.toBeNull();
    const corps = texte(reponse.accuse!);
    expect(corps).toContain(`Référence de la commande : ${reference}\n`);
    expect(corps).not.toContain("https://mission-gateau.vercel.app");
    expect(accuses()[0]!.message.texte).not.toContain("session_id");
  });

  it("par le lien de la page de la commande, retrouve un paiement que la recherche de Stripe ne voit pas encore", async () => {
    const { reference, sessionId, paiement } = await commandeConfirmee({ indexe: false });
    const { statut, reponse } = await renoncer(declaration(reference, { session_id: sessionId }));
    expect(statut).toBe(200);
    expect(reponse.issue).toBe("accuse");
    expect(stripe.sessionsLues).toContain(sessionId);
    expect(stripe.recherchesParReference).not.toContain(reference);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toEqual(RECUE_LE);
    expect(stripe.remboursements).toHaveLength(1);
  });

  it("ignore une session qui désigne une autre commande : seule la référence compte", async () => {
    const autre = await commandeConfirmee();
    const visee = await commandeConfirmee();
    await renoncer(declaration(visee.reference, { session_id: autre.sessionId }));
    expect(lireSuivi(stripe.paiements.get(visee.paiement.id)!.metadonnees).retractation).not.toBeNull();
    expect(lireSuivi(stripe.paiements.get(autre.paiement.id)!.metadonnees).retractation).toBeNull();
    // Sans session valable, un paiement invisible de la recherche n'est pas retrouvé.
    const invisible = await commandeConfirmee({ indexe: false });
    const { statut, reponse } = await renoncer(declaration(invisible.reference, { session_id: autre.sessionId }));
    expect(statut).toBe(404);
    expect(reponse.issue).toBe("non_transmise");
  });

  it("remboursement en échec : l'accusé promet le remboursement sous 14 jours, et part quand même", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.remboursementEnPanne = true;
    const { reponse } = await renoncer(declaration(reference));
    expect(rembourseEnTotalite(stripe.paiements.get(paiement.id)!)).toBe(false);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).not.toBeNull();
    const corps = texte(reponse.accuse!);
    expect(corps).toContain("Statut : rétractation enregistrée — remboursement à venir");
    expect(corps).toContain("Nous vous rembourserons 12,90 € sur la carte utilisée pour le paiement, sous 14 jours au plus.");
    expect(accuses()[0]!.message.copieCachee).toContain(VENDEUR.email);
    expect(journaux.join("\n")).toContain("remboursement_impossible");
  });

  it("déjà remboursée hors rétractation : l'accusé dit le remboursement fait, sans nouvelle demande", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.rembourserHorsSite(paiement.id);
    const { reponse } = await renoncer(declaration(reference));
    expect(stripe.demandesDeRemboursement).toHaveLength(0);
    expect(texte(reponse.accuse!)).toContain("Statut : rétractation enregistrée — remboursement effectué");
  });

  it("litige en cours : aucun remboursement automatique, le vendeur répond sous 7 jours", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.contester(paiement.id);
    const { reponse } = await renoncer(declaration(reference));
    expect(stripe.demandesDeRemboursement).toHaveLength(0);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).not.toBeNull();
    const corps = texte(reponse.accuse!);
    expect(corps).toContain("paiement contesté, remboursement non automatique");
    expect(corps).toContain("Nous vous répondons sous 7 jours au plus.");
  });

  it("tardive à Paris mais pas encore à UTC−12 : la rétractation est valable", async () => {
    const { reference, paiement } = await commandeConfirmee();
    // 1 h 30 du matin à Paris, le vendredi 9 octobre : le 8 n'est pas fini partout sur Terre.
    horloge = new Date("2026-10-08T23:30:00.000Z");
    await renoncer(declaration(reference));
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).not.toBeNull();
    expect(stripe.remboursements).toHaveLength(1);
  });

  it("ne tient compte ni de l'état « illisible » de la page de commande : seul le paiement compte", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.paiements.get(paiement.id)!.metadonnees.config_0 = "AAAA";
    await renoncer(declaration(reference));
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).not.toBeNull();
    expect(stripe.remboursements).toHaveLength(1);
  });
});

describe("la déclaration qui enregistre la rétractation", () => {
  it("est toujours accusée ; une déclaration identique reçoit exactement le même accusé, même heure, même clé", async () => {
    const { reference, paiement } = await commandeConfirmee();
    emails.refuse = true;
    const premiere = await renoncer(declaration(reference));
    expect(premiere.reponse.envoi).toEqual({ etat: "echec" });
    // La rétractation est enregistrée et remboursée quand même ; l'échec est journalisé avec la référence.
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toEqual(RECUE_LE);
    expect(stripe.remboursements).toHaveLength(1);
    expect(lignesDuJournal()).toContainEqual({
      route: "retractation",
      evenement: "accuse_non_envoye",
      code: "validation_error",
      reference,
    });

    // « Renvoyer », deux minutes plus tard : la même déclaration, dont l'accusé n'est pas encore parti.
    emails.refuse = false;
    horloge = new Date(RECUE_LE.getTime() + 120_000);
    const renvoi = await renoncer(declaration(reference));
    expect(renvoi.reponse.envoi?.etat).toBe("envoye");
    expect(accuses()).toHaveLength(1);
    expect(texte(renvoi.reponse.accuse!)).toContain("Envoyée le : 26 septembre 2026 à 10 h 30 (heure de Paris)");
    expect(texte(renvoi.reponse.accuse!)).toBe(texte(premiere.reponse.accuse!));
    // Exactement la même requête, sous la même clé.
    const appels = emails.appels.filter(({ cle }) => cle === `accuse-${reference}`);
    expect(appels).toHaveLength(2);
    expect(empreinteDe(appels[1]!.message)).toBe(empreinteDe(appels[0]!.message));
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).accuseRetractation).toBe(accuses()[0]!.id);

    // Son accusé est parti : une déclaration identique n'appelle plus Resend ; la page réaffiche le même accusé, à la même heure.
    horloge = new Date(RECUE_LE.getTime() + 600_000);
    const avant = emails.appels.length;
    const encore = await renoncer(declaration(reference));
    expect(encore.statut).toBe(200);
    expect(encore.reponse).toMatchObject({ issue: "deja_accusee", date: "26 septembre 2026" });
    expect(encore.reponse.heure!.replace(/[\u00a0\u202f]/g, " ")).toBe("10 h 30");
    expect(texte(encore.reponse.accuse!)).toBe(texte(premiere.reponse.accuse!));
    expect(emails.appels).toHaveLength(avant);
    expect(accuses()).toHaveLength(1);
    expect(stripe.remboursements).toHaveLength(1);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).accuses).toBe(0);
  });

  it("rejouée à l'identique à +2 min, +25 h, +50 h et +20 jours, clés de Resend oubliées : un seul e-mail en tout", async () => {
    const { reference } = await commandeConfirmee();
    const premiere = await renoncer(declaration(reference));
    expect(premiere.reponse.envoi?.etat).toBe("envoye");
    for (const plus of [2 * 60_000, 25 * 3_600_000, 50 * 3_600_000, 20 * 24 * 3_600_000]) {
      emails.oublierLesCles();
      horloge = new Date(RECUE_LE.getTime() + plus);
      const { statut, reponse } = await renoncer(declaration(reference));
      expect(statut, String(plus)).toBe(200);
      expect(reponse.issue, String(plus)).toBe("deja_accusee");
      expect(texte(reponse.accuse!), String(plus)).toBe(texte(premiere.reponse.accuse!));
    }
    expect(accuses()).toHaveLength(1);
    expect(emails.appels.filter(({ cle }) => cle.startsWith("accuse-"))).toHaveLength(1);
  });

  it("est reconnue à son empreinte même après trois accusés aux autres déclarations : la page réaffiche son accusé, sans nouvel e-mail", async () => {
    const { reference } = await commandeConfirmee();
    await renoncer(declaration(reference));
    for (const prenom of ["Léa", "Paul", "Zoé", "Noé"]) await renoncer(declaration(reference, { prenom }));
    expect(accuses()).toHaveLength(4);
    const avant = emails.appels.length;
    const identique = await renoncer(declaration(reference));
    expect(identique.reponse.issue).toBe("deja_accusee");
    expect(texte(identique.reponse.accuse!)).toContain("Statut : rétractation enregistrée — remboursement effectué");
    expect(emails.appels).toHaveLength(avant);
    // Les seules clés de la route : l'accusé de la déclaration qui a enregistré, puis les n° 1 à 3.
    expect(emails.appels.map(({ cle }) => cle).filter((cle) => cle.startsWith("accuse-")).sort()).toEqual(
      [`accuse-${reference}`, `accuse-${reference}-1`, `accuse-${reference}-2`, `accuse-${reference}-3`].sort(),
    );
  });

  it("n'est remboursée qu'une fois et n'envoie qu'un accusé, même déclarée deux fois en même temps", async () => {
    const { reference } = await commandeConfirmee();
    emails.delai = 30;
    const reponses = await Promise.all([renoncer(declaration(reference)), renoncer(declaration(reference))]);
    expect(reponses.every(({ statut }) => statut === 200 || statut === 202)).toBe(true);
    expect(reponses.map(({ reponse }) => reponse.issue).sort()).toEqual(["accuse", "en_cours"]);
    expect(stripe.remboursements).toHaveLength(1);
    expect(accuses()).toHaveLength(1);
    const enCours = reponses.find(({ reponse }) => reponse.issue === "en_cours")!.reponse;
    expect(enCours.message!.replace(/[\u00a0\u202f]/g, " ")).toBe(
      "Votre déclaration est en cours de traitement : rechargez la page dans quelques instants.",
    );
  });
});

describe("les autres déclarations : trois accusés par e-mail au plus", () => {
  it("rétractation déjà enregistrée par une autre déclaration : un accusé qui donne les deux heures, jamais un second remboursement", async () => {
    const { reference, paiement } = await commandeConfirmee();
    await renoncer(declaration(reference));
    horloge = new Date(RECUE_LE.getTime() + 3 * 3600_000); // 13 h 30 à Paris
    const { statut, reponse } = await renoncer(declaration(reference, { email: "autre@exemple.fr" }));
    expect(statut).toBe(200);
    expect(reponse.envoi?.etat).toBe("envoye");
    const corps = texte(reponse.accuse!);
    expect(corps).toContain("Envoyée le : 26 septembre 2026 à 13 h 30 (heure de Paris)");
    expect(corps).toContain("Statut : rétractation déjà enregistrée — remboursement effectué");
    expect(corps).toContain(
      "Votre rétractation de cette commande a déjà été enregistrée le 26 septembre 2026 à 10 h 30 (heure de Paris), à la réception d'une précédente déclaration. Cette nouvelle déclaration, envoyée le 26 septembre 2026 à 13 h 30, n'y change rien",
    );
    expect(emails.appels.at(-1)!.cle).toBe(`accuse-${reference}-1`);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).accuses).toBe(1);
    // La rétractation garde son heure et son empreinte d'origine ; un seul remboursement.
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toEqual(RECUE_LE);
    expect(stripe.remboursements).toHaveLength(1);
    expect(stripe.demandesDeRemboursement).toHaveLength(1);
  });

  it("au-delà de trois, l'accusé s'affiche sans partir, et la page dit pourquoi", async () => {
    const { reference, paiement } = await commandeConfirmee();
    horloge = new Date("2026-09-25T14:05:00.000Z");
    expect((await telecharger(reference)).status).toBe(200);
    horloge = RECUE_LE;
    for (let numero = 1; numero <= 3; numero += 1) {
      const { reponse } = await renoncer(declaration(reference, { prenom: `Camille${"e".repeat(numero)}` }));
      expect(reponse.envoi?.etat).toBe("envoye");
      expect(emails.appels.at(-1)!.cle).toBe(`accuse-${reference}-${numero}`);
      expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).accuses).toBe(numero);
    }
    const appels = emails.appels.length;
    const quatrieme = await renoncer(declaration(reference, { prenom: "Dominique" }));
    expect(quatrieme.statut).toBe(200);
    expect(quatrieme.reponse.issue).toBe("accuse");
    expect(quatrieme.reponse.envoi).toEqual({ etat: "plafond" });
    expect(texte(quatrieme.reponse.accuse!)).toContain("Prénom : Dominique");
    expect(emails.appels).toHaveLength(appels);
    expect(accuses()).toHaveLength(3);
    expect(stripe.demandesDeRemboursement).toHaveLength(0);
  });

  it("jamais plus de trois, même avec des déclarations simultanées", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.telechargement] = "2026-09-25T14:05:00.000Z";
    emails.delai = 20;
    const prenoms = ["Ada", "Bea", "Cyr", "Dan", "Eve", "Flo", "Gus", "Hugo"];
    await Promise.all(prenoms.map((prenom) => renoncer(declaration(reference, { prenom }))));
    for (const prenom of ["Iris", "Jade", "Kim", "Lou", "Max"]) await renoncer(declaration(reference, { prenom }));
    await Promise.all(prenoms.map((prenom) => renoncer(declaration(reference, { prenom: `${prenom}e` }))));
    expect(accuses().length).toBeLessThanOrEqual(3);
    expect(accuses()).toHaveLength(3);
    // Une clé par numéro, un seul e-mail par clé.
    expect(accuses().map(({ cle }) => cle).sort()).toEqual([1, 2, 3].map((n) => `accuse-${reference}-${n}`));
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).accuses).toBe(3);
  });

  it("après le premier téléchargement : l'accusé l'explique, sans remboursement ni promesse de disponibilité", async () => {
    const { reference, paiement } = await commandeConfirmee();
    horloge = new Date("2026-09-25T14:05:00.000Z");
    expect((await telecharger(reference)).status).toBe(200);
    horloge = RECUE_LE;
    const { reponse } = await renoncer(declaration(reference));
    const corps = texte(reponse.accuse!);
    expect(corps).toContain("Statut : droit de rétractation éteint au premier téléchargement");
    expect(corps).toContain(
      "Votre droit de rétractation a pris fin au début du premier téléchargement de votre jeu, le 25 septembre 2026 à 16 h 05 (heure de Paris), comme vous l'aviez demandé et reconnu avant de payer (article L221-28, 13° du Code de la consommation). Votre commande est donc maintenue, sans remboursement.\n",
    );
    expect(corps).not.toContain("reste disponible");
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toBeNull();
    expect(stripe.demandesDeRemboursement).toHaveLength(0);
    expect((await telecharger(reference)).status).toBe(200);
    expect(accuses()).toHaveLength(1);
    expect(emails.appels.at(-1)!.cle).toBe(`accuse-${reference}-1`);
  });

  it("délai expiré : l'accusé donne le dernier jour du délai, sans remboursement, et la livraison continue", async () => {
    const { reference, paiement } = await commandeConfirmee();
    horloge = new Date("2026-10-10T08:00:00.000Z");
    const { reponse } = await renoncer(declaration(reference));
    const corps = texte(reponse.accuse!);
    expect(corps).toContain("Statut : délai de rétractation expiré");
    expect(corps).toContain("Le délai de rétractation de cette commande a pris fin le 8 octobre 2026.");
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toBeNull();
    expect(stripe.demandesDeRemboursement).toHaveLength(0);
    expect((await telecharger(reference)).status).toBe(200);
  });

  it("tardive partout : refusée, au-delà de midi UTC le lendemain du dernier jour", async () => {
    const { reference, paiement } = await commandeConfirmee();
    horloge = new Date("2026-10-09T12:00:00.000Z");
    const { reponse } = await renoncer(declaration(reference));
    expect(texte(reponse.accuse!)).toContain("délai de rétractation expiré");
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toBeNull();
  });

  it("clé déjà servie chez Resend (409) : compte ce numéro, sans rien décider sur Stripe, et passe au suivant", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.telechargement] = "2026-09-25T14:05:00.000Z";
    // Le n° 1 est parti, mais son compteur n'a pas pu être écrit.
    await emails.envoyer(
      { de: "x", a: ["y@resend.dev"], copieCachee: [], repondreA: "x", objet: "Accusé de réception", texte: "x", html: "x", piecesJointes: [] },
      `accuse-${reference}-1`,
    );
    const { reponse } = await renoncer(declaration(reference));
    expect(reponse.envoi?.etat).toBe("envoye");
    expect(emails.appels.at(-1)!.cle).toBe(`accuse-${reference}-2`);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).accuses).toBe(2);
  });

  it("clé en cours chez Resend (409) et rien d'enregistré : « en cours de traitement », et la page ne dit pas qu'un accusé est parti", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.telechargement] = "2026-09-25T14:05:00.000Z";
    emails.delai = 40;
    const lente = renoncer(declaration(reference, { prenom: "Premiere" }));
    await new Promise((resoudre) => setTimeout(resoudre, 5));
    const { statut, reponse } = await renoncer(declaration(reference, { prenom: "Seconde" }));
    expect(statut).toBe(202);
    expect(reponse).toEqual({
      issue: "en_cours",
      message: "Votre déclaration est en cours de traitement : rechargez la page dans quelques instants.",
    });
    expect((await lente).reponse.envoi?.etat).toBe("envoye");
    expect(accuses()).toHaveLength(1);
    // L'accusé qui n'est pas parti laisse la référence au journal.
    expect(lignesDuJournal()).toContainEqual({ route: "retractation", evenement: "accuse_non_envoye", code: "en_cours", reference });
  });
});

describe("déclaration non transmise : rien n'est enregistré ni envoyé", () => {
  function sansTrace(avant: { modifications: number; appels: number }) {
    expect(stripe.modifications).toHaveLength(avant.modifications);
    expect(stripe.demandesDeRemboursement).toHaveLength(0);
    expect(emails.appels).toHaveLength(avant.appels);
  }

  function mailtoDe(reponse: Reponse): { a: string; objet: string; corps: string } {
    const url = new URL(reponse.mailto!);
    expect(url.protocol).toBe("mailto:");
    return {
      a: decodeURIComponent(url.pathname),
      objet: url.searchParams.get("subject")!.replace(/[\u00a0\u202f]/g, " "),
      corps: url.searchParams.get("body")!.replace(/[\u00a0\u202f]/g, " "),
    };
  }

  it("référence inconnue : aucune commande payée, le message le dit, rien ne part", async () => {
    await commandeConfirmee();
    const avant = { modifications: stripe.modifications.length, appels: emails.appels.length };
    const { statut, reponse } = await renoncer(declaration(INVENTEE));
    expect(statut).toBe(404);
    expect(reponse.issue).toBe("non_transmise");
    expect(reponse.cause).toBe("introuvable");
    expect(reponse.message!.replace(/[\u00a0\u202f]/g, " ")).toBe(
      "Nous ne trouvons aucune commande payée sous cette référence : votre déclaration n'a pas été transmise et aucun accusé de réception ne partira.",
    );
    sansTrace(avant);
    expect(lignesDuJournal()).toContainEqual({
      route: "retractation",
      evenement: "declaration_non_transmise",
      cause: "introuvable",
      reference: INVENTEE,
      heure: RECUE_LE.toISOString(),
    });
    // L'e-mail de secours, prérempli pour la messagerie de la personne.
    const courriel = mailtoDe(reponse);
    expect(courriel.a).toBe(VENDEUR.email);
    expect(courriel.objet).toBe(`Rétractation de la commande ${INVENTEE}`);
    expect(courriel.corps).toBe(
      [
        "Je renonce au contrat portant sur la commande indiquée ci-dessous.",
        "",
        "Nom : Martin",
        "Prénom : Camille",
        `Référence de la commande : ${INVENTEE}`,
        `Adresse e-mail : ${SAISIE}`,
        "Déclaration faite le 26 septembre 2026 à 10 h 30 (heure de Paris).",
      ].join("\n"),
    );
  });

  it("commande impayée : même réponse, rien ne part", async () => {
    horloge = PAYEE_LE;
    await commanderRoute(requeteJson("http://localhost/api/commande", corpsDeCommande()));
    const { reference } = stripe.payer({ payeLe: PAYEE_LE, statut: "requires_payment_method" });
    horloge = RECUE_LE;
    const { statut, reponse } = await renoncer(declaration(reference));
    expect(statut).toBe(404);
    expect(reponse.cause).toBe("introuvable");
    expect(emails.appels).toHaveLength(0);
  });

  it("paiement pas encore visible dans la recherche, sans session : la page conseille de réessayer, rien ne part", async () => {
    const { reference, paiement } = await commandeConfirmee({ indexe: false });
    const appels = emails.appels.length;
    const { statut, reponse } = await renoncer(declaration(reference));
    expect(statut).toBe(404);
    expect(reponse.cause).toBe("introuvable");
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toBeNull();
    expect(emails.appels).toHaveLength(appels);
  });

  for (const [nom, panne, cause] of [
    ["Stripe en panne", (s: FauxStripe) => (s.enPanne = true), "stripe_indisponible"],
    ["Stripe qui limite le débit", (s: FauxStripe) => (s.debitLimite = true), "stripe_limite"],
  ] as const) {
    it(`${nom} : « vérification impossible », bouton d'e-mail rempli, journal declaration_non_transmise`, async () => {
      const { reference } = await commandeConfirmee();
      panne(stripe);
      const avant = { modifications: stripe.modifications.length, appels: emails.appels.length };
      const { statut, reponse } = await renoncer(declaration(reference));
      expect(statut).toBe(503);
      expect(reponse.issue).toBe("non_transmise");
      expect(reponse.cause).toBe("indisponible");
      expect(reponse.message!.replace(/[\u00a0\u202f]/g, " ")).toBe(
        "Nous ne pouvons pas vérifier votre commande pour le moment : votre déclaration n'a pas été transmise. Réessayez dans quelques minutes, ou envoyez-la dès maintenant par e-mail : une déclaration envoyée avant la fin du délai de rétractation préserve votre droit.",
      );
      sansTrace(avant);
      expect(lignesDuJournal()).toContainEqual({
        route: "retractation",
        evenement: "declaration_non_transmise",
        cause,
        reference,
        heure: RECUE_LE.toISOString(),
      });
      const courriel = mailtoDe(reponse);
      expect(courriel.a).toBe(VENDEUR.email);
      expect(courriel.corps).toContain(`Référence de la commande : ${reference}`);
      expect(courriel.corps).toContain("Nom : Martin");
      expect(courriel.corps).toContain(`Adresse e-mail : ${SAISIE}`);
      expect(courriel.corps).toContain("Déclaration faite le 26 septembre 2026 à 10 h 30 (heure de Paris).");
    });
  }

  it("sans clé Stripe, comme la production aujourd'hui : aucune commande retrouvée, aucun e-mail", async () => {
    injection.deps = dependances(null, { email: emails, env: environnement({ vercelEnv: "production", cleStripe: undefined }), maintenant: () => RECUE_LE });
    for (const email of ["delivered@resend.dev", "victime@exemple.fr"]) {
      const { statut, reponse } = await renoncer(declaration(INVENTEE, { email }));
      expect(statut).toBe(404);
      expect(reponse.cause).toBe("introuvable");
    }
    expect(emails.appels).toHaveLength(0);
  });

  it("en production avec une clé de test, les vraies dépendances ne créent aucun client : rien ne part", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("STRIPE_SECRET_KEY", CLE_TEST);
    try {
      injection.deps = null;
      const { statut, reponse } = await renoncer(declaration(INVENTEE));
      expect(statut).toBe(404);
      expect(reponse.cause).toBe("introuvable");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("commande retrouvée, puis Stripe échoue avant l'enregistrement : rien ne part", () => {
  const MESSAGE_DE_PANNE =
    "Nous ne pouvons pas vérifier votre commande pour le moment : votre déclaration n'a pas été transmise. Réessayez dans quelques minutes, ou envoyez-la dès maintenant par e-mail : une déclaration envoyée avant la fin du délai de rétractation préserve votre droit.";

  it("26 déclarations différentes pendant que les écritures échouent : aucun e-mail, 26 réponses 503 avec le bouton d'e-mail", async () => {
    const { reference, paiement } = await commandeConfirmee();
    const avant = emails.appels.length;
    stripe.metadonneesEnPanne = true;
    const prenoms = Array.from({ length: 26 }, (_, rang) => `Camille${"abcdefghijklmnopqrstuvwxyz"[rang]}`);
    for (const [rang, prenom] of prenoms.entries()) {
      horloge = new Date(RECUE_LE.getTime() + rang * 60_000);
      const { statut, reponse } = await renoncer(declaration(reference, { prenom, email: `personne${rang}@exemple.fr` }));
      expect(statut, prenom).toBe(503);
      expect(reponse.issue, prenom).toBe("non_transmise");
      expect(reponse.message!.replace(/[\u00a0\u202f]/g, " "), prenom).toBe(MESSAGE_DE_PANNE);
      expect(reponse.mailto, prenom).toMatch(/^mailto:/);
    }
    expect(emails.appels).toHaveLength(avant);
    expect(stripe.demandesDeRemboursement).toHaveLength(0);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toBeNull();
    // Le journal garde la cause, la référence et l'heure de chacune, jamais un nom ni une adresse.
    const lignes = lignesDuJournal().filter((ligne) => ligne.evenement === "declaration_non_transmise");
    expect(lignes).toHaveLength(26);
    for (const ligne of lignes) expect(ligne).toMatchObject({ cause: "ecriture_impossible", reference });
    expect(JSON.stringify(lignesDuJournal())).not.toMatch(/Camille|personne\d|@/);
  });

  it("dix réponses 500 gardées sous marque-retractation-<ref>-1 à -10 : aucune déclaration ne fait partir d'e-mail", async () => {
    const { reference } = await commandeConfirmee();
    for (let essai = 1; essai <= 10; essai += 1) stripe.garderUnEchec(`marque-retractation-${reference}-${essai}`);
    const avant = emails.appels.length;
    for (const prenom of ["Léa", "Paul", "Zoé"]) {
      const { statut, reponse } = await renoncer(declaration(reference, { prenom }));
      expect(statut).toBe(503);
      expect(reponse.cause).toBe("indisponible");
    }
    expect(emails.appels).toHaveLength(avant);
    expect(lignesDuJournal().filter((ligne) => ligne.evenement === "declaration_non_transmise").map((ligne) => ligne.cause)).toEqual([
      "ecriture_impossible",
      "ecriture_impossible",
      "ecriture_impossible",
    ]);
  });

  it("l'écriture de retractation répond 500 mais s'applique : la relecture trouve son empreinte, et l'accusé part normalement", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.pannesParCle.set(`marque-retractation-${reference}-1`, "500_appliquee");
    const { statut, reponse } = await renoncer(declaration(reference));
    expect(statut).toBe(200);
    expect(reponse.envoi?.etat).toBe("envoye");
    expect(texte(reponse.accuse!)).toContain("Statut : rétractation enregistrée — remboursement effectué");
    expect(emails.appels.at(-1)!.cle).toBe(`accuse-${reference}`);
    expect(stripe.remboursements).toHaveLength(1);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toEqual(RECUE_LE);
    expect(lignesDuJournal()).toContainEqual({ route: "retractation", evenement: "enregistree_malgre_l_echec", reference });
  });

  it("l'écriture répond 500 mais s'applique, et la relecture échoue : 503 ; puis la déclaration identique reçoit l'accusé", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.pannesParCle.set(`marque-retractation-${reference}-1`, "500_appliquee");
    const lire = stripe.lirePaiement.bind(stripe);
    stripe.lirePaiement = async () => {
      throw Object.assign(new Error("panne simulée"), { type: "StripeConnectionError" });
    };
    const avant = emails.appels.length;
    const premiere = await renoncer(declaration(reference));
    expect(premiere.statut).toBe(503);
    expect(premiere.reponse.issue).toBe("non_transmise");
    expect(emails.appels).toHaveLength(avant);
    // L'écriture s'est pourtant appliquée : la livraison est bloquée.
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toEqual(RECUE_LE);
    expect((await telecharger(reference)).status).toBe(410);

    // « Réessayer » : la déclaration identique reçoit l'accusé, à l'heure enregistrée, et la commande est remboursée.
    stripe.lirePaiement = lire;
    horloge = new Date(RECUE_LE.getTime() + 5 * 60_000);
    const reessai = await renoncer(declaration(reference));
    expect(reessai.reponse.envoi?.etat).toBe("envoye");
    expect(texte(reessai.reponse.accuse!)).toContain("Envoyée le : 26 septembre 2026 à 10 h 30 (heure de Paris)");
    expect(texte(reessai.reponse.accuse!)).toContain("Statut : rétractation enregistrée — remboursement effectué");
    expect(emails.appels.at(-1)!.cle).toBe(`accuse-${reference}`);
    expect(accuses()).toHaveLength(1);
    expect(stripe.remboursements).toHaveLength(1);
  });

  it("débit limité : à la recherche, cause « stripe_limite » ; pendant la relecture qui suit un échec d'écriture, la cause reste celle de l'écriture", async () => {
    const { reference } = await commandeConfirmee();
    stripe.panneAuProchainAppel = "429";
    expect((await renoncer(declaration(reference, { prenom: "Paul" }))).statut).toBe(503);
    expect(lignesDuJournal()).toContainEqual(expect.objectContaining({ evenement: "declaration_non_transmise", cause: "stripe_limite", reference }));
    stripe.pannesParCle.set(`marque-retractation-${reference}-1`, "500");
    stripe.lirePaiement = async () => {
      throw Object.assign(new Error("trop de requêtes"), { type: "StripeRateLimitError", code: "rate_limit", statusCode: 429 });
    };
    const avant = emails.appels.length;
    const { statut } = await renoncer(declaration(reference));
    expect(statut).toBe(503);
    expect(emails.appels).toHaveLength(avant);
    // La relecture n'a rien dit : la cause est celle de l'écriture.
    expect(lignesDuJournal()).toContainEqual(expect.objectContaining({ evenement: "declaration_non_transmise", cause: "ecriture_impossible", reference }));
  });
});

describe("Resend répond 409", () => {
  const DEJA_PARTI = { de: "x", a: ["y@resend.dev"], copieCachee: [], repondreA: "x", objet: "Accusé de réception", texte: "x", html: "x", piecesJointes: [] };

  it("sur l'accusé de la déclaration qui enregistre, relecture en échec : « en cours de traitement », et rien d'autre ne part", async () => {
    const { reference } = await commandeConfirmee();
    // La clé de son accusé a déjà servi à un autre contenu.
    await emails.envoyer(DEJA_PARTI, `accuse-${reference}`);
    stripe.lirePaiement = async () => {
      throw Object.assign(new Error("panne simulée"), { type: "StripeConnectionError" });
    };
    const avant = emails.appels.length;
    const { statut, reponse } = await renoncer(declaration(reference));
    expect(statut).toBe(202);
    expect(reponse.message!.replace(/[\u00a0\u202f]/g, " ")).toBe(
      "Votre déclaration est en cours de traitement : rechargez la page dans quelques instants.",
    );
    // Un seul appel à Resend, sous la clé de l'accusé : aucune autre clé.
    expect(emails.appels.slice(avant).map(({ cle }) => cle)).toEqual([`accuse-${reference}`]);
    expect(lignesDuJournal()).toContainEqual({ route: "retractation", evenement: "accuse_non_envoye", code: "en_cours", reference });
  });
});

describe("chaque e-mail de la route est compté, par commande", () => {
  const TELECHARGEE_LE = "2026-09-25T14:05:00.000Z";

  /** Les clés Resend de la route de rétractation (la confirmation de commande mise à part). */
  function clesDeLaRoute(): string[] {
    return emails.envoyes.map(({ cle }) => cle).filter((cle) => cle.startsWith("accuse-"));
  }

  it("12 déclarations simultanées sur une commande téléchargée, relectures en 429 : 3 accusés au plus", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.telechargement] = TELECHARGEE_LE;
    stripe.lirePaiement = async () => {
      throw Object.assign(new Error("trop de requêtes"), { type: "StripeRateLimitError", code: "rate_limit", statusCode: 429 });
    };
    emails.delai = 15;
    const prenoms = ["Ada", "Bea", "Cyr", "Dan", "Eve", "Flo", "Gus", "Hugo", "Iris", "Jade", "Kim", "Lou"];
    const reponses = await Promise.all(prenoms.map((prenom) => renoncer(declaration(reference, { prenom }))));
    expect(accuses().length).toBeLessThanOrEqual(3);
    expect(new Set(clesDeLaRoute())).toEqual(new Set(clesDeLaRoute().filter((cle) => /-[123]$/.test(cle))));
    // Aucune ne dit qu'un accusé est parti s'il n'est pas parti.
    const partis = new Set(emails.envoyes.map(({ message }) => message.texte));
    for (const { reponse } of reponses) {
      if (reponse.envoi?.etat === "envoye") expect(partis.has(courrielEnTexte(reponse.accuse!))).toBe(true);
    }
  });

  it("une réponse 500 gardée par Stripe sous accuses-<ref>-1, puis 8 déclarations sur 4 heures : 2 accusés de plus au plus, puis le plafond", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.telechargement] = TELECHARGEE_LE;
    stripe.pannesParCle.set(`accuses-${reference}-1`, "500");
    expect((await renoncer(declaration(reference, { prenom: "Premiere" }))).reponse.envoi?.etat).toBe("envoye");
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).accuses).toBe(0);
    const etats: string[] = [];
    for (let rang = 0; rang < 8; rang += 1) {
      horloge = new Date(RECUE_LE.getTime() + rang * 30 * 60_000);
      etats.push((await renoncer(declaration(reference, { prenom: `Personne${"abcdefgh"[rang]}` }))).reponse.envoi!.etat);
    }
    expect(etats).toEqual(["envoye", "envoye", "plafond", "plafond", "plafond", "plafond", "plafond", "plafond"]);
    expect(clesDeLaRoute().sort()).toEqual([1, 2, 3].map((n) => `accuse-${reference}-${n}`));
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).accuses).toBe(3);
  });

  it("l'ordre qui donnait « en cours » à tort : d1 envoie le n° 1, d3 reçoit 409 sur le n° 1, d2 envoie le n° 2, d3 reçoit son n° 3", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.telechargement] = TELECHARGEE_LE;
    // L'écriture du compteur par d1 reste en suspens le temps que d3 lise, envoie et reçoive son 409.
    let libererD1: () => void = () => {};
    let d1EcritSonCompteur: () => void = () => {};
    const d1Arrete = new Promise<void>((resoudre) => (d1EcritSonCompteur = resoudre));
    let libererD3: () => void = () => {};
    let d3EcritSonCompteur: () => void = () => {};
    const d3Arrete = new Promise<void>((resoudre) => (d3EcritSonCompteur = resoudre));
    let ecrituresDuN1 = 0;
    stripe.avantEcriture = async ({ cle }) => {
      if (cle !== `accuses-${reference}-1`) return;
      ecrituresDuN1 += 1;
      if (ecrituresDuN1 === 1) {
        d1EcritSonCompteur();
        await new Promise<void>((resoudre) => (libererD1 = resoudre));
      } else if (ecrituresDuN1 === 2) {
        d3EcritSonCompteur();
        await new Promise<void>((resoudre) => (libererD3 = resoudre));
      }
    };
    const d1 = renoncer(declaration(reference, { prenom: "Dun" }));
    await d1Arrete;
    horloge = new Date(RECUE_LE.getTime() + 60_000);
    const d3 = renoncer(declaration(reference, { prenom: "Dtrois" }));
    await d3Arrete;
    // d1 finit ; d2 lit le compteur à 1 et envoie le n° 2.
    libererD1();
    expect((await d1).reponse.envoi?.etat).toBe("envoye");
    horloge = new Date(RECUE_LE.getTime() + 120_000);
    const d2 = await renoncer(declaration(reference, { prenom: "Ddeux" }));
    expect(d2.reponse.envoi?.etat).toBe("envoye");
    expect(emails.envoyes.at(-1)!.cle).toBe(`accuse-${reference}-2`);
    // d3 reprend : le n° 2 est pris, il reçoit le n° 3.
    libererD3();
    const troisieme = await d3;
    expect(troisieme.reponse.issue).toBe("accuse");
    expect(troisieme.reponse.envoi?.etat).toBe("envoye");
    expect(emails.envoyes.at(-1)!.cle).toBe(`accuse-${reference}-3`);
    expect(clesDeLaRoute().sort()).toEqual([1, 2, 3].map((n) => `accuse-${reference}-${n}`));
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).accuses).toBe(3);
  });

  it("l'ordre qui faisait reculer le compteur : l'écriture retardée de d1 est rejouée sans effet ; 25 h plus tard, un seul accusé de plus", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.telechargement] = TELECHARGEE_LE;
    let libererD1: () => void = () => {};
    let d1Retenu: () => void = () => {};
    const d1Arrete = new Promise<void>((resoudre) => (d1Retenu = resoudre));
    let premiere = true;
    stripe.avantEcriture = async ({ cle }) => {
      if (cle === `accuses-${reference}-1` && premiere) {
        premiere = false;
        d1Retenu();
        await new Promise<void>((resoudre) => (libererD1 = resoudre));
      }
    };
    const d1 = renoncer(declaration(reference, { prenom: "Dun" }));
    await d1Arrete;
    horloge = new Date(RECUE_LE.getTime() + 60_000);
    // d3 : 409 sur le n° 1, écrit accuses = 1, envoie le n° 2 et écrit 2.
    const d3 = await renoncer(declaration(reference, { prenom: "Dtrois" }));
    expect(d3.reponse.envoi?.etat).toBe("envoye");
    expect(emails.envoyes.at(-1)!.cle).toBe(`accuse-${reference}-2`);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).accuses).toBe(2);
    // L'écriture de d1 arrive ensuite : rejouée par Stripe, sans effet.
    libererD1();
    expect((await d1).reponse.envoi?.etat).toBe("envoye");
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).accuses).toBe(2);
    const compteurs = stripe.modifications.filter((m) => CLES.accuses in m.metadonnees).map((m) => m.metadonnees[CLES.accuses]);
    expect(compteurs).toEqual(["1", "2"]);

    // 25 heures plus tard, Resend et Stripe ont oublié leurs clés : trois déclarations, un seul accusé de plus (n° 3).
    emails.oublierLesCles();
    stripe.oublierLesClesDIdempotence();
    const etats: string[] = [];
    for (const [rang, prenom] of ["Eun", "Edeux", "Etrois"].entries()) {
      horloge = new Date(RECUE_LE.getTime() + 25 * 3_600_000 + rang * 60_000);
      etats.push((await renoncer(declaration(reference, { prenom }))).reponse.envoi!.etat);
    }
    expect(etats).toEqual(["envoye", "plafond", "plafond"]);
    expect(clesDeLaRoute().sort()).toEqual([1, 2, 3].map((n) => `accuse-${reference}-${n}`));
  });

  it("le faux Resend garde, ou non, la clé d'un envoi en échec : le plafond tient dans les deux cas", async () => {
    for (const garder of [false, true]) {
      stripe = new FauxStripe();
      emails = new FauxEmail();
      emails.garderLesClesEnEchec = garder;
      injection.deps = deps();
      const { reference, paiement } = await commandeConfirmee();
      stripe.paiements.get(paiement.id)!.metadonnees[CLES.telechargement] = TELECHARGEE_LE;
      emails.panneAuProchainEnvoi = true;
      const echec = await renoncer(declaration(reference, { prenom: "Premiere" }));
      expect(echec.reponse.envoi?.etat, String(garder)).toBe("echec");
      for (const [rang, prenom] of ["Ada", "Bea", "Cyr", "Dan", "Eve"].entries()) {
        horloge = new Date(RECUE_LE.getTime() + (rang + 1) * 60_000);
        await renoncer(declaration(reference, { prenom }));
      }
      // Gardée, la clé du n° 1 compte comme partie sans qu'aucun e-mail soit parti : deux accusés seulement.
      expect(accuses().length, String(garder)).toBe(garder ? 2 : 3);
      expect(clesDeLaRoute().every((cle) => /^accuse-.+-[123]$/.test(cle)), String(garder)).toBe(true);
      expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).accuses, String(garder)).toBe(3);
    }
  });
});

describe("l'état réel du remboursement, lu sur les remboursements eux-mêmes", () => {
  it("en attente puis effectué : l'accusé dit « demandé », puis « effectué » ; la tâche ne crée pas de second remboursement", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.statutDesNouveauxRemboursements = "pending";
    const { reponse } = await renoncer(declaration(reference));
    const corps = texte(reponse.accuse!);
    expect(corps).toContain("Statut : rétractation enregistrée — remboursement demandé");
    expect(corps).toContain(
      "Nous avons demandé le remboursement de 12,90 € sur la carte utilisée pour le paiement ; il apparaît sur votre compte selon les délais de votre banque.",
    );
    expect(stripe.remboursements).toHaveLength(1);
    // La tâche quotidienne voit le remboursement en attente : pas de second remboursement.
    const demandes = stripe.demandesDeRemboursement.length;
    await tacheQuotidienne(deps({ maintenant: () => new Date("2026-09-27T03:00:00.000Z") }));
    expect(stripe.demandesDeRemboursement).toHaveLength(demandes);
    expect(stripe.remboursements).toHaveLength(1);
    // Réglé chez Stripe : une autre déclaration lit « effectué ».
    stripe.reglerRemboursement(stripe.remboursements[0]!.id, "succeeded");
    horloge = new Date(RECUE_LE.getTime() + 3_600_000);
    const autre = await renoncer(declaration(reference, { prenom: "Paul" }));
    expect(texte(autre.reponse.accuse!)).toContain("Statut : rétractation déjà enregistrée — remboursement effectué");
    expect(rembourseEnTotalite(stripe.paiements.get(paiement.id)!)).toBe(true);
  });

  it("un remboursement qui échoue chez Stripe (failed) est retenté par la tâche quotidienne, une fois", async () => {
    const { reference } = await commandeConfirmee();
    stripe.statutDesNouveauxRemboursements = "pending";
    await renoncer(declaration(reference));
    stripe.reglerRemboursement(stripe.remboursements[0]!.id, "failed");
    stripe.statutDesNouveauxRemboursements = "succeeded";
    const bilan = await tacheQuotidienne(deps({ maintenant: () => new Date("2026-09-27T03:00:00.000Z") }));
    expect(bilan.remboursements).toMatchObject({ remboursementsRetentes: 1, remboursementsReussis: 1 });
    expect(stripe.remboursements).toHaveLength(2);
    expect(stripe.demandesDeRemboursement.at(-1)!.cle).toBe(`retractation-${reference}-2026-09-27`);
    // Au passage suivant, le remboursement effectué suffit : aucun troisième.
    await tacheQuotidienne(deps({ maintenant: () => new Date("2026-09-27T15:00:00.000Z") }));
    expect(stripe.remboursements).toHaveLength(2);
  });

  it("un remboursement en attente fait depuis le tableau de bord, hors rétractation : kit refusé, aucune confirmation", async () => {
    horloge = PAYEE_LE;
    expect((await commanderRoute(requeteJson("http://localhost/api/commande", corpsDeCommande()))).status).toBe(200);
    const { reference, paiement, sessionId } = stripe.payer({ payeLe: PAYEE_LE });
    stripe.rembourserHorsSite(paiement.id, "pending");
    horloge = new Date(PAYEE_LE.getTime() + 2 * 3_600_000);
    const confirmation = await confirmationPost(
      requeteJson(`http://localhost/api/commande/${reference}/confirmation`, { session_id: sessionId }),
      { params: Promise.resolve({ ref: reference }) },
    );
    expect(confirmation.status).toBe(409);
    expect(await confirmation.json()).toEqual({ etat: "remboursement_demande" });
    expect((await telecharger(reference)).status).toBe(410);
    const bilan = await tacheQuotidienne(deps());
    expect(bilan.confirmations.confirmationsEnvoyees).toBe(0);
    expect(emails.appels.filter(({ cle }) => cle.startsWith("confirmation-"))).toHaveLength(0);
  });
});

describe("un paiement sans boutique n'est jamais une commande", () => {
  it("retrouvé par sa référence ou par sa session : introuvable pour le kit, la confirmation et la rétractation", async () => {
    horloge = PAYEE_LE;
    expect((await commanderRoute(requeteJson("http://localhost/api/commande", corpsDeCommande()))).status).toBe(200);
    const { reference, sessionId } = stripe.payer({ payeLe: PAYEE_LE, sansBoutique: true });
    // Une recherche qui le rendrait quand même : le paiement est revérifié.
    stripe.rechercheIgnoreLaBoutique = true;
    horloge = RECUE_LE;
    for (const corps of [{}, { session_id: sessionId }]) {
      const ici = JSON.stringify(corps);
      const kit = await kitPost(requeteJson(`http://localhost/api/commande/${reference}/kit`, corps), {
        params: Promise.resolve({ ref: reference }),
      });
      expect(kit.status, ici).toBe(404);
      expect(((await kit.json()) as { etat: string }).etat, ici).toBe("introuvable");
      const confirmation = await confirmationPost(requeteJson(`http://localhost/api/commande/${reference}/confirmation`, corps), {
        params: Promise.resolve({ ref: reference }),
      });
      // La route de la confirmation refuse tout ce qui n'est pas une commande payée (409), en disant pourquoi.
      expect(confirmation.status, ici).toBe(409);
      expect(await confirmation.json(), ici).toEqual({ etat: "introuvable" });
      const { statut, reponse } = await renoncer(declaration(reference, corps));
      expect(statut, ici).toBe(404);
      expect(reponse.message!.replace(/[\u00a0\u202f]/g, " "), ici).toBe(
        "Nous ne trouvons aucune commande payée sous cette référence : votre déclaration n'a pas été transmise et aucun accusé de réception ne partira.",
      );
    }
    expect(emails.appels).toHaveLength(0);
    expect(stripe.modifications).toHaveLength(0);
  });
});

describe("commande « à examiner »", () => {
  it("l'accusé annonce l'examen par le vendeur, sans promettre qu'aucun remboursement ne sera fait", async () => {
    const { reference, paiement } = await commandeConfirmee();
    const meta = stripe.paiements.get(paiement.id)!.metadonnees;
    meta[CLES.retractation] = "2026-09-25T08:00:00.000Z";
    meta[CLES.telechargement] = "2026-09-25T08:00:00.300Z";
    const { reponse } = await renoncer(declaration(reference, { prenom: "Paul" }));
    const corps = texte(reponse.accuse!);
    expect(corps).toContain("Statut : déclaration traitée à la main par le vendeur, qui vous répond sous 7 jours");
    expect(corps).toContain(
      "Votre déclaration est bien reçue, mais elle n'a pas pu être traitée automatiquement : le vendeur la traite à la main et vous répond sous 7 jours au plus.",
    );
    // Faux dès que la route du kit, perdante, écrit course = retractation et que la tâche rembourse.
    expect(corps).not.toContain("Aucun remboursement");
    expect(emails.appels.at(-1)!.cle).toBe(`accuse-${reference}-1`);
    expect(stripe.demandesDeRemboursement).toHaveLength(0);
  });
});

describe("après la fin du délai, jamais « arrivée en même temps »", () => {
  const TARDIVE = new Date("2026-10-10T08:00:00.000Z");

  it("commande déjà rétractée : « rétractation déjà enregistrée »", async () => {
    const { reference } = await commandeConfirmee();
    await renoncer(declaration(reference));
    horloge = TARDIVE;
    const { reponse } = await renoncer(declaration(reference, { prenom: "Paul" }));
    expect(texte(reponse.accuse!)).toContain("Statut : rétractation déjà enregistrée");
  });

  it("premier téléchargement écrit après la réception de la déclaration : « délai de rétractation expiré »", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.telechargement] = new Date(TARDIVE.getTime() + 3_600_000).toISOString();
    horloge = TARDIVE;
    const { reponse } = await renoncer(declaration(reference));
    const corps = texte(reponse.accuse!);
    expect(corps).toContain("Statut : délai de rétractation expiré");
    expect(corps).not.toContain("arrivée en même temps");
  });

  it("premier téléchargement commencé avant la fin du délai : « droit de rétractation éteint au premier téléchargement »", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.telechargement] = "2026-10-08T15:00:00.000Z";
    horloge = TARDIVE;
    const { reponse } = await renoncer(declaration(reference));
    expect(texte(reponse.accuse!)).toContain("Statut : droit de rétractation éteint au premier téléchargement");
  });
});

describe("entrées strictes", () => {
  it("refuse une à une les entrées qui pourraient porter un lien, une adresse ou un texte déguisé", async () => {
    const refusees: [string, Record<string, unknown>][] = [
      ["chiffre dans le nom", { nom: "Martin2" }],
      ["@ dans le prénom", { prenom: "camille@exemple" }],
      ["deux-points", { nom: "https:Martin" }],
      ["barre oblique", { nom: "Martin/Durand" }],
      ["point", { nom: "exemple.fr" }],
      ["caractère de contrôle", { nom: "Mar\u0007tin" }],
      ["retour à la ligne", { prenom: "Cam\nille" }],
      ["sens de lecture inversé", { nom: "Mar‮tin" }],
      ["isolat de sens de lecture", { prenom: "⁧Camille⁩" }],
      ["espace sans chasse", { nom: "Mar​tin" }],
      ["nom vide", { nom: "" }],
      ["prénom d'espaces", { prenom: "   " }],
      ["nom sans lettre", { nom: "'-'" }],
      ["nom de 61 caractères", { nom: "a".repeat(61) }],
      // Caractères ignorables par défaut : invisibles, ils déguiseraient un nom.
      ["U+034F (graphème combinant)", { nom: "Mar\u034Ftin" }],
      ["sélecteur de variante U+FE0F", { nom: "Martin\uFE0F" }],
      ["sélecteur de variante U+E0100", { prenom: "Cam\u{E0100}ille" }],
      ["remplisseur coréen U+115F", { nom: "\u115FMartin" }],
      ["remplisseur coréen U+1160", { nom: "Mar\u1160tin" }],
      ["remplisseur coréen U+3164", { prenom: "\u3164" }],
      ["remplisseur coréen U+FFA0", { prenom: "Cam\uFFA0ille" }],
      // Plus de trois signes combinants à la suite, même après normalisation.
      ["q suivi de quatre signes combinants", { prenom: "q\u0303\u0301\u0323\u0304" }],
      ["nom de 241 caractères avant normalisation", { nom: "e\u0301".repeat(120) + "e" }],
      ["référence de 21 caractères", { reference: "A".repeat(21) }],
      ["référence de 23 caractères", { reference: "A".repeat(23) }],
      ["référence fantaisiste", { reference: "ma commande de mardi" }],
      ["lien vers une référence trop longue", { reference: `https://x/commande/${"A".repeat(23)}` }],
      ["e-mail invalide", { email: "pas-une-adresse" }],
      ["e-mail de 255 caractères", { email: `${"a".repeat(244)}@exemple.fr` }],
      ["session au mauvais format", { session_id: "pi_123" }],
      ["champ inattendu", { inattendu: "x" }],
    ];
    for (const [nom, partiel] of refusees) {
      const { statut } = await renoncer(declaration(INVENTEE, partiel));
      expect(statut, nom).toBe(422);
    }
    expect(stripe.recherchesParReference).toHaveLength(0);
    expect(emails.appels).toHaveLength(0);
  });

  it("accepte les noms de toute écriture, accentués en forme décomposée, et le lien d'une commande", async () => {
    const { reference, paiement } = await commandeConfirmee();
    const decompose = "Hélène";
    await renoncer(declaration(`www.missiongateau.com/commande/${reference}`, { nom: "O’Brien-Dupont", prenom: decompose }));
    const meta = stripe.paiements.get(paiement.id)!.metadonnees;
    expect(meta[CLES.retractation]).toBeDefined();
    // Gardé en forme NFC : l'accusé porte « Hélène », composé.
    const corps = accuses()[0]!.message.texte.replace(/[\u00a0\u202f]/g, " ");
    expect(corps).toContain("Prénom : Hélène");
    expect(corps).toContain("Nom : O’Brien-Dupont");
    expect(meta[CLES.empreinteRetractation]).toBe(
      empreinteDeDeclaration({ nom: "O’Brien-Dupont", prenom: "Hélène", reference, email: SAISIE }),
    );
    for (const [nom, prenom] of [
      ["Παπαδοπούλου", "Ελένη"],
      ["Иванова", "Анна-Мария"],
      ["D'Artagnan", "Jean Pierre"],
      ["Nguyễn", "Thị"],
      // « Nguyễn » en forme décomposée : e, accent circonflexe, tilde, qui deviennent une seule lettre après NFC.
      ["Nguye\u0302\u0303n", "Thi\u0323"],
      // Trois signes combinants à la suite restent acceptés.
      ["Martin", "q\u0303\u0301\u0323"],
      // Une lettre d'une autre écriture qui imite une ponctuation reste acceptée : rien n'y est cliquable.
      ["Martinꓸ", "Camille"],
    ]) {
      expect((await renoncer(declaration(INVENTEE, { nom, prenom }))).statut, `${prenom} ${nom}`).toBe(404);
    }
  });

  it("extrait la référence de ce qui ressemble au lien d'une commande, même entouré de ponctuation, et de rien d'autre", () => {
    const ref = "AbCdEfGhIjKlMnOpQrSt-_";
    const lien = `https://www.missiongateau.com/commande/${ref}`;
    expect(extraireReference(ref)).toBe(ref);
    expect(extraireReference(`  ${ref}  `)).toBe(ref);
    expect(extraireReference(`/commande/${ref}`)).toBe(ref);
    expect(extraireReference(`${lien}?session_id=cs_test_abcdefgh#x`)).toBe(ref);
    expect(extraireReference(`${lien}/`)).toBe(ref);
    expect(extraireReference(`voici le lien : ${lien} merci`)).toBe(ref);
    // Un lien collé entouré de ponctuation.
    expect(extraireReference(`(${lien})`)).toBe(ref);
    expect(extraireReference(`${lien}.`)).toBe(ref);
    expect(extraireReference(`<${lien}>`)).toBe(ref);
    expect(extraireReference(`${lien}, merci`)).toBe(ref);
    // 21 ou 23 caractères, un caractère de trop collé, deux commandes différentes : refusés.
    expect(extraireReference(`https://x/commande/${ref.slice(1)}`)).toBeNull();
    expect(extraireReference(`https://x/commande/${ref}x`)).toBeNull();
    expect(extraireReference(`(https://x/commande/${ref}A)`)).toBeNull();
    expect(extraireReference(`${lien} et https://x/commande/${"B".repeat(22)}`)).toBeNull();
    expect(extraireReference(`${lien} ${lien}.`)).toBe(ref);
    expect(extraireReference(`https://x/commande/${ref}‮`)).toBeNull();
    expect(extraireReference("pas une référence")).toBeNull();
    expect(extraireReference(ref.slice(1))).toBeNull();
    expect(extraireReference(`${ref}A`)).toBeNull();
  });
});

describe("la route", () => {
  it("hors production, n'écrit qu'aux adresses de test et au vendeur, et dit où l'accusé est parti", async () => {
    injection.deps = deps({ env: environnement() });
    const { reference } = await commandeConfirmee();
    const { reponse } = await renoncer(declaration(reference));
    expect(reponse.envoi).toEqual({ etat: "envoye", adresse: "delivered@resend.dev", saisie: SAISIE, remplacee: true });
    const { message } = accuses()[0]!;
    expect(message.a).toEqual(["delivered@resend.dev"]);
    expect(message.copieCachee).toEqual([VENDEUR.email]);
  });

  it("ne dit jamais si l'adresse saisie est celle de l'acheteur", async () => {
    const acheteur = await commandeConfirmee();
    const avecSaAdresse = await renoncer(declaration(acheteur.reference, { email: EMAIL_ACHETEUR.toUpperCase() }));
    const autre = await commandeConfirmee();
    const avecUneAutre = await renoncer(declaration(autre.reference));
    for (const { reponse } of [avecSaAdresse, avecUneAutre]) {
      expect(Object.keys(reponse.envoi!).sort()).toEqual(["adresse", "etat", "remplacee", "saisie"]);
      expect(JSON.stringify(reponse)).not.toContain("copieAcheteur");
    }
    // Les deux réponses ont la même forme : rien n'y distingue l'adresse de l'acheteur d'une autre.
    expect(avecSaAdresse.reponse.envoi!.remplacee).toBe(avecUneAutre.reponse.envoi!.remplacee);
    // Sa propre adresse : pas de copie en plus. Une autre : une copie cachée à l'acheteur.
    expect(accuses()[0]!.message.copieCachee).toEqual([VENDEUR.email]);
    expect(accuses()[1]!.message.copieCachee).toEqual([EMAIL_ACHETEUR, VENDEUR.email]);
  });

  it("le champ piège rempli : refusée, sans rien faire ni rien envoyer", async () => {
    const { reference, paiement } = await commandeConfirmee();
    const avant = emails.appels.length;
    const { statut } = await renoncer(declaration(reference, { champ_libre: "https://pourriel.example" }));
    expect(statut).toBe(400);
    expect(emails.appels).toHaveLength(avant);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toBeNull();
  });

  it("borne la taille de la requête, et refuse une simple visite", async () => {
    const lourde = await renoncerPost(requeteJson("http://localhost/api/renoncer", declaration(INVENTEE, { nom: "x".repeat(5000) })));
    expect(lourde.status).toBe(413);
    expect(renoncerGet().status).toBe(405);
    expect(emails.appels).toHaveLength(0);
  });

  it("n'écrit dans les journaux ni nom, ni adresse, ni donnée du jeu", async () => {
    const { reference } = await commandeConfirmee();
    await renoncer(declaration(reference, { nom: "Zéphyrine" }));
    await renoncer(declaration(INVENTEE, { nom: "Zéphyrine" }));
    stripe.enPanne = true;
    await renoncer(declaration(reference, { nom: "Zéphyrine" }));
    const tout = journaux.join("\n");
    expect(marquesDans(tout)).toEqual([]);
    expect(tout).not.toContain(SAISIE);
    expect(tout).not.toContain("Martin");
    expect(tout).not.toContain("Camille");
  });
});
