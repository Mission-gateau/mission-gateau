import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dependances } from "@/vente/dependances";

/**
 * La confirmation de commande par e-mail, envoyée avant tout téléchargement
 * par la route que la page de la commande appelle à son chargement. Faux
 * Stripe, faux Resend : chaque envoi est relu tel qu'il partirait.
 */
const injection = vi.hoisted(() => ({ deps: null as unknown }));
vi.mock("@/vente/dependances", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/vente/dependances")>();
  return { ...original, dependancesReelles: () => (injection.deps as Dependances | null) ?? original.dependancesReelles() };
});

import { POST as commanderRoute } from "@/app/api/commande/route";
import { GET as confirmationGet, POST as confirmationPost } from "@/app/api/commande/[ref]/confirmation/route";
import { GET as tache } from "@/app/api/effacement/route";
import { VERSION_EN_VIGUEUR, versionCgv } from "@/contenu/cgv";
import { VENDEUR } from "@/contenu/vendeur";
import { cleDeConfirmation } from "@/vente/confirmation";
import { CLES, lireSuivi } from "@/vente/metadonnees";
import type { MessageEmail } from "@/vente/envoi";
import { FORMULAIRE_OFFICIEL } from "./officiels";
import { FauxEmail, empreinteDe } from "./fauxEmail";
import {
  CLE_REELLE,
  EMAIL_ACHETEUR,
  FICHE_SANS_CONVENTION,
  FauxStripe,
  SECRET_TACHE,
  corpsDeCommande,
  dependances,
  environnement,
  marquesDans,
  requeteJson,
} from "./fauxStripe";
import { texteDuPdf } from "./lirePdf";

/** La commande est passée à 12 h 15 (heure de Paris), payée à 12 h 17, confirmée à 12 h 18. */
const COMMANDEE_LE = new Date("2026-09-24T10:15:00.000Z");
const PAYEE_LE = new Date("2026-09-24T10:17:30.000Z");
const CONFIRMEE_LE = new Date("2026-09-24T10:18:00.000Z");
const PRODUCTION = environnement({ vercelEnv: "production", cleStripe: CLE_REELLE });

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
  horloge = COMMANDEE_LE;
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

async function commandePayee(options: Parameters<FauxStripe["payer"]>[0] = {}, corps = corpsDeCommande()) {
  horloge = COMMANDEE_LE;
  const reponse = await commanderRoute(requeteJson("http://localhost/api/commande", corps));
  expect(reponse.status).toBe(200);
  const reglee = stripe.payer({ payeLe: PAYEE_LE, ...options });
  horloge = CONFIRMEE_LE;
  return reglee;
}

async function confirmer(reference: string, corps: unknown = {}): Promise<{ statut: number; etat: string }> {
  const reponse = await confirmationPost(requeteJson(`http://localhost/api/commande/${reference}/confirmation`, corps), {
    params: Promise.resolve({ ref: reference }),
  });
  const lu = (await reponse.json()) as { etat: string };
  return { statut: reponse.status, etat: lu.etat };
}

/** Le texte brut, espaces insécables comprises comme des espaces. */
function texteDe(message: MessageEmail): string {
  return message.texte.replace(/[  ]/g, " ");
}

/** Le texte visible du HTML : balises retirées, entités décodées, espaces resserrées. */
function visibleDuHtml(html: string): string {
  return html
    .replace(/<title>[\s\S]*?<\/title>/, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[  ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resserre(texte: string): string {
  return texte.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
}

describe("envoi de la confirmation", () => {
  it("part à l'acheteur dès que la page de la commande l'appelle, une seule fois, et s'enregistre sur le paiement", async () => {
    const { reference, sessionId, paiement } = await commandePayee();
    expect(await confirmer(reference, { session_id: sessionId })).toEqual({ statut: 200, etat: "confirmee" });
    expect(emails.envoyes).toHaveLength(1);
    const { message, cle, id } = emails.envoyes[0]!;
    expect(cle).toBe(cleDeConfirmation(reference));
    expect(cle).toBe(`confirmation-${reference}`);
    expect(message.a).toEqual([EMAIL_ACHETEUR]);
    const meta = stripe.paiements.get(paiement.id)!.metadonnees;
    expect(meta[CLES.confirmation]).toBe(CONFIRMEE_LE.toISOString());
    expect(meta[CLES.confirmationId]).toBe(id);

    // La marque est lue avant tout envoi : plus aucun appel à Resend ensuite.
    expect(await confirmer(reference)).toEqual({ statut: 200, etat: "confirmee" });
    expect(emails.appels).toHaveLength(1);
  });

  it("expéditeur, réponse et copie cachée : Mission Gâteau, puis l'e-mail du vendeur", async () => {
    const { reference } = await commandePayee();
    await confirmer(reference);
    const { message } = emails.envoyes[0]!;
    expect(message.de).toBe("Mission Gâteau <commandes@missiongateau.com>");
    expect(message.repondreA).toBe(VENDEUR.email);
    expect(message.copieCachee).toEqual([VENDEUR.email]);
    expect(message.objet).toBe("Confirmation de votre commande Mission Gâteau");
  });

  it("n'envoie qu'un e-mail même quand deux appels arrivent en même temps", async () => {
    const { reference, sessionId, paiement } = await commandePayee();
    emails.delai = 30;
    const resultats = await Promise.all([
      confirmer(reference, { session_id: sessionId }),
      confirmer(reference, { session_id: sessionId }),
    ]);
    expect(resultats.map((r) => r.etat).sort()).toEqual(["confirmee", "en_cours"]);
    expect(resultats.find((r) => r.etat === "en_cours")!.statut).toBe(202);
    expect(emails.envoyes).toHaveLength(1);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).confirmation).not.toBeNull();
    // Ensuite, tout le monde lit « confirmée ».
    expect(await confirmer(reference)).toEqual({ statut: 200, etat: "confirmee" });
    expect(emails.envoyes).toHaveLength(1);
  });

  it("une nouvelle tentative envoie exactement la même requête, que Resend ne renvoie pas", async () => {
    const { reference, paiement } = await commandePayee();
    // Le premier envoi part, mais son enregistrement chez Stripe échoue : la page le dit à part.
    stripe.metadonneesEnPanne = true;
    expect(await confirmer(reference)).toEqual({ statut: 503, etat: "non_enregistree" });
    expect(emails.envoyes).toHaveLength(1);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).confirmation).toBeNull();
    // La tentative suivante : même requête, octet pour octet, même identifiant, aucun second e-mail.
    stripe.metadonneesEnPanne = false;
    horloge = new Date(CONFIRMEE_LE.getTime() + 3600_000);
    expect(await confirmer(reference)).toEqual({ statut: 200, etat: "confirmee" });
    expect(emails.appels).toHaveLength(2);
    expect(empreinteDe(emails.appels[1]!.message)).toBe(empreinteDe(emails.appels[0]!.message));
    expect(emails.envoyes).toHaveLength(1);
    expect(stripe.paiements.get(paiement.id)!.metadonnees[CLES.confirmationId]).toBe(emails.envoyes[0]!.id);
  });

  it("409 concurrent_idempotent_requests : « confirmation en cours » ; 409 invalid_idempotent_request : erreur journalisée", async () => {
    const { reference } = await commandePayee();
    // Une requête différente est déjà passée sous la même clé.
    await emails.envoyer(
      { de: "x", a: ["y@resend.dev"], copieCachee: [], repondreA: "x", objet: "autre", texte: "autre", html: "autre", piecesJointes: [] },
      cleDeConfirmation(reference),
    );
    expect(await confirmer(reference)).toEqual({ statut: 503, etat: "echec" });
    expect(journaux.map((ligne) => JSON.parse(ligne) as Record<string, string>)).toContainEqual({
      route: "confirmation",
      evenement: "confirmation_differente",
      code: "invalid_idempotent_request",
    });
  });

  it("un refus de Resend (domaine de l'expéditeur non vérifié) est un échec d'envoi comme un autre", async () => {
    const { reference, paiement } = await commandePayee();
    emails.refuse = true;
    expect(await confirmer(reference)).toEqual({ statut: 503, etat: "echec" });
    emails.refuse = false;
    emails.enPanne = true;
    expect(await confirmer(reference)).toEqual({ statut: 503, etat: "echec" });
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).confirmation).toBeNull();
    expect(journaux.join("\n")).toContain("validation_error");
  });

  it("sans clé de Resend, rien ne part et rien n'est livré", async () => {
    const { reference } = await commandePayee();
    injection.deps = deps({ email: null });
    expect(await confirmer(reference)).toEqual({ statut: 503, etat: "echec" });
  });

  it("version des CGV introuvable : aucun envoi, « confirmation impossible »", async () => {
    const { reference, paiement } = await commandePayee();
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.versionCgv] = "2099-01-01";
    expect(await confirmer(reference)).toEqual({ statut: 500, etat: "impossible" });
    expect(emails.appels).toHaveLength(0);
  });

  it("ne confirme qu'une commande payée : les autres états sont rendus tels quels", async () => {
    await commanderRoute(requeteJson("http://localhost/api/commande", corpsDeCommande()));
    const { id, reference } = stripe.derniereSession();
    expect(await confirmer(reference, { session_id: id })).toEqual({ statut: 409, etat: "non_aboutie" });
    expect(await confirmer("AAAAAAAAAAAAAAAAAAAAAA")).toEqual({ statut: 409, etat: "introuvable" });
    const rembourse = await commandePayee();
    stripe.rembourserHorsSite(rembourse.paiement.id);
    expect((await confirmer(rembourse.reference)).etat).toBe("remboursee");
    const conteste = await commandePayee();
    stripe.contester(conteste.paiement.id);
    expect((await confirmer(conteste.reference)).etat).toBe("litige");
    expect(emails.appels).toHaveLength(0);
    expect(confirmationGet().status).toBe(405);
  });

  it("trouve l'adresse de l'acheteur par un seul chemin : la session retrouvée par le paiement, sinon le débit", async () => {
    // Même au retour de Stripe, avec la session en main, l'adresse vient de la session retrouvée par le paiement.
    const avecSession = await commandePayee({ email: "session@exemple.fr", emailDuDebit: "debit@exemple.fr" });
    await confirmer(avecSession.reference, { session_id: avecSession.sessionId });
    expect(emails.envoyes.at(-1)!.message.a).toEqual(["session@exemple.fr"]);
    expect(stripe.sessionsCherchees).toContain(avecSession.paiement.id);

    const sansSession = await commandePayee({ email: "retrouvee@exemple.fr", emailDuDebit: "debit@exemple.fr" });
    await confirmer(sansSession.reference);
    expect(emails.envoyes.at(-1)!.message.a).toEqual(["retrouvee@exemple.fr"]);
    expect(stripe.sessionsCherchees).toContain(sansSession.paiement.id);

    const debitSeul = await commandePayee({ email: null, emailDuDebit: "debit@exemple.fr" });
    await confirmer(debitSeul.reference);
    expect(emails.envoyes.at(-1)!.message.a).toEqual(["debit@exemple.fr"]);

    const aucune = await commandePayee({ email: null, emailDuDebit: null });
    expect(await confirmer(aucune.reference)).toEqual({ statut: 500, etat: "impossible" });
  });

  it("la page et la tâche quotidienne envoient exactement la même requête : Resend ne renvoie pas l'e-mail", async () => {
    const { reference, sessionId, paiement } = await commandePayee();
    // La page, au retour de Stripe : l'e-mail part, mais sa marque n'est pas posée.
    stripe.metadonneesEnPanne = true;
    expect(await confirmer(reference, { session_id: sessionId })).toEqual({ statut: 503, etat: "non_enregistree" });
    stripe.metadonneesEnPanne = false;
    // Deux heures plus tard, la tâche quotidienne reprend la même commande.
    horloge = new Date(PAYEE_LE.getTime() + 2 * 3600_000);
    injection.deps = deps({ env: { ...PRODUCTION, secretTache: SECRET_TACHE } });
    const reponse = await tache(new Request("http://localhost/api/effacement", { headers: { Authorization: `Bearer ${SECRET_TACHE}` } }));
    expect(reponse.status).toBe(200);
    expect(emails.appels).toHaveLength(2);
    expect(empreinteDe(emails.appels[1]!.message)).toBe(empreinteDe(emails.appels[0]!.message));
    expect(emails.appels[1]!.cle).toBe(emails.appels[0]!.cle);
    expect(emails.envoyes).toHaveLength(1);
    expect(lireSuivi(stripe.paiements.get(paiement.id)!.metadonnees).confirmation).not.toBeNull();
  });

  it("hors production, n'écrit qu'aux adresses de test de Resend et au vendeur", async () => {
    injection.deps = deps({ env: environnement() });
    const inconnue = await commandePayee();
    await confirmer(inconnue.reference);
    expect(emails.envoyes.at(-1)!.message.a).toEqual(["delivered@resend.dev"]);
    expect(emails.envoyes.at(-1)!.message.copieCachee).toEqual([VENDEUR.email]);

    const test = await commandePayee({ email: "bounced+essai@resend.dev" });
    await confirmer(test.reference);
    expect(emails.envoyes.at(-1)!.message.a).toEqual(["bounced+essai@resend.dev"]);

    const vendeur = await commandePayee({ email: VENDEUR.email.toUpperCase() });
    await confirmer(vendeur.reference);
    expect(emails.envoyes.at(-1)!.message.a).toEqual([VENDEUR.email.toUpperCase()]);
    // Le vendeur destinataire ne reçoit pas en plus une copie cachée.
    expect(emails.envoyes.at(-1)!.message.copieCachee).toEqual([]);
    for (const { message } of emails.envoyes) {
      for (const adresse of [...message.a, ...message.copieCachee]) {
        expect(/@resend\.dev$/i.test(adresse) || adresse.toLowerCase() === VENDEUR.email.toLowerCase(), adresse).toBe(true);
      }
    }
  });
});

describe("contenu de la confirmation", () => {
  async function confirmation(options: { fiche?: typeof VENDEUR } = {}) {
    // Convention non signée : la vente n'est ouverte qu'à l'essai, hors production.
    if (options.fiche) {
      injection.deps = deps({ fiche: options.fiche, ...(options.fiche === FICHE_SANS_CONVENTION ? { env: environnement() } : {}) });
    }
    const reglee = await commandePayee();
    await confirmer(reglee.reference, { session_id: reglee.sessionId });
    return { ...reglee, message: emails.envoyes.at(-1)!.message };
  }

  it("donne, dans l'ordre, la commande, le jeu, l'accord, le droit de rétractation, le formulaire, le vendeur et les CGV jointes", async () => {
    const { reference, message } = await confirmation();
    const texte = texteDe(message);
    const reperes = [
      "Votre commande",
      `Référence : ${reference}`,
      "Votre jeu",
      "Votre demande de recevoir le jeu dès le paiement",
      "Votre droit de rétractation",
      "Formulaire type de rétractation",
      "Le vendeur",
      "Pièce jointe : nos conditions générales de vente",
    ].map((repere) => texte.indexOf(repere));
    expect(reperes.every((position) => position >= 0), JSON.stringify(reperes)).toBe(true);
    expect([...reperes].sort((a, b) => a - b)).toEqual(reperes);
  });

  it("1. la commande : référence, date et heure du paiement à Paris, le jeu, le prix et la TVA, payé par carte", async () => {
    const { reference, message } = await confirmation();
    const texte = texteDe(message);
    expect(texte).toContain(`Référence : ${reference}`);
    expect(texte).toContain("Payée le : 24 septembre 2026 à 12 h 17 (heure de Paris)");
    expect(texte).toContain(
      "Jeu : Jeu d'anniversaire Mission Gâteau — kit personnalisé à imprimer (PDF) — thème Pirates, 10-12 ans",
    );
    expect(texte).toContain("Prix : 12,90 € — TVA non applicable, article 293 B du CGI, payé par carte");
  });

  it("2. le jeu : le lien de la page de la commande, sa validité datée, et le bouton qui télécharge", async () => {
    const { reference, message } = await confirmation();
    const texte = texteDe(message);
    expect(texte).toContain(
      `Votre jeu se télécharge sur la page de votre commande, par son bouton « Télécharger mon jeu (PDF) » :\n\nhttps://mission-gateau.vercel.app/commande/${reference}\n`,
    );
    expect(texte).toContain(
      "Ce lien reste valable 30 jours après le paiement, jusqu'au 24 octobre 2026 à 12 h 17 (heure de Paris) : pensez à enregistrer le fichier.",
    );
  });

  it("3. l'accord, mot pour mot, avec la date et l'heure lues dans les métadonnées", async () => {
    const { message } = await confirmation();
    expect(texteDe(message)).toContain(
      "Avant de payer, le 24 septembre 2026 à 12 h 15, vous avez demandé à recevoir votre jeu avant la fin du délai de rétractation de 14 jours et reconnu que vous perdrez votre droit de rétractation dès le début de son premier téléchargement (article L221-28, 13° du Code de la consommation). Cet e-mail vous confirme cet accord et cette reconnaissance.",
    );
  });

  it("4. le droit de rétractation : jusqu'au premier téléchargement et au plus tard le dernier jour, par trois moyens, remboursement sous 14 jours", async () => {
    const { reference, message } = await confirmation();
    const texte = texteDe(message);
    expect(texte).toContain(
      "Vous pouvez renoncer à votre commande, sans avoir à vous justifier, jusqu'au début du premier téléchargement de votre jeu, et au plus tard le 8 octobre 2026 :",
    );
    expect(texte).toContain(
      `- par le lien Renoncer au contrat ici (https://mission-gateau.vercel.app/renoncer?ref=${reference}) ;`,
    );
    expect(message.html).toContain(
      `<a href="https://mission-gateau.vercel.app/renoncer?ref=${reference}" style="color:#0f4c5c">Renoncer au contrat ici</a>`,
    );
    expect(texte).toContain("- par le formulaire type ci-dessous ;");
    expect(texte).toContain(
      `- par toute déclaration claire envoyée par e-mail à ${VENDEUR.email} ou par courrier à 7 impasse des Bosquets, 34670 Baillargues, France.`,
    );
    expect(texte).toContain("Nous vous rembourserons alors 12,90 € sous 14 jours au plus, sur la carte utilisée pour le paiement.");
  });

  it("5. le formulaire type, mot pour mot, rempli avec le nom, l'adresse géographique et l'e-mail du vendeur", async () => {
    const { message } = await confirmation();
    const attendu = FORMULAIRE_OFFICIEL.replace(
      "[le professionnel insère ici son nom, son adresse géographique et son adresse électronique]",
      `Quentin Courtois EI, 7 impasse des Bosquets, 34670 Baillargues, France, ${VENDEUR.email}`,
    );
    expect(texteDe(message)).toContain(attendu);
  });

  it("6. le vendeur, le service client, la garantie légale avec renvoi à l'article des CGV, et le médiateur seulement une fois la convention signée", async () => {
    const sansConvention = texteDe((await confirmation({ fiche: FICHE_SANS_CONVENTION })).message);
    for (const attendu of [
      "Vendeur : Quentin Courtois EI, entrepreneur individuel",
      "Nom commercial : Mission Gâteau",
      "SIRET : 992 667 006 00017",
      "Adresse : 7 impasse des Bosquets, 34670 Baillargues, France",
      "Téléphone : +33 6 32 57 69 77",
      `E-mail : ${VENDEUR.email}`,
      `Service client : écrivez-nous à ${VENDEUR.email} ; nous répondons sous 7 jours au plus.`,
      "garantie légale de conformité et de la garantie légale des vices cachés : voir l'article 10 des conditions générales de vente jointes.",
    ]) {
      expect(sansConvention, attendu).toContain(attendu);
    }
    expect(sansConvention).not.toMatch(/Médiat|Alteritae|mediateur-consommation-smp/);
    // La convention signée le 25 septembre 2026 : la fiche réelle cite le médiateur, et comment le saisir.
    const avecConvention = texteDe((await confirmation({ fiche: VENDEUR })).message);
    expect(avecConvention).toContain(
      "Médiateur de la consommation dont relève le vendeur : Société Médiation Professionnelle, Alteritae, 5 rue Salvaing, 12000 Rodez, https://www.mediateur-consommation-smp.fr.",
    );
    expect(avecConvention).toContain(
      "La médiation est gratuite pour vous. Elle suppose une réclamation écrite adressée d'abord au vendeur et restée sans solution, puis une saisine du médiateur dans l'année qui suit cette réclamation (article L612-2 du Code de la consommation) : en ligne, sur https://www.mediateur-consommation-smp.fr/demander-une-mediation/, ou par courrier à l'adresse ci-dessus.",
    );
  });

  it("7. les CGV de la version acceptée, prix compris, en PDF joint et annoncé, identique d'un envoi à l'autre", async () => {
    const premiere = await confirmation();
    const seconde = await confirmation();
    const nom = `cgv-mission-gateau-${VERSION_EN_VIGUEUR.identifiant}.pdf`;
    for (const { message } of [premiere, seconde]) {
      expect(message.piecesJointes).toHaveLength(1);
      expect(message.piecesJointes[0]!.nom).toBe(nom);
      expect(message.piecesJointes[0]!.type).toBe("application/pdf");
      expect(texteDe(message)).toContain(`Pièce jointe : nos conditions générales de vente, version du 27 septembre 2026 (fichier ${nom}).`);
      expect(texteDe(message)).toContain("Nos conditions générales de vente, dans la version que vous avez acceptée, y sont jointes en PDF.");
    }
    const [a, b] = [premiere, seconde].map(({ message }) => message.piecesJointes[0]!.contenu);
    expect(Buffer.compare(a!, b!)).toBe(0);
    const pdf = texteDuPdf(a!).replace(/[  ]/g, " ");
    expect(pdf).toContain("Version du 27 septembre 2026");
    expect(pdf).toContain("Le jeu complet coûte 12,90 €");
    expect(pdf).toContain("11. Médiation de la consommation");
    expect(pdf).toContain("8. Droit de rétractation");
    expect(pdf).toContain("MODÈLE DE FORMULAIRE DE RÉTRACTATION");
    expect(a!.toString("latin1")).not.toMatch(/Helvetica/);
  });

  it("joint les CGV de la version enregistrée dans la commande, pas celles en vigueur", async () => {
    const { reference, paiement } = await commandePayee();
    stripe.paiements.get(paiement.id)!.metadonnees[CLES.versionCgv] = "2026-09-24";
    await confirmer(reference);
    const { message } = emails.envoyes.at(-1)!;
    expect(message.piecesJointes[0]!.nom).toBe("cgv-mission-gateau-2026-09-24.pdf");
    expect(texteDe(message)).toContain("version du 24 septembre 2026 (fichier cgv-mission-gateau-2026-09-24.pdf)");
    const pdf = texteDuPdf(message.piecesJointes[0]!.contenu).replace(/[  ]/g, " ");
    expect(pdf).toContain("Version du 24 septembre 2026");
    expect(pdf).toContain("8. Absence de droit de rétractation");
    expect(versionCgv("2026-09-24")).not.toBeNull();
  });

  it("ne contient aucune donnée du jeu : ni prénom, ni date, ni heure, ni adresse, ni contact de la fête", async () => {
    const { message } = await confirmation();
    const tout = [message.objet, message.texte, message.html, ...message.piecesJointes.map((p) => texteDuPdf(p.contenu))].join("\n");
    expect(marquesDans(tout)).toEqual([]);
    expect(tout).not.toContain("Camille");
  });

  it("donne le même contenu en texte et en HTML, sans image ni ressource distante", async () => {
    const { reference, message } = await confirmation();
    const visible = visibleDuHtml(message.html);
    // Chaque ligne du texte, lien retiré de sa parenthèse, se retrouve dans le HTML, et rien d'autre n'y est ajouté.
    const lignes = message.texte
      .split("\n")
      .filter((ligne) => ligne.trim() !== "" && !/^-+$/.test(ligne))
      .map((ligne) => resserre(ligne.replace(/^- /, "").replace(/ \(https?:\/\/[^)]+\)/g, "")));
    for (const ligne of lignes) expect(visible, ligne).toContain(ligne);
    expect(visible.length).toBeLessThanOrEqual(lignes.join(" ").length + 5);
    // Les liens du HTML sont ceux du texte, vers le site.
    const liens = [...message.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
    expect(liens).toEqual([
      `https://mission-gateau.vercel.app/commande/${reference}`,
      `https://mission-gateau.vercel.app/renoncer?ref=${reference}`,
    ]);
    for (const lien of liens) expect(message.texte).toContain(lien);
    // Aucune ressource distante : ni image, ni feuille de style, ni police, ni script.
    expect(message.html).not.toMatch(/<img|<link|<script|<style|<iframe|src=|url\(|@import|srcset/i);
  });
});
