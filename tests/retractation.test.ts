import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    expect(stripe.paiements.get(paiement.id)!.rembourseEnTotalite).toBe(false);
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

    // « Renvoyer », deux minutes plus tard : la même déclaration.
    emails.refuse = false;
    horloge = new Date(RECUE_LE.getTime() + 120_000);
    const renvoi = await renoncer(declaration(reference));
    expect(renvoi.reponse.envoi?.etat).toBe("envoye");
    expect(accuses()).toHaveLength(1);
    expect(texte(renvoi.reponse.accuse!)).toContain("Envoyée le : 26 septembre 2026 à 10 h 30 (heure de Paris)");
    expect(texte(renvoi.reponse.accuse!)).toBe(texte(premiere.reponse.accuse!));
    // Exactement la même requête, sous la même clé : Resend ne renvoie rien de plus.
    const appels = emails.appels.filter(({ cle }) => cle === `accuse-${reference}`);
    expect(appels).toHaveLength(2);
    expect(empreinteDe(appels[1]!.message)).toBe(empreinteDe(appels[0]!.message));
    horloge = new Date(RECUE_LE.getTime() + 600_000);
    const encore = await renoncer(declaration(reference));
    expect(encore.reponse.envoi?.etat).toBe("envoye");
    expect(accuses()).toHaveLength(1);
    expect(stripe.remboursements).toHaveLength(1);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).accuses).toBe(0);
  });

  it("est reconnue à son empreinte même après trois accusés aux autres déclarations : hors plafond", async () => {
    const { reference } = await commandeConfirmee();
    await renoncer(declaration(reference));
    for (const prenom of ["Léa", "Paul", "Zoé", "Noé"]) await renoncer(declaration(reference, { prenom }));
    expect(accuses()).toHaveLength(4);
    const identique = await renoncer(declaration(reference));
    expect(identique.reponse.envoi?.etat).toBe("envoye");
    expect(emails.appels.at(-1)!.cle).toBe(`accuse-${reference}`);
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

  it("clé déjà servie chez Resend (409) : relit le paiement, compte ce numéro et passe au suivant", async () => {
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

describe("commande retrouvée, mais Stripe refuse une écriture", () => {
  it("l'accusé part quand même, « traitée à la main par le vendeur », hors plafond, sans remboursement", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.accuses] = "3";
    stripe.metadonneesEnPanne = true;
    const { statut, reponse } = await renoncer(declaration(reference));
    expect(statut).toBe(200);
    expect(reponse.envoi?.etat).toBe("envoye");
    const corps = texte(reponse.accuse!);
    expect(corps).toContain("Statut : déclaration traitée à la main par le vendeur, qui vous répond sous 7 jours");
    expect(corps).toContain("le vendeur la traite à la main et vous répond sous 7 jours au plus");
    expect(corps).not.toContain("n'a pas encore pu être reliée");
    expect(stripe.demandesDeRemboursement).toHaveLength(0);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toBeNull();
    // La copie cachée au vendeur porte ce statut ; la clé est propre à cette déclaration.
    const { message, cle } = accuses()[0]!;
    expect(message.copieCachee).toContain(VENDEUR.email);
    expect(message.texte).toContain("traitée à la main");
    expect(cle).toMatch(new RegExp(`^accuse-${reference}-manuel-[0-9a-f]{16}$`));
    expect(lignesDuJournal()).toContainEqual({ route: "retractation", evenement: "enregistrement_impossible", reference });
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
    ]) {
      expect((await renoncer(declaration(INVENTEE, { nom, prenom }))).statut, `${prenom} ${nom}`).toBe(404);
    }
  });

  it("extrait la référence de ce qui ressemble au lien d'une commande, et de rien d'autre", () => {
    const ref = "AbCdEfGhIjKlMnOpQrSt-_";
    expect(extraireReference(ref)).toBe(ref);
    expect(extraireReference(`  ${ref}  `)).toBe(ref);
    expect(extraireReference(`/commande/${ref}`)).toBe(ref);
    expect(extraireReference(`https://www.missiongateau.com/commande/${ref}?session_id=cs_test_abcdefgh#x`)).toBe(ref);
    expect(extraireReference(`https://www.missiongateau.com/commande/${ref}/`)).toBe(ref);
    expect(extraireReference(`voici le lien : https://www.missiongateau.com/commande/${ref} merci`)).toBe(ref);
    expect(extraireReference(`https://x/commande/${ref}x`)).toBeNull();
    expect(extraireReference(`https://x/?page=/commande/${ref}`)).toBeNull();
    expect(extraireReference(`https://x/commande/${ref}‮`)).toBeNull();
    expect(extraireReference("pas une référence")).toBeNull();
    expect(extraireReference(ref.slice(1))).toBeNull();
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
