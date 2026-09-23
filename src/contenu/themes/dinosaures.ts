import type { Theme } from "./types";

export const DINOSAURES: Theme = {
  id: "dinosaures",
  nom: "Dinosaures",
  accroche: "Une vallée oubliée, des empreintes à suivre et un œuf à protéger.",
  ambiances: [
    "Le carnet du paléontologue indique :",
    "Une empreinte dans la boue mène à ce message :",
    "Le petit dinosaure pousse un cri qui ressemble à ceci :",
    "Une feuille de fougère porte ces mots :",
    "La carte de la vallée précise :",
    "Le vieux tronc creux garde cette phrase :",
    "Un éclat de coquille est gravé ainsi :",
    "Le guide de la vallée a noté :",
  ],
  personnages: ["Camille", "Robin", "Alix"],
  objetsLogique: [
    { court: "Pinceau", avecArticle: "le pinceau" },
    { court: "Carnet", avecArticle: "le carnet" },
    { court: "Marteau", avecArticle: "le petit marteau" },
  ],
  icones: ["dinosaure", "tyrannosaure", "oeuf", "os", "feuille", "palmier", "empreinte", "meteore"],
  formats: {
    chasse: {
      titreKit: "La chasse aux dinosaures",
      histoire:
        "Écoutez bien. Cette nuit, un tout petit dinosaure est passé par ici. Il cherchait un endroit tranquille. Il a posé son œuf quelque part dans la maison. Puis il est reparti dans la vallée. Mais il a laissé des traces. Des traces partout ! Chaque trace montre où aller. Il faut les suivre, une par une, doucement. Au bout, il y a l'œuf. Et l'œuf est un cadeau pour {prenom} !",
      briefing:
        "Voici la règle, l'équipe. On cherche tous ensemble. On marche à pas de dinosaure : doucement. Quand on trouve une trace, on me l'apporte et je la lis. Puis on repart. On y va ? La première trace est tout près.",
      reussites: [
        "Bravo ! Le petit dinosaure serait content.",
        "Une trace de plus ! On avance bien.",
        "Vous suivez la piste comme de vrais guides.",
        "L'œuf n'est plus très loin.",
      ],
      tresor:
        "Le nid est là ! Le petit dinosaure l'a laissé pour {prenom}, qui a {age} ans aujourd'hui. Ouvrez-le tous ensemble. À l'intérieur, il y a le gâteau et les cadeaux. Bon anniversaire, {prenom} !",
      diplomeTitre: "Diplôme de la vallée",
      diplomeTexte:
        "Ce diplôme est décerné à {nom}, membre de l'expédition, pour avoir suivi toutes les traces et retrouvé le nid de {prenom}.",
      invitation:
        "Un petit dinosaure a laissé son nid dans la maison ! Viens suivre les traces avec nous pour les {age} ans de {prenom}.",
    },
    mission: {
      titreKit: "L'expédition de la vallée",
      histoire:
        "Voici le carnet d'une expédition qui n'est jamais revenue au camp. L'équipe cherchait une vallée dont on parlait depuis des années, une vallée où les dinosaures auraient survécu bien plus longtemps qu'ailleurs. Ils l'ont trouvée. Ils ont même rapporté un œuf fossile entier, le seul connu. Puis la saison des pluies est arrivée et il a fallu partir vite. Avant de plier le camp, ils ont mis l'œuf à l'abri dans cette maison et ils ont noté la piste dans leur carnet, page après page, chaque page menant à la suivante. Le carnet est là. L'œuf aussi. Il revient à {prenom}, qui a {age} ans.",
      briefing:
        "Vous reprenez l'expédition. Chaque page trouvée vous donne le nom d'un endroit de la maison : la page suivante y est cachée. Certaines pages portent un chiffre : notez-le, c'est un morceau du code de la caisse. Apportez-moi chaque page résolue, je vérifie. L'expédition repart maintenant.",
      reussites: [
        "Exact ! L'expédition progresse.",
        "Bien lu. La piste continue.",
        "Le carnet ne vous a pas menti.",
        "Encore une page, et on y sera.",
      ],
      tresor:
        "La caisse de l'expédition s'ouvre avec le code {code}. L'œuf fossile est intact, et il revient à {prenom} pour ses {age} ans. Vous avez terminé ce que l'expédition avait commencé.",
      diplomeTitre: "Diplôme de paléontologue",
      diplomeTexte:
        "Ce diplôme est décerné à {nom}, pour avoir déchiffré le carnet de l'expédition et retrouvé l'œuf fossile chez {prenom}.",
      invitation:
        "Une expédition inachevée, un carnet plein d'indices et un œuf fossile à retrouver. Viens mener l'enquête pour les {age} ans de {prenom}.",
    },
    escape: {
      titreKit: "La vallée scellée",
      histoire:
        "La dernière expédition de la vallée a rapporté davantage qu'un œuf : elle a rapporté des relevés que personne n'a jamais pu lire. Sa responsable, la paléontologue Irène Sorel, savait que son matériel serait convoité. Elle a donc enfermé ses relevés dans une caisse à serrure, puis elle a éparpillé le code à quatre chiffres dans une série d'énigmes tirées de son propre carnet de terrain. Chaque énigme désigne une cachette, chaque cachette contient la suivante, et quatre d'entre elles livrent un chiffre. Elle avait prévu qu'il faudrait plusieurs équipes pour tout rassembler. La caisse n'a jamais été rouverte. Elle est ici.",
      briefing:
        "Vous formez plusieurs équipes et vous travaillez sur des énigmes différentes. Une énigme résolue donne le nom d'une cachette : la carte suivante vous y attend, marquée de votre symbole. Quatre énigmes donnent chacune un chiffre du code, avec son rang. Aucune équipe ne détient le code complet : il faudra tout mettre en commun devant la caisse. Venez valider chaque réponse auprès de moi.",
      reussites: [
        "Exact. Irène Sorel aurait approuvé.",
        "Relevé confirmé. L'équipe avance.",
        "Un chiffre de plus au tableau.",
        "La caisse se rapproche.",
      ],
      tresor:
        "Le code {code} fait céder la serrure et la caisse d'Irène Sorel s'ouvre enfin. Ses relevés, et ce qu'elle gardait avec, reviennent à {prenom}, qui a {age} ans aujourd'hui. Il aura fallu toutes vos équipes pour y arriver.",
      diplomeTitre: "Diplôme de la vallée scellée",
      diplomeTexte:
        "Ce diplôme est décerné à {nom}, pour avoir résolu les énigmes d'Irène Sorel et reconstitué le code de la caisse, chez {prenom}.",
      invitation:
        "Une caisse scellée, quatre chiffres dispersés dans un carnet de terrain, une après-midi pour tout rouvrir. Viens former une équipe pour les {age} ans de {prenom}.",
    },
  },
};
