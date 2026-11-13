import { createHash } from "node:crypto";
import { remplir } from "../engine/texte";
import { A_TRAITER } from "../contenu/emails";
import { courrielEnTexte, type BlocCourriel, type DocumentCourriel } from "./courriels";
import { marqueGagnante } from "./course";
import { marqueRetenue } from "./examen";
import { dateAParis, heureAParis } from "./dates";
import { jourAParis, jourIso } from "./delai";
import { CLES, heuresIllisibles, lireSuivi } from "./metadonnees";
import { etatDuRemboursement, rembourseEnTotalite } from "./remboursement";
import type { PaiementLu } from "./stripe";

/**
 * La liste quotidienne des commandes à traiter, envoyée au vendeur par la
 * tâche quotidienne (phase `a_traiter`, après les remboursements). Les
 * journaux de l'offre Hobby de Vercel ne sont gardés qu'une heure : c'est
 * elle, et non leur lecture, qui dit au vendeur ce qui l'attend.
 *
 * Sept rubriques, lues sur les paiements aboutis de la boutique, relus à jour :
 * - `a_examiner` : les deux marques, sans `course` ;
 * - `simultanees` : `course` = `telechargement` et une rétractation reçue
 *   avant le premier téléchargement — leur accusé promet une réponse du
 *   vendeur sous 7 jours ;
 * - `accuse_manquant` : `retractation` sans `retractation_accuse` ;
 * - `sans_remboursement` : la rétractation l'a emporté (aucune heure
 *   illisible, voir src/vente/examen.ts), et les
 *   remboursements faits ou demandés ne couvrent pas le montant payé — sauf
 *   un paiement contesté, que Stripe ne laisse rembourser que par la
 *   procédure de contestation (la rubrique `contestations` le couvre) ;
 * - `remboursement_en_attente` : un remboursement toujours en attente cinq
 *   jours après l'heure de la rétractation (le délai légal est de 14 jours) ;
 * - `contestations` : le paiement fait l'objet d'une contestation ;
 * - `heures_illisibles` : une marque horodatée (`retractation`,
 *   `telechargement`, `examinee`) est présente mais illisible.
 *
 * Si la recherche des paiements ou la relecture d'une commande a échoué, la
 * liste part quand même, avec en tête une ligne fixe qui le dit.
 *
 * Les rubriques `simultanees` et `contestations` ne montrent plus une
 * commande qui porte `examinee` (la réponse du vendeur). La liste ne contient
 * jamais ni nom ni adresse e-mail : chaque commande s'y lit par sa référence.
 */

export const RUBRIQUES = [
  "a_examiner",
  "simultanees",
  "accuse_manquant",
  "sans_remboursement",
  "remboursement_en_attente",
  "contestations",
  "heures_illisibles",
] as const;

export type Rubrique = (typeof RUBRIQUES)[number];

/** Ce qui a manqué à la liste : la recherche des paiements, ou la relecture de certaines commandes. */
export interface Incompletude {
  rechercheEchouee: boolean;
  relecturesEchouees: number;
}

export type ListeATraiter = Record<Rubrique, PaiementLu[]> & { incompletude: Incompletude };

/** Cinq jours après la rétractation, un remboursement encore en attente est signalé. */
export const ATTENTE_SIGNALEE_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Peut-il entrer dans une rubrique ? Il faut une rétractation ou une
 * contestation : la tâche ne relit que ces paiements-là.
 */
export function candidatALaListe(paiement: PaiementLu): boolean {
  return lireSuivi(paiement.metadonnees).retractation !== null || paiement.litige || heuresIllisibles(paiement.metadonnees).length > 0;
}

export function listeATraiter(
  paiements: PaiementLu[],
  maintenant: Date,
  incompletude: Incompletude = { rechercheEchouee: false, relecturesEchouees: 0 },
): ListeATraiter {
  const liste = {
    ...Object.fromEntries(RUBRIQUES.map((rubrique) => [rubrique, [] as PaiementLu[]])),
    incompletude,
  } as ListeATraiter;
  const tries = [...paiements].sort((a, b) =>
    (a.metadonnees[CLES.reference] ?? "").localeCompare(b.metadonnees[CLES.reference] ?? ""),
  );
  for (const paiement of tries) {
    const suivi = lireSuivi(paiement.metadonnees);
    const gagnante = marqueGagnante(paiement.metadonnees);
    if (gagnante === "a_examiner") liste.a_examiner.push(paiement);
    if (
      suivi.course === "telechargement" &&
      suivi.retractation &&
      suivi.telechargement &&
      suivi.retractation.getTime() < suivi.telechargement.getTime() &&
      !suivi.examinee
    ) {
      liste.simultanees.push(paiement);
    }
    if (suivi.retractation && !suivi.accuseRetractation) liste.accuse_manquant.push(paiement);
    if (marqueRetenue(paiement.metadonnees) === "retractation" && !rembourseEnTotalite(paiement) && !paiement.litige) liste.sans_remboursement.push(paiement);
    if (
      suivi.retractation &&
      etatDuRemboursement(paiement) === "demande" &&
      maintenant.getTime() - suivi.retractation.getTime() >= ATTENTE_SIGNALEE_MS
    ) {
      liste.remboursement_en_attente.push(paiement);
    }
    if (paiement.litige && !suivi.examinee) liste.contestations.push(paiement);
    if (heuresIllisibles(paiement.metadonnees).length > 0) liste.heures_illisibles.push(paiement);
  }
  return liste;
}

/** La liste est-elle incomplète (recherche ou relecture en échec) ? */
export function listeIncomplete(liste: ListeATraiter): boolean {
  return liste.incompletude.rechercheEchouee || liste.incompletude.relecturesEchouees > 0;
}

export function tailleDeLaListe(liste: ListeATraiter): number {
  return RUBRIQUES.reduce((total, rubrique) => total + liste[rubrique].length, 0);
}

function quand(instant: Date): { date: string; heure: string } {
  return { date: dateAParis(instant), heure: heureAParis(instant) };
}

/** Une commande de la liste : sa référence, la date du paiement, puis ses marques, jamais un nom ni une adresse. */
function ligneDeCommande(paiement: PaiementLu): string {
  const suivi = lireSuivi(paiement.metadonnees);
  const { marques } = A_TRAITER;
  const parties = [remplir(marques.payee, quand(new Date(paiement.payeLe * 1000)))];
  const marque = (libelle: string, instant: Date | null) => {
    if (instant) parties.push(remplir(marques.le, { libelle, ...quand(instant) }));
  };
  marque(marques.confirmation, suivi.confirmation);
  marque(marques.telechargement, suivi.telechargement);
  marque(marques.retractation, suivi.retractation);
  if (suivi.course) parties.push(remplir(marques.course, { gagnante: marques.gagnantes[suivi.course] }));
  if (suivi.retractation) parties.push(suivi.accuseRetractation ? marques.accuseParti : marques.accuseNonParti);
  if (suivi.retractation || paiement.remboursements.length > 0) parties.push(marques.remboursement[etatDuRemboursement(paiement)]);
  if (paiement.litige) parties.push(marques.litige);
  marque(marques.examinee, suivi.examinee);
  const illisibles = heuresIllisibles(paiement.metadonnees);
  if (illisibles.length > 0) parties.push(remplir(marques.illisible, { cles: illisibles.join(", ") }));
  return `${paiement.metadonnees[CLES.reference] ?? ""} — ${parties.join(" ; ")}`;
}

/** L'e-mail de la liste. Il ne dépend que de la liste et du jour : deux passages le même jour, liste inchangée, écrivent le même. */
export function courrielDeLaListe(liste: ListeATraiter, maintenant: Date): DocumentCourriel {
  const blocs: BlocCourriel[] = [];
  if (liste.incompletude.rechercheEchouee) blocs.push({ type: "paragraphe", morceaux: [A_TRAITER.incompleteRecherche] });
  else if (liste.incompletude.relecturesEchouees > 0) {
    blocs.push({ type: "paragraphe", morceaux: [remplir(A_TRAITER.incomplete, { nombre: liste.incompletude.relecturesEchouees })] });
  }
  blocs.push({ type: "paragraphe", morceaux: [remplir(A_TRAITER.intro, { date: dateAParis(maintenant) })] });
  for (const rubrique of RUBRIQUES) {
    const commandes = liste[rubrique];
    if (commandes.length === 0) continue;
    const textes = A_TRAITER.rubriques[rubrique];
    blocs.push(
      { type: "titre", texte: remplir(A_TRAITER.titre, { titre: textes.titre, nombre: commandes.length }) },
      { type: "paragraphe", morceaux: [remplir(A_TRAITER.action, { action: textes.action, section: A_TRAITER.section })] },
      { type: "liste", elements: commandes.map((paiement) => [ligneDeCommande(paiement)]) },
    );
  }
  return { objet: A_TRAITER.objet, blocs };
}

/**
 * La clé d'idempotence de Resend : le jour de Paris et l'empreinte du
 * contenu de la liste (16 caractères hexadécimaux du SHA-256). Une liste
 * inchangée ne repart pas ; une liste modifiée au second passage du jour
 * repart.
 */
export function cleDeLaListe(document: DocumentCourriel, maintenant: Date): string {
  const empreinte = createHash("sha256").update(courrielEnTexte(document)).digest("hex").slice(0, 16);
  return `a-traiter-${jourIso(jourAParis(maintenant))}-${empreinte}`;
}
