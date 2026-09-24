# Mission Gâteau

Générateur de jeux d'anniversaire personnalisés à imprimer, pour les enfants
de 4 à 12 ans.

Un parent choisit un thème, l'âge fêté, le prénom de l'enfant, le nombre
d'enfants, la durée et les cachettes dont il dispose chez lui. Le site compose
aussitôt un kit complet : guide de l'organisateur, invitations, cartes-indices
à cacher, fiches d'énigmes, page du trésor, diplômes et page de solutions.

Le dépôt en est au **lot 4**. Les lots 1 à 3 ont livré le moteur de jeu, le
kit PDF, le formulaire et l'aperçu gratuit filigrané, puis les correctifs de
deux audits. Le lot 4 ajoute la vente du jeu complet à 12,90 € par Stripe, sa
livraison et les pages légales ; la vente reste fermée tant qu'il lui manque
quelque chose (voir « La vente »). Les pages de contenu viendront plus tard. Le
site reste volontairement invisible des moteurs de recherche : `robots.txt`
interdit tout, et chaque page porte une balise `noindex, nofollow`.

## Démarrer

```bash
npm ci
npm run assets   # une seule fois : télécharge les polices et les icônes
npm run dev
```

Le site tourne alors sur <http://localhost:3000>. Sans `STRIPE_SECRET_KEY`,
tout marche sauf la vente et la livraison ; pour les essayer en local, mettre
une clé **de test** dans `.env.local` (jamais suivi par git).

| Commande            | Effet                                                        |
| ------------------- | ------------------------------------------------------------ |
| `npm run dev`       | Serveur de développement                                      |
| `npm run build`     | Build de production                                           |
| `npm test`          | Tests `vitest`                                                |
| `npm run typecheck` | Vérification des types                                        |
| `npm run lint`      | ESLint                                                        |
| `npm run assets`    | Télécharge polices et icônes dans `public/` (idempotent)      |
| `npm run samples`   | Régénère les exemples de `samples/`                           |
| `npm run verifier:tracage` | Après un build : vérifie que les fonctions PDF embarquent polices et icônes |

`npm run assets` n'écrit que ce qui manque ; `npm run assets -- --force`
retélécharge tout. `npm run samples` redonne à l'identique les fichiers JSON et
le texte de chaque page ; les PDF, eux, changent d'octets à chaque passage, car
@react-pdf/renderer y inscrit la date de création et un identifiant de fichier.

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
  vendeur.ts      la fiche du vendeur : le seul fichier à changer avec le vendeur
  legal.ts        mentions légales, CGV et politique de confidentialité
  vente.ts        bloc d'achat, page de commande, textes envoyés à Stripe
src/vente/      la vente : ouverture, Stripe, chiffrement, livraison, effacement
src/pdf/        les documents imprimés (@react-pdf/renderer)
src/app/        les pages du site et ses routes
tests/          vitest (dont un faux Stripe : tests/fauxStripe.ts)
samples/        neuf kits, neuf aperçus et leur structure en JSON
vercel.json     la tâche quotidienne d'effacement
```

### Le moteur est déterministe

Une graine est tirée au moment de l'aperçu et renvoyée au navigateur dans
l'en-tête `X-Graine`. La même configuration et la même graine redonnent
exactement le même kit, énigme pour énigme : c'est ce qui permettra, au lot 4,
de livrer le jeu que le parent a vu en aperçu. `VERSION_KIT` marque la version
du format d'un kit ; elle change dès que sa structure évolue.

### Les énigmes sont vérifiées, pas supposées

Chaque énigme sort d'un générateur alimenté par la graine, puis repasse par un
contrôle **indépendant** qui ne lit que ce qui est imprimé sur la carte : la
grille, la légende, les indices. Les labyrinthes sont résolus par un parcours
en largeur, l'unicité de leur chemin est prouvée en comptant les passages ;
les sudokus et les grilles de logique sont résolus par énumération et leur
unicité est démontrée ; les mots mêlés sont relus case par case.

`src/engine/validation.ts` vérifie ensuite le jeu entier : le parcours forme
une chaîne sans impasse, chaque cachette ne sert qu'à une étape, le code final
correspond bien aux réponses trouvées, et deux équipes ne reçoivent jamais la
même énigme à une même étape. Dès qu'il y a plusieurs équipes, le code se
répartit entre elles et aucune ne le détient en entier ; de 3 à 6 enfants, le
jeu se joue à une seule équipe, qui rassemble alors tous les chiffres.

### Les textes changent avec le nombre d'équipes

De 3 à 6 enfants, la mission et l'escape game se jouent à une seule équipe. Les
textes qui parlent d'équipes existent donc en deux versions — `uneEquipe` et
`plusieursEquipes` — et `selonEquipes` choisit la bonne au moment de composer
le kit. Un texte qui ne dépend pas du nombre d'équipes reste une simple chaîne.
`tests/equipes.test.ts` relit le PDF produit et refuse, à une seule équipe, la
moindre mention d'une autre équipe.

## Ajouter un thème

1. Copier `src/contenu/themes/pirates.ts` sous un nouveau nom et réécrire
   les textes : phrases d'ambiance, personnages et objets de la grille de
   logique, puis pour chacun des trois formats l'histoire, le briefing, les
   messages de réussite, le trésor, le diplôme et l'invitation.
   Les champs `histoire`, `briefing` et `tresor` acceptent soit une chaîne,
   soit un couple `{ uneEquipe, plusieursEquipes }`.
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

## La vente

### Le parcours d'achat

1. Le parent compose son aperçu gratuit sur `/creer`. Une fois l'aperçu
   produit — et seulement alors —, le bloc d'achat apparaît dessous : contenu
   du kit, format, prix, livraison, pays de résidence, puis deux cases
   distinctes, non cochées, toutes deux obligatoires (acceptation des CGV ;
   accès immédiat et renonciation au droit de rétractation, article L221-28,
   13° du Code de la consommation), et le bouton « Commander et payer 12,90 € ».
   Le bloc achète exactement la configuration et la graine de cet aperçu ;
   changer une réponse oblige à refaire un aperçu.
2. `POST /api/commande` revérifie tout (configuration, graine, pays, accords),
   compose le kit et le contrôle, puis crée une session Stripe Checkout et
   renvoie son adresse. Le navigateur part sur la page de paiement hébergée par
   Stripe, en français, par carte (Apple Pay et Google Pay compris).
3. Juste avant de partir, l'onglet garde le formulaire et l'aperçu dans son
   `sessionStorage`, et nulle part ailleurs : si le parent annule, il retrouve
   son jeu sur `/creer` et peut acheter sans rien ressaisir (les deux cases
   repartent décochées : les accords se donnent à chaque commande).
4. Après le paiement, Stripe renvoie sur `/commande/<ref>?session_id=…`. La page
   vérifie la commande chez Stripe, côté serveur, et ne génère rien ; le bouton
   « Télécharger mon jeu (PDF) » appelle `POST /api/commande/<ref>/kit`, qui
   refait la vérification, déchiffre la configuration, construit le kit avec
   la graine, le passe par `verifierKit` et renvoie le PDF. Stripe envoie de son
   côté la facture et le reçu par e-mail, avec le même lien, valable 30 jours.

`<ref>` est une référence de 128 bits tirée au hasard. Hors d'une commande
payée, aucune route ne sert le kit complet ; une commande impayée, introuvable,
expirée, remboursée en totalité, d'une autre version du kit ou illisible reçoit
un message clair, et rien d'autre.

### Ce que Stripe garde

Dans les métadonnées du paiement : la référence, `VERSION_KIT`, la graine, le
pays déclaré, la version des CGV acceptée, l'heure des deux accords (heure du
serveur), et la configuration complète **chiffrée** (AES-256-GCM, clé dérivée
de `STRIPE_SECRET_KEY` par HKDF-SHA256 avec une étiquette propre à cet usage),
découpée en morceaux de 500 caractères. Aucune donnée saisie par le parent —
prénoms, date, heure, adresse, contact — ne part en clair : le produit est
décrit par son thème et sa tranche d'âge.

Stripe recopie ces métadonnées, une fois pour toutes, sur chaque débit
(Charge) créé par le paiement, tentatives refusées comprises : la configuration
chiffrée existe donc en plusieurs exemplaires. Chaque nuit, la tâche
`GET /api/effacement` (cron Vercel déclaré dans `vercel.json`, une fois par
jour, compatible avec l'offre Hobby) efface la configuration chiffrée des
paiements **et** des débits de plus de 30 jours (comptés à partir du débit
réussi pour un paiement). Le reste de la commande — montant, date, e-mail,
facture, référence, accords — reste chez Stripe. La tâche ne touche rien de
plus récent, peut tourner plusieurs fois sans dégât, ne journalise que des
compteurs, et n'importe qui peut l'appeler : elle ne fait rien d'autre.

### Quand la vente est-elle ouverte ?

Seulement si deux conditions sont réunies (`src/vente/ouverture.ts`) :

- `STRIPE_SECRET_KEY` est présente et de la bonne nature : une clé **réelle**
  (`sk_live_…` ou `rk_live_…`) en production (`VERCEL_ENV=production`), une clé
  **de test** (`sk_test_…` ou `rk_test_…`) partout ailleurs — préversions et
  local. Une clé de test en production, ou une clé réelle hors production,
  ferme la vente ;
- la fiche du vendeur est complète, convention avec le médiateur comprise.

Vente fermée : aucun prix affiché, aucun bouton d'achat, `POST /api/commande`
répond 503, et `/creer` annonce après l'aperçu que la vente ouvre bientôt. La
livraison des commandes déjà payées, elle, n'a besoin que d'une clé. Toutes les
pages sont rendues à la demande : la clé n'est lue qu'à l'exécution, jamais au
build, et le build, les tests et la CI passent sans elle.

`STRIPE_SECRET_KEY` est la seule variable d'environnement du site ; elle se
pose dans Vercel (Production : clé réelle ; Preview : clé de test), jamais dans
un fichier suivi par git. Les adresses de retour de Stripe et le lien de
téléchargement visent le déploiement qui crée la commande : en production,
`VERCEL_PROJECT_PRODUCTION_URL` (qui suivra le domaine quand il sera branché),
en préversion `VERCEL_URL`, en local `localhost`.

### La fiche du vendeur, et comment changer de vendeur

Tout ce qui concerne le vendeur vit dans `src/contenu/vendeur.ts` : identité,
SIRET, RCS et capital (facultatifs), adresse, téléphone, e-mail du service
client, mention de TVA, médiateur, hébergeur, prestataire de paiement. Les
pages légales, le pied de page, la facture Stripe et la condition d'ouverture
lisent ce seul fichier ; un champ vide n'est jamais affiché, et tant que
`conventionSignee` est faux, le médiateur n'est nommé nulle part.

Pour changer de vendeur (une société remplaçant la micro-entreprise) :
modifier ce fichier (dénomination, forme, capital, RCS, TVA…), relire les CGV
et la politique de confidentialité, changer `VERSION_CGV` dans
`src/contenu/legal.ts` si les CGV changent, puis remplacer `STRIPE_SECRET_KEY`
par la clé du nouveau compte Stripe. Attention : la configuration chiffrée
d'une commande ne se relit qu'avec la clé qui l'a chiffrée ; changer de clé
rend illisibles les commandes de moins de 30 jours. Mieux vaut changer de clé
quand aucune commande récente n'attend sa livraison.

### Réglages à faire à la main dans Stripe avant d'ouvrir

- Paramètres > E-mails aux clients : activer « Paiements réussis » (sans quoi
  la facture et le reçu ne partent pas), langue par défaut : français.
- Informations publiques : dénomination, adresse et e-mail du service client,
  et l'adresse de la politique de confidentialité (`/confidentialite`).
- Moyens de paiement : Apple Pay et Google Pay activés pour les cartes.

### Limites connues

- La recherche de Stripe met jusqu'à une minute à voir un paiement neuf : au
  retour immédiat du paiement, la page s'appuie sur la session ; depuis le lien
  de l'e-mail, sur la recherche. La recherche ignore la casse : la référence
  est donc revérifiée à l'identique.
- Une session abandonnée garde chez Stripe la configuration chiffrée qu'on lui
  a confiée ; l'API ne permet ni de la relire ni de l'effacer. Elle reste
  illisible sans la clé du site.
- La tâche d'effacement tourne une fois par jour, à une heure près (offre
  Hobby) : une configuration peut survivre jusqu'à un jour de plus que 30 jours
  (la livraison, elle, s'arrête à 30 jours pile).
- Pas de webhook : le site ne sait d'une commande que ce qu'il demande à Stripe
  au moment où la page ou le bouton sont appelés.
- Sans clé, une référence est « introuvable » : un déploiement sans clé n'a
  jamais pu vendre. Retirer la clé de la production après l'ouverture ferait
  donc lire « commande introuvable » à des clients qui ont payé (le service
  client reste indiqué) ; une panne de Stripe, elle, affiche « vérification
  momentanément impossible ».
- Le retour de Stripe se fait sur l'adresse du déploiement (production :
  `VERCEL_PROJECT_PRODUCTION_URL` ; préversion : `VERCEL_URL`). Un parent parti
  d'une autre adresse (alias de branche d'une préversion, autre alias
  `*.vercel.app`) ne retrouve pas son formulaire en cas d'annulation, et
  l'onglet d'origine garde sa sauvegarde jusqu'à sa fermeture.
- Aucune limite de débit : chaque visite de `/commande/<ref>`, chaque
  commande et chaque appel de `/api/effacement` interrogent Stripe, dont la
  recherche est limitée à 20 lectures par seconde. Une limite se règle, au
  besoin, dans le pare-feu de Vercel.
- Les champs libres (invités, date, heure, adresse, contact) refusent les
  accolades, qui casseraient les gabarits du kit. Un caractère absent des
  polices Nunito et Fredoka (émoji, écriture non latine) serait dessiné avec
  une police de secours dans le PDF.

## Données personnelles

L'aperçu ne conserve rien : rien n'est enregistré, rien n'est journalisé, rien
n'est transmis à un tiers. La route de l'aperçu reçoit les données en POST —
jamais dans l'adresse, pour que le prénom de l'enfant n'apparaisse dans aucun
journal de serveur —, valide ses entrées avec `zod` et borne la taille de la
requête à 8 ko.

L'achat conserve ce que dit la page `/confidentialite` : la configuration,
chiffrée, 30 jours chez Stripe, puis effacée ; l'e-mail, le nom, l'adresse de
facturation et la facture, chez Stripe, au titre des obligations comptables
(10 ans). Aucun journal, de Vercel ou du code, ne contient de prénom, de donnée
de la fête, d'e-mail ni de contenu chiffré : les routes de la vente ne
journalisent que des noms d'événements et des compteurs, et les tests le
vérifient.

Le site ne pose aucun cookie, n'emploie aucun traceur, et ne charge aucune
ressource depuis un autre domaine : polices et images sont servies par le site
lui-même, et le paiement se fait sur la page hébergée par Stripe. Seul le
`sessionStorage` de l'onglet sert, le temps du paiement.

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
