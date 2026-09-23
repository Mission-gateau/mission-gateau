import type { Theme } from "./types";

export const AGENTS: Theme = {
  id: "agents",
  nom: "Agents secrets",
  accroche: "Une mission, des messages codés et un colis à retrouver avant l'heure.",
  ambiances: [
    "Le quartier général transmet ce message :",
    "La radio grésille, puis annonce :",
    "Un billet plié en quatre indique :",
    "L'agent de liaison a laissé cette note :",
    "Le dossier secret s'ouvre sur cette ligne :",
    "La fiche de mission précise :",
    "Une fois décodé, le message donne ceci :",
    "Un murmure dans l'oreillette souffle :",
  ],
  personnages: ["Agent Nour", "Agent Théo", "Agent Lena"],
  objetsLogique: [
    { court: "Loupe", avecArticle: "la loupe" },
    { court: "Badge", avecArticle: "le badge" },
    { court: "Lampe", avecArticle: "la lampe de poche" },
  ],
  icones: ["loupe", "cle", "valise", "lampe", "radio", "satellite", "chapeau", "montre"],
  formats: {
    chasse: {
      titreKit: "La mission des jeunes agents",
      histoire:
        "Attention, message important. Le quartier général vous appelle. Un colis est arrivé ce matin. Il est très bien caché. Personne ne sait où, sauf les agents. Et les agents, aujourd'hui, c'est vous. Le chef a laissé des messages partout dans la maison. Chaque message dit où aller. Il faut les trouver un par un. Au bout, il y a le colis. Et le colis est pour {prenom} !",
      briefing:
        "Règles de la mission, l'équipe. On avance ensemble. On marche doucement, comme des agents discrets. Quand on trouve un message, on me l'apporte et je le lis. Puis on repart. On y va ? Le premier message est tout près.",
      reussites: [
        "Bravo ! Le quartier général est content.",
        "Message reçu. Mission en bonne voie.",
        "L'équipe travaille bien. On continue !",
        "Le colis n'est plus très loin.",
      ],
      tresor:
        "Le colis est là ! Le quartier général l'a envoyé pour {prenom}, qui a {age} ans aujourd'hui. Ouvrez-le tous ensemble. À l'intérieur, il y a le gâteau et les cadeaux. Bon anniversaire, {prenom} !",
      diplomeTitre: "Diplôme de la mission",
      diplomeTexte:
        "Ce diplôme est décerné à {nom}, pour avoir suivi tous les messages du quartier général et retrouvé le colis de {prenom}.",
      invitation:
        "Mission secrète ! Un colis est caché quelque part et il faut une équipe d'agents pour le retrouver. Viens fêter les {age} ans de {prenom}.",
    },
    mission: {
      titreKit: "Mission : colis disparu",
      histoire:
        "Message du quartier général, à lire une seule fois. Un colis devait arriver ce matin. Il n'est jamais arrivé jusqu'au bureau. Notre agent de liaison a eu juste le temps de le mettre à l'abri dans cette maison avant de filer. Avant de partir, il a semé une série de messages : chacun indique où se trouve le suivant, et certains contiennent un chiffre du code de la mallette. L'agent n'a laissé aucun raccourci, par sécurité. Il faut suivre la piste dans l'ordre. Le colis est à remettre en main propre à {prenom}, qui a {age} ans aujourd'hui.",
      briefing: {
        uneEquipe:
          "Vous êtes l'équipe de terrain. Chaque message trouvé vous donne le nom d'un endroit de la maison : c'est là que se trouve le suivant. Certains messages cachent un chiffre : notez-le avec son rang, c'est une partie du code. Apportez-moi chaque message résolu, je confirme. La mission commence maintenant.",
        plusieursEquipes:
          "Vous formez plusieurs équipes de terrain, et chacune suit ses propres messages : dans une cachette, ne prenez que ceux qui portent votre symbole. Chaque message trouvé vous donne le nom d'un endroit de la maison : c'est là que se trouve le suivant. Certains messages cachent un chiffre : notez-le avec son rang, c'est une partie du code. Apportez-moi chaque message résolu, je confirme. La mission commence maintenant.",
      },
      reussites: [
        "Confirmé. L'équipe progresse.",
        "Bonne lecture du message. Continuez.",
        "Le quartier général suit la mission de près.",
        "Encore un message décodé.",
      ],
      tresor:
        "La mallette s'ouvre avec le code {code}. Le colis est intact : il est bien pour {prenom}, qui a {age} ans. Mission accomplie, l'équipe. Vous pouvez tout ouvrir.",
      diplomeTitre: "Diplôme de la mission de terrain",
      diplomeTexte:
        "Ce diplôme est décerné à {nom}, pour avoir décodé les messages du quartier général et retrouvé le colis de {prenom}.",
      invitation:
        "Avis aux agents ! Un colis a disparu quelque part dans la maison. Viens mener l'enquête avec nous pour les {age} ans de {prenom}.",
    },
    escape: {
      titreKit: "Protocole Vermeil",
      histoire: {
        uneEquipe:
          "Dossier Vermeil, niveau confidentiel. Une mallette contenant les travaux du service a été mise à l'abri dans cette maison il y a trois jours. L'agent qui l'a cachée n'a pas pu revenir. Il avait prévu ce cas de figure : la mallette est fermée par un code à quatre chiffres, et ces quatre chiffres sont répartis dans une chaîne d'énigmes qu'il a disséminées lui-même. Chaque énigme mène à une cachette, chaque cachette contient la suivante. Personne, au service, ne connaissait le code en entier. Vous avez le temps d'une après-midi pour rouvrir la mallette.",
        plusieursEquipes:
          "Dossier Vermeil, niveau confidentiel. Une mallette contenant les travaux du service a été mise à l'abri dans cette maison il y a trois jours. L'agent qui l'a cachée n'a pas pu revenir. Il avait prévu ce cas de figure : la mallette est fermée par un code à quatre chiffres, et ces quatre chiffres sont répartis dans une chaîne d'énigmes qu'il a disséminées lui-même. Chaque énigme mène à une cachette, chaque cachette contient la suivante. Aucune équipe ne détient le code entier, c'était la règle du service. Vous avez le temps d'une après-midi pour rouvrir la mallette.",
      },
      briefing: {
        uneEquipe:
          "Vous êtes l'équipe de terrain, et la mission est à vous seuls. Une énigme résolue donne le nom d'une cachette, et vous y trouverez la carte suivante. Quatre énigmes livrent chacune un chiffre du code, avec son rang : il en faut quatre pour ouvrir la mallette. Venez me voir pour valider chaque réponse. Le protocole démarre.",
        plusieursEquipes:
          "Vous formez plusieurs équipes, mais la mission est commune. Chaque équipe a ses propres énigmes : dans une cachette, ne prenez que les cartes marquées de votre symbole. Une énigme résolue donne le nom d'une cachette, et vous y trouverez la carte suivante. Quatre énigmes livrent chacune un chiffre du code, avec son rang. Il faudra tout rassembler à la fin pour ouvrir la mallette. Venez me voir pour valider chaque réponse. Le protocole démarre.",
      },
      reussites: [
        "Réponse confirmée. L'équipe avance.",
        "Décodage correct. Poursuivez.",
        "Le quartier général enregistre le chiffre.",
        "Une énigme de moins avant la mallette.",
      ],
      tresor: {
        uneEquipe:
          "Le code {code} déverrouille la mallette. Le dossier Vermeil est clos, et ce qu'il protégeait revient à {prenom}, qui a {age} ans aujourd'hui. Vous avez réuni les quatre chiffres à vous seuls.",
        plusieursEquipes:
          "Le code {code} déverrouille la mallette. Le dossier Vermeil est clos, et ce qu'il protégeait revient à {prenom}, qui a {age} ans aujourd'hui. Aucune équipe n'aurait pu l'ouvrir seule : c'est votre code à toutes.",
      },
      diplomeTitre: "Diplôme du protocole Vermeil",
      diplomeTexte:
        "Ce diplôme est décerné à {nom}, pour avoir résolu les énigmes du dossier Vermeil et reconstitué le code de la mallette, chez {prenom}.",
      invitation:
        "Dossier confidentiel : une mallette verrouillée, quatre chiffres dispersés, une après-midi pour tout rouvrir. Viens rejoindre une équipe pour les {age} ans de {prenom}.",
    },
  },
};
