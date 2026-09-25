import { graineValide } from "../engine/alea";
import { schemaConfiguration } from "../engine/configuration";
import { VERSION_KIT, construireKit } from "../engine/kit";
import type { Configuration } from "../engine/types";
import { verifierKit } from "../engine/validation";
import { VERSION_CGV } from "../contenu/cgv";
import { REPONSES_RETRACTATION } from "../contenu/retractation";
import { ACHAT, REPONSES_COMMANDE } from "../contenu/vente";
import { etatDeLaCommande, etatDuPaiement, type EtatCommande } from "./commande";
import { envoyerLaConfirmation, type IssueConfirmation } from "./confirmation";
import type { Dependances } from "./dependances";
import { adresseDuSite } from "./environnement";
import { texteDeLEtat, type Refus } from "./etats";
import { codesErreur, journal } from "./journal";
import { KitRefuse, produireKitLivre } from "./livraison";
import { CLES, depassementsDeMetadonnees, metadonneesDuPaiement } from "./metadonnees";
import { exemplaireDEssai, livraisonPossible, venteOuverte } from "./ouverture";
import { paysAccepte } from "./pays";
import { creerReference } from "./reference";
import { schemaDeclaration, traiterDeclaration } from "./retractation";
import { LONGUEUR_CHAMP_FACTURE, lienDeCommande, parametresDeSession } from "./session";
import { bilanTacheVide, tacheAutorisee, tacheQuotidienne, type BilanTache } from "./tache";

export { journal } from "./journal";

/**
 * Les routes de la vente, écrites une fois pour toutes ici et appelées par
 * les fichiers de src/app avec les vraies dépendances. Aucune ne journalise
 * de prénom, de donnée de la fête, d'adresse e-mail ni de contenu chiffré :
 * les seuls journaux sont des noms d'événements et des compteurs.
 */

/** Même borne que la route de l'aperçu : une commande tient largement dans 8 ko. */
export const TAILLE_MAX_COMMANDE = 8 * 1024;
const TAILLE_MAX_KIT = 1024;
/** Une déclaration de rétractation : quatre champs courts. */
export const TAILLE_MAX_RETRACTATION = 4 * 1024;

function json(corps: Record<string, unknown>, statut: number): Response {
  return Response.json(corps, { status: statut, headers: { "Cache-Control": "no-store" } });
}

function erreur(message: string, statut: number, details?: unknown): Response {
  return json({ erreur: message, ...(details ? { details } : {}) }, statut);
}

type Corps = { valeur: Record<string, unknown> } | { reponse: Response };

/** Lit un corps JSON borné. Les données arrivent en POST, jamais dans l'adresse. */
async function lireCorps(requete: Request, tailleMax: number, videAccepte = false): Promise<Corps> {
  const annonce = requete.headers.get("content-length");
  if (annonce && Number(annonce) > tailleMax) {
    return { reponse: erreur(REPONSES_COMMANDE.tropVolumineuse, 413) };
  }
  let brut: string;
  try {
    brut = await requete.text();
  } catch {
    return { reponse: erreur(REPONSES_COMMANDE.illisible, 400) };
  }
  if (Buffer.byteLength(brut, "utf8") > tailleMax) {
    return { reponse: erreur(REPONSES_COMMANDE.tropVolumineuse, 413) };
  }
  if (videAccepte && brut.trim() === "") return { valeur: {} };
  let valeur: unknown;
  try {
    valeur = JSON.parse(brut);
  } catch {
    return { reponse: erreur(REPONSES_COMMANDE.illisible, 400) };
  }
  if (typeof valeur !== "object" || valeur === null || Array.isArray(valeur)) {
    return { reponse: erreur(REPONSES_COMMANDE.illisible, 400) };
  }
  return { valeur: valeur as Record<string, unknown> };
}

function sessionDuCorps(valeur: Record<string, unknown>): string | null {
  return typeof valeur.session_id === "string" ? valeur.session_id : null;
}

// ---------------------------------------------------------------------------
// POST /api/commande
// ---------------------------------------------------------------------------

/**
 * Crée la commande : revérifie tout ce que le navigateur envoie, puis crée la
 * session Stripe Checkout et renvoie son adresse. Le navigateur y part.
 */
export async function creerCommande(requete: Request, deps: Dependances): Promise<Response> {
  const { env, fiche, client } = deps;
  if (!venteOuverte(env, fiche) || !client || !env.cleStripe) {
    return erreur(REPONSES_COMMANDE.venteFermee, 503);
  }

  const corps = await lireCorps(requete, TAILLE_MAX_COMMANDE);
  if ("reponse" in corps) return corps.reponse;
  const { configuration, graine, pays, accordCgv, accordAccesImmediat } = corps.valeur;

  const analyse = schemaConfiguration.safeParse(configuration);
  if (!analyse.success) {
    return erreur(
      REPONSES_COMMANDE.configurationInvalide,
      422,
      analyse.error.issues.map((souci) => ({ champ: souci.path.join("."), message: souci.message })),
    );
  }
  if (typeof graine !== "string" || !graineValide(graine)) {
    return erreur(REPONSES_COMMANDE.graineInvalide, 422);
  }
  if (!paysAccepte(pays)) return erreur(ACHAT.paysRefuse, 422);
  if (accordCgv !== true) return erreur(ACHAT.erreurAccordCgv, 422);
  if (accordAccesImmediat !== true) return erreur(ACHAT.erreurAccordAcces, 422);

  // Le jeu vendu doit pouvoir être livré : on le compose et on le contrôle
  // avant d'encaisser quoi que ce soit. Une erreur du moteur donne une
  // réponse propre, jamais une page d'erreur, et un journal sans donnée.
  const config = analyse.data as Configuration;
  let problemes: number;
  try {
    problemes = verifierKit(construireKit(config, graine)).length;
  } catch {
    journal({ route: "commande", evenement: "kit_impossible" });
    return erreur(REPONSES_COMMANDE.kitImpossible, 500);
  }
  if (problemes > 0) {
    journal({ route: "commande", evenement: "kit_refuse", problemes });
    return erreur(REPONSES_COMMANDE.kitRefuse, 422);
  }

  const adresseSite = adresseDuSite(env);
  if (!adresseSite) {
    journal({ route: "commande", evenement: "adresse_du_site_inconnue" });
    return erreur(REPONSES_COMMANDE.indisponible, 503);
  }
  const reference = creerReference();
  if (lienDeCommande(adresseSite, reference).length > LONGUEUR_CHAMP_FACTURE) {
    journal({ route: "commande", evenement: "lien_trop_long" });
    return erreur(REPONSES_COMMANDE.indisponible, 503);
  }

  // Les deux accords sont reçus ensemble, à l'heure du serveur.
  const heure = deps.maintenant().toISOString();
  const metadonnees = metadonneesDuPaiement(
    {
      reference,
      versionKit: VERSION_KIT,
      graine,
      pays,
      versionCgv: VERSION_CGV.identifiant,
      accordCgv: heure,
      accordAccesImmediat: heure,
    },
    config,
    env.cleStripe,
  );
  if (depassementsDeMetadonnees(metadonnees).length > 0) {
    journal({ route: "commande", evenement: "metadonnees_trop_grandes" });
    return erreur(REPONSES_COMMANDE.configurationInvalide, 422);
  }

  try {
    const { url } = await client.creerSession(
      parametresDeSession({ reference, configuration: config, adresseSite, metadonnees, fiche }),
      reference,
    );
    return json({ url }, 200);
  } catch (probleme) {
    journal({ route: "commande", evenement: "refus_de_stripe", ...codesErreur(probleme) });
    return erreur(REPONSES_COMMANDE.stripe, 502);
  }
}

// ---------------------------------------------------------------------------
// POST /api/commande/<ref>/kit
// ---------------------------------------------------------------------------

const STATUTS: Record<Refus, number> = {
  non_aboutie: 402,
  introuvable: 404,
  expiree: 410,
  remboursee: 410,
  retractee: 410,
  litige: 409,
  non_confirmee: 409,
  autre_version: 409,
  illisible: 409,
  indisponible: 503,
};

function refus(etat: Refus, statut = STATUTS[etat]): Response {
  const { titre, texte } = texteDeLEtat(etat);
  return json({ etat, erreur: `${titre}. ${texte}` }, statut);
}

/**
 * Livre le kit complet. Refait la vérification de la page de commande et
 * refuse tant que la confirmation n'est pas partie, après une rétractation
 * et pendant un litige. Déchiffre ensuite la configuration, construit le kit
 * avec la graine, le fait passer par verifierKit et le rend ; juste avant de
 * renvoyer le PDF pour la première fois, relit le paiement et enregistre le
 * premier téléchargement, qui commence l'exécution du contrat. Si cet
 * enregistrement échoue, aucun PDF ne part.
 */
export async function livrerKit(requete: Request, reference: string, deps: Dependances): Promise<Response> {
  const corps = await lireCorps(requete, TAILLE_MAX_KIT, true);
  if ("reponse" in corps) return corps.reponse;
  const sessionId = sessionDuCorps(corps.valeur);

  const { client } = deps;
  const cleStripe = deps.env.cleStripe;
  if (!livraisonPossible(deps.env) || !client || !cleStripe) return refus("introuvable");
  const etat = await etatDeLaCommande({ reference, sessionId, client, cleStripe, maintenant: deps.maintenant() });
  if (etat.etat !== "payee") return refus(etat.etat);
  if (!etat.suivi.confirmation) return refus("non_confirmee");

  let rendu: { pdf: Buffer; nomFichier: string };
  try {
    rendu = await produireKitLivre(etat.configuration, etat.graine, { essai: exemplaireDEssai(deps.env) });
  } catch (probleme) {
    journal({ route: "kit", evenement: probleme instanceof KitRefuse ? "kit_refuse" : "rendu_impossible" });
    return refus("illisible", 500);
  }

  try {
    const frais = await client.lirePaiement(etat.paiement.id);
    const encore: EtatCommande = frais
      ? etatDuPaiement(frais, reference, cleStripe, deps.maintenant())
      : { etat: "introuvable" };
    if (encore.etat !== "payee") return refus(encore.etat);
    if (!encore.suivi.telechargement) {
      await client.modifierMetadonnees(encore.paiement.id, { [CLES.telechargement]: deps.maintenant().toISOString() });
      journal({ route: "kit", evenement: "premier_telechargement" });
    }
  } catch {
    journal({ route: "kit", evenement: "enregistrement_impossible" });
    return erreur(REPONSES_COMMANDE.enregistrementImpossible, 503);
  }

  return new Response(new Uint8Array(rendu.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${rendu.nomFichier}"`,
      "Content-Length": String(rendu.pdf.length),
      "Cache-Control": "no-store",
    },
  });
}

// ---------------------------------------------------------------------------
// POST /api/commande/<ref>/confirmation
// ---------------------------------------------------------------------------

const STATUTS_CONFIRMATION: Record<IssueConfirmation, number> = {
  confirmee: 200,
  en_cours: 202,
  echec: 503,
  impossible: 500,
};

/**
 * Envoie la confirmation d'une commande payée qui n'en a pas encore : la page
 * de la commande l'appelle à son chargement. Ne renvoie qu'un état, jamais le
 * contenu de la commande.
 */
export async function confirmerCommande(requete: Request, reference: string, deps: Dependances): Promise<Response> {
  const corps = await lireCorps(requete, TAILLE_MAX_KIT, true);
  if ("reponse" in corps) return corps.reponse;
  const sessionId = sessionDuCorps(corps.valeur);

  if (!livraisonPossible(deps.env) || !deps.client) return json({ etat: "introuvable" }, 404);
  const etat = await etatDeLaCommande({
    reference,
    sessionId,
    client: deps.client,
    cleStripe: deps.env.cleStripe,
    maintenant: deps.maintenant(),
  });
  if (etat.etat !== "payee") return json({ etat: etat.etat }, 409);
  const issue = await envoyerLaConfirmation(etat, deps, "page");
  return json({ etat: issue }, STATUTS_CONFIRMATION[issue]);
}

// ---------------------------------------------------------------------------
// POST /api/renoncer
// ---------------------------------------------------------------------------

/**
 * Reçoit une déclaration de rétractation (voir src/vente/retractation.ts).
 * Taille bornée, entrées validées par zod, et un champ piège qu'un humain ne
 * voit pas : rempli, la déclaration est refusée sans rien faire.
 */
export async function renoncer(requete: Request, deps: Dependances): Promise<Response> {
  const corps = await lireCorps(requete, TAILLE_MAX_RETRACTATION);
  if ("reponse" in corps) return corps.reponse;
  const analyse = schemaDeclaration.safeParse(corps.valeur);
  if (!analyse.success) {
    return erreur(
      REPONSES_RETRACTATION.invalide,
      422,
      analyse.error.issues.map((souci) => ({ champ: souci.path.join(".") })),
    );
  }
  if (analyse.data.champ_libre) {
    journal({ route: "retractation", evenement: "piege" });
    return erreur(REPONSES_RETRACTATION.refusee, 400);
  }
  const { nom, prenom, reference, email } = analyse.data;
  return json(await traiterDeclaration({ nom, prenom, reference, email }, deps), 200);
}

// ---------------------------------------------------------------------------
// GET /api/effacement — la tâche quotidienne
// ---------------------------------------------------------------------------

/**
 * La tâche quotidienne (voir src/vente/tache.ts). Sans le secret de
 * CRON_SECRET dans l'en-tête Authorization, ou sans la variable : 401, et
 * rien d'autre. Ses compteurs ne partent que dans les journaux.
 */
export async function lancerTacheQuotidienne(requete: Request, deps: Dependances): Promise<Response> {
  if (!tacheAutorisee(requete, deps.env)) {
    return new Response(null, { status: 401, headers: { "Cache-Control": "no-store", "WWW-Authenticate": "Bearer" } });
  }
  let bilan: BilanTache;
  try {
    bilan = await tacheQuotidienne(deps);
  } catch {
    bilan = { ...bilanTacheVide(), erreurs: 1 };
  }
  journal({ tache: "quotidienne", ...bilan, ...(deps.client ? {} : { sansCle: 1 }) });
  return json({ ok: bilan.erreurs === 0 }, bilan.erreurs > 0 ? 500 : 200);
}

export function methodeRefusee(): Response {
  return erreur(REPONSES_COMMANDE.methode, 405);
}
