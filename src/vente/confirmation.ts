import { versionCgv } from "../contenu/cgv";
import { EXPEDITEUR } from "../contenu/emails";
import { nomDuPdfCgv, pdfDesCgv } from "./cgvPdf";
import { emailDeLAcheteur, type CommandePayee } from "./commande";
import { courrielDeConfirmation, courrielEnHtml, courrielEnTexte } from "./courriels";
import type { Dependances } from "./dependances";
import { adresseDEnvoi, sansDoublon } from "./envoi";
import { adresseDuSite } from "./environnement";
import { journal } from "./journal";
import { CLES, lireSuivi } from "./metadonnees";
import { formaterPrix } from "./prix";
import { lienDeCommande, lienDeRenonciation } from "./session";

/**
 * L'envoi de la confirmation de commande (article L221-13 du Code de la
 * consommation), avant tout téléchargement.
 *
 * Un seul envoi par commande, même quand la page et la tâche quotidienne, ou
 * deux onglets, la demandent en même temps :
 * - la marque `confirmation` des métadonnées du paiement est lue avant tout
 *   envoi, et une commande qui la porte n'est jamais confirmée deux fois ;
 * - l'envoi porte une clé d'idempotence tirée de la référence : Resend
 *   n'envoie qu'une fois l'e-mail d'une même clé (24 heures durant), et
 *   répond « en cours » à une requête simultanée ;
 * - le contenu de l'e-mail ne dépend que de la commande (le PDF des CGV
 *   compris), pour qu'une nouvelle tentative envoie exactement la même
 *   requête.
 */

/**
 * `confirmee` : l'e-mail est parti et la marque est enregistrée ;
 * `en_cours` : un autre envoi de la même confirmation est en cours ;
 * `echec` : l'envoi a échoué, ou n'a pas pu être enregistré — à réessayer ;
 * `impossible` : la confirmation ne peut pas être préparée (version des CGV
 * inconnue, e-mail de l'acheteur introuvable).
 */
export type IssueConfirmation = "confirmee" | "en_cours" | "echec" | "impossible";

export function cleDeConfirmation(reference: string): string {
  return `confirmation-${reference}`;
}

export async function envoyerLaConfirmation(
  commande: CommandePayee,
  deps: Dependances,
  origine: "page" | "tache",
): Promise<IssueConfirmation> {
  if (commande.suivi.confirmation) return "confirmee";
  const { client, email, env, fiche } = deps;
  const evenement = (nom: string, extra: Record<string, string> = {}) =>
    journal({ route: origine === "page" ? "confirmation" : "tache", evenement: nom, ...extra });
  if (!client || !email) {
    evenement("envoi_sans_cle");
    return "echec";
  }

  const version = versionCgv(commande.commande.versionCgv);
  if (!version) {
    evenement("version_cgv_inconnue");
    return "impossible";
  }
  const accordLe = new Date(commande.commande.accordAccesImmediat);
  if (Number.isNaN(accordLe.getTime())) {
    evenement("heure_accord_illisible");
    return "impossible";
  }
  const adresseSite = adresseDuSite(env);
  if (!adresseSite) {
    evenement("adresse_du_site_inconnue");
    return "echec";
  }

  let acheteur: string | null;
  try {
    acheteur = await emailDeLAcheteur(client, commande.paiement, commande.session);
  } catch {
    evenement("stripe_indisponible");
    return "echec";
  }
  if (!acheteur) {
    evenement("email_acheteur_inconnu");
    return "impossible";
  }

  let pdf: Buffer;
  try {
    pdf = await pdfDesCgv(version, fiche, formaterPrix(commande.paiement.montant));
  } catch {
    evenement("rendu_cgv_impossible");
    return "echec";
  }

  const nomPdf = nomDuPdfCgv(version);
  const document = courrielDeConfirmation({
    reference: commande.reference,
    payeeLe: commande.payeeLe,
    expireLe: commande.expireLe,
    accordLe,
    dernierJour: commande.delai.dernierJour,
    montant: commande.paiement.montant,
    configuration: commande.configuration,
    lienCommande: lienDeCommande(adresseSite, commande.reference),
    lienRenoncer: lienDeRenonciation(adresseSite, commande.reference),
    version,
    nomPdf,
    fiche,
  });
  const destinataire = adresseDEnvoi(acheteur, env, fiche).adresse;
  const resultat = await email.envoyer(
    {
      de: EXPEDITEUR,
      a: [destinataire],
      // Copie cachée au vendeur : la preuve de l'envoi.
      copieCachee: sansDoublon([destinataire, fiche.email.trim()]).slice(1),
      repondreA: fiche.email.trim(),
      objet: document.objet,
      texte: courrielEnTexte(document),
      html: courrielEnHtml(document),
      piecesJointes: [{ nom: nomPdf, contenu: pdf, type: "application/pdf" }],
    },
    cleDeConfirmation(commande.reference),
  );

  if (!resultat.ok) {
    if (resultat.raison === "en_cours") return "en_cours";
    evenement(resultat.raison === "requete_differente" ? "confirmation_differente" : "envoi_refuse", {
      code: resultat.code,
    });
    return "echec";
  }

  // La marque n'est posée qu'une fois : si un envoi simultané l'a déjà
  // enregistrée, on la garde telle quelle.
  try {
    const frais = await client.lirePaiement(commande.paiement.id);
    if (frais && lireSuivi(frais.metadonnees).confirmation) return "confirmee";
    await client.modifierMetadonnees(commande.paiement.id, {
      [CLES.confirmation]: deps.maintenant().toISOString(),
      [CLES.confirmationId]: resultat.id,
    });
  } catch {
    evenement("enregistrement_impossible");
    return "echec";
  }
  evenement("confirmation_envoyee");
  return "confirmee";
}
