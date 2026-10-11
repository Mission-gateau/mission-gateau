import Stripe from "stripe";
import { natureCle, type Environnement } from "./environnement";
import { BOUTIQUE, CLES, CONFIGURATION_CHIFFREE } from "./metadonnees";

/**
 * Tout ce que le site demande à Stripe passe par cette petite interface.
 *
 * Le code de la vente ne connaît qu'elle : en production, elle est servie par
 * le SDK officiel (creerClientStripe, plus bas) ; dans les tests, par un faux
 * client qui enregistre chaque requête. Elle ne rapporte de Stripe que ce
 * dont la vente a besoin.
 */

export type ParametresSession = Stripe.Checkout.SessionCreateParams;

export interface PaiementLu {
  id: string;
  /** État du PaymentIntent : « succeeded » quand le paiement est abouti. */
  statut: string;
  /** Création du PaymentIntent, en secondes Unix : la première tentative. */
  cree: number;
  /**
   * Heure du paiement, en secondes Unix : celle du dernier débit, qui est le
   * débit réussi d'un paiement abouti. Les 30 jours courent à partir d'elle,
   * comme le délai de rétractation.
   */
  payeLe: number;
  /** Montant payé, en centimes. */
  montant: number;
  metadonnees: Record<string, string>;
  /**
   * Les remboursements du paiement (ceux de son dernier débit, le débit
   * réussi), lus sur les remboursements eux-mêmes et jamais sur `refunded` :
   * voir src/vente/remboursement.ts.
   */
  remboursements: RemboursementDuPaiement[];
  /** Vrai si le dernier débit fait l'objet d'un litige (Charge.disputed). */
  litige: boolean;
  /** E-mail de facturation du dernier débit : le dernier recours pour écrire à l'acheteur. */
  emailDuDebit: string | null;
}

/** Un remboursement d'un paiement, tel que Stripe le rend. */
export interface RemboursementDuPaiement {
  id: string;
  /** « pending », « requires_action », « succeeded », « failed » ou « canceled ». */
  statut: string;
  /** Montant remboursé, en centimes. */
  montant: number;
}

/**
 * Un débit (Charge). Stripe y recopie les métadonnées du paiement au moment
 * où il le crée, configuration chiffrée comprise, et ne le met plus à jour
 * ensuite : la tâche d'effacement doit donc aussi passer par les débits.
 */
export interface DebitLu {
  id: string;
  /** Création du débit, en secondes Unix. */
  cree: number;
  metadonnees: Record<string, string>;
}

export interface SessionLue {
  id: string;
  /** Vrai quand Stripe tient la session pour payée. */
  payee: boolean;
  metadonnees: Record<string, string>;
  paiement: PaiementLu | null;
  /** customer_details.email : l'adresse saisie par l'acheteur sur la page de paiement. */
  email: string | null;
}

/** Un remboursement tel que Stripe l'a accepté. */
export interface RemboursementLu {
  id: string;
  /**
   * « succeeded », « pending », « requires_action », « failed » ou
   * « canceled » ; « deja_rembourse » quand Stripe refuse un nouveau
   * remboursement parce que le paiement l'est déjà en totalité (fait ou
   * demandé).
   */
  statut: string;
}

export interface ClientStripe {
  creerSession(parametres: ParametresSession, cleIdempotence: string): Promise<{ url: string }>;
  /** Null si la session n'existe pas. */
  lireSession(id: string): Promise<SessionLue | null>;
  /**
   * Le paiement qui porte cette référence, lu à jour : la recherche de Stripe
   * trouve l'identifiant, puis le paiement est relu par cet identifiant, car
   * la recherche peut rendre des métadonnées périmées. Null si aucun paiement
   * ne porte cette référence (ou si la recherche ne le voit pas encore).
   */
  paiementParReference(reference: string): Promise<PaiementLu | null>;
  /** Le paiement relu par son identifiant, toujours à jour. Null s'il n'existe pas. */
  lirePaiement(id: string): Promise<PaiementLu | null>;
  /** La session Checkout d'un paiement, pour y lire l'e-mail de l'acheteur. */
  sessionDuPaiement(idPaiement: string): Promise<SessionLue | null>;
  /** Paiements aboutis de cette boutique créés après `depuis` (secondes Unix), page après page. */
  paiementsAboutisDepuis(
    depuis: number,
    page: string | null,
  ): Promise<{ paiements: PaiementLu[]; pageSuivante: string | null }>;
  /** Paiements créés avant `avant` (secondes Unix) qui gardent une configuration chiffrée. */
  paiementsAvecConfiguration(
    avant: number,
    page: string | null,
  ): Promise<{ paiements: PaiementLu[]; pageSuivante: string | null }>;
  /** Débits créés avant `avant` (secondes Unix) qui gardent une copie de la configuration chiffrée. */
  debitsAvecConfiguration(
    avant: number,
    page: string | null,
  ): Promise<{ debits: DebitLu[]; pageSuivante: string | null }>;
  /**
   * Met à jour des métadonnées du paiement et le rend tel que Stripe le
   * renvoie en réponse à cette écriture : à jour, écritures précédentes
   * comprises. C'est sur lui que se décide qui, du premier téléchargement ou
   * de la rétractation, l'emporte (voir src/vente/course.ts).
   *
   * Avec une clé d'idempotence, Stripe n'exécute que la première requête
   * portant cette clé (24 heures durant) : la même requête est rejouée à
   * l'identique, une requête différente est refusée (voir erreurDIdempotence).
   */
  modifierMetadonnees(idPaiement: string, metadonnees: Record<string, string>, cleIdempotence?: string): Promise<PaiementLu>;
  modifierMetadonneesDuDebit(idDebit: string, metadonnees: Record<string, string>): Promise<void>;
  /**
   * Rembourse la totalité d'un paiement, motif « requested_by_customer ».
   * Un paiement déjà remboursé en totalité n'est pas une erreur : Stripe le
   * dit, et le remboursement est tenu pour fait.
   */
  rembourser(
    idPaiement: string,
    cleIdempotence: string,
    metadonnees: Record<string, string>,
  ): Promise<RemboursementLu>;
}

/**
 * Requêtes de recherche Stripe. La recherche ignore la casse : le résultat
 * est donc toujours revérifié à l'identique (voir paiementParReference).
 * La référence est validée avant d'arriver ici : elle ne contient ni
 * guillemet ni barre oblique inverse.
 */
export function requeteParReference(reference: string): string {
  return `metadata["${CLES.reference}"]:"${reference}" AND metadata["${CLES.boutique}"]:"${BOUTIQUE}"`;
}

/** Les paiements et les débits de cette boutique, configuration encore chiffrée, créés avant `avant`. */
export function requeteConfigurationsAvant(avant: number): string {
  return `metadata["${CLES.etatConfiguration}"]:"${CONFIGURATION_CHIFFREE}" AND created<${Math.floor(avant)} AND metadata["${CLES.boutique}"]:"${BOUTIQUE}"`;
}

export function requetePaiementsAboutisDepuis(depuis: number): string {
  return `status:"succeeded" AND created>${Math.floor(depuis)} AND metadata["${CLES.boutique}"]:"${BOUTIQUE}"`;
}

/**
 * Ce que chaque lecture d'un paiement développe : son dernier débit, et les
 * remboursements de ce débit (Stripe ne les renvoie que sur demande).
 */
export const DEVELOPPEMENT_DU_PAIEMENT = "latest_charge.refunds";

function lirePaiement(paiement: Stripe.PaymentIntent): PaiementLu {
  const charge = paiement.latest_charge && typeof paiement.latest_charge === "object" ? paiement.latest_charge : null;
  const remboursements = charge?.refunds?.data ?? [];
  return {
    id: paiement.id,
    statut: paiement.status,
    cree: paiement.created,
    payeLe: charge?.created ?? paiement.created,
    montant: paiement.amount_received || paiement.amount,
    metadonnees: { ...(paiement.metadata ?? {}) },
    remboursements: remboursements.map((remboursement) => ({
      id: remboursement.id,
      statut: remboursement.status ?? "pending",
      montant: remboursement.amount,
    })),
    litige: charge?.disputed === true,
    emailDuDebit: charge?.billing_details?.email ?? null,
  };
}

function lireDebit(debit: Stripe.Charge): DebitLu {
  return { id: debit.id, cree: debit.created, metadonnees: { ...(debit.metadata ?? {}) } };
}

function lireSessionStripe(session: Stripe.Checkout.Session): SessionLue {
  const paiement =
    session.payment_intent && typeof session.payment_intent === "object" ? lirePaiement(session.payment_intent) : null;
  return {
    id: session.id,
    payee: session.payment_status === "paid",
    metadonnees: { ...(session.metadata ?? {}) },
    paiement,
    email: session.customer_details?.email ?? null,
  };
}

function codeErreur(erreur: unknown): string | null {
  if (typeof erreur !== "object" || erreur === null) return null;
  const code = (erreur as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

/**
 * Ce que dit une erreur de Stripe d'une clé d'idempotence déjà prise :
 * « en_cours » quand une autre requête de même clé s'exécute encore (409),
 * « deja_utilisee » quand la clé a servi à une requête aux paramètres
 * différents, null pour toute autre erreur.
 */
export function erreurDIdempotence(erreur: unknown): "en_cours" | "deja_utilisee" | null {
  if (typeof erreur !== "object" || erreur === null) return null;
  const { type, statusCode, rawType } = erreur as { type?: unknown; statusCode?: unknown; rawType?: unknown };
  if (statusCode === 409) return "en_cours";
  if (type === "StripeIdempotencyError" || rawType === "idempotency_error") return "deja_utilisee";
  return null;
}

/** Stripe limite le débit (429, « rate_limit ») : une panne passagère d'un genre particulier. */
export function limiteDeDebit(erreur: unknown): boolean {
  if (typeof erreur !== "object" || erreur === null) return false;
  const { type, statusCode } = erreur as { type?: unknown; statusCode?: unknown };
  return type === "StripeRateLimitError" || codeErreur(erreur) === "rate_limit" || statusCode === 429;
}

/**
 * Le client réel. Null sans clé : aucune commande ne peut alors être
 * vérifiée, et rien n'est livré.
 * `options.httpClient` ne sert qu'aux tests, pour lire les requêtes telles
 * qu'elles partiraient sur le réseau.
 */
export function creerClientStripe(
  env: Environnement,
  options: { httpClient?: Stripe.HttpClient } = {},
): ClientStripe | null {
  if (!env.cleStripe || !natureCle(env.cleStripe)) return null;
  const stripe = new Stripe(env.cleStripe, {
    maxNetworkRetries: 2,
    timeout: 20_000,
    telemetry: false,
    ...(options.httpClient ? { httpClient: options.httpClient } : {}),
  });

  const relire = async (id: string): Promise<PaiementLu | null> => {
    try {
      return lirePaiement(await stripe.paymentIntents.retrieve(id, { expand: [DEVELOPPEMENT_DU_PAIEMENT] }));
    } catch (erreur) {
      if (codeErreur(erreur) === "resource_missing") return null;
      throw erreur;
    }
  };

  return {
    async creerSession(parametres, cleIdempotence) {
      const session = await stripe.checkout.sessions.create(parametres, { idempotencyKey: cleIdempotence });
      if (!session.url) throw new Error("Stripe n'a pas renvoyé d'adresse de paiement.");
      return { url: session.url };
    },

    async lireSession(id) {
      try {
        return lireSessionStripe(
          await stripe.checkout.sessions.retrieve(id, { expand: [`payment_intent.${DEVELOPPEMENT_DU_PAIEMENT}`] }),
        );
      } catch (erreur) {
        if (codeErreur(erreur) === "resource_missing") return null;
        throw erreur;
      }
    },

    async paiementParReference(reference) {
      const resultat = await stripe.paymentIntents.search({
        query: requeteParReference(reference),
        limit: 10,
      });
      const memeReference = resultat.data.filter(
        (paiement) => paiement.metadata?.[CLES.reference] === reference && paiement.metadata?.[CLES.boutique] === BOUTIQUE,
      );
      const choisi = memeReference.find((paiement) => paiement.status === "succeeded") ?? memeReference[0];
      if (!choisi) return null;
      const frais = await relire(choisi.id);
      return frais && frais.metadonnees[CLES.reference] === reference && frais.metadonnees[CLES.boutique] === BOUTIQUE ? frais : null;
    },

    lirePaiement: relire,

    async sessionDuPaiement(idPaiement) {
      const resultat = await stripe.checkout.sessions.list({ payment_intent: idPaiement, limit: 1 });
      const session = resultat.data[0];
      return session ? lireSessionStripe(session) : null;
    },

    async paiementsAboutisDepuis(depuis, page) {
      const resultat = await stripe.paymentIntents.search({
        query: requetePaiementsAboutisDepuis(depuis),
        limit: 100,
        expand: [`data.${DEVELOPPEMENT_DU_PAIEMENT}`],
        ...(page ? { page } : {}),
      });
      return {
        paiements: resultat.data.map(lirePaiement),
        pageSuivante: resultat.has_more && resultat.next_page ? resultat.next_page : null,
      };
    },

    async paiementsAvecConfiguration(avant, page) {
      const resultat = await stripe.paymentIntents.search({
        query: requeteConfigurationsAvant(avant),
        limit: 100,
        expand: [`data.${DEVELOPPEMENT_DU_PAIEMENT}`],
        ...(page ? { page } : {}),
      });
      return {
        paiements: resultat.data.map(lirePaiement),
        pageSuivante: resultat.has_more && resultat.next_page ? resultat.next_page : null,
      };
    },

    async debitsAvecConfiguration(avant, page) {
      const resultat = await stripe.charges.search({
        query: requeteConfigurationsAvant(avant),
        limit: 100,
        ...(page ? { page } : {}),
      });
      return {
        debits: resultat.data.map(lireDebit),
        pageSuivante: resultat.has_more && resultat.next_page ? resultat.next_page : null,
      };
    },

    async modifierMetadonnees(idPaiement, metadonnees, cleIdempotence) {
      return lirePaiement(
        await stripe.paymentIntents.update(
          idPaiement,
          { metadata: metadonnees, expand: [DEVELOPPEMENT_DU_PAIEMENT] },
          cleIdempotence ? { idempotencyKey: cleIdempotence } : undefined,
        ),
      );
    },

    async modifierMetadonneesDuDebit(idDebit, metadonnees) {
      await stripe.charges.update(idDebit, { metadata: metadonnees });
    },

    async rembourser(idPaiement, cleIdempotence, metadonnees) {
      try {
        const remboursement = await stripe.refunds.create(
          { payment_intent: idPaiement, reason: "requested_by_customer", metadata: metadonnees },
          { idempotencyKey: cleIdempotence },
        );
        return { id: remboursement.id, statut: remboursement.status ?? "pending" };
      } catch (erreur) {
        if (codeErreur(erreur) === "charge_already_refunded") return { id: "", statut: "deja_rembourse" };
        throw erreur;
      }
    },
  };
}
