import { graineValide } from "../engine/alea";
import { schemaConfiguration } from "../engine/configuration";
import { VERSION_KIT, construireKit } from "../engine/kit";
import type { Configuration } from "../engine/types";
import { verifierKit } from "../engine/validation";
import { VERSION_CGV } from "../contenu/legal";
import { ACHAT, REPONSES_COMMANDE } from "../contenu/vente";
import { etatDeLaCommande } from "./commande";
import type { Dependances } from "./dependances";
import { bilanVide, effacerLesConfigurationsAnciennes } from "./effacement";
import { adresseDuSite } from "./environnement";
import { texteDeLEtat, type EtatSansLivraison } from "./etats";
import { KitRefuse, produireKitLivre } from "./livraison";
import { depassementsDeMetadonnees, metadonneesDuPaiement } from "./metadonnees";
import { livraisonPossible, venteOuverte } from "./ouverture";
import { paysAccepte } from "./pays";
import { creerReference } from "./reference";
import { LONGUEUR_CHAMP_FACTURE, lienDeCommande, parametresDeSession } from "./session";

/**
 * Les routes de la vente, écrites une fois pour toutes ici et appelées par
 * les fichiers de src/app avec les vraies dépendances. Aucune ne journalise
 * de prénom, de donnée de la fête, d'e-mail ni de contenu chiffré : les seuls
 * journaux sont des noms d'événements et des compteurs.
 */

/** Même borne que la route de l'aperçu : une commande tient largement dans 8 ko. */
export const TAILLE_MAX_COMMANDE = 8 * 1024;
const TAILLE_MAX_KIT = 1024;

function json(corps: Record<string, unknown>, statut: number): Response {
  return Response.json(corps, { status: statut, headers: { "Cache-Control": "no-store" } });
}

function erreur(message: string, statut: number, details?: unknown): Response {
  return json({ erreur: message, ...(details ? { details } : {}) }, statut);
}

/** Un journal d'une ligne, fait de noms d'événements et de compteurs. */
export function journal(entree: Record<string, string | number>): void {
  console.info(JSON.stringify(entree));
}

/** Le type et le code d'une erreur Stripe, jamais son message, qui pourrait citer une valeur envoyée. */
function codesErreur(erreur: unknown): Record<string, string> {
  const codes: Record<string, string> = {};
  if (erreur && typeof erreur === "object") {
    for (const champ of ["type", "code"] as const) {
      const valeur = (erreur as Record<string, unknown>)[champ];
      if (typeof valeur === "string" && /^[A-Za-z_]{1,60}$/.test(valeur)) codes[champ] = valeur;
    }
  }
  return codes;
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
  // avant d'encaisser quoi que ce soit.
  const config = analyse.data as Configuration;
  if (verifierKit(construireKit(config, graine)).length > 0) {
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

const STATUTS: Record<EtatSansLivraison, number> = {
  non_aboutie: 402,
  introuvable: 404,
  expiree: 410,
  remboursee: 410,
  autre_version: 409,
  illisible: 409,
  indisponible: 503,
};

function refus(etat: EtatSansLivraison, statut = STATUTS[etat]): Response {
  const { titre, texte } = texteDeLEtat(etat);
  return json({ etat, erreur: `${titre}. ${texte}` }, statut);
}

/**
 * Livre le kit complet. Refait la vérification de la page de commande,
 * déchiffre la configuration, construit le kit avec la graine, le fait
 * passer par verifierKit et renvoie le PDF. Hors d'une commande payée, rien.
 */
export async function livrerKit(requete: Request, reference: string, deps: Dependances): Promise<Response> {
  const corps = await lireCorps(requete, TAILLE_MAX_KIT, true);
  if ("reponse" in corps) return corps.reponse;
  const sessionId = typeof corps.valeur.session_id === "string" ? corps.valeur.session_id : null;

  if (!livraisonPossible(deps.env) || !deps.client) return refus("introuvable");
  const etat = await etatDeLaCommande({
    reference,
    sessionId,
    client: deps.client,
    cleStripe: deps.env.cleStripe,
    maintenant: deps.maintenant(),
  });
  if (etat.etat !== "payee") return refus(etat.etat);

  try {
    const { pdf, nomFichier } = await produireKitLivre(etat.configuration, etat.graine);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomFichier}"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (probleme) {
    journal({ route: "kit", evenement: probleme instanceof KitRefuse ? "kit_refuse" : "rendu_impossible" });
    return refus("illisible", 500);
  }
}

// ---------------------------------------------------------------------------
// GET /api/effacement — la tâche quotidienne
// ---------------------------------------------------------------------------

/**
 * Efface la configuration chiffrée des paiements de plus de 30 jours.
 * N'importe qui peut appeler cette route : elle ne fait rien d'autre, et ne
 * renvoie que des compteurs.
 */
export async function lancerEffacement(deps: Dependances): Promise<Response> {
  if (!deps.client) {
    const bilan = { tache: "effacement", ...bilanVide(), sansCle: 1 };
    journal(bilan);
    return json(bilan, 200);
  }
  try {
    const bilan = { tache: "effacement", ...(await effacerLesConfigurationsAnciennes(deps.client, deps.maintenant())) };
    journal(bilan);
    return json(bilan, bilan.erreurs > 0 ? 500 : 200);
  } catch {
    const bilan = { tache: "effacement", ...bilanVide(), erreurs: 1 };
    journal(bilan);
    return json(bilan, 500);
  }
}

export function methodeRefusee(): Response {
  return erreur(REPONSES_COMMANDE.methode, 405);
}
