import { typographier } from "../../engine/texte";
import type { Guide } from "./types";

export const ESCAPE_10_12_ANS: Guide = typographier({
  adresse: "escape-game-anniversaire-10-12-ans",
  titre: "Un escape game d'anniversaire à la maison pour les 10-12 ans",
  titreCourt: "Escape game, 10-12 ans",
  description:
    "Organiser un escape game d'anniversaire à la maison pour des enfants de 10 à 12 ans : énigmes, code à 4 chiffres, équipes, coups de pouce et fin du jeu.",
  modifieLe: "2026-10-11",
  chapeau:
    "Vers 10 ou 12 ans, une simple chasse au trésor ne suffit plus : les enfants veulent réfléchir, déduire, déchiffrer. Un escape game à la maison leur offre exactement cela, avec un salon, une chambre, quelques feuilles imprimées et un adulte qui tient les rênes. Voici comment le construire vous-même, énigme par énigme.",
  sections: [
    {
      titre: "Le principe : une histoire, un temps donné, un code",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Un escape game d'anniversaire repose sur trois éléments. D'abord une histoire, lue à voix haute au début : un trésor de pirates enfermé dans un coffre, un laboratoire à remettre en marche, une salle des archives à ouvrir. Ensuite un temps donné, annoncé dès le départ, qui crée l'urgence. Enfin une suite d'énigmes enchaînées : chacune mène à la suivante, et ensemble elles livrent un code à 4 chiffres qui ouvre le trésor.",
        },
        {
          type: "paragraphe",
          texte:
            "À la maison, il n'y a pas de pièce verrouillée : les enfants ne sont pas enfermés, ce sont les réponses qui sont cachées. Chaque énigme résolue indique une cachette où se trouve la carte suivante, et certaines donnent un chiffre du code. Nos kits suivent cette règle pour les 10-12 ans : 5 étapes pour une partie de 30 minutes, 7 pour 45 minutes, 8 pour une heure, et un code final à 4 chiffres.",
        },
      ],
    },
    {
      titre: "Les énigmes qui tiennent à cet âge",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "À 10-12 ans, les enfants lisent avec aisance et aiment les défis où il faut raisonner. Les énigmes qui fonctionnent bien sont celles qui demandent une méthode plutôt qu'une connaissance : une fois la règle comprise, toute l'équipe peut avancer.",
        },
        {
          type: "liste",
          elements: [
            "Le chiffre de César : chaque lettre d'un mot est décalée dans l'alphabet du même nombre de rangs. Il suffit de reculer d'autant pour lire le message.",
            "Le sudoku 4x4 ou 6x6 : assez court pour être résolu en quelques minutes, assez rigoureux pour faire réfléchir. Une case entourée donne le chiffre recherché.",
            "La grille de logique : trois pirates, trois couleurs, trois trésors, et une poignée d'affirmations pour retrouver qui possède quoi.",
            "Le morse : une suite de points et de traits, avec la légende fournie, à transcrire lettre par lettre.",
            "Les mots mêlés : une grille de lettres où se cache un mot, parfois le nom de la cachette suivante.",
            "Le labyrinthe : un chemin à suivre au crayon, qui passe par des lettres ou des chiffres à relever.",
          ],
        },
        {
          type: "paragraphe",
          texte:
            "Variez les types d'une étape à l'autre : un enfant qui sèche sur la logique sera peut-être le plus rapide en morse, et chacun trouve ainsi son moment pour briller.",
        },
      ],
    },
    {
      titre: "Enchaîner les énigmes",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Le chaînage fait tout l'intérêt du jeu. Une réponse peut désigner la cachette suivante : le mot LIT envoie sous le lit, le mot TAPIS sous le tapis. Une autre peut livrer un chiffre du code, à noter précieusement. Mieux encore, un chiffre déjà trouvé peut servir de clé à l'énigme d'après : les enfants comprennent alors que rien n'est à jeter et que tout se tient.",
        },
        {
          type: "paragraphe",
          texte:
            "L'exemple ci-dessous montre ce chaînage pour Camille, 11 ans, sur le thème des pirates. L'énigme s'appelle « Le message décalé ». Le message chiffré tient en trois lettres, et le décalage vaut 2 : c'est le chiffre que l'équipe a trouvé à l'étape précédente. En reculant chaque lettre de deux rangs, N devient L, K devient I, V devient T : la réponse est LIT, et la carte suivante attend sous le lit.",
        },
        { type: "exemple" },
        {
          type: "paragraphe",
          texte: "Vous pouvez fabriquer ce genre de message à la main, avec un crayon et une feuille :",
        },
        {
          type: "etapes",
          elements: [
            "Écrivez l'alphabet en entier sur une ligne, pour ne pas vous tromper en comptant.",
            "Choisissez le mot réponse, de préférence le nom d'une cachette : TABLE, CHAISE, COUSSIN.",
            "Choisissez le décalage : idéalement, un chiffre que l'équipe aura trouvé juste avant.",
            "Avancez chaque lettre du mot d'autant de rangs. Arrivé au Z, repartez au A.",
            "Recopiez proprement le message chiffré sur la carte, avec une consigne claire : « Recule chaque lettre du nombre de rangs que ton équipe a déjà trouvé. »",
            "Déchiffrez-le vous-même dans l'autre sens pour vérifier que vous retombez sur le bon mot.",
          ],
        },
      ],
    },
    {
      titre: "Plusieurs équipes, un seul code",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Au-delà de six enfants, une seule équipe devient bruyante et certains restent spectateurs. Nos kits prévoient une équipe jusqu'à 6 enfants, deux équipes de 7 à 12, trois de 13 à 16. Chaque équipe suit son propre parcours, avec ses propres cartes, repérées par un symbole.",
        },
        {
          type: "paragraphe",
          texte:
            "L'astuce consiste à répartir le code entre les équipes. Dès deux équipes, personne ne détient le code en entier : l'une trouve deux chiffres, l'autre les deux suivants, et il faut se réunir pour ouvrir le trésor. La compétition du début se change en coopération à la fin, et personne ne gagne contre les autres. Pensez à indiquer sur la dernière carte de chaque équipe la place de ses chiffres dans le code, pour éviter les disputes sur l'ordre.",
        },
      ],
    },
    {
      titre: "Tester ses énigmes avant le jour de la fête",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Une énigme qui paraît évidente à celui qui l'a écrite peut bloquer toute une équipe. Quelques jours avant, faites résoudre chaque énigme par un adulte qui ne connaît pas les réponses, sans l'aider. Notez où il hésite et reformulez la consigne.",
        },
        {
          type: "liste",
          elements: [
            "Vérifiez qu'il n'y a qu'une solution : un sudoku ou une grille de logique qui en admet deux sème la confusion.",
            "Relisez chaque mot chiffré lettre par lettre : une seule erreur de décalage rend l'énigme insoluble.",
            "Contrôlez que la réponse de chaque étape mène bien à la cachette prévue, et que les chiffres forment le bon code.",
            "Gardez une feuille de solutions pour vous, rangée loin des regards curieux.",
          ],
        },
        {
          type: "paragraphe",
          texte:
            "Dans nos kits, chaque énigme est vérifiée par le site : un programme recalcule la solution avant l'impression.",
        },
      ],
    },
    {
      titre: "Des coups de pouce gradués",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Prévoyez pour chaque énigme trois coups de pouce, du plus vague au plus précis. Le premier rappelle la méthode, le deuxième montre le début de la solution, le troisième la donne presque. Proposez-les dans l'ordre, seulement quand une équipe bloque vraiment : un coup de pouce plutôt que la réponse permet aux enfants de garder le mérite de la découverte.",
        },
      ],
    },
    {
      titre: "L'ambiance, le temps et la fin du jeu",
      blocs: [
        {
          type: "paragraphe",
          texte:
            "Gardez la partie sans écran : du papier, des crayons, une lampe de poche pour l'atmosphère, une musique d'ambiance douce si vous le souhaitez. Un compte à rebours visible, sur une horloge ou un minuteur de cuisine, entretient la tension sans téléphone dans les mains.",
        },
        {
          type: "paragraphe",
          texte:
            "Côté horaires, nos kits comptent 5 minutes d'accueil, 3 minutes pour lire l'histoire, puis les étapes se partagent le temps, et la séquence du code et du trésor prend le reste, au moins 5 minutes. Si une équipe prend du retard, accélérez les coups de pouce plutôt que de rallonger la partie.",
        },
        {
          type: "paragraphe",
          texte:
            "Soignez la fin, c'est le moment dont on se souvient. Réunissez les équipes autour du coffre, faites annoncer le code à voix haute, chiffre par chiffre, et ne remettez le trésor qu'en échange du code complet. Un cadenas à code, si vous en avez un, rend l'ouverture plus solennelle. Le trésor peut être simple : des friandises à partager, des diplômes d'enquêteurs, puis le gâteau.",
        },
        {
          type: "paragraphe",
          texte:
            "Pour la sécurité, choisissez des cachettes à hauteur d'enfant, dans les pièces de vie, et rappelez la règle avant de commencer : on marche, on ne court pas, et on ne monte sur rien. Restez avec le groupe du début à la fin.",
        },
        { type: "versCreer" },
      ],
    },
  ],
});
