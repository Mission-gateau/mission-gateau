import type { Theme } from "./types";

export const PIRATES: Theme = {
  id: "pirates",
  nom: "Pirates",
  accroche: "Un équipage, une carte abîmée et un trésor caché dans la maison.",
  ambiances: [
    "Le capitaine a laissé un mot dans une bouteille :",
    "Le perroquet répète sans arrêt la même phrase :",
    "Un coin de la carte au trésor porte ces mots :",
    "Le vieux marin grommelle son indice :",
    "Sur le pont, quelqu'un a écrit ceci à la craie :",
    "La boussole tourne, hésite, puis désigne ce message :",
    "Un papier roulé dans un coquillage annonce :",
    "Le journal de bord s'ouvre à cette page :",
  ],
  personnages: ["Malo", "Sarah", "Yann"],
  objetsLogique: [
    { court: "Boussole", avecArticle: "la boussole" },
    { court: "Longue-vue", avecArticle: "la longue-vue" },
    { court: "Corde", avecArticle: "la corde" },
  ],
  icones: ["ancre", "perroquet", "carte_tresor", "boussole", "voilier", "coquillage", "crabe", "poisson"],
  formats: {
    chasse: {
      titreKit: "La chasse au trésor des pirates",
      histoire:
        "Écoutez bien, l'équipage. Cette nuit, un bateau est passé près de la maison. Le capitaine avait un coffre. Le coffre était trop lourd. Alors il l'a caché ici, tout près. Puis il est reparti sur la mer. Avant de partir, il a semé des cartes. Chaque carte montre où aller. Le perroquet nous les a laissées. Il faut les suivre, une par une. Au bout du chemin, il y a le trésor. Et le trésor, aujourd'hui, il est pour {prenom} !",
      briefing:
        "Voici la règle, l'équipage. On cherche ensemble. On marche, on ne court pas. Quand on trouve une carte, on me l'apporte. Je la lis à voix haute. Et on repart. On y va ? La première carte est cachée tout près.",
      reussites: [
        "Bravo ! Le capitaine serait fier de vous.",
        "Une carte de plus ! L'équipage avance.",
        "Le perroquet est content. Continuez !",
        "Vous approchez du trésor. Je le sens.",
      ],
      tresor:
        "Le coffre est là ! Le capitaine l'a laissé pour {prenom}, qui a {age} ans aujourd'hui. Ouvrez-le tous ensemble. À l'intérieur, il y a le gâteau et les cadeaux. Bon anniversaire, {prenom} !",
      diplomeTitre: "Diplôme de pirate",
      diplomeTexte:
        "Ce diplôme est décerné à {nom}, membre de l'équipage, pour avoir suivi toutes les cartes et retrouvé le trésor de {prenom}.",
      invitation:
        "Hissez les voiles ! Un trésor est caché et il faut un équipage pour le retrouver. Viens fêter les {age} ans de {prenom}.",
    },
    mission: {
      titreKit: "Le trésor du capitaine",
      histoire:
        "Il y a très longtemps, un capitaine sans peur a fait le tour du monde. Il rapportait des coffres de partout : des pièces, des perles, des cartes. Un jour, la tempête l'a poussé jusqu'ici. Son bateau était trop abîmé pour repartir chargé. Alors il a caché son dernier coffre dans cette maison, et il a découpé sa carte en morceaux pour que personne ne la lise en entier. Ces morceaux, les voici. Chacun mène au suivant. Le dernier mène au coffre. Personne ne l'a ouvert depuis. Aujourd'hui, c'est à vous de jouer : le trésor revient à {prenom}, qui a {age} ans.",
      briefing: {
        uneEquipe:
          "Vous êtes l'équipage. Chaque carte trouvée vous indique la cachette suivante : lisez-la bien, la réponse est le nom d'un endroit de la maison. Certaines cartes cachent aussi un chiffre : notez-le, il fait partie du code du coffre. Apportez-moi chaque carte résolue. Bonne chance.",
        plusieursEquipes:
          "Vous formez plusieurs équipes, et chacune a ses propres cartes : dans une cachette, ne prenez que celles qui portent votre symbole. Chaque carte vous indique la cachette suivante : la réponse est le nom d'un endroit de la maison. Certaines cartes cachent un chiffre du code : notez-le avec son rang. Apportez-moi chaque carte résolue. Bonne chance.",
      },
      reussites: [
        "Bien vu ! La piste tient bon.",
        "Le capitaine n'aurait pas fait mieux.",
        "Une cachette de plus, une de moins à trouver.",
        "L'équipage garde le cap.",
      ],
      tresor:
        "Le coffre du capitaine est devant vous. Le code était {code}. Il s'ouvre enfin, après toutes ces années, et ce qu'il contient revient à {prenom} pour ses {age} ans. Ouvrez-le ensemble, et servez-vous : personne ne viendra le réclamer.",
      diplomeTitre: "Diplôme de l'équipage",
      diplomeTexte:
        "Ce diplôme est décerné à {nom}, pour avoir déchiffré les cartes du capitaine et ouvert le coffre caché chez {prenom}.",
      invitation:
        "Avis à l'équipage ! Le coffre d'un vieux capitaine dort quelque part dans la maison. Viens le chercher avec nous pour les {age} ans de {prenom}.",
    },
    escape: {
      titreKit: "Le coffre scellé",
      histoire:
        "Le capitaine Rovan ne faisait confiance à personne, pas même à son équipage. Quand il a compris qu'il ne repartirait plus, il a scellé son coffre avec une serrure à quatre chiffres et il a dispersé ces chiffres dans une série d'énigmes. Chaque énigme mène à une cachette, chaque cachette contient la suivante, et quatre d'entre elles livrent un chiffre du code. Il a laissé ce mot : celui qui aura la patience de tout résoudre méritera ce qu'il y a dedans. Trois équipages ont essayé. Aucun n'est allé au bout. Le coffre est toujours là, dans cette maison, et le temps vous est compté.",
      briefing: {
        uneEquipe:
          "La piste est à vous seuls. Une énigme résolue donne le nom d'une cachette : allez-y, la carte suivante vous y attend. Quatre énigmes donnent chacune un chiffre du code, avec son rang : gardez-les tous, il en faut quatre pour ouvrir le coffre. Apportez-moi vos réponses, je valide. Le chronomètre part maintenant.",
        plusieursEquipes:
          "Vous jouez ensemble, mais chaque équipe a ses propres énigmes : dans une cachette, ne prenez que les cartes marquées de votre symbole. Une énigme résolue donne le nom d'une cachette, et la carte suivante vous y attend. Quatre énigmes donnent chacune un chiffre du code, avec son rang. Aucune équipe ne possède le code entier : il faudra tout rassembler à la fin. Apportez-moi vos réponses, je valide. Le chronomètre part maintenant.",
      },
      reussites: [
        "Exact. Vous gagnez du temps.",
        "La serrure recule d'un cran.",
        "Bien joué : Rovan n'avait pas prévu ça.",
        "Encore une énigme de moins.",
      ],
      tresor: {
        uneEquipe:
          "Le code {code} entre dans la serrure et le coffre du capitaine Rovan cède enfin. Ce qu'il gardait depuis tout ce temps revient à {prenom}, qui a {age} ans aujourd'hui. Vous avez rassemblé les quatre chiffres jusqu'au dernier.",
        plusieursEquipes:
          "Le code {code} entre dans la serrure et le coffre du capitaine Rovan cède enfin. Ce qu'il gardait depuis tout ce temps revient à {prenom}, qui a {age} ans aujourd'hui. Vous l'avez ouvert ensemble : aucune équipe n'y serait arrivée seule.",
      },
      diplomeTitre: "Diplôme du code brisé",
      diplomeTexte:
        "Ce diplôme est décerné à {nom}, pour avoir percé les énigmes du capitaine Rovan et reconstitué le code du coffre, chez {prenom}.",
      invitation:
        "Un coffre scellé, quatre chiffres perdus, et une seule après-midi pour tout résoudre. Viens former une équipe pour les {age} ans de {prenom}.",
    },
  },
};
