import Stripe from "stripe";
import { natureCle, type Environnement } from "./environnement";
import { CLES, CONFIGURATION_CHIFFREE } from "./metadonnees";

/**
 * Tout ce que le site demande à Stripe passe par cette petite interface.
 *
 * Le code de la vente ne connaît qu'elle : en production, elle est servie par
 * le SDK officiel (creerClientStripe, plus bas) ; dans les tests, par un faux
 * client qui enregistre chaque requête. Elle ne rapporte de Stripe que ce
 * dont la livraison a besoin.
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
   * débit réussi d'un paiement abouti. Les 30 jours courent à partir d'elle.
   */
  payeLe: number;
  metadonnees: Record<string, string>;
  /** Vrai seulement si le paiement a été remboursé en totalité. */
  rembourseEnTotalite: boolean;
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
}

export interface ClientStripe {
  creerSession(parametres: ParametresSession, cleIdempotence: string): Promise<{ url: string }>;
  /** Null si la session n'existe pas. */
  lireSession(id: string): Promise<SessionLue | null>;
  /** Null si aucun paiement ne porte cette référence. */
  paiementParReference(reference: string): Promise<PaiementLu | null>;
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
  modifierMetadonnees(idPaiement: string, metadonnees: Record<string, string>): Promise<void>;
  modifierMetadonneesDuDebit(idDebit: string, metadonnees: Record<string, string>): Promise<void>;
}

/**
 * Requêtes de recherche Stripe. La recherche ignore la casse : le résultat
 * est donc toujours revérifié à l'identique (voir paiementParReference).
 * La référence est validée avant d'arriver ici : elle ne contient ni
 * guillemet ni barre oblique inverse.
 */
export function requeteParReference(reference: string): string {
  return `metadata["${CLES.reference}"]:"${reference}"`;
}

export function requeteConfigurationsAvant(avant: number): string {
  return `metadata["${CLES.etatConfiguration}"]:"${CONFIGURATION_CHIFFREE}" AND created<${Math.floor(avant)}`;
}

function lirePaiement(paiement: Stripe.PaymentIntent): PaiementLu {
  const charge = paiement.latest_charge && typeof paiement.latest_charge === "object" ? paiement.latest_charge : null;
  return {
    id: paiement.id,
    statut: paiement.status,
    cree: paiement.created,
    payeLe: charge?.created ?? paiement.created,
    metadonnees: { ...(paiement.metadata ?? {}) },
    rembourseEnTotalite: charge?.refunded === true,
  };
}

function lireDebit(debit: Stripe.Charge): DebitLu {
  return { id: debit.id, cree: debit.created, metadonnees: { ...(debit.metadata ?? {}) } };
}

function ressourceAbsente(erreur: unknown): boolean {
  return typeof erreur === "object" && erreur !== null && (erreur as { code?: unknown }).code === "resource_missing";
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

  return {
    async creerSession(parametres, cleIdempotence) {
      const session = await stripe.checkout.sessions.create(parametres, { idempotencyKey: cleIdempotence });
      if (!session.url) throw new Error("Stripe n'a pas renvoyé d'adresse de paiement.");
      return { url: session.url };
    },

    async lireSession(id) {
      try {
        const session = await stripe.checkout.sessions.retrieve(id, { expand: ["payment_intent.latest_charge"] });
        const paiement =
          session.payment_intent && typeof session.payment_intent === "object"
            ? lirePaiement(session.payment_intent)
            : null;
        return {
          id: session.id,
          payee: session.payment_status === "paid",
          metadonnees: { ...(session.metadata ?? {}) },
          paiement,
        };
      } catch (erreur) {
        if (ressourceAbsente(erreur)) return null;
        throw erreur;
      }
    },

    async paiementParReference(reference) {
      const resultat = await stripe.paymentIntents.search({
        query: requeteParReference(reference),
        limit: 10,
        expand: ["data.latest_charge"],
      });
      const memeReference = resultat.data.filter((paiement) => paiement.metadata?.[CLES.reference] === reference);
      const choisi = memeReference.find((paiement) => paiement.status === "succeeded") ?? memeReference[0];
      return choisi ? lirePaiement(choisi) : null;
    },

    async paiementsAvecConfiguration(avant, page) {
      const resultat = await stripe.paymentIntents.search({
        query: requeteConfigurationsAvant(avant),
        limit: 100,
        expand: ["data.latest_charge"],
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

    async modifierMetadonnees(idPaiement, metadonnees) {
      await stripe.paymentIntents.update(idPaiement, { metadata: metadonnees });
    },

    async modifierMetadonneesDuDebit(idDebit, metadonnees) {
      await stripe.charges.update(idDebit, { metadata: metadonnees });
    },
  };
}
