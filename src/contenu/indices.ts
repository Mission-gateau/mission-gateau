import { typographier } from "../engine/texte";

/**
 * Indices de dépannage, pour l'adulte.
 *
 * Trois niveaux par étape : la pièce, puis un indice moyen propre à la
 * cachette, puis la réponse. Le guide les imprime dans cet ordre, de façon
 * que le maître du jeu puisse débloquer une équipe sans tout révéler.
 */
export const GABARITS_INDICES = typographier({
  premier: "Cherchez du côté de : {piece}.",
  troisieme: "La réponse : {libelle}.",
} as const);

export const INDICES_CACHETTES: Record<string, string> = typographier({
  canape: "C'est un meuble sur lequel on s'assoit à plusieurs, et il faut se baisser.",
  coussin: "C'est mou, c'est carré, et cela se soulève d'une main.",
  table: "Regardez sous quelque chose qui a un grand plateau.",
  chaise: "C'est un siège, mais pour une seule personne.",
  tapis: "C'est par terre, et il faut en soulever un coin.",
  livre: "Cherchez sur une étagère basse, derrière quelque chose qui se lit.",
  jouets: "C'est un contenant, et il est déjà plein de choses amusantes.",
  lit: "C'est le meuble où l'on dort, et il faut regarder dessous.",
  oreiller: "C'est sur le lit, et on y pose la tête.",
  panier: "Cherchez du côté du linge propre.",
  boite: "C'est un contenant en carton, avec un couvercle.",
  crayons: "Cherchez près du bureau, dans quelque chose qui tient debout.",
  cartable: "C'est ce qui part à l'école chaque matin.",
  torchon: "Cherchez dans un tiroir de la cuisine, sous du tissu plié.",
  marmite: "C'est dans un placard bas, et cela sert à faire la soupe.",
  fruits: "Cherchez du côté des pommes et des bananes.",
  porte: "C'est ce qu'on pousse pour passer d'une pièce à l'autre.",
  manteau: "Cherchez dans un vêtement chaud, posé à portée de main.",
});
