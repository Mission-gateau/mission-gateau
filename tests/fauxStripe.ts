import { VENDEUR, type FicheVendeur } from "@/contenu/vendeur";
import type { Configuration } from "@/engine/types";
import type { Dependances } from "@/vente/dependances";
import type { Environnement } from "@/vente/environnement";
import { rembourseEnTotalite } from "@/vente/remboursement";
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
 * même clé d'idempotence rend le même remboursement (ou le même échec), et un
 * paiement n'est jamais remboursé au-delà de son montant ; un remboursement
 * naît `succeeded`, ou `pending` (`statutDesNouveauxRemboursements`), puis
 * `reglerRemboursement()` le fait passer à `succeeded` ou `failed`.
 * `panneAuProchainAppel` fait échouer l'appel suivant, quel qu'il soit : 500
 * (gardé sous sa clé d'idempotence, comme chez Stripe), 500 alors que
 * l'écriture s'est appliquée (réponse perdue), 429, ou coupure du réseau.
 * `modifierMetadonnees()` rend,
 * comme Stripe, le paiement à jour, écritures précédentes comprises ; avec
 * une clé d'idempotence, elle suit aussi les règles de Stripe : la première
 * requête de chaque clé s'exécute et sa réponse est gardée, échec compris ;
 * la même requête reçoit ensuite la même réponse, sans rien exécuter ; une
 * requête aux paramètres différents est refusée (400, « idempotency_error ») ;
 * une clé déclarée en cours répond 409.
 */
export class FauxStripe implements ClientStripe {
  readonly sessionsCreees: { parametres: ParametresSession; cleIdempotence: string }[] = [];
  readonly sessionsLues: string[] = [];
  readonly recherchesParReference: string[] = [];
  readonly recherchesAEffacer: { avant: number; page: string | null }[] = [];
  /** Les écritures de métadonnées réellement exécutées (une requête rejouée par sa clé n'y figure pas). */
  readonly modifications: { id: string; metadonnees: Record<string, string> }[] = [];
  /** Chaque demande d'écriture de métadonnées, avec sa clé d'idempotence, telle que le site l'envoie. */
  readonly demandesDeModification: { id: string; metadonnees: Record<string, string>; cle: string | null }[] = [];
  readonly modificationsDeDebits: { id: string; metadonnees: Record<string, string> }[] = [];
  readonly recherchesDeDebits: { avant: number; page: string | null }[] = [];
  readonly recherchesAbouties: { depuis: number; page: string | null }[] = [];
  readonly paiementsRelus: string[] = [];
  readonly sessionsCherchees: string[] = [];
  /** Chaque demande de remboursement, telle que le site l'envoie. */
  readonly demandesDeRemboursement: { id: string; cle: string; metadonnees: Record<string, string> }[] = [];
  /** Les remboursements réellement faits : un par paiement au plus. */
  readonly remboursements: { id: string; idPaiement: string }[] = [];
  private readonly reponsesDeRemboursement = new Map<string, { reponse?: RemboursementLu; erreur?: unknown }>();
  /** Quand c'est vrai, chaque demande de remboursement est refusée sur-le-champ (carte fermée, par exemple). */
  remboursementEnPanne = false;
  /** L'état d'un remboursement à sa création : effectué aussitôt, ou en attente (paiement pas encore réglé, solde insuffisant). */
  statutDesNouveauxRemboursements: "succeeded" | "pending" = "succeeded";
  /** L'appel suivant, quel qu'il soit, échoue ainsi ; puis tout redevient normal. */
  panneAuProchainAppel: PanneStripe | null = null;
  /** Pannes attendues sur une clé d'idempotence précise : la première écriture qui la porte échoue ainsi. */
  readonly pannesParCle = new Map<string, "500" | "500_appliquee">();
  /** Appelée avant chaque écriture de métadonnées : un test peut y retenir une écriture précise, le temps d'en faire passer d'autres. */
  avantEcriture: ((ecriture: { cle: string | null; metadonnees: Record<string, string> }) => Promise<void> | void) | null = null;
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
  rechercheIgnoreLaBoutique = false;
  /** Quand c'est vrai, chaque appel échoue comme une panne réseau. */
  enPanne = false;
  /** Quand c'est vrai, chaque appel est refusé comme par la limitation de débit de Stripe (429). */
  debitLimite = false;
  /** Écritures qui échouent quand elles portent l'une de ces clés (par exemple `course`). */
  readonly clesEnPanne = new Set<string>();
  /** Clés d'idempotence dont une requête s'exécute encore chez Stripe : toute autre requête de même clé reçoit 409. */
  readonly clesDIdempotenceEnCours = new Set<string>();
  /** Réponses gardées par clé d'idempotence : les paramètres de la première requête, et sa réponse ou son erreur. */
  private readonly reponsesParCle = new Map<string, { parametres: string; reponse?: PaiementLu; erreur?: unknown }>();
  private compteur = 0;

  /**
   * Les pannes qui empêchent un appel de s'exécuter. Une écriture reçoit la
   * panne injectée « 500 » ou « 500 appliquée » pour la traiter elle-même
   * (Stripe garde le résultat d'une requête exécutée, échec compris) ; une
   * lecture échoue aussitôt.
   */
  private panne(ecriture = false): "500" | "500_appliquee" | null {
    if (this.enPanne) throw erreurDeConnexion();
    if (this.debitLimite) throw erreurDeDebit();
    const injectee = this.panneAuProchainAppel;
    this.panneAuProchainAppel = null;
    if (injectee === "connexion") throw erreurDeConnexion();
    if (injectee === "429") throw erreurDeDebit();
    if (injectee && !ecriture) throw erreur500();
    return injectee;
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
    // Comme la requête du site : la référence, et la boutique.
    for (const paiement of this.paiements.values()) {
      if (
        !this.nonIndexes.has(paiement.id) &&
        paiement.metadonnees.ref === reference &&
        (this.rechercheIgnoreLaBoutique || paiement.metadonnees.boutique === "mission-gateau")
      ) {
        return structuredClone(paiement);
      }
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
    // Comme la requête du site : aboutis, assez récents, et de cette boutique.
    const trouves = [...this.paiements.values()].filter(
      (paiement) =>
        !this.nonIndexes.has(paiement.id) &&
        paiement.statut === "succeeded" &&
        paiement.cree > depuis &&
        (this.rechercheIgnoreLaBoutique || paiement.metadonnees.boutique === "mission-gateau"),
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

  async modifierMetadonnees(id: string, metadonnees: Record<string, string>, cleIdempotence?: string): Promise<PaiementLu> {
    let injectee = this.panne(true);
    if (this.avantEcriture) await this.avantEcriture({ cle: cleIdempotence ?? null, metadonnees: { ...metadonnees } });
    const parCle = cleIdempotence ? this.pannesParCle.get(cleIdempotence) : undefined;
    if (parCle) {
      this.pannesParCle.delete(cleIdempotence!);
      injectee ??= parCle;
    }
    this.demandesDeModification.push({ id, metadonnees: { ...metadonnees }, cle: cleIdempotence ?? null });
    if (!cleIdempotence) {
      if (injectee === "500_appliquee") this.executerModification(id, metadonnees);
      if (injectee) throw erreur500();
      return this.executerModification(id, metadonnees);
    }
    if (this.clesDIdempotenceEnCours.has(cleIdempotence)) {
      throw Object.assign(new Error("requête concurrente de même clé"), {
        type: "StripeIdempotencyError",
        rawType: "idempotency_error",
        statusCode: 409,
      });
    }
    const parametres = JSON.stringify([id, metadonnees]);
    const gardee = this.reponsesParCle.get(cleIdempotence);
    if (gardee) {
      if (gardee.parametres !== parametres) {
        throw Object.assign(new Error("clé déjà utilisée avec d'autres paramètres"), {
          type: "StripeIdempotencyError",
          rawType: "idempotency_error",
          statusCode: 400,
        });
      }
      if (gardee.reponse) return structuredClone(gardee.reponse);
      throw gardee.erreur;
    }
    try {
      if (injectee === "500_appliquee") this.executerModification(id, metadonnees);
      if (injectee) throw erreur500();
      const reponse = this.executerModification(id, metadonnees);
      this.reponsesParCle.set(cleIdempotence, { parametres, reponse: structuredClone(reponse) });
      return reponse;
    } catch (erreur) {
      // Comme chez Stripe : l'échec d'une requête exécutée est gardé, lui aussi.
      this.reponsesParCle.set(cleIdempotence, { parametres, erreur });
      throw erreur;
    }
  }

  private executerModification(id: string, metadonnees: Record<string, string>): PaiementLu {
    if (this.metadonneesEnPanne || Object.keys(metadonnees).some((cle) => this.clesEnPanne.has(cle))) throw erreur500();
    const paiement = this.paiements.get(id);
    if (!paiement) throw Object.assign(new Error("absent"), { code: "resource_missing", statusCode: 404 });
    this.modifications.push({ id, metadonnees: { ...metadonnees } });
    appliquer(paiement.metadonnees, metadonnees);
    // Comme chez Stripe : la mise à jour du paiement ne touche pas ses débits,
    // et la réponse est le paiement à jour.
    return structuredClone(paiement);
  }

  /** Stripe oublie les clés d'idempotence au bout de 24 heures. */
  oublierLesClesDIdempotence(): void {
    this.reponsesParCle.clear();
    this.reponsesDeRemboursement.clear();
  }

  /**
   * Une réponse 500 que Stripe garde sous cette clé, pour une requête aux
   * paramètres inconnus : toute requête qui la porte ensuite est refusée
   * (400), comme chez Stripe.
   */
  garderUnEchec(cle: string): void {
    this.reponsesParCle.set(cle, { parametres: "(une requête passée)", erreur: erreur500() });
  }

  async modifierMetadonneesDuDebit(id: string, metadonnees: Record<string, string>): Promise<void> {
    this.panne();
    this.modificationsDeDebits.push({ id, metadonnees: { ...metadonnees } });
    const debit = this.debits.get(id);
    if (!debit) throw Object.assign(new Error("absent"), { code: "resource_missing" });
    appliquer(debit.metadonnees, metadonnees);
  }

  async rembourser(idPaiement: string, cle: string, metadonnees: Record<string, string>): Promise<RemboursementLu> {
    const injectee = this.panne(true);
    this.demandesDeRemboursement.push({ id: idPaiement, cle, metadonnees: { ...metadonnees } });
    const deja = this.reponsesDeRemboursement.get(cle);
    if (deja) {
      if (deja.reponse) return { ...deja.reponse };
      throw deja.erreur;
    }
    const paiement = this.paiements.get(idPaiement);
    if (!paiement) throw Object.assign(new Error("absent"), { code: "resource_missing" });
    if (injectee === "500") {
      // Stripe garde l'échec d'une requête exécutée sous sa clé.
      const erreur = erreur500();
      this.reponsesDeRemboursement.set(cle, { erreur });
      throw erreur;
    }
    if (this.remboursementEnPanne) throw Object.assign(new Error("refus simulé"), { type: "StripeCardError", code: "card_declined" });
    if (paiement.litige) throw Object.assign(new Error("litige"), { type: "StripeInvalidRequestError", code: "charge_disputed" });
    // Comme le vrai client : Stripe refuse un nouveau remboursement d'un paiement déjà remboursé en totalité, fait ou demandé.
    if (rembourseEnTotalite(paiement)) return { id: "", statut: "deja_rembourse" };
    const remboursement = { id: `re_faux${this.remboursements.length + 1}`, statut: this.statutDesNouveauxRemboursements };
    paiement.remboursements.push({ id: remboursement.id, statut: remboursement.statut, montant: paiement.montant });
    this.remboursements.push({ id: remboursement.id, idPaiement });
    if (injectee === "500_appliquee") {
      // Le remboursement est créé, mais la réponse se perd : Stripe garde l'échec sous la clé.
      const erreur = erreur500();
      this.reponsesDeRemboursement.set(cle, { erreur });
      throw erreur;
    }
    this.reponsesDeRemboursement.set(cle, { reponse: remboursement });
    return { ...remboursement };
  }

  /** Un remboursement en attente se règle chez Stripe : effectué, ou en échec. */
  reglerRemboursement(idRemboursement: string, statut: "succeeded" | "failed" | "canceled"): void {
    for (const paiement of this.paiements.values()) {
      const remboursement = paiement.remboursements.find((r) => r.id === idRemboursement);
      if (remboursement) {
        remboursement.statut = statut;
        return;
      }
    }
    throw new Error(`remboursement ${idRemboursement} inconnu`);
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
      /** Un paiement d'un autre produit du même compte Stripe : sans la métadonnée `boutique`. */
      sansBoutique?: boolean;
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
      remboursements: [],
      litige: false,
      emailDuDebit: options.emailDuDebit === undefined ? email : options.emailDuDebit,
    };
    if (options.sansBoutique) delete paiement.metadonnees.boutique;
    this.paiements.set(paiement.id, paiement);
    if (options.premiereTentative) {
      this.debits.set(`ch_faux${numero}_refuse`, { id: `ch_faux${numero}_refuse`, cree, metadonnees: { ...metadonnees } });
    }
    this.debits.set(`ch_faux${numero}`, { id: `ch_faux${numero}`, cree: payeLe, metadonnees: { ...metadonnees } });
    if (options.indexe === false) this.nonIndexes.add(paiement.id);
    this.sessions.set(id, { id, payee: statut === "succeeded", metadonnees: { ref: reference }, paiement, email });
    return { sessionId: id, reference, paiement };
  }

  /** Un remboursement fait hors du site, depuis le tableau de bord de Stripe : effectué, ou seulement demandé. */
  rembourserHorsSite(idPaiement: string, statut: "succeeded" | "pending" = "succeeded"): string {
    const paiement = this.paiements.get(idPaiement)!;
    const id = `re_tableau${paiement.remboursements.length + 1}_${idPaiement}`;
    paiement.remboursements.push({ id, statut, montant: paiement.montant });
    return id;
  }

  /** Un litige ouvert par la banque de l'acheteur. */
  contester(idPaiement: string): void {
    this.paiements.get(idPaiement)!.litige = true;
  }
}

/** Les pannes que le faux Stripe sait injecter dans un appel. */
export type PanneStripe = "500" | "500_appliquee" | "429" | "connexion";

function erreur500(): Error {
  return Object.assign(new Error("panne simulée"), { type: "StripeAPIError", statusCode: 500 });
}

function erreurDeDebit(): Error {
  return Object.assign(new Error("trop de requêtes"), { type: "StripeRateLimitError", code: "rate_limit", statusCode: 429 });
}

function erreurDeConnexion(): Error {
  return Object.assign(new Error("panne simulée"), { type: "StripeConnectionError" });
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

/** La fiche réelle : complète, convention avec le médiateur signée le 25 septembre 2026. */
export const FICHE_COMPLETE: FicheVendeur = VENDEUR;

/** La fiche telle qu'elle était avant la signature de la convention : le médiateur n'y est nommé nulle part. */
export const FICHE_SANS_CONVENTION: FicheVendeur = {
  ...VENDEUR,
  mediateur: { ...VENDEUR.mediateur, conventionSignee: false },
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
