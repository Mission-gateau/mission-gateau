import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dependances } from "@/vente/dependances";

/**
 * La fonction « Renoncer au contrat ici », éprouvée par sa vraie route, sur
 * des commandes passées, payées et confirmées par les vraies routes. Chaque
 * cas de la déclaration est jugé sur le paiement lui-même.
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
import { CLES, lireSuivi } from "@/vente/metadonnees";
import { extraireReference } from "@/vente/retractation";
import { FauxEmail } from "./fauxEmail";
import {
  CLE_REELLE,
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
async function commandeConfirmee(options: { payeLe?: Date; email?: string } = {}) {
  horloge = options.payeLe ?? PAYEE_LE;
  expect((await commanderRoute(requeteJson("http://localhost/api/commande", corpsDeCommande()))).status).toBe(200);
  const reglee = stripe.payer({ payeLe: horloge, email: options.email });
  const confirmation = await confirmationPost(requeteJson(`http://localhost/api/commande/${reglee.reference}/confirmation`, {}), {
    params: Promise.resolve({ ref: reglee.reference }),
  });
  expect(confirmation.status).toBe(200);
  horloge = RECUE_LE;
  return reglee;
}

interface Reponse {
  issue: "accuse" | "deja_enregistree";
  accuse?: DocumentCourriel;
  envoi?: { etat: string; adresse?: string; saisie?: string; remplacee?: boolean; copieAcheteur?: boolean };
  date?: string;
  heure?: string;
  remboursement?: string;
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
  return courrielEnTexte(document).replace(/[  ]/g, " ");
}

describe("rétractation valable", () => {
  it("l'enregistre à l'heure de réception, bloque la livraison, rembourse tout par Stripe et en accuse réception", async () => {
    const { reference, paiement } = await commandeConfirmee();
    const { statut, reponse } = await renoncer(declaration(reference));
    expect(statut).toBe(200);
    expect(reponse.issue).toBe("accuse");

    // Enregistrée, à l'heure du serveur.
    expect(stripe.paiements.get(paiement.id)!.metadonnees[CLES.retractation]).toBe(RECUE_LE.toISOString());
    // Remboursée en totalité, avec la clé d'idempotence tirée de la référence.
    expect(stripe.demandesDeRemboursement).toEqual([
      { id: paiement.id, cle: `retractation-${reference}`, metadonnees: { ref: reference, motif: "retractation" } },
    ]);
    expect(stripe.remboursements).toHaveLength(1);
    // La livraison est bloquée.
    const kit = await telecharger(reference);
    expect(kit.status).toBe(410);
    expect(((await kit.json()) as { etat: string }).etat).toBe("retractee");

    // Un accusé de réception, à l'adresse saisie, copie cachée au vendeur et à l'acheteur (adresse différente).
    expect(accuses()).toHaveLength(1);
    const { message, cle } = accuses()[0]!;
    expect(cle).toBe(`accuse-${reference}`);
    expect(message.a).toEqual([SAISIE]);
    expect(message.copieCachee).toEqual([EMAIL_ACHETEUR, VENDEUR.email]);
    expect(message.repondreA).toBe(VENDEUR.email);
    expect(message.de).toBe("Mission Gâteau <commandes@missiongateau.com>");
    expect(message.piecesJointes).toEqual([]);
    expect(stripe.paiements.get(paiement.id)!.metadonnees[CLES.accuseRetractation]).toBe(accuses()[0]!.id);

    // Le contenu de la déclaration, la date et l'heure de son envoi, et la suite donnée.
    const corps = message.texte.replace(/[  ]/g, " ");
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
    // La page affiche exactement ce contenu, et dit où l'accusé est parti.
    expect(texte(reponse.accuse!)).toBe(corps);
    expect(reponse.envoi).toEqual({ etat: "envoye", adresse: SAISIE, saisie: SAISIE, remplacee: false, copieAcheteur: true });
  });

  it("accepte le lien complet de la commande à la place de la référence", async () => {
    const { reference, paiement } = await commandeConfirmee();
    await renoncer(declaration(`  https://mission-gateau.vercel.app/commande/${reference}?session_id=cs_test_abc  `));
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).not.toBeNull();
    expect(extraireReference(reference)).toBe(reference);
    expect(extraireReference(`/commande/${reference}`)).toBe(reference);
    expect(extraireReference("pas une référence")).toBeNull();
    expect(extraireReference(`https://x/commande/${reference}x`)).toBeNull();
  });

  it("remboursement en échec : l'accusé promet le remboursement sous 14 jours, la copie au vendeur le signale", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.remboursementEnPanne = true;
    const { reponse } = await renoncer(declaration(reference));
    expect(stripe.paiements.get(paiement.id)!.rembourseEnTotalite).toBe(false);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).not.toBeNull();
    const corps = texte(reponse.accuse!);
    expect(corps).toContain("Statut : rétractation enregistrée — remboursement à venir");
    expect(corps).toContain("Nous vous rembourserons 12,90 € sur la carte utilisée pour le paiement, sous 14 jours au plus.");
    // La copie cachée au vendeur porte ce même statut.
    expect(accuses()[0]!.message.copieCachee).toContain(VENDEUR.email);
    expect(journaux.join("\n")).toContain("remboursement_impossible");
  });

  it("déjà remboursée hors rétractation : l'accusé le dit, sans nouveau remboursement", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.rembourserHorsSite(paiement.id);
    const { reponse } = await renoncer(declaration(reference));
    expect(stripe.demandesDeRemboursement).toHaveLength(0);
    expect(texte(reponse.accuse!)).toContain("Statut : rétractation enregistrée — commande déjà remboursée");
    expect(texte(reponse.accuse!)).toContain("Cette commande avait déjà été remboursée en totalité");
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

  it("un seul remboursement et un seul accusé par commande, même déclarée deux fois", async () => {
    const { reference } = await commandeConfirmee();
    await renoncer(declaration(reference));
    horloge = new Date(RECUE_LE.getTime() + 60_000);
    const { statut, reponse } = await renoncer(declaration(reference, { email: "autre@exemple.fr" }));
    expect(statut).toBe(200);
    expect(reponse).toEqual({
      issue: "deja_enregistree",
      date: "26 septembre 2026",
      heure: "10 h 30",
      remboursement: "effectue",
    });
    expect(stripe.remboursements).toHaveLength(1);
    expect(accuses()).toHaveLength(1);
  });

  it("un seul remboursement et un seul accusé, même déclarée deux fois en même temps", async () => {
    const { reference } = await commandeConfirmee();
    emails.delai = 30;
    const reponses = await Promise.all([renoncer(declaration(reference)), renoncer(declaration(reference))]);
    expect(reponses.every(({ statut }) => statut === 200)).toBe(true);
    expect(stripe.remboursements).toHaveLength(1);
    expect(accuses()).toHaveLength(1);
  });

  it("accusé en échec : la page propose de le renvoyer, et le renvoi part une seule fois, à l'heure enregistrée", async () => {
    const { reference, paiement } = await commandeConfirmee();
    emails.refuse = true;
    const premiere = await renoncer(declaration(reference));
    expect(premiere.reponse.envoi).toEqual({ etat: "echec" });
    // La rétractation est enregistrée et remboursée quand même.
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).not.toBeNull();
    expect(stripe.remboursements).toHaveLength(1);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).accuseRetractation).toBeNull();

    emails.refuse = false;
    horloge = new Date(RECUE_LE.getTime() + 120_000);
    const renvoi = await renoncer(declaration(reference));
    expect(renvoi.reponse.issue).toBe("accuse");
    expect(renvoi.reponse.envoi?.etat).toBe("envoye");
    expect(accuses()).toHaveLength(1);
    // L'heure de la déclaration reste celle qui a été enregistrée.
    expect(texte(renvoi.reponse.accuse!)).toContain("Envoyée le : 26 septembre 2026 à 10 h 30 (heure de Paris)");
    expect(stripe.remboursements).toHaveLength(1);
    // Ensuite : déjà enregistrée, plus aucun e-mail.
    expect((await renoncer(declaration(reference))).reponse.issue).toBe("deja_enregistree");
    expect(accuses()).toHaveLength(1);
  });
});

describe("droit de rétractation éteint", () => {
  it("après le premier téléchargement : l'accusé l'explique, sans remboursement, et la livraison continue", async () => {
    const { reference, paiement } = await commandeConfirmee();
    horloge = new Date("2026-09-25T14:05:00.000Z");
    expect((await telecharger(reference)).status).toBe(200);
    horloge = RECUE_LE;
    const { reponse } = await renoncer(declaration(reference));
    const corps = texte(reponse.accuse!);
    expect(corps).toContain("Statut : droit de rétractation éteint au premier téléchargement");
    expect(corps).toContain(
      "Votre droit de rétractation a pris fin au début du premier téléchargement de votre jeu, le 25 septembre 2026 à 16 h 05 (heure de Paris), comme vous l'aviez demandé et reconnu avant de payer (article L221-28, 13° du Code de la consommation).",
    );
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toBeNull();
    expect(stripe.demandesDeRemboursement).toHaveLength(0);
    expect((await telecharger(reference)).status).toBe(200);
    expect(accuses()).toHaveLength(1);
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

  it("tardive à Paris mais pas encore à UTC−12 : la rétractation est valable", async () => {
    const { reference, paiement } = await commandeConfirmee();
    // 1 h 30 du matin à Paris, le vendredi 9 octobre : le 8 n'est pas fini partout sur Terre.
    horloge = new Date("2026-10-08T23:30:00.000Z");
    await renoncer(declaration(reference));
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).not.toBeNull();
    expect(stripe.remboursements).toHaveLength(1);
  });

  it("tardive partout : refusée, au-delà de midi UTC le lendemain du dernier jour", async () => {
    const { reference, paiement } = await commandeConfirmee();
    horloge = new Date("2026-10-09T12:00:00.000Z");
    const { reponse } = await renoncer(declaration(reference));
    expect(texte(reponse.accuse!)).toContain("délai de rétractation expiré");
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toBeNull();
  });

  it("ne tient compte ni de l'état « expirée » ni de « illisible » de la page de commande : seul le paiement compte", async () => {
    const { reference, paiement } = await commandeConfirmee();
    // Configuration illisible : la page dirait « ne peut pas être relue ».
    stripe.paiements.get(paiement.id)!.metadonnees.config_0 = "AAAA";
    await renoncer(declaration(reference));
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).not.toBeNull();
    expect(stripe.remboursements).toHaveLength(1);
  });
});

describe("paiement introuvable", () => {
  async function nonReliee(reference: string) {
    const { statut, reponse } = await renoncer(declaration(reference));
    expect(statut).toBe(200);
    expect(reponse.issue).toBe("accuse");
    const corps = texte(reponse.accuse!);
    expect(corps).toContain("Statut : déclaration à examiner par le vendeur");
    expect(corps).toContain("Votre déclaration n'a pas encore pu être reliée à une commande. Nous l'examinons et vous répondons sous 7 jours au plus.");
    return reponse;
  }

  it("référence inconnue : l'accusé part quand même, avec une copie au vendeur pour traitement à la main", async () => {
    const reponse = await nonReliee("AAAAAAAAAAAAAAAAAAAAAA");
    expect(reponse.envoi?.etat).toBe("envoye");
    const { message } = accuses()[0]!;
    expect(message.a).toEqual([SAISIE]);
    expect(message.copieCachee).toEqual([VENDEUR.email]);
    expect(stripe.demandesDeRemboursement).toHaveLength(0);
  });

  it("référence fantaisiste : pas même cherchée chez Stripe, et l'accusé reprend ce qui a été saisi", async () => {
    const reponse = await nonReliee("ma commande de mardi");
    expect(stripe.recherchesParReference).toHaveLength(0);
    expect(texte(reponse.accuse!)).toContain("Référence de la commande : ma commande de mardi");
  });

  it("paiement pas encore visible dans la recherche de Stripe", async () => {
    horloge = PAYEE_LE;
    await commanderRoute(requeteJson("http://localhost/api/commande", corpsDeCommande()));
    const { reference, paiement } = stripe.payer({ payeLe: PAYEE_LE, indexe: false });
    horloge = RECUE_LE;
    await nonReliee(reference);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toBeNull();
  });

  it("Stripe indisponible", async () => {
    const { reference } = await commandeConfirmee();
    stripe.enPanne = true;
    await nonReliee(reference);
    expect(journaux.join("\n")).toContain("stripe_indisponible");
  });

  it("enregistrement impossible chez Stripe : traitée comme non reliée, à la main", async () => {
    const { reference, paiement } = await commandeConfirmee();
    stripe.metadonneesEnPanne = true;
    await nonReliee(reference);
    expect(stripe.demandesDeRemboursement).toHaveLength(0);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toBeNull();
  });
});

describe("la route", () => {
  it("hors production, n'écrit qu'aux adresses de test et au vendeur, et dit où l'accusé est parti", async () => {
    injection.deps = deps({ env: environnement() });
    const { reference } = await commandeConfirmee();
    const { reponse } = await renoncer(declaration(reference));
    expect(reponse.envoi).toEqual({
      etat: "envoye",
      adresse: "delivered@resend.dev",
      saisie: SAISIE,
      remplacee: true,
      // L'adresse de l'acheteur devient aussi delivered@resend.dev : aucune copie en plus.
      copieAcheteur: false,
    });
    const { message } = accuses()[0]!;
    expect(message.a).toEqual(["delivered@resend.dev"]);
    expect(message.copieCachee).toEqual([VENDEUR.email]);
  });

  it("n'envoie pas de copie à l'acheteur quand il a saisi sa propre adresse", async () => {
    const { reference } = await commandeConfirmee();
    const { reponse } = await renoncer(declaration(reference, { email: EMAIL_ACHETEUR.toUpperCase() }));
    expect(reponse.envoi?.copieAcheteur).toBe(false);
    expect(accuses()[0]!.message.copieCachee).toEqual([VENDEUR.email]);
  });

  it("le champ piège rempli : refusée, sans rien faire ni rien envoyer", async () => {
    const { reference, paiement } = await commandeConfirmee();
    const avant = emails.appels.length;
    const { statut } = await renoncer(declaration(reference, { champ_libre: "https://pourriel.example" }));
    expect(statut).toBe(400);
    expect(emails.appels).toHaveLength(avant);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).retractation).toBeNull();
  });

  it("valide chaque champ avec zod, borne la taille de la requête, et refuse une simple visite", async () => {
    for (const mauvais of [
      declaration("AAAAAAAAAAAAAAAAAAAAAA", { nom: "" }),
      declaration("AAAAAAAAAAAAAAAAAAAAAA", { prenom: "   " }),
      declaration(""),
      declaration("AAAAAAAAAAAAAAAAAAAAAA", { email: "pas-une-adresse" }),
      declaration("AAAAAAAAAAAAAAAAAAAAAA", { nom: "x".repeat(101) }),
      declaration("AAAAAAAAAAAAAAAAAAAAAA", { inattendu: "x" }),
    ]) {
      expect((await renoncer(mauvais)).statut, JSON.stringify(mauvais)).toBe(422);
    }
    const lourde = await renoncerPost(
      requeteJson("http://localhost/api/renoncer", declaration("AAAAAAAAAAAAAAAAAAAAAA", { nom: "x".repeat(5000) })),
    );
    expect(lourde.status).toBe(413);
    expect(renoncerGet().status).toBe(405);
    expect(emails.appels).toHaveLength(0);
  });

  it("n'écrit dans les journaux ni nom, ni adresse, ni donnée du jeu", async () => {
    const { reference } = await commandeConfirmee();
    await renoncer(declaration(reference, { nom: "Zéphyrine" }));
    await renoncer(declaration("AAAAAAAAAAAAAAAAAAAAAA", { nom: "Zéphyrine" }));
    const tout = journaux.join("\n");
    expect(marquesDans(tout)).toEqual([]);
    expect(tout).not.toContain(SAISIE);
    expect(tout).not.toContain("Martin");
  });
});
