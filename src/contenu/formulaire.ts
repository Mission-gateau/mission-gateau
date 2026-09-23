import { typographier } from "../engine/texte";

/** Textes du formulaire. Le parent est vouvoyé du début à la fin. */

export const FORMULAIRE = typographier({
  titre: "Créer mon jeu",
  intro:
    "Six questions, et votre aperçu est prêt. Rien de ce que vous saisissez n'est enregistré : vos réponses servent à composer le jeu, puis disparaissent.",
  etapeSur: "Étape {courante} sur {total}",
  precedent: "Retour",
  suivant: "Continuer",
  voirApercu: "Voir l'aperçu gratuit",
  enCours: "Composition de votre aperçu…",

  etapes: [
    { cle: "theme", titre: "Quel thème ?", aide: "Le thème habille les histoires, les cartes et les diplômes." },
    { cle: "age", titre: "Quel âge fête-t-on ?", aide: "Le format du jeu s'adapte tout seul à l'âge." },
    { cle: "prenom", titre: "Le prénom de l'enfant", aide: "Il apparaît dans l'histoire, sur le trésor et sur les diplômes." },
    { cle: "enfants", titre: "Combien d'enfants en tout ?", aide: "Enfant fêté compris. Les équipes se forment toutes seules." },
    { cle: "duree", titre: "Combien de temps de jeu ?", aide: "Le nombre d'étapes s'ajuste à la durée." },
    { cle: "cachettes", titre: "Quelles cachettes avez-vous ?", aide: "Décochez ce que vous n'avez pas. Toutes sont sûres et à hauteur d'enfant." },
    { cle: "fete", titre: "Quelques détails, si vous voulez", aide: "Tout est facultatif : ce que vous laissez vide devient une ligne à compléter à la main." },
  ],

  labelTheme: "Thème du jeu",
  labelAge: "Âge fêté",
  labelPrenom: "Prénom de l'enfant qui fête son anniversaire",
  aidePrenom: "Lettres, espaces, tirets et apostrophes. 20 caractères au plus.",
  labelEnfants: "Nombre d'enfants",
  labelDuree: "Durée du jeu",
  labelCachettes: "Cachettes disponibles chez vous",
  labelDate: "Date de la fête",
  labelHeure: "Heure",
  labelAdresse: "Adresse",
  labelContact: "Téléphone ou courriel pour les parents",
  labelInvites: "Prénoms des invités",
  aideInvites:
    "Un prénom par ligne. Ils apparaissent sur les invitations et les diplômes. Laissé vide, chaque carton porte une ligne à compléter.",
  placeholderDate: "samedi 18 octobre",
  placeholderHeure: "14 h 30",
  placeholderAdresse: "12 rue des Lilas, Tours",
  placeholderContact: "06 12 34 56 78",

  resumeFormat: "Format retenu : {format} ({tranche}).",
  resumeEquipes: {
    une: "Un seul groupe, mené par vous.",
    plusieurs: "{nombre} équipes, reconnaissables à leur symbole.",
  },
  resumeEtapes: "{etapes} étapes d'environ {minutes} minutes.",
  compteurCachettes: "{cochees} cochées — il en faut au moins {minimum}.",
  compteurCachettesOk: "{cochees} cochées — c'est bon, il en faut {minimum}.",
  toutCocher: "Tout cocher",
  toutDecocher: "Tout décocher",

  titreResultat: "Votre aperçu est prêt",
  texteResultat:
    "Quatre pages représentatives de votre kit, avec le filigrane « aperçu ». Les solutions et le code final n'y figurent pas.",
  ouvrir: "Ouvrir l'aperçu",
  telecharger: "Télécharger le PDF",
  refaire: "Composer un autre jeu",
  graineLibelle: "Référence de votre jeu",
  graineAide:
    "Gardez-la : avec les mêmes réponses, elle redonne exactement ce jeu-là, énigme pour énigme.",
  erreurReseau: "L'aperçu n'a pas pu être créé. Vérifiez votre connexion et réessayez.",
  titreErreurs: "Merci de corriger ce point :",
  titreErreursPluriel: "Merci de corriger ces points :",
} as const);
