import { VENDEUR, type FicheVendeur } from "@/contenu/vendeur";
import type { Configuration } from "@/engine/types";
import type { Dependances } from "@/vente/dependances";
import type { Environnement } from "@/vente/environnement";
import type { ClientStripe, DebitLu, PaiementLu, ParametresSession, RemboursementLu, SessionLue } from "@/vente/stripe";
import { configuration } from "./aide";

/**
 * Le faux Stripe des tests.
 *
 * Il implémente la même petite interface que le vrai client, enregistre
 * chaque requête telle que le site l'envoie, et garde en mémoire les
 * sessions et les paiements. `payer()` simule un paiement abouti : le
 * paiement reçoit exactement les métadonnées que le site a confiées à la
 * session, comme chez Stripe. `rembourser()` suit les règles de Stripe : une
 * même clé d'idempotence rend le même remboursement, et un paiement n'est
 * jamais remboursé au-delà de son montant.
 */
export class FauxStripe implements ClientStripe {
  readonly sessionsCreees: { parametres: ParametresSession; cleIdempotence: string }[] = [];
  readonly sessionsLues: string[] = [];
  readonly recherchesParReference: string[] = [];
  readonly recherchesAEffacer: { avant: number; page: string | null }[] = [];
  readonly modifications: { id: string; metadonnees: Record<string, string> }[] = [];
  readonly modificationsDeDebits: { id: string; metadonnees: Record<string, string> }[] = [];
  readonly recherchesDeDebits: { avant: number; page: string | null }[] = [];
  readonly recherchesAbouties: { depuis: number; page: string | null }[] = [];
  readonly paiementsRelus: string[] = [];
  readonly sessionsCherchees: string[] = [];
  /** Chaque demande de remboursement, telle que le site l'envoie. */
  readonly demandesDeRemboursement: { id: string; cle: string; metadonnees: Record<string, string> }[] = [];
  /** Les remboursements réellement faits : un par paiement au plus. */
  readonly remboursements: { id: string; idPaiement: string }[] = [];
  private readonly reponsesDeRemboursement = new Map<string, RemboursementLu>();
  /** Quand c'est vrai, chaque remboursement échoue (carte fermée, par exemple). */
  remboursementEnPanne = false;
  /** Quand c'est vrai, chaque modification de métadonnées échoue. */
  metadonneesEnPanne = false;
  readonly sessions = new Map<string, SessionLue>();
  readonly paiements = new Map<string, PaiementLu>();
  /** Débits : comme chez Stripe, chacun garde une copie des métadonnées du paiement prise à sa création. */
  readonly debits = new Map<string, DebitLu>();
  /** Paiements que la recherche ne voit pas encore (Stripe met jusqu'à une minute à les indexer). */
  readonly nonIndexes = new Set<string>();
  /** Taille des pages de la recherche, pour éprouver la pagination. */
  taillePage = 100;
  /**
   * La recherche de Stripe est tenue pour approximative : index en retard,
   * résultats périmés. Ces deux interrupteurs lui font renvoyer des paiements
   * qu'elle n'aurait pas dû renvoyer.
   */
  rechercheIgnoreLaDate = false;
  rechercheIgnoreLEtat = false;
  /** Quand c'est vrai, chaque appel échoue comme une panne réseau. */
  enPanne = false;
  private compteur = 0;

  private panne(): void {
    if (this.enPanne) throw Object.assign(new Error("panne simulée"), { type: "StripeConnectionError" });
  }

  async creerSession(parametres: ParametresSession, cleIdempotence: string): Promise<{ url: string }> {
    this.panne();
    this.sessionsCreees.push({ parametres: structuredClone(parametres), cleIdempotence });
    this.compteur += 1;
    const id = `cs_test_faux${String(this.compteur).padStart(4, "0")}`;
    this.sessions.set(id, {
      id,
      payee: false,
      metadonnees: { ...(parametres.metadata ?? {}) } as Record<string, string>,
      paiement: null,
      email: null,
    });
    return { url: `https://checkout.stripe.com/c/pay/${id}` };
  }

  async lireSession(id: string): Promise<SessionLue | null> {
    this.panne();
    this.sessionsLues.push(id);
    const session = this.sessions.get(id);
    return session ? structuredClone(session) : null;
  }

  async paiementParReference(reference: string): Promise<PaiementLu | null> {
    this.panne();
    this.recherchesParReference.push(reference);
    for (const paiement of this.paiements.values()) {
      if (!this.nonIndexes.has(paiement.id) && paiement.metadonnees.ref === reference) return structuredClone(paiement);
    }
    return null;
  }

  async lirePaiement(id: string): Promise<PaiementLu | null> {
    this.panne();
    this.paiementsRelus.push(id);
    const paiement = this.paiements.get(id);
    return paiement ? structuredClone(paiement) : null;
  }

  async sessionDuPaiement(idPaiement: string): Promise<SessionLue | null> {
    this.panne();
    this.sessionsCherchees.push(idPaiement);
    for (const session of this.sessions.values()) {
      if (session.paiement?.id === idPaiement) return structuredClone(session);
    }
    return null;
  }

  async paiementsAboutisDepuis(
    depuis: number,
    page: string | null,
  ): Promise<{ paiements: PaiementLu[]; pageSuivante: string | null }> {
    this.panne();
    this.recherchesAbouties.push({ depuis, page });
    const trouves = [...this.paiements.values()].filter(
      (paiement) => !this.nonIndexes.has(paiement.id) && paiement.statut === "succeeded" && paiement.cree > depuis,
    );
    const debut = page ? Number(page) : 0;
    const suite = debut + this.taillePage;
    return {
      paiements: trouves.slice(debut, suite).map((paiement) => structuredClone(paiement)),
      pageSuivante: suite < trouves.length ? String(suite) : null,
    };
  }

  async paiementsAvecConfiguration(
    avant: number,
    page: string | null,
  ): Promise<{ paiements: PaiementLu[]; pageSuivante: string | null }> {
    this.panne();
    this.recherchesAEffacer.push({ avant, page });
    const trouves = [...this.paiements.values()].filter(
      (paiement) =>
        (this.rechercheIgnoreLEtat || paiement.metadonnees.config === "chiffree") &&
        (this.rechercheIgnoreLaDate || paiement.cree < avant),
    );
    const debut = page ? Number(page) : 0;
    const suite = debut + this.taillePage;
    return {
      paiements: trouves.slice(debut, suite).map((paiement) => structuredClone(paiement)),
      pageSuivante: suite < trouves.length ? String(suite) : null,
    };
  }

  async debitsAvecConfiguration(
    avant: number,
    page: string | null,
  ): Promise<{ debits: DebitLu[]; pageSuivante: string | null }> {
    this.panne();
    this.recherchesDeDebits.push({ avant, page });
    const trouves = [...this.debits.values()].filter(
      (debit) =>
        (this.rechercheIgnoreLEtat || debit.metadonnees.config === "chiffree") &&
        (this.rechercheIgnoreLaDate || debit.cree < avant),
    );
    const debut = page ? Number(page) : 0;
    const suite = debut + this.taillePage;
    return {
      debits: trouves.slice(debut, suite).map((debit) => structuredClone(debit)),
      pageSuivante: suite < trouves.length ? String(suite) : null,
    };
  }

  async modifierMetadonnees(id: string, metadonnees: Record<string, string>): Promise<void> {
    this.panne();
    if (this.metadonneesEnPanne) throw Object.assign(new Error("panne simulée"), { type: "StripeAPIError" });
    this.modifications.push({ id, metadonnees: { ...metadonnees } });
    const paiement = this.paiements.get(id);
    if (!paiement) throw Object.assign(new Error("absent"), { code: "resource_missing" });
    appliquer(paiement.metadonnees, metadonnees);
    // Comme chez Stripe : la mise à jour du paiement ne touche pas ses débits.
  }

  async modifierMetadonneesDuDebit(id: string, metadonnees: Record<string, string>): Promise<void> {
    this.panne();
    this.modificationsDeDebits.push({ id, metadonnees: { ...metadonnees } });
    const debit = this.debits.get(id);
    if (!debit) throw Object.assign(new Error("absent"), { code: "resource_missing" });
    appliquer(debit.metadonnees, metadonnees);
  }

  async rembourser(idPaiement: string, cle: string, metadonnees: Record<string, string>): Promise<RemboursementLu> {
    this.panne();
    this.demandesDeRemboursement.push({ id: idPaiement, cle, metadonnees: { ...metadonnees } });
    const deja = this.reponsesDeRemboursement.get(cle);
    if (deja) return { ...deja };
    const paiement = this.paiements.get(idPaiement);
    if (!paiement) throw Object.assign(new Error("absent"), { code: "resource_missing" });
    if (this.remboursementEnPanne) throw Object.assign(new Error("refus simulé"), { type: "StripeCardError", code: "card_declined" });
    if (paiement.litige) throw Object.assign(new Error("litige"), { type: "StripeInvalidRequestError", code: "charge_disputed" });
    // Comme le vrai client : un paiement déjà remboursé en totalité compte pour remboursé.
    if (paiement.rembourseEnTotalite) return { id: "", statut: "succeeded" };
    paiement.rembourseEnTotalite = true;
    const remboursement = { id: `re_faux${this.remboursements.length + 1}`, statut: "succeeded" };
    this.remboursements.push({ id: remboursement.id, idPaiement });
    this.reponsesDeRemboursement.set(cle, remboursement);
    return { ...remboursement };
  }

  /** La dernière session créée par le site, et sa référence. */
  derniereSession(): { id: string; reference: string; parametres: ParametresSession } {
    const index = this.sessionsCreees.length;
    const creee = this.sessionsCreees[index - 1];
    if (!creee) throw new Error("aucune session créée");
    return {
      id: `cs_test_faux${String(index).padStart(4, "0")}`,
      reference: creee.parametres.metadata!.ref as string,
      parametres: creee.parametres,
    };
  }

  /**
   * Simule le paiement de la dernière session créée. `premiereTentative`
   * simule une carte refusée avant le débit réussi : le paiement est alors
   * créé à la première tentative, et chaque tentative laisse un débit.
   */
  payer(
    options: {
      payeLe?: Date;
      premiereTentative?: Date;
      statut?: string;
      indexe?: boolean;
      /** L'adresse saisie sur la page de paiement (customer_details.email). */
      email?: string | null;
      /** L'e-mail de facturation du débit, s'il diffère. */
      emailDuDebit?: string | null;
    } = {},
  ): {
    sessionId: string;
    reference: string;
    paiement: PaiementLu;
  } {
    const { id, reference, parametres } = this.derniereSession();
    const statut = options.statut ?? "succeeded";
    const metadonnees = parametres.payment_intent_data!.metadata as Record<string, string>;
    const payeLe = Math.floor((options.payeLe ?? new Date()).getTime() / 1000);
    const cree = options.premiereTentative ? Math.floor(options.premiereTentative.getTime() / 1000) : payeLe;
    const numero = this.paiements.size + 1;
    const email = options.email === undefined ? EMAIL_ACHETEUR : options.email;
    const paiement: PaiementLu = {
      id: `pi_faux${numero}`,
      statut,
      cree,
      payeLe,
      montant: 1290,
      metadonnees: { ...metadonnees },
      rembourseEnTotalite: false,
      litige: false,
      emailDuDebit: options.emailDuDebit === undefined ? email : options.emailDuDebit,
    };
    this.paiements.set(paiement.id, paiement);
    if (options.premiereTentative) {
      this.debits.set(`ch_faux${numero}_refuse`, { id: `ch_faux${numero}_refuse`, cree, metadonnees: { ...metadonnees } });
    }
    this.debits.set(`ch_faux${numero}`, { id: `ch_faux${numero}`, cree: payeLe, metadonnees: { ...metadonnees } });
    if (options.indexe === false) this.nonIndexes.add(paiement.id);
    this.sessions.set(id, { id, payee: statut === "succeeded", metadonnees: { ref: reference }, paiement, email });
    return { sessionId: id, reference, paiement };
  }

  /** Un remboursement fait hors du site, depuis le tableau de bord de Stripe. */
  rembourserHorsSite(idPaiement: string): void {
    this.paiements.get(idPaiement)!.rembourseEnTotalite = true;
  }

  /** Un litige ouvert par la banque de l'acheteur. */
  contester(idPaiement: string): void {
    this.paiements.get(idPaiement)!.litige = true;
  }
}

/** L'adresse que l'acheteur saisit sur la page de paiement, dans les tests. */
export const EMAIL_ACHETEUR = "parent.acheteur@exemple.fr";

/** Une mise à jour de métadonnées à la manière de Stripe : une valeur vide supprime la clé. */
function appliquer(cible: Record<string, string>, modifications: Record<string, string>): void {
  for (const [cle, valeur] of Object.entries(modifications)) {
    if (valeur === "") delete cible[cle];
    else cible[cle] = valeur;
  }
}

/**
 * Fausses clés. Elles sont composées à l'exécution : aucun motif de clé
 * Stripe n'apparaît tel quel dans le dépôt.
 */
export const CLE_TEST = ["sk", "test", "faux".repeat(8)].join("_");
export const CLE_REELLE = ["sk", "live", "faux".repeat(8)].join("_");
export const CLE_RESTREINTE_TEST = ["rk", "test", "faux".repeat(8)].join("_");
export const CLE_RESTREINTE_REELLE = ["rk", "live", "faux".repeat(8)].join("_");
export const CLE_RESEND = ["re", "faux".repeat(6)].join("_");
export const SECRET_TACHE = "secret-de-la-tache-quotidienne-0123456789";

export const DOMAINE_PRODUCTION = "mission-gateau.vercel.app";
export const DOMAINE_PREVERSION = "mission-gateau-a1b2c3d4e-facelessbuilds-projects.vercel.app";

/** Une préversion avec une clé de test et la clé de Resend : la vente d'essai est ouverte. */
export function environnement(partiel: Partial<Environnement> = {}): Environnement {
  return {
    cleStripe: CLE_TEST,
    vercelEnv: "preview",
    domaineProduction: DOMAINE_PRODUCTION,
    domaineDeploiement: DOMAINE_PREVERSION,
    port: undefined,
    cleResend: CLE_RESEND,
    secretTache: undefined,
    ...partiel,
  };
}

/** La fiche réelle, convention signée : la seule chose qui manque aujourd'hui. */
export const FICHE_COMPLETE: FicheVendeur = {
  ...VENDEUR,
  mediateur: { ...VENDEUR.mediateur, conventionSignee: true },
};

export function dependances(client: ClientStripe | null, partiel: Partial<Dependances> = {}): Dependances {
  return {
    env: environnement(),
    fiche: FICHE_COMPLETE,
    client,
    email: null,
    maintenant: () => new Date("2026-09-24T12:00:00.000Z"),
    ...partiel,
  };
}

/**
 * Une configuration dont chaque champ saisi porte une marque reconnaissable :
 * aucune ne doit se retrouver en clair chez Stripe ni dans un journal.
 */
export const MARQUES = [
  "Zéphyrine",
  "Zephyrine",
  "Bérénice",
  "Anatole",
  "mardi 31 mars",
  "16 h 45",
  "Mésanges",
  "Quimper",
  "07 98 76 54 32",
  "0798765432",
];

export function configurationMarquee(partiel: Partial<Configuration> = {}): Configuration {
  return configuration({
    prenom: "Zéphyrine",
    age: 11,
    nombreEnfants: 12,
    duree: 60,
    fete: {
      date: "mardi 31 mars",
      heure: "16 h 45",
      adresse: "3 allée des Mésanges, Quimper",
      contact: "07 98 76 54 32",
      invites: ["Bérénice", "Anatole"],
    },
    ...partiel,
  });
}

/** Les marques trouvées dans un texte, sans tenir compte de la casse. */
export function marquesDans(texte: string): string[] {
  const minuscule = texte.toLowerCase();
  return MARQUES.filter((marque) => minuscule.includes(marque.toLowerCase()));
}

/** Un corps de commande complet et valable. */
export function corpsDeCommande(partiel: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    configuration: configurationMarquee(),
    graine: "k7m2p9q4rs",
    pays: "FR",
    accordCgv: true,
    accordAccesImmediat: true,
    ...partiel,
  };
}

export function requeteJson(url: string, corps: unknown, entetes: Record<string, string> = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...entetes },
    body: typeof corps === "string" ? corps : JSON.stringify(corps),
  });
}
