import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VENDEUR } from "@/contenu/vendeur";
import { ADRESSE_DE_TEST, adresseDEnvoi, adresseMasquee, creerClientEmail, sansDoublon, type MessageEmail } from "@/vente/envoi";
import { CLE_REELLE, CLE_RESEND, environnement } from "./fauxStripe";

/**
 * Le vrai client de Resend, bâti sur le SDK officiel, branché sur un faux
 * réseau : on lit la requête exactement telle qu'elle partirait.
 */
interface RequeteVue {
  url: string;
  methode: string;
  entetes: Headers;
  corps: Record<string, unknown>;
}

let vues: RequeteVue[];

function reseau(repondre: () => Response | Promise<Response>): void {
  vues = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (entree: string | URL | Request, init?: RequestInit) => {
      vues.push({
        url: String(entree),
        methode: init?.method ?? "GET",
        entetes: new Headers(init?.headers as HeadersInit),
        corps: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
      });
      return repondre();
    }),
  );
}

const MESSAGE: MessageEmail = {
  de: "Mission Gâteau <commandes@missiongateau.com>",
  a: ["delivered@resend.dev"],
  copieCachee: [VENDEUR.email],
  repondreA: VENDEUR.email,
  objet: "Confirmation de votre commande Mission Gâteau",
  texte: "Bonjour",
  html: "<p>Bonjour</p>",
  piecesJointes: [{ nom: "cgv-mission-gateau-2026-09-25.pdf", contenu: Buffer.from("%PDF-1.7 essai"), type: "application/pdf" }],
};

function erreur(statut: number, name: string): Response {
  return Response.json({ statusCode: statut, name, message: `erreur ${name}` }, { status: statut });
}

beforeEach(() => {
  // Hors production, le SDK journalise ses erreurs : on les écarte.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("client Resend réel", () => {
  it("n'existe pas sans RESEND_API_KEY", () => {
    expect(creerClientEmail(environnement({ cleResend: undefined }))).toBeNull();
  });

  it("envoie une seule requête, avec la clé d'idempotence, le texte, le HTML et la pièce jointe en base64", async () => {
    reseau(() => Response.json({ id: "email-123" }));
    const client = creerClientEmail(environnement())!;
    expect(await client.envoyer(MESSAGE, "confirmation-AbCdEfGhIjKlMnOpQrStUv")).toEqual({ ok: true, id: "email-123" });
    expect(vues).toHaveLength(1);
    const [requete] = vues;
    expect(requete!.methode).toBe("POST");
    expect(requete!.url).toBe("https://api.resend.com/emails");
    expect(requete!.entetes.get("Authorization")).toBe(`Bearer ${CLE_RESEND}`);
    expect(requete!.entetes.get("Idempotency-Key")).toBe("confirmation-AbCdEfGhIjKlMnOpQrStUv");
    expect(requete!.corps).toMatchObject({
      from: "Mission Gâteau <commandes@missiongateau.com>",
      to: ["delivered@resend.dev"],
      bcc: [VENDEUR.email],
      reply_to: VENDEUR.email,
      subject: "Confirmation de votre commande Mission Gâteau",
      text: "Bonjour",
      html: "<p>Bonjour</p>",
      attachments: [
        {
          filename: "cgv-mission-gateau-2026-09-25.pdf",
          content: Buffer.from("%PDF-1.7 essai").toString("base64"),
          content_type: "application/pdf",
        },
      ],
    });
  });

  it("traduit les réponses de Resend : en cours, requête différente, refus, panne", async () => {
    const client = creerClientEmail(environnement())!;
    const cas: [() => Response | Promise<Response>, unknown][] = [
      [() => erreur(409, "concurrent_idempotent_requests"), { ok: false, raison: "en_cours", code: "concurrent_idempotent_requests" }],
      [() => erreur(409, "invalid_idempotent_request"), { ok: false, raison: "requete_differente", code: "invalid_idempotent_request" }],
      [() => erreur(403, "validation_error"), { ok: false, raison: "refus", code: "validation_error" }],
      [() => erreur(422, "invalid_parameter"), { ok: false, raison: "refus", code: "invalid_parameter" }],
      [() => erreur(429, "rate_limit_exceeded"), { ok: false, raison: "panne", code: "rate_limit_exceeded" }],
      [() => erreur(429, "daily_quota_exceeded"), { ok: false, raison: "panne", code: "daily_quota_exceeded" }],
      [() => erreur(500, "internal_server_error"), { ok: false, raison: "panne", code: "internal_server_error" }],
      [() => new Response("<html>panne</html>", { status: 502 }), { ok: false, raison: "panne", code: "application_error" }],
      [
        () => {
          throw new TypeError("fetch failed");
        },
        { ok: false, raison: "panne", code: "application_error" },
      ],
    ];
    for (const [reponse, attendu] of cas) {
      reseau(reponse);
      expect(await client.envoyer(MESSAGE, "cle")).toEqual(attendu);
    }
  });
});

describe("adresses", () => {
  const PREVERSION = environnement();
  const PRODUCTION = environnement({ vercelEnv: "production", cleStripe: CLE_REELLE });

  it("hors production, ne laisse partir que les adresses de test de Resend et celle du vendeur", () => {
    expect(adresseDEnvoi("parent@exemple.fr", PREVERSION, VENDEUR)).toEqual({ adresse: ADRESSE_DE_TEST, remplacee: true });
    expect(adresseDEnvoi("delivered@resend.dev", PREVERSION, VENDEUR)).toEqual({ adresse: "delivered@resend.dev", remplacee: false });
    expect(adresseDEnvoi("Bounced+x@Resend.dev", PREVERSION, VENDEUR)).toEqual({ adresse: "Bounced+x@Resend.dev", remplacee: false });
    expect(adresseDEnvoi(` ${VENDEUR.email.toUpperCase()} `, PREVERSION, VENDEUR)).toEqual({
      adresse: VENDEUR.email.toUpperCase(),
      remplacee: false,
    });
    expect(adresseDEnvoi("pirate@resend.dev.example", PREVERSION, VENDEUR).remplacee).toBe(true);
    expect(adresseDEnvoi("parent@exemple.fr", environnement({ vercelEnv: undefined }), VENDEUR).remplacee).toBe(true);
  });

  it("en production, laisse partir toutes les adresses", () => {
    expect(adresseDEnvoi("parent@exemple.fr", PRODUCTION, VENDEUR)).toEqual({ adresse: "parent@exemple.fr", remplacee: false });
  });

  it("masque une adresse pour la page, et dédoublonne sans tenir compte de la casse", () => {
    expect(adresseMasquee("quentin@gmail.com")).toBe("q•••@gmail.com");
    expect(adresseMasquee("x@y.fr")).toBe("x•••@y.fr");
    expect(adresseMasquee("sans-arobase")).toBe("•••");
    expect(sansDoublon(["A@x.fr", "b@x.fr", "a@X.fr"])).toEqual(["A@x.fr", "b@x.fr"]);
  });
});
