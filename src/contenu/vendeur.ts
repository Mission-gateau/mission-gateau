/**
 * La fiche du vendeur.
 *
 * Tout ce qui concerne le vendeur vit ici, et nulle part ailleurs : les pages
 * légales, le pied de page, la facture Stripe et la condition d'ouverture de
 * la vente lisent ce seul fichier. Changer de vendeur — une société
 * remplacera un jour la micro-entreprise — se fait en modifiant ce fichier et
 * la clé Stripe, sans toucher au code.
 *
 * Règles :
 * - rien n'est inventé : un champ inconnu reste vide ;
 * - un champ vide n'est jamais affiché, ni remplacé par un texte provisoire ;
 * - la vente reste fermée tant qu'un champ obligatoire est vide, ou tant que
 *   la convention avec le médiateur n'est pas signée (voir src/vente/fiche.ts).
 */

export interface Adresse {
  rue: string;
  codePostal: string;
  ville: string;
  pays: string;
}

export interface FicheVendeur {
  /** Nom de la personne ou dénomination de la société. */
  nom: string;
  /**
   * Mention accolée au nom : « EI » pour un entrepreneur individuel
   * (article R526-26 du Code de commerce), la forme sociale pour une société.
   */
  mention: string;
  /** Statut en toutes lettres. */
  statut: string;
  /** Capital social : vide pour un entrepreneur individuel. Facultatif. */
  capital: string;
  nomCommercial: string;
  directeurPublication: string;
  siret: string;
  /** Numéro d'immatriculation au RCS. Facultatif : affiché seulement s'il est rempli. */
  rcs: string;
  adresse: Adresse;
  telephone: string;
  /** Adresse du service client et des réclamations. */
  email: string;
  /** Mention de TVA portée sur le site et sur les factures. */
  tva: string;
  mediateur: {
    nom: string;
    /** Adresse postale, où le consommateur peut aussi saisir le médiateur par courrier. */
    adresse: string;
    /** Adresse du site du médiateur (article R616-1 du Code de la consommation). */
    site: string;
    /** Page du site du médiateur où déposer une demande de médiation. Facultative : à défaut, le site. */
    demande: string;
    /** Tant que c'est faux, le médiateur n'est nommé nulle part. */
    conventionSignee: boolean;
  };
  hebergeur: {
    nom: string;
    adresse: string;
    telephone: string;
    site: string;
  };
  paiement: {
    nom: string;
    adresse: string;
  };
}

export const VENDEUR: FicheVendeur = {
  nom: "Quentin Courtois",
  mention: "EI",
  statut: "entrepreneur individuel",
  capital: "",
  nomCommercial: "Mission Gâteau",
  directeurPublication: "Quentin Courtois",
  siret: "992 667 006 00017",
  rcs: "",
  adresse: {
    rue: "7 impasse des Bosquets",
    codePostal: "34670",
    ville: "Baillargues",
    pays: "France",
  },
  telephone: "+33 6 32 57 69 77",
  email: "contact@missiongateau.com",
  tva: "TVA non applicable, article 293 B du CGI",
  mediateur: {
    nom: "Société Médiation Professionnelle",
    adresse: "Alteritae, 5 rue Salvaing, 12000 Rodez",
    site: "https://www.mediateur-consommation-smp.fr",
    demande: "https://www.mediateur-consommation-smp.fr/demander-une-mediation/",
    // Convention signée le 25 septembre 2026.
    conventionSignee: true,
  },
  hebergeur: {
    nom: "Vercel Inc.",
    adresse: "440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis",
    telephone: "+1 951 383 6898",
    site: "https://vercel.com",
  },
  paiement: {
    nom: "Stripe Payments Europe, Limited",
    adresse: "1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Irlande",
  },
};
