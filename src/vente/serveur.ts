import { graineValide } from "../engine/alea";
import { schemaConfiguration } from "../engine/configuration";
import { VERSION_KIT, construireKit } from "../engine/kit";
import type { Configuration } from "../engine/types";
import { verifierKit } from "../engine/validation";
import { VERSION_CGV } from "../contenu/cgv";
import { REPONSES_RETRACTATION } from "../contenu/retractation";
import { ACHAT, REPONSES_COMMANDE } from "../contenu/vente";
import { etatDeLaCommande, etatDuPaiement } from "./commande";
import { envoyerLaConfirmation, type IssueConfirmation } from "./confirmation";
import { ecrireLaMarque, issueDeLEcriture, type EcritureDeMarque } from "./course";
import { schemaDeclaration } from "./declaration";
import type { Dependances } from "./dependances";
import { adresseDuSite } from "./environnement";
import { texteDeLEtat, type Refus } from "./etats";
import { codesErreur, journal } from "./journal";
import { KitRefuse, produireKitLivre } from "./livraison";
import { CLES, depassementsDeMetadonnees, metadonneesDuPaiement } from "./metadonnees";
import { exemplaireDEssai, livraisonPossible, venteOuverte } from "./ouverture";
import { paysAccepte } from "./pays";
import { creerReference } from "./reference";
import { traiterDeclaration, type ReponseRetractation } from "./retractation";
import { LONGUEUR_CHAMP_FACTURE, lienDeCommande, parametresDeSession } from "./session";
import { erreursDeLaTache, tacheAutorisee, tacheQuotidienne } from "./tache";

export { journal } from "./journal";

/**
 * Les routes de la vente, écrites une fois pour toutes ici et appelées par
 * les fichiers de src/app avec les vraies dépendances, après le contrôle
 * commun des requêtes POST (src/vente/garde.ts). Aucune ne journalise de
 * prénom, de donnée de la fête, d'adresse e-mail ni de contenu chiffré : les
 * seuls journaux sont des noms d'événements, des compteurs et, quand le
 * vendeur peut avoir à agir, la référence d'une commande.
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
  a_examiner: 409,
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
 * renvoyer le PDF pour la première fois, enregistre le premier
 * téléchargement, qui commence l'exécution du contrat, une seule fois (clé
 * d'idempotence), et décide sur le paiement que Stripe renvoie en réponse :
 * si une rétractation y est déjà écrite, elle l'emporte (410, aucun PDF ;
 * voir src/vente/course.ts). Un premier téléchargement déjà écrit par un
 * autre onglet se juge sur le paiement relu. Si l'enregistrement échoue,
 * aucun PDF ne part.
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

  if (!etat.suivi.telechargement) {
    let ecriture: EcritureDeMarque;
    try {
      ecriture = await ecrireLaMarque(client, etat.paiement, reference, "telechargement", {
        [CLES.telechargement]: deps.maintenant().toISOString(),
      });
    } catch {
      journal({ route: "kit", evenement: "enregistrement_impossible" });
      return erreur(REPONSES_COMMANDE.enregistrementImpossible, 503);
    }
    // Un autre onglet écrit le premier téléchargement en ce moment : réessayer.
    if (ecriture.issue === "en_cours") return erreur(REPONSES_COMMANDE.enregistrementImpossible, 503);
    if (ecriture.issue === "ecrite" && issueDeLEcriture("telechargement", ecriture.apres.metadonnees) === "perd") {
      // Une rétractation a été écrite avant : elle l'emporte, aucun PDF ne part.
      try {
        await client.modifierMetadonnees(etat.paiement.id, { [CLES.course]: "retractation" });
        journal({ route: "kit", evenement: "course_perdue", reference });
      } catch {
        journal({ route: "kit", evenement: "course_non_enregistree", reference });
      }
      return refus("retractee");
    }
    // Premier téléchargement écrit par cette requête, ou par un autre onglet juste avant : le paiement à jour décide.
    const encore = etatDuPaiement(ecriture.apres, reference, cleStripe, deps.maintenant());
    // Croisement dont la course n'est pas encore écrite : réessayer dans un instant.
    if (encore.etat === "a_examiner") return erreur(REPONSES_COMMANDE.enregistrementImpossible, 503);
    if (encore.etat !== "payee") return refus(encore.etat);
    if (ecriture.issue === "ecrite") journal({ route: "kit", evenement: "premier_telechargement" });
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
  non_enregistree: 503,
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

function statutDeRetractation(reponse: ReponseRetractation): number {
  switch (reponse.issue) {
    case "non_transmise":
      return reponse.cause === "introuvable" ? 404 : 503;
    case "en_cours":
      return 202;
    default:
      return 200;
  }
}

/**
 * Reçoit une déclaration de rétractation (voir src/vente/retractation.ts).
 * Taille bornée, entrées strictes validées par zod (src/vente/declaration.ts),
 * et un champ piège qu'un humain ne voit pas : rempli, la déclaration est
 * refusée sans rien faire.
 */
export async function renoncer(requete: Request, deps: Dependances): Promise<Response> {
  const corps = await lireCorps(requete, TAILLE_MAX_RETRACTATION);
  if ("reponse" in corps) return corps.reponse;
  const analyse = schemaDeclaration.safeParse(corps.valeur);
  if (!analyse.success) {
    return erreur(
      REPONSES_RETRACTATION.invalide,
      422,
      [...new Set(analyse.error.issues.map((souci) => souci.path.join(".")))].map((champ) => ({ champ })),
    );
  }
  if (analyse.data.champ_libre) {
    journal({ route: "retractation", evenement: "piege" });
    return erreur(REPONSES_RETRACTATION.refusee, 400);
  }
  const { nom, prenom, reference, email, session_id } = analyse.data;
  const reponse = await traiterDeclaration({ declaration: { nom, prenom, reference, email }, sessionId: session_id ?? null }, deps);
  return json(reponse, statutDeRetractation(reponse));
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
  let erreurs: number;
  try {
    // Chaque phase écrit sa ligne de journal dès qu'elle finit.
    erreurs = erreursDeLaTache(await tacheQuotidienne(deps));
  } catch {
    journal({ tache: "quotidienne", phase: "interrompue", erreurs: 1 });
    erreurs = 1;
  }
  return json({ ok: erreurs === 0 }, erreurs > 0 ? 500 : 200);
}

export function methodeRefusee(): Response {
  return erreur(REPONSES_COMMANDE.methode, 405);
}
