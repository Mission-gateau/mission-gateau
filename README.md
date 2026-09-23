# Mission Gâteau

Générateur de jeux d'anniversaire personnalisés à imprimer, pour les enfants
de 4 à 12 ans.

Un parent choisit un thème, l'âge fêté, le prénom de l'enfant, le nombre
d'enfants, la durée et les cachettes dont il dispose chez lui. Le site compose
aussitôt un kit complet : guide de l'organisateur, invitations, cartes-indices
à cacher, fiches d'énigmes, page du trésor, diplômes et page de solutions.

Ce dépôt correspond au **lot 1** : le moteur de jeu, le kit PDF, le formulaire
et l'aperçu gratuit filigrané. Le paiement, les mentions légales et les pages
de contenu viendront plus tard. Le site reste volontairement invisible des
moteurs de recherche : `robots.txt` interdit tout, et chaque page porte une
balise `noindex, nofollow`.

## Démarrer

```bash
npm ci
npm run assets   # une seule fois : télécharge les polices et les icônes
npm run dev
```

Le site tourne alors sur <http://localhost:3000>.

| Commande            | Effet                                                        |
| ------------------- | ------------------------------------------------------------ |
| `npm run dev`       | Serveur de développement                                      |
| `npm run build`     | Build de production                                           |
| `npm test`          | Tests `vitest`                                                |
| `npm run typecheck` | Vérification des types                                        |
| `npm run lint`      | ESLint                                                        |
| `npm run assets`    | Télécharge polices et icônes dans `public/` (idempotent)      |
| `npm run samples`   | Régénère les exemples de `samples/`                           |

`npm run assets` n'écrit que ce qui manque ; `npm run assets -- --force`
retélécharge tout.

## Comment c'est fait

```
src/engine/     le moteur : TypeScript pur, sans Next.js ni React
  alea.ts         générateur pseudo-aléatoire déterministe
  cachettes.ts    catalogue fermé des cachettes sûres
  configuration.ts validation zod et règles du jeu
  enigmes/        les générateurs d'énigmes
  verif/          les solveurs, indépendants des générateurs
  kit.ts          assemble le parcours, les équipes et le code final
  validation.ts   contrôle complet d'un kit avant impression
src/contenu/    tous les textes, séparés du code
src/pdf/        les documents imprimés (@react-pdf/renderer)
src/app/        les pages du site et la route de l'aperçu
tests/          vitest
samples/        neuf kits, neuf aperçus et leur structure en JSON
```

### Le moteur est déterministe

Une graine est tirée au moment de l'aperçu et renvoyée au navigateur dans
l'en-tête `X-Graine`. La même configuration et la même graine redonnent
exactement le même kit, énigme pour énigme : c'est ce qui permettra, au lot 2,
de livrer le jeu que le parent a vu en aperçu.

### Les énigmes sont vérifiées, pas supposées

Chaque énigme sort d'un générateur alimenté par la graine, puis repasse par un
contrôle **indépendant** qui ne lit que ce qui est imprimé sur la carte : la
grille, la légende, les indices. Les labyrinthes sont résolus par un parcours
en largeur, l'unicité de leur chemin est prouvée en comptant les passages ;
les sudokus et les grilles de logique sont résolus par énumération et leur
unicité est démontrée ; les mots mêlés sont relus case par case.

`src/engine/validation.ts` vérifie ensuite le jeu entier : le parcours forme
une chaîne sans impasse, chaque cachette ne sert qu'à une étape, le code final
correspond bien aux réponses trouvées, et aucune équipe ne détient le code
complet à elle seule.

## Ajouter un thème

1. Copier `src/contenu/themes/pirates.ts` sous un nouveau nom et réécrire
   les textes : phrases d'ambiance, personnages et objets de la grille de
   logique, puis pour chacun des trois formats l'histoire, le briefing, les
   messages de réussite, le trésor, le diplôme et l'invitation.
2. Déclarer le thème dans `src/contenu/themes/index.ts`.
3. Ajouter son identifiant à `THEMES` et à `schemaConfiguration` dans
   `src/engine/configuration.ts`.
4. Si le thème a besoin d'icônes nouvelles, les déclarer dans
   `src/engine/icones.ts` puis lancer `npm run assets`.

Aucun code d'énigme n'est à toucher : les générateurs sont communs, seuls les
textes et les icônes changent.

## Ajouter une cachette

Ajouter l'entrée dans `src/engine/cachettes.ts`, sa devinette pour les trois
formats dans `src/contenu/devinettes.ts`, son indice de dépannage dans
`src/contenu/indices.ts`, et son icône dans `src/engine/icones.ts`. Les tests
refusent toute cachette incomplète. Le mot-clé doit faire huit lettres au plus,
sans accent, pour tenir dans une grille de mots mêlés 8x8.

La cachette doit surtout être sûre, et ses textes doivent le rester :
`tests/cachettes.test.ts` relit le libellé, les trois devinettes, l'indice et
le nom de l'icône, et refuse tout mot qui contredirait la promesse faite au
parent — four, plaque, machine, prise, appareil électrique, fenêtre, balcon,
escalier, porte d'entrée, extérieur, salle de bains, médicament, produit
ménager. Aucune cachette n'oblige à grimper.

## Données personnelles

Rien n'est enregistré, rien n'est journalisé, rien n'est transmis à un tiers.
La route de l'aperçu reçoit les données en POST — jamais dans l'adresse, pour
que le prénom de l'enfant n'apparaisse dans aucun journal de serveur —, valide
ses entrées avec `zod` et borne la taille de la requête à 8 ko. Le site ne pose
aucun cookie, n'emploie aucun traceur, et ne charge aucune ressource depuis un
autre domaine : polices et images sont servies par le site lui-même.

## Licences

Le code est publié sous les conditions du dépôt. Les ressources reprises sont
listées sur la page `/credits` du site :

| Ressource                    | Usage                       | Licence                     |
| ---------------------------- | --------------------------- | --------------------------- |
| [Noto Emoji][noto]           | Toutes les icônes, en PNG   | Apache License 2.0          |
| [Nunito][nunito]             | Police du texte             | SIL Open Font License 1.1   |
| [Fredoka][fredoka]           | Police des titres           | SIL Open Font License 1.1   |

Licences acceptées pour tout ce qui est livré dans le site ou dans les PDF :
MIT, Apache 2.0, SIL Open Font License, CC0, et CC BY 4.0 avec crédit.
Refusées : CC BY-SA, toute clause non commerciale, et toute licence inconnue.

Les histoires, les devinettes et les consignes sont écrites pour Mission
Gâteau. Aucun personnage, nom ou univers protégé n'apparaît dans les jeux ; un
test le vérifie sur chaque kit produit.

[noto]: https://github.com/googlefonts/noto-emoji
[nunito]: https://fonts.google.com/specimen/Nunito
[fredoka]: https://fonts.google.com/specimen/Fredoka

## Limite connue

`@react-pdf/renderer` 4.9 écrit parfois un glyphe sans dire quel caractère il
représente : la table `ToUnicode` du fichier reçoit une destination vide. Le
glyphe est dessiné normalement — la page imprimée est juste — mais ce
caractère-là ne peut plus être ni copié depuis le PDF, ni lu par une synthèse
vocale. Cela touche au plus une lettre par document, presque toujours une
lettre isolée : une case d'une grille de mots mêlés, ou la première lettre du
filigrane « APERÇU ». Le premier document produit dans un processus n'est
jamais touché ; les suivants le sont souvent.

Ce n'est pas réparable depuis le code de l'application : la correspondance est
écrite par la bibliothèque à partir des glyphes que son moteur de composition
lui remet. Le défaut est donc surveillé plutôt que corrigé — `tests/lirePdf.ts`
relit chaque fichier produit et `tests/polices.test.ts` refuse qu'il dépasse un
glyphe par document. Si une version future de la bibliothèque le corrige, ce
contrôle passera à zéro tout seul.
