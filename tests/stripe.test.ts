import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { VERSION_CGV } from "@/contenu/legal";
import { metadonneesDuPaiement } from "@/vente/metadonnees";
import { parametresDeSession } from "@/vente/session";
import {
  creerClientStripe,
  erreurDIdempotence,
  limiteDeDebit,
  requeteConfigurationsAvant,
  requeteParReference,
  requetePaiementsAboutisDepuis,
} from "@/vente/stripe";
import { CLE_TEST, FICHE_COMPLETE, configurationMarquee, environnement, marquesDans } from "./fauxStripe";

/**
 * Le vrai client, bâti sur le SDK officiel, branché sur un faux réseau : on
 * lit les requêtes exactement telles qu'elles partiraient chez Stripe.
 */
interface RequeteVue {
  methode: string;
  url: URL;
  entetes: Headers;
  corps: string;
}

function reseau(repondre: (requete: RequeteVue) => { statut?: number; json: unknown; entetes?: Record<string, string> }) {
  const vues: RequeteVue[] = [];
  const faux = async (entree: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const requete: RequeteVue = {
      methode: init?.method ?? "GET",
      url: new URL(String(entree)),
      entetes: new Headers(init?.headers as HeadersInit),
      corps: typeof init?.body === "string" ? init.body : "",
    };
    vues.push(requete);
    const { statut = 200, json, entetes = {} } = repondre(requete);
    return new Response(JSON.stringify(json), {
      status: statut,
      headers: { "Content-Type": "application/json", "Request-Id": "req_faux", ...entetes },
    });
  };
  const client = creerClientStripe(environnement(), { httpClient: Stripe.createFetchHttpClient(faux as typeof fetch) });
  if (!client) throw new Error("client attendu");
  return { client, vues };
}

const REFERENCE = "AbCdEfGhIjKlMnOpQrStUv";

function parametres() {
  const metadonnees = metadonneesDuPaiement(
    {
      reference: REFERENCE,
      versionKit: "1.2",
      graine: "k7m2p9q4rs",
      pays: "FR",
      versionCgv: VERSION_CGV.identifiant,
      accordCgv: "2026-09-24T12:00:00.000Z",
      accordAccesImmediat: "2026-09-24T12:00:00.000Z",
    },
    configurationMarquee(),
    CLE_TEST,
  );
  return parametresDeSession({
    reference: REFERENCE,
    configuration: configurationMarquee(),
    adresseSite: "https://mission-gateau.vercel.app",
    metadonnees,
    fiche: FICHE_COMPLETE,
  });
}

function paiement(statut: string, ref: string, rembourse = false, options: { litige?: boolean; email?: string | null } = {}) {
  return {
    id: `pi_${ref.slice(0, 6)}`,
    object: "payment_intent",
    status: statut,
    created: 1790000000,
    amount: 1290,
    amount_received: statut === "succeeded" ? 1290 : 0,
    metadata: { ref },
    latest_charge: {
      id: "ch_1",
      object: "charge",
      created: 1790003600,
      refunded: rembourse,
      amount_refunded: rembourse ? 1290 : 0,
      disputed: options.litige ?? false,
      billing_details: { email: options.email === undefined ? "facturation@exemple.fr" : options.email },
    },
  };
}

describe("client Stripe réel", () => {
  it("n'existe pas sans clé valable", () => {
    expect(creerClientStripe(environnement({ cleStripe: undefined }))).toBeNull();
    expect(creerClientStripe(environnement({ cleStripe: "pk_test_abc" }))).toBeNull();
  });

  it("crée la session par une seule requête, sans aucune donnée saisie en clair sur le réseau", async () => {
    const { client, vues } = reseau(() => ({
      json: { id: "cs_test_1", object: "checkout.session", url: "https://checkout.stripe.com/c/pay/cs_test_1" },
    }));
    const { url } = await client.creerSession(parametres(), REFERENCE);
    expect(url).toBe("https://checkout.stripe.com/c/pay/cs_test_1");

    expect(vues).toHaveLength(1);
    const [requete] = vues;
    expect(requete!.methode).toBe("POST");
    expect(requete!.url.href).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(requete!.entetes.get("Idempotency-Key")).toBe(REFERENCE);
    expect(requete!.entetes.get("Authorization")).toBe(`Bearer ${CLE_TEST}`);

    const champs = new URLSearchParams(requete!.corps);
    expect(champs.get("mode")).toBe("payment");
    expect(champs.get("locale")).toBe("fr");
    expect(champs.getAll("payment_method_types[0]")).toEqual(["card"]);
    expect(champs.get("payment_method_types[1]")).toBeNull();
    expect(champs.get("line_items[0][quantity]")).toBe("1");
    expect(champs.get("line_items[0][price_data][currency]")).toBe("eur");
    expect(champs.get("line_items[0][price_data][unit_amount]")).toBe("1290");
    expect(champs.get("billing_address_collection")).toBe("required");
    expect(champs.get("adaptive_pricing[enabled]")).toBe("false");
    expect(champs.get("invoice_creation[enabled]")).toBe("true");
    expect(champs.get("invoice_creation[invoice_data][custom_fields][0][name]")).toBe("Votre jeu");
    expect(champs.get("invoice_creation[invoice_data][custom_fields][0][value]")).toBe(
      `https://mission-gateau.vercel.app/commande/${REFERENCE}`,
    );
    expect(champs.get("payment_intent_data[metadata][ref]")).toBe(REFERENCE);
    expect(champs.get("success_url")).toBe(
      `https://mission-gateau.vercel.app/commande/${REFERENCE}?session_id={CHECKOUT_SESSION_ID}`,
    );

    // Ni dans le corps brut, ni une fois décodé.
    const decode = [...champs.entries()].map(([cle, valeur]) => `${cle}=${valeur}`).join("\n");
    expect(marquesDans(decode)).toEqual([]);
    expect(marquesDans(decodeURIComponent(requete!.corps.replace(/\+/g, " ")))).toEqual([]);
  });

  it("lit une session et le paiement qui l'accompagne, remboursement compris", async () => {
    let rembourse = false;
    const { client, vues } = reseau(() => ({
      json: {
        id: "cs_test_1",
        object: "checkout.session",
        payment_status: "paid",
        metadata: { ref: REFERENCE },
        customer_details: { email: "parent@exemple.fr" },
        payment_intent: paiement("succeeded", REFERENCE, rembourse),
      },
    }));
    expect(await client.lireSession("cs_test_1")).toEqual({
      id: "cs_test_1",
      payee: true,
      metadonnees: { ref: REFERENCE },
      email: "parent@exemple.fr",
      paiement: {
        id: "pi_AbCdEf",
        statut: "succeeded",
        cree: 1790000000,
        // L'heure du paiement est celle du débit, pas celle de la première tentative.
        payeLe: 1790003600,
        montant: 1290,
        metadonnees: { ref: REFERENCE },
        rembourseEnTotalite: false,
        litige: false,
        emailDuDebit: "facturation@exemple.fr",
      },
    });
    expect(vues[0]!.url.pathname).toBe("/v1/checkout/sessions/cs_test_1");
    expect(vues[0]!.url.searchParams.getAll("expand[0]")).toEqual(["payment_intent.latest_charge"]);
    rembourse = true;
    expect((await client.lireSession("cs_test_1"))!.paiement!.rembourseEnTotalite).toBe(true);
  });

  it("renvoie null pour une session inconnue", async () => {
    const { client } = reseau(() => ({
      statut: 404,
      json: { error: { type: "invalid_request_error", code: "resource_missing", message: "No such checkout.session" } },
    }));
    expect(await client.lireSession("cs_test_inconnue")).toBeNull();
  });

  it("cherche un paiement par sa référence, ignore ce qui ne lui correspond qu'à la casse près, et le relit à jour", async () => {
    const autre = `${REFERENCE.slice(0, -1)}${REFERENCE.at(-1)!.toLowerCase()}`;
    const { client, vues } = reseau((requete) =>
      requete.url.pathname.endsWith("/search")
        ? {
            json: {
              object: "search_result",
              // La recherche peut rendre des métadonnées périmées…
              data: [paiement("succeeded", autre), { ...paiement("succeeded", REFERENCE), metadata: { ref: REFERENCE } }],
              has_more: false,
              next_page: null,
            },
          }
        : // … la relecture par l'identifiant, elle, est à jour.
          { json: { ...paiement("succeeded", REFERENCE), metadata: { ref: REFERENCE, confirmation: "2026-09-24T12:00:00.000Z" } } },
    );
    const trouve = await client.paiementParReference(REFERENCE);
    expect(trouve?.metadonnees).toEqual({ ref: REFERENCE, confirmation: "2026-09-24T12:00:00.000Z" });
    const recherche = vues[0]!.url;
    expect(recherche.pathname).toBe("/v1/payment_intents/search");
    expect(recherche.searchParams.get("query")).toBe(`metadata["ref"]:"${REFERENCE}"`);
    expect(recherche.searchParams.get("limit")).toBe("10");
    expect(vues[1]!.url.pathname).toBe("/v1/payment_intents/pi_AbCdEf");
    expect(vues[1]!.url.searchParams.getAll("expand[0]")).toEqual(["latest_charge"]);
    expect(vues).toHaveLength(2);
  });

  it("relit un paiement : montant, litige, remboursement et e-mail de facturation du dernier débit", async () => {
    const { client } = reseau(() => ({ json: paiement("succeeded", REFERENCE, false, { litige: true, email: null }) }));
    expect(await client.lirePaiement("pi_AbCdEf")).toMatchObject({
      montant: 1290,
      litige: true,
      rembourseEnTotalite: false,
      emailDuDebit: null,
    });
    const absent = reseau(() => ({
      statut: 404,
      json: { error: { type: "invalid_request_error", code: "resource_missing", message: "No such payment_intent" } },
    }));
    expect(await absent.client.lirePaiement("pi_inconnu")).toBeNull();
  });

  it("retrouve la session Checkout d'un paiement pour y lire l'e-mail de l'acheteur", async () => {
    const { client, vues } = reseau(() => ({
      json: {
        object: "list",
        data: [
          {
            id: "cs_test_1",
            object: "checkout.session",
            payment_status: "paid",
            metadata: { ref: REFERENCE },
            customer_details: { email: "parent@exemple.fr" },
            payment_intent: "pi_AbCdEf",
          },
        ],
        has_more: false,
      },
    }));
    const session = await client.sessionDuPaiement("pi_AbCdEf");
    expect(session?.email).toBe("parent@exemple.fr");
    expect(session?.paiement).toBeNull();
    expect(vues[0]!.methode).toBe("GET");
    expect(vues[0]!.url.pathname).toBe("/v1/checkout/sessions");
    expect(vues[0]!.url.searchParams.get("payment_intent")).toBe("pi_AbCdEf");
    expect(vues[0]!.url.searchParams.get("limit")).toBe("1");
  });

  it("cherche les paiements aboutis de cette boutique depuis une date, page après page", async () => {
    const { client, vues } = reseau(() => ({
      json: { object: "search_result", data: [paiement("succeeded", REFERENCE)], has_more: false, next_page: null },
    }));
    const { paiements, pageSuivante } = await client.paiementsAboutisDepuis(1786000000, null);
    expect(paiements).toHaveLength(1);
    expect(pageSuivante).toBeNull();
    expect(vues[0]!.url.pathname).toBe("/v1/payment_intents/search");
    expect(vues[0]!.url.searchParams.get("query")).toBe(
      'status:"succeeded" AND created>1786000000 AND metadata["boutique"]:"mission-gateau"',
    );
    expect(vues[0]!.url.searchParams.getAll("expand[0]")).toEqual(["data.latest_charge"]);
    expect(requetePaiementsAboutisDepuis(1786000000.7)).toBe(
      'status:"succeeded" AND created>1786000000 AND metadata["boutique"]:"mission-gateau"',
    );
  });

  it("rembourse la totalité du paiement, motif « requested_by_customer », avec sa clé d'idempotence", async () => {
    const { client, vues } = reseau(() => ({ json: { id: "re_1", object: "refund", status: "succeeded", amount: 1290 } }));
    expect(await client.rembourser("pi_AbCdEf", `retractation-${REFERENCE}`, { ref: REFERENCE, motif: "retractation" })).toEqual({
      id: "re_1",
      statut: "succeeded",
    });
    const [requete] = vues;
    expect(requete!.methode).toBe("POST");
    expect(requete!.url.pathname).toBe("/v1/refunds");
    expect(requete!.entetes.get("Idempotency-Key")).toBe(`retractation-${REFERENCE}`);
    const champs = new URLSearchParams(requete!.corps);
    expect(champs.get("payment_intent")).toBe("pi_AbCdEf");
    expect(champs.get("reason")).toBe("requested_by_customer");
    expect(champs.get("amount")).toBeNull();
    expect(champs.get("metadata[ref]")).toBe(REFERENCE);
  });

  it("tient pour fait le remboursement d'un paiement déjà remboursé, et laisse passer les autres refus", async () => {
    const deja = reseau(() => ({
      statut: 400,
      json: { error: { type: "invalid_request_error", code: "charge_already_refunded", message: "already refunded" } },
    }));
    expect(await deja.client.rembourser("pi_AbCdEf", "cle", {})).toEqual({ id: "", statut: "succeeded" });
    const litige = reseau(() => ({
      statut: 400,
      json: { error: { type: "invalid_request_error", code: "charge_disputed", message: "disputed" } },
    }));
    await expect(litige.client.rembourser("pi_AbCdEf", "cle", {})).rejects.toMatchObject({ code: "charge_disputed" });
  });

  it("cherche les configurations à effacer, page après page", async () => {
    const { client, vues } = reseau((requete) => ({
      json: {
        object: "search_result",
        data: [paiement("succeeded", REFERENCE)],
        has_more: !requete.url.searchParams.get("page"),
        next_page: requete.url.searchParams.get("page") ? null : "page_2",
      },
    }));
    const premiere = await client.paiementsAvecConfiguration(1787400000, null);
    expect(premiere.pageSuivante).toBe("page_2");
    const seconde = await client.paiementsAvecConfiguration(1787400000, "page_2");
    expect(seconde.pageSuivante).toBeNull();
    expect(vues[0]!.url.pathname).toBe("/v1/payment_intents/search");
    expect(vues[0]!.url.searchParams.get("query")).toBe('metadata["config"]:"chiffree" AND created<1787400000');
    expect(vues[0]!.url.searchParams.get("limit")).toBe("100");
    expect(vues[0]!.url.searchParams.getAll("expand[0]")).toEqual(["data.latest_charge"]);
    expect(vues[1]!.url.searchParams.get("page")).toBe("page_2");
    expect(premiere.paiements[0]!.payeLe).toBe(1790003600);
  });

  it("cherche aussi les débits qui gardent une copie de la configuration", async () => {
    const { client, vues } = reseau(() => ({
      json: {
        object: "search_result",
        data: [{ id: "ch_1", object: "charge", created: 1787000000, metadata: { ref: REFERENCE, config: "chiffree" } }],
        has_more: false,
        next_page: null,
      },
    }));
    expect(await client.debitsAvecConfiguration(1787400000, null)).toEqual({
      debits: [{ id: "ch_1", cree: 1787000000, metadonnees: { ref: REFERENCE, config: "chiffree" } }],
      pageSuivante: null,
    });
    expect(vues[0]!.url.pathname).toBe("/v1/charges/search");
    expect(vues[0]!.url.searchParams.get("query")).toBe('metadata["config"]:"chiffree" AND created<1787400000');
  });

  it("efface la copie d'un débit en lui envoyant des valeurs vides", async () => {
    const { client, vues } = reseau(() => ({ json: { id: "ch_1", object: "charge", metadata: {} } }));
    await client.modifierMetadonneesDuDebit("ch_1", { config: "effacee", config_0: "" });
    expect(vues[0]!.methode).toBe("POST");
    expect(vues[0]!.url.pathname).toBe("/v1/charges/ch_1");
    const champs = new URLSearchParams(vues[0]!.corps);
    expect(champs.get("metadata[config]")).toBe("effacee");
    expect(champs.get("metadata[config_0]")).toBe("");
  });

  it("efface des clés de métadonnées en leur envoyant une valeur vide", async () => {
    const { client, vues } = reseau(() => ({ json: paiement("succeeded", REFERENCE) }));
    await client.modifierMetadonnees("pi_1", { config: "effacee", config_morceaux: "", config_0: "" });
    const champs = new URLSearchParams(vues[0]!.corps);
    expect(vues[0]!.methode).toBe("POST");
    expect(vues[0]!.url.pathname).toBe("/v1/payment_intents/pi_1");
    expect(champs.get("metadata[config]")).toBe("effacee");
    expect(champs.get("metadata[config_0]")).toBe("");
    expect(champs.get("metadata[config_morceaux]")).toBe("");
  });

  it("rend le paiement tel que Stripe le renvoie en réponse à une écriture, débit compris", async () => {
    const ecrit = { ...paiement("succeeded", REFERENCE), metadata: { ref: REFERENCE, retractation: "2026-09-26T08:30:00.000Z", telechargement: "2026-09-26T08:29:59.000Z" } };
    const { client, vues } = reseau(() => ({ json: ecrit }));
    const lu = await client.modifierMetadonnees("pi_1", { retractation: "2026-09-26T08:30:00.000Z" });
    // Le débit est développé dans la même requête : un seul aller-retour.
    expect(vues).toHaveLength(1);
    expect(new URLSearchParams(vues[0]!.corps).getAll("expand[0]")).toEqual(["latest_charge"]);
    expect(lu).toMatchObject({
      id: "pi_AbCdEf",
      statut: "succeeded",
      payeLe: 1790003600,
      metadonnees: { ref: REFERENCE, retractation: "2026-09-26T08:30:00.000Z", telechargement: "2026-09-26T08:29:59.000Z" },
    });
  });

  it("écrit une marque sous sa clé d'idempotence, et reconnaît les refus de Stripe pour une clé déjà prise", async () => {
    const cle = `marque-retractation-${REFERENCE}-1`;
    const { client, vues } = reseau(() => ({ json: paiement("succeeded", REFERENCE) }));
    await client.modifierMetadonnees("pi_1", { retractation: "2026-09-26T08:30:00.000Z" }, cle);
    expect(vues[0]!.entetes.get("idempotency-key")).toBe(cle);

    // Même clé, autres paramètres : Stripe refuse (400, « idempotency_error »).
    const refus = reseau(() => ({
      statut: 400,
      json: { error: { type: "idempotency_error", message: "Keys for idempotent requests can only be used with the same parameters they were first used with." } },
    }));
    const dejaUtilisee = await refus.client.modifierMetadonnees("pi_1", { retractation: "2026-09-26T08:30:01.000Z" }, cle).catch((e: unknown) => e);
    expect(erreurDIdempotence(dejaUtilisee)).toBe("deja_utilisee");
    expect(refus.vues).toHaveLength(1);

    // Une autre requête de même clé s'exécute encore : 409 (sans nouvel essai ici, Stripe le déconseille par son en-tête).
    const conflit = reseau(() => ({
      statut: 409,
      json: { error: { type: "idempotency_error", message: "There is currently another in-progress request using this idempotent key." } },
      entetes: { "Stripe-Should-Retry": "false" },
    }));
    const enCours = await conflit.client.modifierMetadonnees("pi_1", { retractation: "2026-09-26T08:30:01.000Z" }, cle).catch((e: unknown) => e);
    expect(erreurDIdempotence(enCours)).toBe("en_cours");

    // Toute autre erreur n'a rien à voir avec la clé.
    expect(erreurDIdempotence(Object.assign(new Error("x"), { type: "StripeAPIError", statusCode: 500 }))).toBeNull();
    expect(erreurDIdempotence(Object.assign(new Error("x"), { type: "StripeConnectionError" }))).toBeNull();
    expect(erreurDIdempotence(null)).toBeNull();
  });

  it("reconnaît la limitation de débit de Stripe", async () => {
    const { client } = reseau(() => ({
      statut: 429,
      json: { error: { type: "invalid_request_error", code: "rate_limit", message: "Too many requests" } },
    }));
    const erreur = await client.paiementParReference(REFERENCE).catch((e: unknown) => e);
    expect(limiteDeDebit(erreur)).toBe(true);
    expect(limiteDeDebit(Object.assign(new Error("x"), { type: "StripeConnectionError" }))).toBe(false);
    expect(limiteDeDebit(null)).toBe(false);
  });

  it("forme des requêtes de recherche sans surprise", () => {
    expect(requeteParReference(REFERENCE)).toBe(`metadata["ref"]:"${REFERENCE}"`);
    expect(requeteConfigurationsAvant(1787400000.9)).toBe('metadata["config"]:"chiffree" AND created<1787400000');
  });
});
