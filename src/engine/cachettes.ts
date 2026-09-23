import type { Cachette } from "./types";

/**
 * Catalogue fermé des cachettes.
 *
 * Règle de sécurité appliquée à la lettre : rien qui chauffe, rien qui tourne,
 * rien d'électrique, rien en hauteur, rien de coupant, rien de fragile, rien
 * dans la salle de bains, rien dehors. Toutes ces cachettes se trouvent à
 * hauteur d'enfant, dans une pièce de vie.
 *
 * Le `motCle` sert de réponse aux énigmes : majuscules, sans accent, huit
 * lettres au plus (contrainte des mots mêlés 8x8).
 */
export const CACHETTES: readonly Cachette[] = [
  { id: "canape", libelle: "Sous le canapé", motCle: "CANAPE", icone: "canape", piece: "salon", preselectionnee: true },
  { id: "coussin", libelle: "Sous un coussin du canapé", motCle: "COUSSIN", icone: "coussin", piece: "salon", preselectionnee: true },
  { id: "table", libelle: "Sous la table", motCle: "TABLE", icone: "table", piece: "salon", preselectionnee: true },
  { id: "chaise", libelle: "Sous une chaise", motCle: "CHAISE", icone: "chaise", piece: "salon", preselectionnee: true },
  { id: "tapis", libelle: "Sous le tapis", motCle: "TAPIS", icone: "tapis", piece: "salon", preselectionnee: true },
  { id: "livre", libelle: "Derrière un livre, sur une étagère basse", motCle: "LIVRE", icone: "livre", piece: "salon", preselectionnee: true },
  { id: "jouets", libelle: "Dans la caisse à jouets", motCle: "JOUETS", icone: "jouets", piece: "salon", preselectionnee: true },

  { id: "lit", libelle: "Sous le lit", motCle: "LIT", icone: "lit", piece: "chambre", preselectionnee: true },
  { id: "oreiller", libelle: "Sous l'oreiller", motCle: "OREILLER", icone: "oreiller", piece: "chambre", preselectionnee: true },
  { id: "panier", libelle: "Dans le panier à linge propre", motCle: "PANIER", icone: "panier", piece: "chambre", preselectionnee: false },
  { id: "boite", libelle: "Dans une boîte à chaussures", motCle: "BOITE", icone: "boite", piece: "chambre", preselectionnee: false },
  { id: "crayons", libelle: "Dans le pot à crayons", motCle: "CRAYONS", icone: "crayons", piece: "chambre", preselectionnee: false },
  { id: "cartable", libelle: "Dans le cartable", motCle: "CARTABLE", icone: "cartable", piece: "chambre", preselectionnee: false },
  { id: "porte", libelle: "Derrière la porte de la chambre", motCle: "PORTE", icone: "porte", piece: "chambre", preselectionnee: false },

  { id: "torchon", libelle: "Dans le tiroir des torchons", motCle: "TORCHON", icone: "torchon", piece: "cuisine", preselectionnee: false },
  { id: "marmite", libelle: "Dans une marmite du placard", motCle: "MARMITE", icone: "marmite", piece: "cuisine", preselectionnee: false },
  { id: "fruits", libelle: "Dans la corbeille à fruits", motCle: "FRUITS", icone: "fruits", piece: "cuisine", preselectionnee: true },

  { id: "manteau", libelle: "Dans la poche d'un manteau posé sur une chaise", motCle: "MANTEAU", icone: "manteau", piece: "entree", preselectionnee: true },
];

export const LIBELLES_PIECES: Record<Cachette["piece"], string> = {
  salon: "Salon et salle à manger",
  chambre: "Chambre",
  cuisine: "Cuisine",
  entree: "Entrée",
};

const PAR_ID = new Map(CACHETTES.map((c) => [c.id, c]));

export function cachette(id: string): Cachette {
  const trouvee = PAR_ID.get(id);
  if (!trouvee) throw new Error(`Cachette inconnue : ${id}`);
  return trouvee;
}

export const IDS_CACHETTES = CACHETTES.map((c) => c.id);

export const CACHETTES_PRESELECTIONNEES = CACHETTES.filter((c) => c.preselectionnee).map((c) => c.id);
