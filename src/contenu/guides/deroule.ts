import { typographier } from "../../engine/texte";
import type { Guide } from "./types";

export const DEROULE: Guide = typographier({
  adresse: "deroule-anniversaire-enfant-maison",
  titre: "Le déroulé d'un anniversaire d'enfant à la maison, heure par heure",
  titreCourt: "Le déroulé de la fête",
  description:
    "Accueil, jeu, goûter, gâteau, cadeaux, départ : le programme heure par heure d'un anniversaire d'enfant à la maison, selon la durée et le nombre d'enfants.",
  modifieLe: "2026-10-11",
  chapeau:
    "Un anniversaire à la maison se passe mieux quand l'après-midi a une forme simple : on accueille, on joue, on goûte, on ouvre les cadeaux, puis chacun repart à l'heure prévue. Ce guide vous aide à poser ce programme sur une feuille, selon la durée que vous choisissez et le nombre d'enfants invités, avec les minutes que prévoient nos kits pour la partie de jeu.",
  sections: [
    {
      titre: "Avant la fête : décider du cadre",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Tout commence par l'invitation. Indiquez l'heure de début et l'heure de fin : les parents s'organisent, et vous savez dès le départ combien de temps vous avez. Une fin écrite sur le carton est aussi une fin plus facile à tenir le jour même.",
        },
        {
          type: "paragraphe",
          texte:
            "Choisissez ensuite la durée du jeu. Nos kits proposent trois longueurs, 30, 45 ou 60 minutes ; le reste de l'après-midi se construit autour. Une partie courte laisse plus de place au goûter et aux jeux libres, une partie longue devient le cœur de la fête.",
        },
        {
          type: "etapes",
          elements: [
            "Envoyez les invitations avec la date, l'adresse, l'heure de début, l'heure de fin et un moyen de vous joindre.",
            "Demandez aux parents de vous signaler toute allergie ou contrainte alimentaire, et renseignez-vous auprès d'eux en cas de doute.",
            "La veille, préparez le jeu : cartes découpées, énigmes rangées dans l'ordre, trésor mis de côté.",
            "Le jour même, avant la première sonnerie, posez les cartes dans leurs cachettes, fermez les pièces qui ne servent pas et rangez hors de portée les produits ménagers, les médicaments et les objets coupants.",
            "Dressez le goûter à l'avance, ou au moins préparez tout ce qui peut l'être : pendant le jeu, vous serez occupé avec le groupe.",
          ],
        },
      ],
    },
    {
      titre: "L'accueil : des arrivées échelonnées",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Les invités n'arrivent jamais tous ensemble. Les premiers attendent les derniers, et c'est là que l'agitation monte si rien n'est prévu. Proposez une activité d'attente calme, que l'on peut rejoindre ou quitter à tout moment : des feuilles et des crayons pour faire un dessin à offrir à l'enfant qui fête son anniversaire, un coin de livres, un puzzle posé sur la table, un jeu de cartes simple.",
        },
        {
          type: "paragraphe",
          texte:
            "Gardez le jeu principal pour le moment où tout le monde est là. Nos kits comptent 5 minutes d'accueil au début de la partie : c'est le temps de rassembler les enfants, de former les équipes et d'annoncer qu'une aventure commence. Si un retardataire arrive pendant le jeu, faites-le entrer dans une équipe déjà formée plutôt que de tout reprendre.",
        },
      ],
    },
    {
      titre: "Le jeu : 30, 45 ou 60 minutes",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Dans nos kits, la partie suit toujours le même fil. Après les 5 minutes d'accueil, l'adulte lit l'histoire à voix haute pendant 3 minutes, puis donne la première devinette. Les étapes se partagent ensuite le temps restant, une cachette par étape. La partie se termine par le code et le trésor, qui prend tout ce qui reste, au moins 5 minutes.",
        },
        {
          type: "liste",
          elements: [
            "De 4 à 6 ans, une chasse au trésor sans lecture, avec 4, 5 ou 6 étapes selon la durée, et pas de code final : la dernière carte ramène au trésor.",
            "De 7 à 9 ans, une mission, avec 5, 6 ou 7 étapes, et un code final de 3 chiffres.",
            "De 10 à 12 ans, un escape game, avec 5, 7 ou 8 étapes, et un code final de 4 chiffres.",
          ],
        },
        {
          type: "paragraphe",
          texte:
            "Voici le déroulé que le site a produit pour Camille, qui fête ses 7 ans avec 10 enfants et une partie de 60 minutes sur le thème des dinosaures. On y lit l'accueil, avec deux équipes à former, la lecture de l'histoire, puis 7 étapes de 6 minutes, de la 8e à la 50e minute, avant les 10 minutes du code et du trésor.",
        },
        { type: "exemple" },
        {
          type: "paragraphe",
          texte:
            "À la 60e minute, la partie s'arrête mais la fête continue : la dernière ligne, « Et ensuite », renvoie au gâteau, aux cadeaux et à la remise des diplômes. Si une équipe avance plus vite, laissez-la souffler ; si une autre bloque, donnez un coup de pouce plutôt que la réponse.",
        },
      ],
    },
    {
      titre: "Le goûter, le gâteau et les cadeaux",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Placez le goûter juste après le jeu. Les enfants arrivent à table avec une histoire à raconter, et le trésor qu'ils viennent de trouver peut contenir le gâteau lui-même : dans nos kits, le trésor rassemble le gâteau et les cadeaux dans un carton ou un sac. Le jeu débouche alors naturellement sur le moment des bougies.",
        },
        {
          type: "paragraphe",
          texte:
            "Pour les cadeaux, deux choix se défendent. Les ouvrir pendant la fête, assis en cercle, chacun tendant le sien à tour de rôle ; ou les mettre de côté et les ouvrir en famille après le départ des invités, ce qui allège la fin d'après-midi. Décidez-le à l'avance et tenez-vous-y.",
        },
      ],
    },
    {
      titre: "Une fin annoncée, un départ à l'heure dite",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Une fête qui s'arrête net laisse un goût d'inachevé. Prévenez les enfants un peu avant : « encore un jeu, puis les diplômes ». La remise des diplômes fait une belle conclusion, chacun reçoit le sien avec son prénom, et cela occupe le groupe pendant que les parents arrivent.",
        },
        {
          type: "liste",
          elements: [
            "Rassemblez à l'avance les manteaux, les sacs et ce que chaque enfant emporte.",
            "Rendez chaque enfant à un adulte que vous connaissez, à l'heure écrite sur l'invitation.",
            "Gardez une activité calme pour ceux dont les parents ont du retard : dessin, livre, ou la fin du puzzle de l'accueil.",
          ],
        },
      ],
    },
    {
      titre: "Deux trames d'après-midi",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Ces trames sont des points de repère, à ajuster selon votre heure de début. Les minutes du jeu sont celles de nos kits ; le reste dépend de votre rythme.",
        },
        {
          type: "paragraphe",
          texte:
            "Une fête courte, avec une partie de 30 minutes, par exemple une mission pour des 7 à 9 ans :",
        },
        {
          type: "etapes",
          elements: [
            "Au début, les arrivées et une activité d'attente calme, le temps que tout le monde soit là.",
            "Le jeu : 5 minutes d'accueil, 3 minutes de lecture de l'histoire, 5 étapes de 3 minutes, puis 7 minutes pour le code et le trésor.",
            "Après le jeu, le goûter et le gâteau.",
            "Les cadeaux, si vous les ouvrez pendant la fête.",
            "Les diplômes, puis le départ à l'heure annoncée.",
          ],
        },
        {
          type: "paragraphe",
          texte: "Une fête plus longue, avec une partie de 60 minutes, comme celle de Camille :",
        },
        {
          type: "etapes",
          elements: [
            "Au début, les arrivées et une activité d'attente calme.",
            "Le jeu : 5 minutes d'accueil, 3 minutes de lecture, 7 étapes de 6 minutes, puis 10 minutes pour le code et le trésor.",
            "Après le jeu, une pause au goûter, avec le gâteau sorti du trésor.",
            "Les cadeaux, puis un temps libre ou un jeu de groupe simple si l'énergie le permet.",
            "La fin annoncée, les diplômes et le départ à l'heure dite.",
          ],
        },
        {
          type: "paragraphe",
          texte:
            "Entre les deux, une partie de 45 minutes garde la même forme : nos kits prévoient alors 5 étapes en chasse au trésor, 6 en mission et 7 en escape game.",
        },
      ],
    },
    {
      titre: "Selon le nombre d'enfants",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Nos kits accueillent de 3 à 16 enfants. De 4 à 6 ans, on joue toujours en un seul groupe, mené par l'adulte qui lit les cartes à voix haute. À partir de 7 ans, on joue en une seule équipe jusqu'à 6 enfants, en deux équipes de 7 à 12 enfants, et en trois équipes de 13 à 16 enfants. Chaque équipe a ses propres cartes, reconnaissables au symbole imprimé en haut.",
        },
        {
          type: "paragraphe",
          texte:
            "Plus le groupe grandit, plus il est utile d'avoir d'autres adultes avec vous. Avec plusieurs équipes, l'idéal est qu'un adulte accompagne chacune d'elles pendant que vous restez le maître du jeu : vous validez les réponses, vous remettez les énigmes, et vous ne remettez le trésor qu'en échange du code complet. Pendant le goûter et au départ, une paire de bras en plus est aussi bienvenue.",
        },
        {
          type: "paragraphe",
          texte:
            "Un dernier rappel, valable quel que soit le nombre d'enfants : pendant le jeu, on marche, on ne court pas, on ne monte sur rien, et un adulte reste avec le groupe du début à la fin.",
        },
        { type: "versCreer" },
      ],
    },
  ],
});
