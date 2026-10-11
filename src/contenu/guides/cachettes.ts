import { typographier } from "../../engine/texte";
import type { Guide } from "./types";

export const CACHETTES_ENIGMES: Guide = typographier({
  adresse: "cachettes-enigmes-selon-age",
  titre: "Cachettes et énigmes adaptées à l'âge : 4, 7 et 10 ans",
  titreCourt: "Cachettes et énigmes selon l'âge",
  description:
    "Quelles cachettes et quelles énigmes pour un jeu d'anniversaire à 4, 7 ou 10 ans ? Idées par pièce, devinettes selon l'âge et consignes de sécurité.",
  modifieLe: "2026-10-11",
  chapeau:
    "Une bonne cachette se trouve en cherchant un peu, et une bonne énigme se résout sans l'aide d'un adulte, ou presque. Entre un enfant de 4 ans et un enfant de 10 ans, tout change : ce qu'il sait lire, la façon dont il fouille une pièce, le genre de raisonnement qui l'amuse. Ce guide vous aide à choisir les cachettes, à écrire des devinettes à la bonne hauteur et à préparer un jeu qui se déroule dans le calme, à la maison.",
  sections: [
    {
      titre: "Ce qu'un enfant sait lire, chercher et résoudre selon son âge",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Chaque enfant avance à son rythme : prenez ce qui suit comme des repères, pas comme une règle. Nos kits proposent trois formats selon l'âge, et chacun part de ce que l'enfant fait déjà volontiers, sans le mettre en difficulté devant ses invités.",
        },
        {
          type: "liste",
          elements: [
            "De 4 à 6 ans, la chasse au trésor se joue sans lecture. Les indices sont des images, les devinettes et les comptines sont lues à voix haute par l'adulte, et les énigmes se résolvent du doigt : trouver l'intrus, continuer une suite, suivre un labyrinthe. Le groupe reste uni et c'est vous qui le menez.",
            "De 7 à 9 ans, la mission d'agents secrets s'appuie sur une lecture courte et claire. Les enfants déchiffrent un alphabet de pictogrammes, lisent un mot écrit en miroir, cherchent dans des mots mêlés ou font un petit calcul. Chaque étape donne un chiffre d'un code à trois chiffres.",
            "De 10 à 12 ans, l'escape game propose de vrais raisonnements : un message chiffré par décalage, une grille de logique, un sudoku, un message en morse. Le code final compte quatre chiffres, et quand il y a plusieurs équipes, aucune ne le détient en entier.",
          ],
        },
        {
          type: "paragraphe",
          texte:
            "Si votre enfant est à la limite entre deux formats, pensez au plus jeune des invités plutôt qu'à l'enfant fêté. Une énigme un peu trop facile se résout dans la bonne humeur ; une énigme trop dure laisse une partie du groupe sur le côté. Pour les plus grands, vous pouvez toujours ajouter une difficulté au moment même, en retenant un coup de pouce.",
        },
      ],
    },
    {
      titre: "Des cachettes, pièce par pièce",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Voici les cachettes que nous utilisons dans nos kits. Elles se trouvent toutes dans une pièce de vie, à hauteur d'enfant, et aucune ne demande de grimper. Choisissez celles que vous avez chez vous, en écartant celles qui seraient proches du four ou des plaques.",
        },
        {
          type: "liste",
          elements: [
            "Salon et salle à manger : sous le canapé, sous un coussin du canapé, sous la table, sous une chaise, sous le tapis, derrière un livre sur une étagère basse, dans la caisse à jouets.",
            "Chambre : sous le lit, sous l'oreiller, dans le panier à linge propre, dans une boîte à chaussures, dans le pot à crayons, dans le cartable, derrière la porte de la chambre.",
            "Cuisine : dans le tiroir des torchons, dans une marmite du placard, dans la corbeille à fruits.",
            "Entrée : dans la poche d'un manteau posé sur une chaise.",
          ],
        },
        {
          type: "paragraphe",
          texte:
            "Prévoyez au moins une cachette par étape. Nos kits comptent 4, 5 ou 6 étapes pour une chasse au trésor de 30, 45 ou 60 minutes, 5, 6 ou 7 pour une mission, et 5, 7 ou 8 pour un escape game. Répartir les cachettes entre plusieurs pièces fait marcher les enfants d'un endroit à l'autre et évite qu'ils se bousculent au même endroit.",
        },
      ],
    },
    {
      titre: "Choisir la cachette selon l'âge",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Une cachette n'a pas la même difficulté pour tout le monde. L'idée reste la même à tous les âges : la cachette reste à hauteur d'enfant, et on la trouve en cherchant bien.",
        },
        {
          type: "liste",
          elements: [
            "Pour les petits, préférez des cachettes bien visibles et faciles d'accès, des objets qu'ils connaissent et savent nommer : la corbeille à fruits, l'oreiller, la caisse à jouets, le dessous de la table. Laissez dépasser un coin de la carte si besoin.",
            "Vers 7 ans, vous pouvez cacher un peu mieux : sous le tapis, dans le pot à crayons, dans le cartable. Les enfants comprennent qu'il faut soulever, ouvrir, regarder dessous.",
            "Pour les grands, choisissez des cachettes plus discrètes, celles qui se ressemblent ou qu'on oublie : derrière un livre sur une étagère basse, dans une boîte à chaussures, dans la poche d'un manteau posé sur une chaise. Elles restent toujours à hauteur d'enfant.",
          ],
        },
      ],
    },
    {
      titre: "Écrire une devinette de cachette adaptée à l'âge",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "La devinette fait deviner l'endroit sans le nommer. Partez de ce que fait l'objet, de son aspect ou de la pièce où il se trouve, puis réglez la longueur et le détour selon l'âge.",
        },
        {
          type: "liste",
          elements: [
            "À 4 ans, faites court et concret : une phrase sur ce que l'objet contient ou sert à faire, puis un ordre simple. L'adulte la lit à voix haute, une seconde fois si besoin.",
            "À 7 ans, une ou deux phrases suffisent. L'enfant les lit lui-même : choisissez des mots simples et une indication de position, dessous, derrière, dedans.",
            "À 10 ans, jouez avec une image ou une double lecture : l'objet parle de lui-même, décrit son rôle par un détour, et la réponse n'apparaît qu'en réfléchissant.",
          ],
        },
        {
          type: "paragraphe",
          texte:
            "L'exemple ci-dessous montre la devinette de départ produite par le moteur pour un même thème, les pirates, à trois âges différents. À 4 ans, la phrase dit presque tout : les fruits sont nommés, il reste à trouver la corbeille. À 7 ans, le lit n'est pas nommé, mais la définition est directe et la position est donnée. À 10 ans, la caisse à jouets se cache derrière une image et une petite contradiction : il faut relire pour comprendre.",
        },
        { type: "exemple" },
      ],
    },
    {
      titre: "Essayer chaque devinette avant la fête",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Une devinette qui paraît évidente à l'adulte qui l'a écrite peut dérouter un enfant. Prenez le temps de la faire essayer, la veille, de préférence à quelqu'un qui ne connaît pas la cachette.",
        },
        {
          type: "etapes",
          elements: [
            "Lisez la devinette à voix haute, ou faites-la lire, sans rien ajouter.",
            "Demandez à quoi elle fait penser. Si la réponse hésite entre deux objets de la maison, précisez la pièce ou la position.",
            "Vérifiez que la carte tient bien dans la cachette et qu'on la voit une fois l'objet soulevé ou ouvert.",
            "Notez sur une feuille, pour vous seul, l'ordre des cachettes et la réponse de chaque énigme.",
            "Préparez un coup de pouce par étape, une phrase qui rapproche de la réponse sans la donner.",
          ],
        },
        {
          type: "paragraphe",
          texte:
            "Le jour même, un enfant bloqué ne doit pas le rester longtemps : proposez le coup de pouce plutôt que de laisser le groupe s'impatienter. Les énigmes de nos kits sont vérifiées par le site, qui recalcule chaque solution ; les vôtres méritent la même relecture attentive.",
        },
      ],
    },
    {
      titre: "La sécurité, à tous les âges",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Un jeu de recherche met les enfants en mouvement dans toute la maison. Avant de cacher la première carte, reprenez ces consignes : ce sont celles de nos kits, et elles valent aussi pour un jeu préparé par vos soins.",
        },
        { type: "securite" },
      ],
    },
    {
      titre: "Pour gagner du temps",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Vous pouvez tout préparer à la main avec ce guide. Si vous préférez, le site compose le jeu complet à partir de l'âge, du thème et des cachettes que vous avez chez vous, avec les devinettes adaptées au format.",
        },
        { type: "versCreer" },
      ],
    },
  ],
});
