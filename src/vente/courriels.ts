import { LIBELLES_THEMES, TRANCHES_AGE, formatPourAge } from "../engine/configuration";
import { remplir } from "../engine/texte";
import type { Configuration } from "../engine/types";
import type { VersionCgv } from "../contenu/cgv";
import { ACCUSE, CONFIRMATION } from "../contenu/emails";
import { formulaireRempli } from "../contenu/formulaireRetractation";
import type { FicheVendeur } from "../contenu/vendeur";
import { TEXTES_STRIPE } from "../contenu/vente";
import { dateAParis, heureAParis, jourEnLettres } from "./dates";
import type { Declaration } from "./declaration";
import type { Jour } from "./delai";
import { adresseSurUneLigne, denomination, mediateurCite, pageDeDemande, siRempli } from "./fiche";
import { formaterPrix } from "./prix";

/**
 * Le contenu des e-mails, écrit une fois et rendu deux fois : en texte brut
 * et en HTML simple. Les deux versions ont donc exactement le même contenu.
 * Le HTML n'appelle aucune image ni aucune ressource distante ; seuls des
 * liens vers le site y figurent.
 */

export type MorceauCourriel = string | { texte: string; lien: string };

export type BlocCourriel =
  | { type: "titre"; texte: string }
  | { type: "paragraphe"; morceaux: MorceauCourriel[] }
  | { type: "liste"; elements: MorceauCourriel[][] }
  | { type: "lignes"; lignes: { libelle: string; valeur: string }[] }
  | { type: "encadre"; paragraphes: string[] };

export interface DocumentCourriel {
  objet: string;
  blocs: BlocCourriel[];
}

const titre = (texte: string): BlocCourriel => ({ type: "titre", texte });
const paragraphe = (...morceaux: MorceauCourriel[]): BlocCourriel => ({ type: "paragraphe", morceaux });
const lignes = (...entrees: [string, string | null][]): BlocCourriel => ({
  type: "lignes",
  lignes: entrees
    .filter((entree): entree is [string, string] => entree[1] !== null && entree[1].trim() !== "")
    .map(([libelle, valeur]) => ({ libelle, valeur })),
});

// ---------------------------------------------------------------------------
// Rendus
// ---------------------------------------------------------------------------

/** Un lien, en texte brut : son libellé suivi de son adresse, ou l'adresse seule quand c'est son libellé. */
function morceauEnTexte(morceau: MorceauCourriel): string {
  if (typeof morceau === "string") return morceau;
  return morceau.texte === morceau.lien ? morceau.lien : `${morceau.texte} (${morceau.lien})`;
}

/** La version texte : un paragraphe par ligne, une ligne vide entre deux blocs. */
export function courrielEnTexte(document: DocumentCourriel): string {
  const parties = document.blocs.map((bloc) => {
    switch (bloc.type) {
      case "titre":
        return `${bloc.texte}\n${"-".repeat(bloc.texte.length)}`;
      case "paragraphe":
        return bloc.morceaux.map(morceauEnTexte).join("");
      case "liste":
        return bloc.elements.map((element) => `- ${element.map(morceauEnTexte).join("")}`).join("\n");
      case "lignes":
        return bloc.lignes.map((ligne) => `${ligne.libelle} : ${ligne.valeur}`).join("\n");
      case "encadre":
        return bloc.paragraphes.join("\n");
    }
  });
  return `${parties.join("\n\n")}\n`;
}

function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function morceauEnHtml(morceau: MorceauCourriel): string {
  return typeof morceau === "string"
    ? echapper(morceau)
    : `<a href="${echapper(morceau.lien)}" style="color:#0f4c5c">${echapper(morceau.texte)}</a>`;
}

const STYLE_TITRE = "margin:28px 0 8px;font-size:18px;color:#0f4c5c";
const STYLE_PARAGRAPHE = "margin:0 0 12px";

/** La version HTML : sans image, sans feuille de style ni police distante, lisible partout. */
export function courrielEnHtml(document: DocumentCourriel): string {
  const corps = document.blocs
    .map((bloc) => {
      switch (bloc.type) {
        case "titre":
          return `<h2 style="${STYLE_TITRE}">${echapper(bloc.texte)}</h2>`;
        case "paragraphe":
          return `<p style="${STYLE_PARAGRAPHE}">${bloc.morceaux.map(morceauEnHtml).join("")}</p>`;
        case "liste":
          return `<ul style="margin:0 0 12px;padding-left:22px">${bloc.elements
            .map((element) => `<li style="margin:0 0 6px">${element.map(morceauEnHtml).join("")}</li>`)
            .join("")}</ul>`;
        case "lignes":
          return bloc.lignes
            .map((ligne) => `<p style="${STYLE_PARAGRAPHE}"><strong>${echapper(ligne.libelle)} :</strong> ${echapper(ligne.valeur)}</p>`)
            .join("");
        case "encadre":
          return `<div style="margin:0 0 12px;padding:12px 16px;border:1px solid #9a9a9a">${bloc.paragraphes
            .map((texte) => `<p style="margin:0 0 8px">${echapper(texte)}</p>`)
            .join("")}</div>`;
      }
    })
    .join("\n");
  return [
    "<!DOCTYPE html>",
    '<html lang="fr">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${echapper(document.objet)}</title></head>`,
    '<body style="margin:0;padding:24px;background:#ffffff;color:#1a1a1a;font-family:sans-serif;font-size:15px;line-height:1.5">',
    '<div style="max-width:600px;margin:0 auto">',
    corps,
    "</div>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// La confirmation de commande
// ---------------------------------------------------------------------------

export interface DonneesConfirmation {
  reference: string;
  payeeLe: Date;
  expireLe: Date;
  /** Heure des deux accords, lue dans les métadonnées. */
  accordLe: Date;
  dernierJour: Jour;
  /** Montant payé, en centimes. */
  montant: number;
  configuration: Configuration;
  lienCommande: string;
  lienRenoncer: string;
  version: VersionCgv;
  nomPdf: string;
  fiche: FicheVendeur;
}

/**
 * La confirmation de commande (article L221-13 du Code de la consommation),
 * dans l'ordre : la commande, le jeu, la confirmation de l'accord, le droit de
 * rétractation, le formulaire type, le vendeur, et l'annonce des CGV jointes.
 * Son contenu ne dépend que de la commande : une nouvelle tentative envoie
 * exactement le même e-mail.
 */
export function courrielDeConfirmation(donnees: DonneesConfirmation): DocumentCourriel {
  const { fiche, configuration } = donnees;
  const montant = formaterPrix(donnees.montant);
  const adresse = adresseSurUneLigne(fiche.adresse);
  const mediateur = mediateurCite(fiche);

  return {
    objet: CONFIRMATION.objet,
    blocs: [
      paragraphe(CONFIRMATION.intro),

      titre(CONFIRMATION.titreCommande),
      lignes(
        [CONFIRMATION.libelleReference, donnees.reference],
        [
          CONFIRMATION.libellePayeeLe,
          remplir(CONFIRMATION.payeeLe, { date: dateAParis(donnees.payeeLe), heure: heureAParis(donnees.payeeLe) }),
        ],
        [
          CONFIRMATION.libelleJeu,
          remplir(CONFIRMATION.jeu, {
            produit: TEXTES_STRIPE.nomProduit,
            theme: LIBELLES_THEMES[configuration.theme],
            tranche: TRANCHES_AGE[formatPourAge(configuration.age)],
          }),
        ],
        [CONFIRMATION.libellePrix, remplir(CONFIRMATION.prix, { montant, tva: fiche.tva })],
      ),

      titre(CONFIRMATION.titreJeu),
      paragraphe(CONFIRMATION.telechargement),
      paragraphe({ texte: donnees.lienCommande, lien: donnees.lienCommande }),
      paragraphe(remplir(CONFIRMATION.validite, { date: dateAParis(donnees.expireLe), heure: heureAParis(donnees.expireLe) })),

      titre(CONFIRMATION.titreAccord),
      paragraphe(
        remplir(CONFIRMATION.accord, { date: dateAParis(donnees.accordLe), heure: heureAParis(donnees.accordLe) }),
      ),

      titre(CONFIRMATION.titreRetractation),
      paragraphe(remplir(CONFIRMATION.retractation, { date: jourEnLettres(donnees.dernierJour) })),
      {
        type: "liste",
        elements: [
          [CONFIRMATION.parLien, { texte: CONFIRMATION.lienRenoncer, lien: donnees.lienRenoncer }, CONFIRMATION.parLienSuite],
          [CONFIRMATION.parFormulaire],
          [remplir(CONFIRMATION.parDeclaration, { email: fiche.email, adresse })],
        ],
      },
      paragraphe(remplir(CONFIRMATION.remboursement, { montant })),

      titre(CONFIRMATION.titreFormulaire),
      paragraphe(CONFIRMATION.formulaire),
      { type: "encadre", paragraphes: formulaireRempli(fiche) },

      titre(CONFIRMATION.titreVendeur),
      lignes(
        [CONFIRMATION.libelleVendeur, `${denomination(fiche)}, ${fiche.statut}`],
        [CONFIRMATION.libelleNomCommercial, fiche.nomCommercial],
        [CONFIRMATION.libelleSiret, fiche.siret],
        [CONFIRMATION.libelleRcs, siRempli(fiche.rcs)],
        [CONFIRMATION.libelleAdresse, adresse],
        [CONFIRMATION.libelleTelephone, fiche.telephone],
        [CONFIRMATION.libelleEmail, fiche.email],
      ),
      paragraphe(remplir(CONFIRMATION.serviceClient, { email: fiche.email })),
      paragraphe(remplir(CONFIRMATION.garantie, { article: donnees.version.articleGarantie })),
      ...(mediateur
        ? [
            paragraphe(
              remplir(CONFIRMATION.mediateur, { nom: mediateur.nom, adresse: mediateur.adresse, site: mediateur.site }),
            ),
            paragraphe(remplir(CONFIRMATION.mediation, { demande: pageDeDemande(mediateur) })),
          ]
        : []),
      paragraphe(remplir(CONFIRMATION.pieceJointe, { version: donnees.version.libelle, fichier: donnees.nomPdf })),
    ],
  };
}

// ---------------------------------------------------------------------------
// L'accusé de réception d'une rétractation
// ---------------------------------------------------------------------------

export type { Declaration } from "./declaration";

/** Où en est le remboursement d'une commande rétractée, lu sur le paiement. */
export type Remboursement = "effectue" | "a_venir" | "litige";

/**
 * La suite donnée à une déclaration de rétractation :
 * - `retractee` : cette déclaration a enregistré la rétractation ;
 * - `deja_retractee` : une autre déclaration l'avait enregistrée le `le` ;
 * - `telechargee` : le premier téléchargement, le `le`, a éteint le droit ;
 * - `simultanee` : la déclaration, reçue avant le début du premier
 *   téléchargement, a perdu la course contre lui (voir src/vente/course.ts) ;
 * - `expiree` : le délai a pris fin le `dernierJour` ;
 * - `manuelle` : la commande est retrouvée, mais une écriture ou une relecture
 *   chez Stripe a échoué, ou la course est à examiner : le vendeur traite la
 *   déclaration à la main.
 */
export type SuiteDonnee =
  | {
      type: "retractee";
      remboursement: Remboursement;
      /** Montant payé, en centimes. */
      montant: number;
    }
  | { type: "deja_retractee"; le: Date; recueLe: Date; remboursement: Remboursement; montant: number }
  | { type: "telechargee"; le: Date }
  | { type: "simultanee"; le: Date }
  | { type: "expiree"; dernierJour: Jour }
  | { type: "manuelle" };

function detailDuRemboursement(remboursement: Remboursement): { statut: string; texte: string } {
  return { effectue: ACCUSE.rembourse, a_venir: ACCUSE.aRembourser, litige: ACCUSE.litige }[remboursement];
}

function suiteEnBlocs(suite: SuiteDonnee): BlocCourriel[] {
  switch (suite.type) {
    case "retractee": {
      const detail = detailDuRemboursement(suite.remboursement);
      return [
        lignes([ACCUSE.libelleStatut, `${ACCUSE.retractee.statut} — ${detail.statut}`]),
        paragraphe(ACCUSE.retractee.texte),
        paragraphe(remplir(detail.texte, { montant: formaterPrix(suite.montant) })),
      ];
    }
    case "deja_retractee": {
      const detail = detailDuRemboursement(suite.remboursement);
      return [
        lignes([ACCUSE.libelleStatut, `${ACCUSE.dejaRetractee.statut} — ${detail.statut}`]),
        paragraphe(
          remplir(ACCUSE.dejaRetractee.texte, {
            date: dateAParis(suite.le),
            heure: heureAParis(suite.le),
            dateDeclaration: dateAParis(suite.recueLe),
            heureDeclaration: heureAParis(suite.recueLe),
          }),
        ),
        paragraphe(remplir(detail.texte, { montant: formaterPrix(suite.montant) })),
      ];
    }
    case "telechargee":
      return [
        lignes([ACCUSE.libelleStatut, ACCUSE.telechargee.statut]),
        paragraphe(remplir(ACCUSE.telechargee.texte, { date: dateAParis(suite.le), heure: heureAParis(suite.le) })),
        paragraphe(ACCUSE.erreur),
      ];
    case "simultanee":
      return [
        lignes([ACCUSE.libelleStatut, ACCUSE.simultanee.statut]),
        paragraphe(remplir(ACCUSE.simultanee.texte, { date: dateAParis(suite.le), heure: heureAParis(suite.le) })),
      ];
    case "expiree":
      return [
        lignes([ACCUSE.libelleStatut, ACCUSE.expiree.statut]),
        paragraphe(remplir(ACCUSE.expiree.texte, { date: jourEnLettres(suite.dernierJour) })),
        paragraphe(ACCUSE.erreur),
      ];
    case "manuelle":
      return [lignes([ACCUSE.libelleStatut, ACCUSE.manuelle.statut]), paragraphe(ACCUSE.manuelle.texte)];
  }
}

/**
 * L'accusé de réception (article L221-21 du Code de la consommation) : le
 * contenu de la déclaration (champs normalisés, référence extraite), la date
 * et l'heure de son envoi, et la suite donnée. La page de rétractation affiche
 * exactement ces blocs. Il ne dépend que de ce qui lui est donné : la même
 * déclaration, à la même heure, avec la même suite, donne le même e-mail.
 */
export function accuseDeReception(entree: {
  declaration: Declaration;
  recueLe: Date;
  suite: SuiteDonnee;
  fiche: FicheVendeur;
}): DocumentCourriel {
  const { declaration, recueLe, suite, fiche } = entree;
  return {
    objet: ACCUSE.objet,
    blocs: [
      paragraphe(ACCUSE.intro),
      titre(ACCUSE.titreDeclaration),
      paragraphe(ACCUSE.declaration),
      lignes(
        [ACCUSE.libelleNom, declaration.nom],
        [ACCUSE.libellePrenom, declaration.prenom],
        [ACCUSE.libelleReference, declaration.reference],
        [ACCUSE.libelleEmail, declaration.email],
        [ACCUSE.libelleEnvoyee, remplir(ACCUSE.envoyee, { date: dateAParis(recueLe), heure: heureAParis(recueLe) })],
      ),
      titre(ACCUSE.titreSuite),
      ...suiteEnBlocs(suite),
      titre(ACCUSE.titreVendeur),
      paragraphe(
        remplir(ACCUSE.vendeur, { vendeur: denomination(fiche), adresse: adresseSurUneLigne(fiche.adresse), email: fiche.email }),
      ),
    ],
  };
}
