import { LIBELLES_THEMES, TRANCHES_AGE, formatPourAge } from "../engine/configuration";
import { remplir } from "../engine/texte";
import type { Configuration } from "../engine/types";
import { VERSION_CGV } from "../contenu/legal";
import { TEXTES_STRIPE } from "../contenu/vente";
import type { FicheVendeur } from "../contenu/vendeur";
import { adresseSurUneLigne, denomination, mediateurCite, siRempli } from "./fiche";
import { CLES } from "./metadonnees";
import { DEVISE, MONTANT_CENTIMES } from "./prix";
import type { ParametresSession } from "./stripe";

/** Longueur maximale d'un champ personnalisé de facture Stripe. */
export const LONGUEUR_CHAMP_FACTURE = 140;

/** Le lien de la commande : la page qui vérifie le paiement et livre le jeu. */
export function lienDeCommande(adresseSite: string, reference: string): string {
  return `${adresseSite}/commande/${reference}`;
}

/** Le lien « Renoncer au contrat ici », référence préremplie. */
export function lienDeRenonciation(adresseSite: string, reference: string): string {
  return `${adresseSite}/renoncer?ref=${encodeURIComponent(reference)}`;
}

/**
 * Pied de la facture : l'identité du vendeur, sa mention de TVA et, quand la
 * convention est signée, le médiateur. Un champ vide n'y figure pas.
 */
export function piedDeFacture(fiche: FicheVendeur): string {
  const lignes = [
    denomination(fiche),
    fiche.nomCommercial,
    `SIRET ${fiche.siret}`,
    siRempli(fiche.rcs) ? `RCS ${fiche.rcs.trim()}` : null,
    siRempli(fiche.capital) ? `Capital ${fiche.capital.trim()}` : null,
    adresseSurUneLigne(fiche.adresse),
    fiche.email,
    fiche.tva,
  ];
  const mediateur = mediateurCite(fiche);
  if (mediateur) {
    lignes.push(
      remplir(TEXTES_STRIPE.mediateur, { nom: mediateur.nom, adresse: mediateur.adresse, site: mediateur.site }),
    );
  }
  return lignes.filter((ligne): ligne is string => Boolean(ligne && ligne.trim())).join(" — ");
}

/**
 * Paramètres de la session Stripe Checkout.
 *
 * Paiement unique de 12,90 € sur la page hébergée par Stripe, en français,
 * par carte seulement (Apple Pay et Google Pay en font partie ; aucun moyen
 * de paiement différé). Adresse de facturation obligatoire, facture créée
 * après le paiement et envoyée par Stripe avec son reçu. Le prix reste en
 * euros quel que soit le pays : la conversion automatique est coupée.
 *
 * Rien de ce que le parent a saisi n'y figure en clair : le produit est
 * décrit par son thème et sa tranche d'âge, et la configuration voyage
 * chiffrée dans les métadonnées du paiement.
 */
export function parametresDeSession(entree: {
  reference: string;
  configuration: Configuration;
  adresseSite: string;
  metadonnees: Record<string, string>;
  fiche: FicheVendeur;
}): ParametresSession {
  const { reference, configuration, adresseSite, metadonnees, fiche } = entree;
  const lien = lienDeCommande(adresseSite, reference);
  const format = formatPourAge(configuration.age);

  return {
    mode: "payment",
    ui_mode: "hosted_page",
    locale: "fr",
    payment_method_types: ["card"],
    adaptive_pricing: { enabled: false },
    billing_address_collection: "required",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: DEVISE,
          unit_amount: MONTANT_CENTIMES,
          product_data: {
            name: TEXTES_STRIPE.nomProduit,
            description: remplir(TEXTES_STRIPE.descriptionProduit, {
              theme: LIBELLES_THEMES[configuration.theme],
              tranche: TRANCHES_AGE[format],
            }),
          },
        },
      },
    ],
    invoice_creation: {
      enabled: true,
      invoice_data: {
        description: remplir(TEXTES_STRIPE.descriptionFacture, {
          ref: reference,
          versionCgv: VERSION_CGV.libelle,
        }),
        custom_fields: [{ name: TEXTES_STRIPE.champFacture, value: lien }],
        footer: piedDeFacture(fiche),
        metadata: { [CLES.reference]: reference },
      },
    },
    payment_intent_data: {
      // Capture immédiate : au retour de Stripe, le paiement est déjà abouti
      // et la page de commande peut livrer le jeu sans attendre.
      capture_method: "automatic",
      description: remplir(TEXTES_STRIPE.descriptionPaiement, { lien }),
      metadata: metadonnees,
    },
    custom_text: {
      submit: { message: TEXTES_STRIPE.rappelPaiement },
    },
    metadata: { [CLES.reference]: reference },
    client_reference_id: reference,
    success_url: `${lien}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${adresseSite}/creer`,
  };
}
