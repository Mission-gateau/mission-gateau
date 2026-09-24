import { VENDEUR, type FicheVendeur } from "@/contenu/vendeur";
import type { Configuration } from "@/engine/types";
import type { Dependances } from "@/vente/dependances";
import type { Environnement } from "@/vente/environnement";
import type { ClientStripe, DebitLu, PaiementLu, ParametresSession, SessionLue } from "@/vente/stripe";
import { configuration } from "./aide";

/**
 * Le faux Stripe des tests.
 *
 * Il implémente la même petite interface que le vrai client, enregistre
 * chaque requête telle que le site l'envoie, et garde en mémoire les
 * sessions et les paiements. `payer()` simule un paiement abouti : le
 * paiement reçoit exactement les métadonnées que le site a confiées à la
 * session, comme chez Stripe.
 */
export class FauxStripe implements ClientStripe {
  readonly sessionsCreees: { parametres: ParametresSession; cleIdempotence: string }[] = [];
  readonly sessionsLues: string[] = [];
  readonly recherchesParReference: string[] = [];
  readonly recherchesAEffacer: { avant: number; page: string | null }[] = [];
  readonly modifications: { id: string; metadonnees: Record<string, string> }[] = [];
  readonly modificationsDeDebits: { id: string; metadonnees: Record<string, string> }[] = [];
  readonly recherchesDeDebits: { avant: number; page: string | null }[] = [];
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
    this.sessions.set(id, { id, payee: false, metadonnees: { ...(parametres.metadata ?? {}) } as Record<string, string>, paiement: null });
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
  payer(options: { payeLe?: Date; premiereTentative?: Date; statut?: string; indexe?: boolean } = {}): {
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
    const paiement: PaiementLu = {
      id: `pi_faux${numero}`,
      statut,
      cree,
      payeLe,
      metadonnees: { ...metadonnees },
      rembourseEnTotalite: false,
    };
    this.paiements.set(paiement.id, paiement);
    if (options.premiereTentative) {
      this.debits.set(`ch_faux${numero}_refuse`, { id: `ch_faux${numero}_refuse`, cree, metadonnees: { ...metadonnees } });
    }
    this.debits.set(`ch_faux${numero}`, { id: `ch_faux${numero}`, cree: payeLe, metadonnees: { ...metadonnees } });
    if (options.indexe === false) this.nonIndexes.add(paiement.id);
    this.sessions.set(id, { id, payee: statut === "succeeded", metadonnees: { ref: reference }, paiement });
    return { sessionId: id, reference, paiement };
  }

  rembourser(idPaiement: string): void {
    const paiement = this.paiements.get(idPaiement)!;
    paiement.rembourseEnTotalite = true;
    for (const session of this.sessions.values()) {
      if (session.paiement?.id === idPaiement) session.paiement.rembourseEnTotalite = true;
    }
  }
}

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

export const DOMAINE_PRODUCTION = "mission-gateau.vercel.app";
export const DOMAINE_PREVERSION = "mission-gateau-a1b2c3d4e-facelessbuilds-projects.vercel.app";

/** Une préversion avec une clé de test : la bonne nature hors production. */
export function environnement(partiel: Partial<Environnement> = {}): Environnement {
  return {
    cleStripe: CLE_TEST,
    vercelEnv: "preview",
    domaineProduction: DOMAINE_PRODUCTION,
    domaineDeploiement: DOMAINE_PREVERSION,
    port: undefined,
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
