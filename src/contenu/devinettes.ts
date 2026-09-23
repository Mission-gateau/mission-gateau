import type { IdFormat } from "../engine/types";
import { typographier } from "../engine/texte";

/**
 * Une devinette par cachette et par format.
 *
 * Elles sont communes aux trois thèmes : c'est la phrase d'ambiance du thème,
 * imprimée juste avant, qui habille la carte. En 4-6 ans la devinette est une
 * comptine : phrases très courtes, rien d'effrayant, et la réponse se montre
 * du doigt plutôt qu'elle ne s'écrit.
 *
 * Un test vérifie qu'aucune cachette du catalogue n'est oubliée, pour aucun
 * format, et que chaque texte tient dans la place prévue sur la carte.
 */
export const DEVINETTES: Record<string, Record<IdFormat, string>> = typographier({
  canape: {
    chasse: "On s'assoit sur moi. Je suis tout doux. Regarde bien dessous !",
    mission: "Je suis le siège le plus long du salon. On s'y installe à plusieurs. Ton indice dort en dessous.",
    escape: "Trois personnes tiennent sur moi, parfois quatre. Je suis long, je suis moelleux, et je cache bien mon jeu. Cherche sous mes pieds.",
  },
  coussin: {
    chasse: "Je suis tout mou. Je vis sur le canapé. Soulève-moi !",
    mission: "Carré et doux, je passe mes journées sur le canapé. Soulève-moi et l'indice apparaît.",
    escape: "Je suis carré, je suis doux, et je ne sers jamais tout seul. On me tapote avant de s'asseoir. Regarde dessous.",
  },
  table: {
    chasse: "On mange sur moi. J'ai quatre pieds. Regarde en dessous !",
    mission: "Quatre pieds, un grand plateau, et les assiettes par-dessus. L'indice est collé sous moi.",
    escape: "Je porte les repas sans jamais y goûter. Mes quatre pieds ne marchent pas. Passe la main sous mon plateau.",
  },
  chaise: {
    chasse: "J'ai quatre pieds et un dos. On s'assoit sur moi. Cherche dessous !",
    mission: "J'ai un dossier et quatre pieds, mais je ne cours jamais. Regarde sous mon siège.",
    escape: "J'ai un dos mais pas de bras, quatre pieds mais aucun pas. Retourne-moi doucement.",
  },
  tapis: {
    chasse: "Je suis tout plat, par terre. On marche sur moi. Soulève-moi !",
    mission: "Je suis posé au sol et tout le monde me marche dessus sans s'excuser. Soulève mon coin.",
    escape: "Je couvre le sol sans être le sol. On s'essuie les pieds sur moi sans me dire merci. Mon coin se soulève.",
  },
  rideau: {
    chasse: "Je suis près de la fenêtre. Je bouge un peu avec l'air. Regarde derrière moi !",
    mission: "Je pends à côté de la fenêtre et je cache la lumière le soir. Regarde derrière moi.",
    escape: "Je m'ouvre et je me ferme, pourtant je ne suis pas une porte. Le soir, je fais la nuit avant la nuit. Passe derrière.",
  },
  livre: {
    chasse: "J'ai plein de pages et des images. On me lit le soir. Cherche derrière moi !",
    mission: "Je suis plein de pages et d'histoires, rangé avec mes camarades sur une étagère basse. L'indice est glissé derrière moi.",
    escape: "Je parle sans voix et je voyage sans bouger. Mes voisins me ressemblent beaucoup, sur l'étagère du bas. Glisse la main derrière.",
  },
  jouets: {
    chasse: "Je suis une grande boîte. Dedans, il y a des jeux. Fouille-moi !",
    mission: "Je suis la caisse où finissent tous les jeux le soir venu. Fouille dedans.",
    escape: "Chaque soir on me remplit, chaque matin on me vide. Je garde les jeux sans jamais jouer. Fouille-moi.",
  },
  lit: {
    chasse: "On dort sur moi la nuit. Je suis grand et doux. Regarde dessous !",
    mission: "Je suis le meuble où l'on dort. L'indice attend juste en dessous, dans l'ombre.",
    escape: "On me quitte le matin, on me retrouve le soir. Mon dessous est un petit pays sombre. Va voir.",
  },
  oreiller: {
    chasse: "On pose sa tête sur moi. Je suis tout doux. Soulève-moi !",
    mission: "On pose sa tête sur moi pour s'endormir. Soulève-moi.",
    escape: "Je reçois les têtes lourdes et les rêves légers. Soulève-moi sans réveiller personne.",
  },
  panier: {
    chasse: "Je garde le linge propre. Je suis un grand panier. Regarde dedans !",
    mission: "Je suis le panier où attend le linge propre, bien plié. Fouille dedans.",
    escape: "Je suis tressé, je suis creux, et je sens la lessive. Le linge propre m'habite. Regarde au fond.",
  },
  boite: {
    chasse: "Je suis une boîte en carton. Avant, j'avais des chaussures. Ouvre-moi !",
    mission: "Je suis une boîte en carton. Une paire de chaussures m'a habitée avant toi. Ouvre mon couvercle.",
    escape: "J'ai un couvercle et quatre coins. Des chaussures m'ont quittée il y a longtemps. Ouvre-moi.",
  },
  crayons: {
    chasse: "Je suis un pot. Dedans, il y a des crayons. Regarde au fond !",
    mission: "Je tiens debout sur le bureau et je garde les crayons au chaud. Regarde au fond.",
    escape: "Je suis plein de couleurs et je n'en ai aucune. Debout sur le bureau, j'attends les mains qui dessinent. Vide-moi.",
  },
  cartable: {
    chasse: "Je vais à l'école. J'ai des bretelles. Ouvre-moi !",
    mission: "Je pars à l'école chaque matin, porté sur un dos. Ouvre ma grande poche.",
    escape: "Je pèse lourd le lundi et léger le samedi. J'ai deux bretelles et beaucoup de secrets. Ouvre-moi.",
  },
  frigo: {
    chasse: "Je suis tout froid. Je garde à manger. Ouvre ma porte !",
    mission: "Je suis froid dedans et je garde le lait et les yaourts. Ouvre ma porte.",
    escape: "Je fais du froid sans neige et je ronronne sans être un chat. Ouvre-moi, puis referme vite.",
  },
  torchon: {
    chasse: "Je suis un tiroir. Dedans, il y a des torchons. Ouvre-moi !",
    mission: "Je suis le tiroir où dorment les torchons pliés. Ouvre-moi.",
    escape: "Je range le tissu qui essuie la vaisselle. Tire ma poignée et fouille sous la pile.",
  },
  marmite: {
    chasse: "Je suis une très grande casserole. Je vis dans le placard. Regarde dedans !",
    mission: "Je suis la grande casserole rangée dans le placard du bas. Soulève mon couvercle.",
    escape: "On me remplit de soupe les soirs d'hiver, mais aujourd'hui je suis vide et bien rangée. Soulève mon couvercle.",
  },
  fruits: {
    chasse: "Je tiens les pommes et les bananes. Regarde sous les fruits !",
    mission: "Je suis la corbeille où attendent les pommes et les bananes. Cherche dessous.",
    escape: "Je porte des fruits sans être un arbre. Écarte les pommes et regarde tout au fond.",
  },
  porte: {
    chasse: "On me pousse pour entrer. Je fais parfois du bruit. Regarde derrière moi !",
    mission: "On me pousse pour entrer dans la maison. Regarde derrière moi.",
    escape: "Je laisse passer tout le monde et je ne fais jamais un pas. Ouvre-moi en grand et regarde derrière.",
  },
  manteau: {
    chasse: "Je tiens chaud dehors. J'ai des poches. Fouille-les !",
    mission: "Je tiens chaud dehors et j'attends sagement sur le porte-manteau. Fouille mes poches.",
    escape: "Je prends la forme de qui me porte et je garde les mains au chaud. Mes poches ont la mémoire courte. Fouille-les.",
  },
});
