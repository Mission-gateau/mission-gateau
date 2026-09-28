# Mission Gâteau

Générateur de jeux d'anniversaire personnalisés à imprimer, pour les enfants
de 4 à 12 ans.

Un parent choisit un thème, l'âge fêté, le prénom de l'enfant, le nombre
d'enfants, la durée et les cachettes dont il dispose chez lui. Le site compose
aussitôt un kit complet : guide de l'organisateur, invitations, cartes-indices
à cacher, fiches d'énigmes, page du trésor, diplômes et page de solutions.

Le dépôt en est au **lot 7**. Les lots 1 à 3 ont livré le moteur de jeu, le
kit PDF, le formulaire et l'aperçu gratuit filigrané, puis les correctifs de
deux audits. Le lot 4 a ajouté la vente du jeu complet à 12,90 € par Stripe, sa
livraison et les pages légales. Le lot 5 a mis la vente en conformité avec le
droit de rétractation : confirmation de commande par e-mail avant tout
téléchargement, droit de rétractation jusqu'au premier téléchargement, et
fonction « Renoncer au contrat ici ». Le lot 6 corrige l'audit du lot 5 : la
fonction de rétractation n'écrit plus qu'à propos d'une commande payée
retrouvée chez Stripe, toutes les routes POST refusent ce qui ne vient pas
d'une page du site, un premier téléchargement et une rétractation simultanés
ne peuvent plus donner à la fois le PDF et le remboursement, et le médiateur
est cité partout, la convention étant signée. Le lot 7 corrige l'audit du
lot 6 : chaque e-mail de « Renoncer au contrat ici » est compté, par commande,
même quand Stripe échoue ; l'état des remboursements se lit sur les
remboursements eux-mêmes ; la boutique est vérifiée partout où une commande
est retrouvée ; une clé réelle ne fonctionne qu'en production ; et une liste
quotidienne des commandes à traiter part au vendeur. La vente reste fermée en
production tant qu'il lui manque quelque chose — aujourd'hui, une clé Stripe
réelle (voir « La vente »). Les pages de contenu viendront plus tard. Le site
reste volontairement invisible des moteurs de recherche : `robots.txt`
interdit tout, et chaque page porte une balise `noindex, nofollow`.

## Démarrer

```bash
npm ci
npm run assets   # une seule fois : télécharge les polices et les icônes
npm run dev
```

Le site tourne alors sur <http://localhost:3000>. Sans `STRIPE_SECRET_KEY` ni
`RESEND_API_KEY`, tout marche sauf la vente, la confirmation et la livraison ;
pour les essayer en local, mettre une clé Stripe **de test** et une clé Resend
dans `.env.local` (jamais suivi par git). Hors production, les e-mails ne
partent qu'aux adresses de test de Resend et à l'e-mail du vendeur (voir « Les
e-mails »).

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
  legal.ts        mentions légales et politique de confidentialité
  cgv/            les CGV, une version publiée par fichier, jamais modifiée
  formulaireRetractation.ts  le formulaire type, mot pour mot
  vente.ts        bloc d'achat, page de commande, textes envoyés à Stripe
  emails.ts       confirmation, accusé de réception, liste des commandes à traiter
  retractation.ts la page « Renoncer au contrat »
src/vente/      la vente : ouverture, Stripe, Resend, chiffrement, livraison,
                confirmation, rétractation, délai légal, tâche quotidienne
  garde.ts        le contrôle commun des routes POST (JSON, même origine)
  declaration.ts  les entrées de la rétractation, vérifiées ici et dans le navigateur
  course.ts       premier téléchargement contre rétractation : qui l'emporte
  remboursement.ts l'état réel d'un remboursement, lu sur les remboursements
  aTraiter.ts     la liste quotidienne des commandes à traiter, pour le vendeur
src/pdf/        les documents imprimés (@react-pdf/renderer)
src/app/        les pages du site et ses routes
tests/          vitest (un faux Stripe, tests/fauxStripe.ts, et un faux
                Resend, tests/fauxEmail.ts ; tests/course.test.ts force tous
                les ordres des appels de requêtes concurrentes, avec une
                panne injectée à chaque appel)
samples/        neuf kits, neuf aperçus et leur structure en JSON
vercel.json     les deux passages quotidiens de la tâche
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
   du kit, format, prix, livraison (« E-mail de confirmation, puis
   téléchargement immédiat sur la page de votre commande ; lien valable 30
   jours. »), le droit de rétractation en une ligne, le pays de résidence,
   puis deux cases distinctes, non cochées, toutes deux obligatoires :
   l'acceptation des CGV, et la demande de recevoir le jeu dès le paiement,
   avant la fin du délai de rétractation, avec la reconnaissance que ce droit
   se perd au début du premier téléchargement (article L221-28, 13° du Code
   de la consommation). Puis le bouton « Commander et payer 12,90 € ». Le bloc
   tient lieu de bon de commande : il nomme aussi le médiateur de la
   consommation et donne l'adresse de son site (article R616-1). Il achète
   exactement la configuration et la graine de cet aperçu.
2. `POST /api/commande` revérifie tout (configuration, graine, pays, accords),
   compose le kit et le contrôle — une erreur du moteur donne une réponse
   propre, en français, journalisée sans donnée —, puis crée une session
   Stripe Checkout et renvoie son adresse. Le navigateur part sur la page de
   paiement hébergée par Stripe, en français, par carte (Apple Pay et Google
   Pay compris). Près du bouton de paiement, Stripe rappelle que le droit de
   rétractation prendra fin au début du premier téléchargement.
3. Juste avant de partir, l'onglet garde le formulaire et l'aperçu dans son
   `sessionStorage`, et nulle part ailleurs : si le parent annule, il retrouve
   son jeu sur `/creer` et peut acheter sans rien ressaisir (les deux cases
   repartent décochées : les accords se donnent à chaque commande).
4. Après le paiement, Stripe renvoie sur `/commande/<ref>?session_id=…`. La page
   vérifie la commande chez Stripe, côté serveur, et ne génère rien. Tant que
   la confirmation n'est pas partie, elle appelle à son chargement
   `POST /api/commande/<ref>/confirmation`, qui envoie **la confirmation de
   commande par e-mail** (voir plus bas), puis la page se recharge.
5. La confirmation partie, la page dit à quelle adresse (masquée), rappelle
   que le téléchargement commence l'exécution et met fin au droit de
   rétractation, propose « Renoncer au contrat ici » (le lien transmet la
   référence et, au retour de Stripe, le `session_id`), puis le bouton
   « Télécharger mon jeu (PDF) ». Il appelle `POST /api/commande/<ref>/kit`, qui
   refait la vérification, déchiffre la configuration, construit le kit avec
   la graine, le passe par `verifierKit` et, au premier téléchargement,
   enregistre son heure **avant** de renvoyer le PDF, en décidant sur le
   paiement que Stripe renvoie en réponse à cette écriture (voir « Premier
   téléchargement et rétractation en même temps » ; si l'enregistrement
   échoue : 503, aucun PDF). La page dit ensuite « Premier téléchargement le …
   à … : votre droit de rétractation a pris fin à ce moment », et la validité
   du lien à la minute près (« jusqu'au 25 octobre 2026 à 0 h 05 (heure de
   Paris) »). Délai passé sans téléchargement : « Votre délai de rétractation a
   pris fin le … », sans le lien.
6. Stripe envoie de son côté la facture et le reçu ; plus rien ne s'appuie
   dessus.

`<ref>` est une référence de 128 bits tirée au hasard. Hors d'une commande
payée **et confirmée**, aucune route ne sert le kit complet ; une commande
impayée, introuvable, expirée, remboursée en totalité, rétractée, à examiner,
en litige, d'une autre version du kit ou illisible reçoit un message clair, et
rien d'autre.

Toutes les routes POST (`/api/apercu`, `/api/commande`,
`/api/commande/<ref>/confirmation`, `/api/commande/<ref>/kit`,
`/api/renoncer`) passent d'abord par le même contrôle, écrit une fois dans
`src/vente/garde.ts` : `Content-Type` égal à `application/json` (paramètres
ignorés), sinon 415 ; 403, en français, si `Sec-Fetch-Site` vaut
`cross-site`, si `Origin` vaut `null`, ou si l'hôte d'`Origin` n'est pas celui
de la requête (première valeur de `x-forwarded-host`, sinon `host`, sinon
l'adresse de la requête). Une page d'un autre site ne peut donc plus rien
faire envoyer par le navigateur de ses visiteurs.

### La confirmation de commande

Elle part à l'adresse que l'acheteur a saisie chez Stripe, trouvée par un seul
chemin, le même depuis la page et depuis la tâche quotidienne :
`customer_details.email` de la session Checkout retrouvée par le paiement
(`checkout.sessions.list({ payment_intent })`), à défaut `billing_details.email`
du dernier débit. Une nouvelle tentative envoie ainsi toujours exactement la
même requête à Resend. Elle contient, dans l'ordre : la
commande (référence, date et heure du paiement à Paris, le jeu par son thème
et sa tranche d'âge, 12,90 € et la mention de TVA, payé par carte) ; le lien
de la page de la commande et sa validité (date et heure de Paris) ; la
confirmation de l'accord donné
avant le paiement, mot pour mot, avec sa date et son heure ; le droit de
rétractation (jusqu'au premier téléchargement et au plus tard le dernier jour
du délai, par « Renoncer au contrat ici », par le formulaire type ou par toute
déclaration claire ; remboursement sous 14 jours) ; le formulaire type rempli
avec les coordonnées du vendeur ; le vendeur, le service client, la garantie
légale (avec l'article des CGV) et le médiateur (la convention est signée
depuis le 25 septembre 2026), avec la gratuité de la médiation, la
réclamation écrite préalable restée sans solution, le délai d'un an et les
deux voies de saisine ; enfin, en pièce jointe annoncée, **les CGV dans la
version acceptée**, prix compris, en PDF (`cgv-mission-gateau-<version>.pdf`).

**Un seul envoi par commande**, même quand la page, un second onglet et la
tâche quotidienne la demandent en même temps : la marque `confirmation` (heure
du serveur) et `confirmation_id` (identifiant chez Resend) sont lues sur le
paiement avant tout envoi, et l'envoi porte la clé d'idempotence
`confirmation-<ref>`, que Resend garde 24 heures. Le contenu de l'e-mail ne
dépend que de la commande : une nouvelle tentative envoie exactement la même
requête, et Resend rend le même identifiant sans renvoyer l'e-mail. Resend
répond 409 `concurrent_idempotent_requests` à une requête simultanée (la page
dit « confirmation en cours » et réessaie), et 409 `invalid_idempotent_request`
à une requête différente sous la même clé (erreur journalisée). Un envoi
refusé (domaine de l'expéditeur non vérifié, par exemple) est un échec comme
un autre : la page le dit, propose de réessayer plus tard ou d'écrire au
service client, et n'affiche aucun bouton de téléchargement. Un e-mail parti
dont la marque n'a pas pu être posée chez Stripe a son propre message
(« Votre confirmation de commande est partie, mais n'a pas pu être
enregistrée : rechargez cette page dans quelques minutes. ») : la tentative
suivante renvoie la même requête, que Resend ne renvoie pas, puis pose la
marque. Version des CGV introuvable : aucun envoi, « confirmation
impossible ».

**Le PDF des CGV est identique octet pour octet d'un rendu à l'autre** : sa date
de création est celle de sa version, et il emploie ses propres polices
(`Nunito CGV`, `Fredoka CGV`), amorcées dès leur chargement : un glyphe est
créé pour chaque caractère de la police, avec ce caractère. Sans cela, le
défaut décrit en fin de page (« Limite connue ») ferait dépendre les octets du
PDF de ce que le processus a rendu avant lui, et une nouvelle tentative
d'envoi deviendrait une requête différente pour Resend. Les kits, eux, ne
changent pas.

### Le droit de rétractation et « Renoncer au contrat ici »

Le délai est de 14 jours après le paiement (articles L221-18 et L221-19) :
le jour du paiement ne compte pas, les jours sont comptés à l'heure de Paris,
et un délai qui finirait un samedi, un dimanche ou un jour férié (les onze de
l'article L3133-1 du Code du travail, plus le Vendredi saint et le 26 décembre,
par prudence) passe au premier jour qui n'est rien de cela. Une déclaration
n'est tenue pour tardive qu'une fois ce dernier jour fini partout sur Terre
(UTC−12). Voir `src/vente/delai.ts`.

Le droit prend fin au début du premier téléchargement (article L221-28, 13°) :
l'acheteur l'a demandé et reconnu par la seconde case, et la confirmation lui
a été envoyée avant, puisque rien n'est livré sans elle.

Le lien « Renoncer au contrat ici » figure dans le pied de toutes les pages
(page 404 comprise), à côté des liens légaux, sur la page de la commande et
dans la confirmation. Il mène à `/renoncer`, toujours accessible : `?ref=`
préremplit la référence, et `?session_id=` (que donne le lien de la page de la
commande au retour de Stripe) permet de retrouver un paiement tout neuf.
Au-dessus du formulaire, la page dit qu'il faut la référence de la commande,
qu'elle figure dans l'e-mail de confirmation, et qu'à défaut on peut se
rétracter par e-mail ou par courrier. Puis : nom, prénom, référence (ou lien
de la commande), e-mail où recevoir l'accusé, un récapitulatif, et « Confirmer
la rétractation ». Les erreurs s'affichent sous chaque champ, annoncées aux
lecteurs d'écran (`role="alert"`), le focus allant au premier champ en
erreur ; à chaque changement d'étape, il va au titre de l'étape.

**Entrées strictes**, vérifiées de la même façon dans le navigateur et par
`POST /api/renoncer` (zod, `src/vente/declaration.ts`), qui borne aussi la
taille à 4 ko et refuse sans rien faire une déclaration dont le champ piège
est rempli :

- référence : exactement 22 caractères `A-Z a-z 0-9 _ -`, ou un texte qui
  contient `/commande/` suivi de 22 caractères de cet alphabet, puis de la fin,
  d'une barre ou d'un caractère hors de l'alphabet
  (`\/commande\/([A-Za-z0-9_-]{22})(?![A-Za-z0-9_-])`) : un lien collé est
  accepté même entouré de ponctuation (« (…/commande/<réf>) », « …<réf>. »,
  « <…<réf>> », « …<réf>, merci ») ; deux références différentes dans le même
  texte sont refusées ; seule la référence extraite est gardée, affichée et
  envoyée, jamais le texte saisi ;
- nom et prénom, après normalisation NFC : 1 à 60 caractères, lettres de
  toute écriture (`\p{L}`, `\p{M}`), espaces, apostrophes et traits d'union,
  avec au moins une lettre : ni chiffre, ni `@`, ni `:`, ni `/`, ni point, ni
  caractère de contrôle ou de mise en forme (dont ceux du sens de lecture), ni
  caractère ignorable par défaut (`\p{Default_Ignorable_Code_Point}` : U+034F,
  sélecteurs de variante, remplisseurs coréens…), ni plus de 3 signes
  combinants à la suite. Les accents en forme décomposée restent acceptés
  (« Nguyễn » décomposé devient une seule lettre après NFC), comme les lettres
  d'autres écritures qui imitent une ponctuation : rien n'y est cliquable. Le
  serveur borne la saisie à 240 caractères avant normalisation, et le
  formulaire ne tronque jamais un nom qu'il accepterait (`maxLength` de 240) ;
- e-mail : 254 caractères au plus ; `session_id` : facultatif, au format de
  Stripe.

**Rien n'est reçu sans commande retrouvée.** Une déclaration n'est traitée,
enregistrée s'il y a lieu et accusée par e-mail que si elle désigne un
paiement abouti de cette boutique (`boutique` = `mission-gateau`) retrouvé
chez Stripe : par la session quand le lien de la page de la commande la donne
(elle doit porter la même référence ; sinon elle est ignorée ; la session ne
porte pas `boutique`, c'est sur le paiement qu'elle est vérifiée), sinon par
la recherche sur la référence, qui exige aussi `boutique`. Sinon, rien n'est
enregistré ni envoyé, et la réponse le dit :

- aucune commande payée ne correspond (et toujours sans client Stripe, comme
  la production aujourd'hui) : 404, « Nous ne trouvons aucune commande payée
  sous cette référence : votre déclaration n'a pas été transmise et aucun
  accusé de réception ne partira. », puis où trouver la référence, réessayer
  si le paiement vient d'avoir lieu, ou se rétracter par e-mail ou par
  courrier (formulaire type en annexe des CGV, ou toute déclaration claire) ;
- Stripe ne répond pas, limite le débit, ou échoue avant que la déclaration
  soit enregistrée (voir plus bas) : 503, « Nous ne pouvons pas vérifier
  votre commande pour le moment… », avec un bouton qui ouvre la
  messagerie de la personne (`mailto:` vers l'e-mail du vendeur, objet et
  corps remplis avec nom, prénom, référence, e-mail, date et heure) : aucun
  e-mail ne part du site, et elle garde sa propre preuve d'envoi. Le même
  bouton est proposé quand la commande est introuvable.

Dans ces deux cas, le journal note `declaration_non_transmise`, sa cause
(`introuvable` ; `ecriture_impossible` : erreur 5xx de Stripe, ou toutes les
clés de la marque épuisées, sur l'écriture de `retractation` ; `stripe_limite`
: 429 ; `stripe_indisponible` : tout le reste), la référence extraite et
l'heure — jamais un nom ni une adresse. Personne ne peut donc plus faire écrire
le site à une adresse quelconque : il faut la référence d'une commande payée.

**Chaque e-mail de la route est compté, par commande.** Pour une commande, la
fonction n'envoie jamais que l'accusé de la déclaration qui enregistre la
rétractation (clé Resend `accuse-<ref>`) et, pour les autres déclarations, les
accusés n° 1 à 3 (clés `accuse-<ref>-1` à `-3`). Aucune autre clé n'existe
dans cette route ; aucun accusé ne part quand Stripe échoue avant
l'enregistrement.

**La commande retrouvée**, elle est jugée **sur le paiement lui-même**, jamais
sur l'état de la page de la commande :

- rétractation possible (ni rétractation, ni téléchargement, délai en cours) :
  `retractation` (l'heure de réception) et `retractation_empreinte` (les 16
  premiers caractères hexadécimaux du SHA-256 des champs normalisés : nom,
  prénom, référence, e-mail) sont écrites **dès que le paiement est retrouvé**,
  avant de chercher l'adresse de l'acheteur, et **une seule fois** : cette
  écriture porte la clé d'idempotence `marque-retractation-<ref>-<n>`, si bien
  qu'une autre déclaration arrivée au même instant, refusée par Stripe,
  n'écrase ni l'heure ni l'empreinte : elle relit le paiement et devient une
  autre déclaration (ou la même, si elle est identique). La décision se prend
  sur le paiement que Stripe renvoie (voir la section suivante). Si la
  rétractation l'emporte, le paiement est remboursé en totalité (clé
  d'idempotence `retractation-<ref>`, motif `requested_by_customer`), sauf si
  un remboursement est déjà demandé ou fait, ou si le paiement est contesté
  (le vendeur répond alors sous 7 jours). Cette déclaration reçoit son accusé
  par e-mail, sous la clé `accuse-<ref>` ; une fois parti, `retractation_accuse`
  retient son identifiant chez Resend ;
- l'écriture de `retractation` échoue : la route relit une fois le paiement.
  Si la marque de cette déclaration (son empreinte) y figure, l'écriture s'est
  appliquée et sa réponse s'est perdue : la déclaration est enregistrée, et
  la course se décide sur cette relecture, qui remplace la réponse perdue —
  sans `telechargement`, la rétractation l'emporte (une écriture de
  téléchargement arrivée après la sienne la verra) ; avec `telechargement`,
  la route suit `course` s'il existe ; sinon elle ne rembourse pas et n'écrit
  pas `course` : la commande reste « à examiner », et l'accusé annonce
  l'examen par le vendeur. L'accusé part sous `accuse-<ref>`, à l'heure
  enregistrée. Si la relecture montre une autre empreinte, ou `telechargement`
  sans `retractation`, c'est une autre déclaration (plafond ci-dessous). Si
  elle ne montre aucune des deux marques, ou si elle échoue, la déclaration
  n'est pas transmise (503) ;
- déclaration identique à celle qui a enregistré la rétractation (même
  empreinte, par exemple « Réessayer » ou « Renvoyer ») : tant que son accusé
  n'est pas parti, elle redemande l'envoi sous la même clé, à l'heure
  enregistrée ; une fois `retractation_accuse` écrit, **elle n'appelle plus
  jamais Resend** : la page affiche « Votre déclaration du … est déjà
  enregistrée » au-dessus du même accusé, à la même heure. Si Resend répond
  409 sur `accuse-<ref>` et que la relecture du paiement échoue (ou ne montre
  pas l'accusé enregistré) : « Votre déclaration est en cours de traitement :
  rechargez la page dans quelques instants. », et rien d'autre ne part ;
- toute autre déclaration (rétractation déjà enregistrée par une déclaration
  différente, commande déjà téléchargée, délai expiré) est nouvelle, avec sa
  propre heure : elle reçoit l'accusé n° n, n = `accuses` + 1, sous la clé
  `accuse-<ref>-<n>`, dans la limite de **trois par commande** ; au-delà, la
  page affiche l'accusé et dit qu'il n'est pas renvoyé par e-mail, avec
  l'adresse du vendeur. Parti, `accuses` = n est écrit sous la clé
  d'idempotence `accuses-<ref>-<n>`, au mieux : son échec, ou une réponse
  rejouée, ne déclenche aucun e-mail et ne change pas la réponse. Si Resend
  répond que la clé du n° n a déjà servi pour une autre requête (409
  `invalid_idempotent_request`), le n° n compte comme parti : `accuses` = n
  est écrit sous sa clé, puis le n° n + 1 est essayé, quelle que soit la
  réponse de Stripe — sauf une réponse qui prouve que Stripe n'a pas exécuté
  l'écriture ni pris sa clé (429, ou réseau coupé sans réponse) : la
  déclaration est alors « en cours de traitement », et rien d'autre ne part.
  La valeur n est ainsi toujours écrite, ou sa clé prise, avant que n + 1
  puisse l'être : une écriture en retard est rejouée sans effet, et le
  compteur ne recule jamais. Si Resend répond que la clé est en cours (409
  `concurrent_idempotent_requests`) : « en cours de traitement », rien
  d'autre ne part. Jamais un second remboursement. L'accusé d'une
  rétractation déjà enregistrée donne les deux heures ; celui d'une commande
  déjà téléchargée ne promet plus que le jeu reste disponible. Une
  déclaration reçue après la fin du délai, sans rétractation enregistrée,
  n'est jamais « arrivée en même temps » : le droit s'était éteint au premier
  téléchargement s'il avait commencé avant la fin du délai, sinon le délai
  était expiré.

Le remboursement se lit sur les remboursements eux-mêmes (`latest_charge.refunds`,
développé à chaque lecture), jamais sur le drapeau `refunded` du débit :
`succeeded` → effectué ; `pending` ou `requires_action` → demandé (au
lancement, Stripe met en attente un remboursement demandé juste après le
paiement : c'est un cas normal) ; aucun, `failed` ou `canceled` → à venir.
Les accusés et la page de la commande disent « remboursement demandé » ou
« effectué » selon le cas (`src/vente/remboursement.ts`).

L'accusé de réception reprend la déclaration (champs normalisés, référence
extraite), la date et l'heure de son envoi (heure de Paris), et la suite
donnée, avec une ligne « Statut ». Il part à l'adresse saisie, en copie cachée
à l'adresse de l'acheteur chez Stripe si elle diffère, et au vendeur. La
réponse de l'API ne dit pas si l'adresse saisie est celle de l'acheteur. La
page ne dit jamais qu'un accusé est parti quand il n'est pas parti. Un accusé
qui n'a pas pu partir laisse dans le journal `accuse_non_envoye` et la
référence extraite.

### Premier téléchargement et rétractation en même temps

Deux onglets suffisent pour qu'une déclaration et un premier téléchargement
soient traités au même instant. Comparer les heures ne suffit pas : l'heure de
réception d'une déclaration est prise à son arrivée, bien avant son écriture.
La règle, écrite une seule fois dans `src/vente/course.ts` et suivie par la
route du kit, la page de la commande, la fonction de rétractation, la tâche
quotidienne et les accusés :

- l'emporte la première des deux marques (`telechargement`, `retractation`)
  écrite chez Stripe ;
- chaque marque ne s'écrit qu'une fois : l'écriture porte la clé
  d'idempotence `marque-<marque>-<ref>-<n>`, et Stripe n'exécute que la
  première requête d'une clé (24 heures durant). Une seconde requête — un
  autre onglet, une autre déclaration — est refusée : elle relit le paiement
  au lieu d'écraser la marque, et décide sur ce qu'elle y lit. Si la clé a
  servi à une tentative restée sans effet (Stripe garde aussi les échecs), la
  clé suivante sert, dix au plus (`ESSAIS_DE_MARQUE`, `ecrireLaMarque`) ;
- chaque route décide sur le paiement que Stripe lui renvoie en réponse à sa
  propre écriture (la mise à jour d'un paiement rend l'objet à jour) : si la
  marque de l'autre y figure déjà, l'autre l'emporte ; sinon, elle l'emporte ;
- la route qui perd écrit `course` = le nom de la marque gagnante ; quand les
  deux marques existent, tout le reste lit `course`. Si cette écriture échoue,
  la commande est « à examiner » : ni livraison ni remboursement
  automatiques, le vendeur répond sous 7 jours ;
- seule exception : quand l'écriture de `retractation` échoue alors qu'elle
  s'est appliquée (réponse perdue), la fonction de rétractation décide sur une
  relecture du paiement, sans écrire `course` (voir plus haut).

Route du kit qui perd : 410, aucun PDF (409, « à examiner », pour celle qui
lit la commande entre les deux écritures). Rétractation qui perd — qu'elle ait
écrit sa marque après le premier téléchargement ou trouvé celui-ci déjà
écrit : aucun remboursement, et un accusé qui dit que le droit a pris fin au
début du premier téléchargement — sauf si la déclaration avait été reçue avant
le début de ce téléchargement : l'accusé dit alors que les deux sont arrivés
presque en même temps et que le vendeur répond sous 7 jours (la copie au
vendeur le signale). `tests/course.test.ts` rejoue deux ou trois requêtes à la
fois (un téléchargement et une déclaration ; deux onglets et une déclaration ;
un téléchargement et deux déclarations, différentes ou identiques ; deux
déclarations sur une commande téléchargée) sur un faux Stripe qui suit les
règles d'idempotence de Stripe, en forçant tous les ordres possibles de leurs
lectures et écritures, puis recommence avec une panne injectée à chaque appel
à Stripe (500 gardé sous sa clé, 500 appliqué, 429) et à Resend (échec
d'envoi, clé gardée ou non), l'ordonnanceur retenant aussi les envois : jamais
le PDF et le remboursement ensemble ; sans panne, jamais ni l'un ni l'autre ;
un remboursement au plus ; aucun accusé annoncé sans être parti ; un compteur
d'accusés qui ne fait que monter ; parmi les e-mails de la route, aucune clé
hors de `accuse-<ref>` et `accuse-<ref>-1` à `-3`, et quatre au plus ; « non
transmise » seulement si aucun e-mail de la route n'est parti.

### Une rétractation reçue par e-mail ou par courrier

Elle se traite à la main. Elle est valable si elle a été **envoyée** avant le
début du premier téléchargement et avant la fin du délai (14 jours après le
paiement, prorogés comme le calcule `src/vente/delai.ts`), même lue après :

1. retrouver la commande dans le tableau de bord de Stripe (recherche sur la
   métadonnée `ref`, ou par l'e-mail de l'acheteur) ;
2. comparer l'heure d'envoi à celle du premier téléchargement
   (`telechargement`) : pour un e-mail, son heure d'envoi ; pour un courrier,
   la date du cachet de la poste, à 0 h 00, heure de Paris — si le premier
   téléchargement a eu lieu ce jour-là, traiter la commande comme « à
   examiner » (ci-dessous) ;
3. écrire au paiement la métadonnée `retractation` avec la date **et
   l'heure** complètes, au format ISO avec le fuseau (par exemple
   `2026-10-02T09:15:00+02:00`, jamais une date seule, qui se lirait minuit
   UTC) : la livraison s'arrête aussitôt. Si `telechargement` existe, écrire
   aussi `course` = `retractation` ;
4. rembourser, ou laisser la tâche quotidienne le faire à son prochain
   passage ;
5. envoyer au client, par e-mail, un accusé de réception qui reprend sa
   déclaration et sa date d'envoi (article 8 des CGV), à l'adresse qu'il a
   indiquée ou, à défaut, à celle de la commande, puis écrire
   `retractation_accuse` = `manuel` : la commande quitte la liste quotidienne.

Une commande « à examiner » (les deux marques, sans `course`), ou un accusé
« arrivée en même temps que le premier téléchargement », se tranche aussi à
la main, en comparant l'heure de la déclaration (`retractation`, ou la ligne
« Envoyée le » de l'accusé) à celle du premier téléchargement
(`telechargement`) : **une déclaration reçue avant le début du premier
téléchargement prévaut**. Écrire alors `course` = `retractation` (et
`retractation`, à la date et à l'heure de la déclaration, s'il manque) : la
livraison s'arrête, et la tâche quotidienne rembourse (ou rembourser
soi-même). Sinon, écrire `course` = `telechargement` : la livraison reprend,
sans remboursement. Dans les deux cas, répondre au client sous 7 jours, puis
écrire `examinee` avec la date et l'heure de la réponse.

### La liste quotidienne des commandes à traiter

Les journaux de l'offre Hobby de Vercel ne sont gardés qu'une heure : c'est
**la liste quotidienne**, et non leur lecture, qui dit au vendeur ce qui
l'attend (`src/vente/aTraiter.ts`). À chaque passage de la tâche (phase
`a_traiter`, après les remboursements), elle relit les paiements de la
boutique des 45 derniers jours qui portent une rétractation ou une
contestation, et, s'il y a au moins une commande à traiter, l'envoie par
e-mail au vendeur (l'e-mail de la fiche), depuis
`commandes@missiongateau.com`, objet « Commandes à traiter — Mission
Gâteau ». La clé d'idempotence de Resend, `a-traiter-<AAAA-MM-JJ>-<empreinte>`
(jour de Paris ; 16 caractères hexadécimaux du SHA-256 du contenu), fait
qu'une liste inchangée ne repart pas, et qu'une liste modifiée au second
passage du jour repart : deux e-mails par jour au plus. Rien ne part quand la
liste est vide. Chaque commande y figure par sa référence, la date du
paiement et ses marques, à l'heure de Paris — jamais un nom ni une adresse.
Pour chaque rubrique :

- **à examiner** (les deux marques, sans `course`) : trancher comme dit
  ci-dessus, répondre au client sous 7 jours, écrire `examinee` ;
- **arrivées en même temps que le premier téléchargement** (`course` =
  `telechargement`, rétractation reçue avant le premier téléchargement) :
  leur accusé promet une réponse sous 7 jours ; examiner la commande de la
  même façon, répondre, puis écrire `examinee` (la commande quitte la
  rubrique) ;
- **rétractations dont l'accusé n'est pas parti** (`retractation` sans
  `retractation_accuse`) : envoyer l'accusé à l'adresse de la commande, puis
  écrire `retractation_accuse` = `manuel` ;
- **rétractations sans remboursement demandé** (la rétractation l'a
  emporté, et aucun remboursement `pending`, `requires_action` ni
  `succeeded` après la phase des remboursements) : vérifier le paiement dans
  Stripe et le rembourser, au plus tard 14 jours après la rétractation ;
- **remboursements en attente depuis plus de 5 jours** (après l'heure de la
  rétractation ; le délai légal est de 14 jours) : vérifier le remboursement
  dans Stripe (solde disponible, action demandée) ;
- **paiements contestés** : répondre à la contestation dans Stripe et au
  client, puis écrire `examinee` (la commande quitte la rubrique).

Les journaux restent un complément : `declaration_non_transmise` (référence
et heure d'une déclaration non transmise, avec sa cause), `accuse_non_envoye`
(référence d'une commande dont l'accusé n'est pas parti) et la ligne de
chaque phase de la tâche, à lire dans l'heure.

### Ce que Stripe garde

Dans les métadonnées du paiement : `boutique` (toujours `mission-gateau`), la
référence, `VERSION_KIT`, la graine, le pays déclaré, la version des CGV
acceptée, l'heure des deux accords (heure du serveur), la configuration
complète **chiffrée** (AES-256-GCM, clé dérivée de `STRIPE_SECRET_KEY` par
HKDF-SHA256 avec une étiquette propre à cet usage), découpée en morceaux de
500 caractères, puis, au fil de la commande : `confirmation` et
`confirmation_id`, `telechargement`, `retractation`, `retractation_empreinte`
et `retractation_accuse`, `course` (la marque qui l'a emporté quand
téléchargement et rétractation se sont croisés), `accuses` (le nombre des
accusés envoyés aux autres déclarations) et `examinee` (écrite à la main par
le vendeur : l'heure de sa réponse au client d'une commande qu'il a dû
examiner). C'est tout l'état d'une commande : le site n'a pas de base de
données. Ces neuf clés écrites après le paiement sont comptées dès la création
de la commande, avec `boutique`, dans les 50 clés permises par Stripe
(`depassementsDeMetadonnees`). Les remboursements, eux, se lisent sur les
remboursements du paiement (`latest_charge.refunds`, développé à chaque
lecture). Aucune
donnée saisie par le parent — prénoms, date, heure, adresse, contact — ne
part en clair : le produit est décrit par son thème et sa tranche d'âge, qui
figurent en clair sur la ligne de commande et la facture.

Stripe recopie ces métadonnées, une fois pour toutes, sur chaque débit
(Charge) créé par le paiement, tentatives refusées comprises : la configuration
chiffrée existe donc en plusieurs exemplaires, que la tâche quotidienne efface
tous après 30 jours. La recherche de Stripe peut rendre des métadonnées
périmées : chaque décision (confirmer, livrer, se rétracter) relit le paiement
par son identifiant.

### Les e-mails

Prestataire : Resend, par son SDK officiel (`resend`), derrière la petite
interface de `src/vente/envoi.ts` (faux client dans les tests). Expéditeur
« Mission Gâteau <commandes@missiongateau.com> », réponses vers l'e-mail de la
fiche du vendeur (une messagerie Gmail, hébergée par Google), copie cachée de
chaque confirmation et de chaque accusé de réception à ce même e-mail (preuve
de l'envoi). Une version texte et une
version HTML simple, rendues du même contenu ; aucune image ni ressource
distante ; aucune donnée du jeu. **Le domaine `missiongateau.com` doit être
vérifié dans Resend** : sans cela, Resend refuse l'expéditeur, la confirmation
ne part pas, et rien n'est livré.

La tâche quotidienne envoie aussi au vendeur la liste des commandes à traiter
(voir plus haut). Hors production, les e-mails ne partent qu'aux adresses de
test de Resend (`…@resend.dev`) et à l'e-mail du vendeur ; toute autre adresse
est remplacée par `delivered@resend.dev`, et la page le dit.

### La tâche quotidienne

`GET /api/effacement`, déclarée deux fois dans `vercel.json`, vers 3 h et 15 h
UTC : sur l'offre Hobby, chaque tâche ne s'exécute qu'une fois par jour, à
l'heure près (jusqu'à 59 minutes de retard), et une même route peut porter
deux tâches. Elle n'agit que si la requête porte
`Authorization: Bearer <CRON_SECRET>`, que Vercel envoie de lui-même ; sinon, ou
sans la variable, 401 et rien d'autre. Sans client Stripe (la production
aujourd'hui), elle écrit `{"tache":"quotidienne","sansCle":1}` et répond 200.
Sinon, en quatre phases :

1. `effacement` : la configuration chiffrée des paiements **et** des débits de
   plus de 30 jours (comptés à partir du débit réussi), comme avant ;
2. `confirmations` : la confirmation des commandes payées depuis plus d'une
   heure qui n'en ont pas, sauf celles rétractées, remboursées (remboursement
   fait ou demandé qui couvre le montant), en litige ou à examiner, sans
   jamais en envoyer deux ;
3. `remboursements` : le remboursement des rétractations qui ont emporté la
   course (voir plus haut), relues à jour, hors litige, **seulement s'il
   n'existe aucun remboursement `pending`, `requires_action` ni
   `succeeded`** ; un remboursement `failed` ou `canceled` est retenté, une
   fois par jour (clé `retractation-<ref>-<jour>` ; Stripe ne rembourse jamais
   au-delà du montant payé). Une rétractation battue par le premier
   téléchargement, ou une commande à examiner, n'est jamais remboursée ici ;
4. `a_traiter` : la liste des commandes à traiter, envoyée au vendeur s'il y
   en a au moins une (voir plus haut). Un 409 de Resend (liste déjà envoyée,
   ou envoi en cours) est compté, ce n'est pas une erreur.

Les phases 2 à 4 ne voient que les paiements de cette boutique : la recherche
exige `boutique` = `mission-gateau`, et chaque paiement rendu est revérifié ;
un paiement d'un autre produit du même compte Stripe n'est jamais touché.
Elle examine les paiements aboutis des 45 derniers jours, au plus 2 000 par
passage. Chaque phase écrit sa ligne de journal dès qu'elle finit, même en
échec (`{"tache":"quotidienne","phase":"effacement",…}`, puis `confirmations`,
`remboursements`, `a_traiter`, cette dernière avec un compteur par rubrique
et l'issue de l'envoi) : un dépassement de durée ne fait pas perdre les
compteurs des phases déjà faites. La réponse ne dit que `{ "ok": true }` ou
`{ "ok": false }`.

### Quand la vente est-elle ouverte ?

Seulement si tout ce qu'il faut pour vendre, confirmer et livrer est réuni
(`src/vente/ouverture.ts`) :

- en production (`VERCEL_ENV=production`) : une clé Stripe **réelle**
  (`sk_live_…` ou `rk_live_…`), la fiche du vendeur complète, convention avec
  le médiateur comprise, et `RESEND_API_KEY`. La fiche est complète depuis la
  signature de la convention (25 septembre 2026) : seule manque aujourd'hui la
  clé réelle, et la vente reste fermée ;
- partout ailleurs (préversions, local) : une clé Stripe **de test**
  (`sk_test_…` ou `rk_test_…`), la fiche complète (elle l'est désormais,
  convention comprise), et `RESEND_API_KEY`.

**En production, sans clé réelle, aucun client Stripe n'est créé**
(`stripePermis`, `src/vente/dependances.ts`) : ni la livraison, ni la
confirmation, ni la rétractation, ni la tâche quotidienne ne peuvent toucher un
paiement de test. **Hors production, seule une clé de test crée un client** :
une clé réelle posée par erreur pour tous les environnements ne peut ni
livrer un exemplaire d'essai contre un vrai paiement (ce qui éteindrait son
droit de rétractation), ni rembourser, ni envoyer de confirmation. Le kit livré porte sur chaque page, bien visible,
« Exemplaire d'essai — sans valeur commerciale » (même mécanisme que le
filigrane de l'aperçu) hors production, et aussi en production si la clé
n'est pas réelle ; une vente réelle le livre sans elle.

Vente fermée : aucun prix affiché, aucun bouton d'achat, `POST /api/commande`
répond 503, et `/creer` annonce après l'aperçu que la vente ouvre bientôt. La
livraison des commandes déjà payées et confirmées n'a besoin que d'un client
Stripe. Toutes les pages sont rendues à la demande : les variables ne sont
lues qu'à l'exécution, jamais au build, et le build, les tests et la CI
passent sans aucune d'elles.

Les variables du site, à poser dans Vercel et jamais dans un fichier suivi par
git :

| Variable            | Production                 | Preview        |
| ------------------- | -------------------------- | -------------- |
| `STRIPE_SECRET_KEY` | clé réelle                 | clé de test    |
| `RESEND_API_KEY`    | clé Resend                 | clé Resend     |
| `CRON_SECRET`       | secret de la tâche         | —              |

Aucune autre variable n'est lue. Les adresses de retour de Stripe et les liens
des e-mails visent le déploiement qui crée la commande : en production,
`VERCEL_PROJECT_PRODUCTION_URL` (le domaine de production que choisit Vercel :
depuis que le domaine est branché, l'un de ceux de `missiongateau.com`,
l'adresse nue redirigeant vers `www.missiongateau.com`), en préversion
`VERCEL_URL`, en local `localhost`.

### Les CGV, version par version

Chaque version publiée vit dans `src/contenu/cgv/<identifiant>.ts` et n'est
plus jamais modifiée : une commande garde l'identifiant de la version
acceptée, et sa confirmation joint le PDF de celle-là. `/cgv` affiche la
dernière de `VERSIONS_CGV`. Pour changer les CGV : copier le dernier fichier
sous un nouvel identifiant (la date de publication), l'écrire, l'ajouter à la
fin de `VERSIONS_CGV`, puis ajouter son empreinte dans `tests/cgv.test.ts`, qui
refuse toute retouche d'une version publiée (texte et fichier). Les versions
du 24, du 25 et du 27 septembre 2026 restent disponibles pour les commandes
passées sous elles ; la version en vigueur est celle du 28 septembre 2026, qui
dit à l'article 8 ce que fait la page quand elle ne peut pas vérifier la
commande ou enregistrer la déclaration, et qu'une déclaration renvoyée à
l'identique réaffiche son accusé sans nouvel e-mail. Rendues avec
la fiche réelle, toutes citent désormais le médiateur, comme leur code le
prévoit depuis le départ.

### La fiche du vendeur, et comment changer de vendeur

Tout ce qui concerne le vendeur vit dans `src/contenu/vendeur.ts` : identité,
SIRET, RCS et capital (facultatifs), adresse, téléphone, e-mail du service
client, mention de TVA, médiateur, hébergeur, prestataire de paiement. Les
pages légales, le pied de page, les e-mails, la facture Stripe et la condition
d'ouverture lisent ce seul fichier ; un champ vide n'est jamais affiché, et
tant que `conventionSignee` est faux, le médiateur n'est nommé nulle part.

La convention avec le médiateur (Société Médiation Professionnelle) est
signée depuis le 25 septembre 2026 : `conventionSignee` vaut `true`, et le
médiateur est cité partout où la fiche le prévoit — mentions légales, CGV (de
toutes les versions), e-mail de confirmation, pied de la facture Stripe, et
une ligne du bloc d'achat, qui tient lieu de bon de commande (article R616-1 :
nom du médiateur et adresse de son site). Les clients y lisent que la
médiation est gratuite pour eux, qu'elle suppose une réclamation écrite
préalable au vendeur restée sans solution, et une saisine du médiateur dans
l'année qui suit cette réclamation (article L612-2), en ligne sur sa page de
demande de médiation (`mediateur.demande`) ou par courrier à son adresse.
**Quand une réclamation n'a pas pu être réglée, le vendeur communique au
client les coordonnées du médiateur** (article L616-1), par écrit, avec la
réponse qui clôt la réclamation.

Pour changer de vendeur (une société remplaçant la micro-entreprise) :
modifier ce fichier (dénomination, forme, capital, RCS, TVA…), relire la
politique de confidentialité, publier une nouvelle version des CGV, puis
remplacer `STRIPE_SECRET_KEY` par la clé du nouveau compte Stripe. Attention :
la configuration chiffrée d'une commande ne se relit qu'avec la clé qui l'a
chiffrée ; changer de clé rend illisibles les commandes de moins de 30 jours.
Mieux vaut changer de clé quand aucune commande récente n'attend sa livraison.

### Réglages à faire à la main avant d'ouvrir

- Resend : vérifier le domaine `missiongateau.com` (enregistrements DNS
  demandés par Resend), sans quoi aucune confirmation ne part.
- Stripe, Paramètres > E-mails aux clients : « Paiements réussis » peut rester
  activé (facture et reçu), langue par défaut : français ; le site ne s'appuie
  plus dessus.
- Stripe, Informations publiques : dénomination, adresse et e-mail du service
  client, et l'adresse de la politique de confidentialité (`/confidentialite`).
- Stripe, Moyens de paiement : Apple Pay et Google Pay activés pour les cartes.
- Vercel, offre : l'offre Hobby est réservée à un usage personnel non
  commercial, et « toute méthode pour demander ou traiter un paiement des
  visiteurs du site » en est un (règles d'usage de Vercel,
  https://vercel.com/docs/limits/fair-use-guidelines) : passer à l'offre Pro
  avant d'ouvrir la vente. Elle apporte aussi l'accord de traitement des
  données de Vercel (qui ne s'applique qu'aux offres Pro et Enterprise) et un
  jour de journaux au lieu d'une heure. Décision et dépense du vendeur.
- Vercel, pare-feu : une règle de limitation de débit sur les routes
  `/commande/*` et `POST /api/*`, **à poser avant l'ouverture de la vente**,
  hors de ce dépôt (voir « Choix et limites » : les lectures de Stripe).
- Resend : le quota gratuit (100 destinataires par jour) peut ne pas suffire
  (voir « Choix et limites ») ; une offre payante est à décider par le
  vendeur.

### Choix et limites

- **Le plafond des e-mails de la rétractation, par commande** : l'accusé de
  la déclaration qui enregistre la rétractation (`accuse-<ref>`), puis 3
  accusés aux autres déclarations (`accuse-<ref>-1` à `-3`) ; rien d'autre, et
  rien quand Stripe échoue avant l'enregistrement. Qui connaît la référence
  d'une commande payée (l'acheteur, ou quelqu'un à qui il l'a donnée) peut
  donc faire partir au plus ces quatre accusés vers des adresses de son choix,
  au contenu fixe, sans lien ni texte libre. Ce plafond tient tant que Resend
  se souvient de ses clés (24 heures). Ensuite, un numéro dont le compteur
  `accuses` n'a pas pu être écrit (réponse de Stripe perdue) peut resservir
  une fois, et une déclaration identique dont `retractation_accuse` n'a pas
  pu être écrit renverrait un vrai second exemplaire de son accusé. La
  documentation de Resend ne dit pas si une requête en échec garde sa clé :
  si c'est le cas, un numéro peut être compté sans qu'aucun e-mail soit
  parti (l'accusé suivant prend alors le numéro d'après). Ces cas sont
  acceptés ; les tests les jouent tous les deux.
- **Le compteur `accuses` ne recule jamais.** Chaque valeur n s'écrit sous sa
  propre clé d'idempotence (`accuses-<ref>-<n>`), et n + 1 ne s'écrit qu'une
  fois n écrit ou sa clé prise : une écriture en retard est rejouée sans
  effet. Pour cela, quand Resend dit qu'un numéro a déjà servi et que Stripe
  répond 429 (ou que le réseau coupe) à l'écriture de ce numéro — preuve que
  Stripe ne l'a pas exécutée et n'a pas pris sa clé —, la déclaration est
  « en cours de traitement » au lieu de passer au numéro suivant :
  l'exploration des ordres a montré qu'autrement le compteur pouvait
  reculer.
- **Stripe n'offre pas d'écriture conditionnelle** : la règle « première
  écriture gagnante » repose sur ses clés d'idempotence. Une marque
  (`telechargement`, `retractation`) ne s'écrit qu'une fois ; une requête
  concurrente est refusée et relit le paiement. Deux déclarations différentes
  reçues au même instant : une seule enregistre la rétractation (son heure et
  son empreinte), l'autre reçoit l'accusé d'une rétractation déjà
  enregistrée ; un seul remboursement.
- **Les hypothèses du protocole de la course**, que le faux Stripe des tests
  (qui applique chaque mise à jour d'un bloc) ne peut pas éprouver et que
  l'audit vérifiera en mode test contre le vrai Stripe : la réponse de Stripe
  à une mise à jour d'un paiement contient les écritures concurrentes déjà
  appliquées ; et, quand la réponse à l'écriture de `retractation` est perdue,
  une relecture par identifiant montre toutes les écritures déjà appliquées.
- **Dix clés par marque** (`ESSAIS_DE_MARQUE`). Stripe garde une clé
  d'idempotence 24 heures, échecs compris : il faudrait dix réponses 500
  gardées sur une même commande pour bloquer l'écriture d'une marque pendant
  24 heures. Clés épuisées, une déclaration reçoit la réponse de panne (503,
  cause `ecriture_impossible`, bouton d'e-mail) et le premier téléchargement
  répond 503 ; aucune livraison ni aucun remboursement à tort.
- **Une déclaration dite « non transmise » peut avoir été enregistrée** :
  l'écriture de `retractation` a pu s'appliquer alors que sa réponse s'est
  perdue et que la relecture a échoué. La livraison est alors bloquée ; si
  aucun premier téléchargement n'avait été écrit avant, la tâche rembourse,
  sinon la commande est « à examiner » ; aucun accusé n'est parti. Une
  déclaration identique (« Réessayer ») reçoit l'accusé ; sinon la liste
  quotidienne montre la commande au vendeur (rubrique des accusés non
  partis), qui écrit au client à l'adresse de la commande.
- **Une déclaration « arrivée en même temps » qui n'a pas pu écrire sa
  marque** (elle a trouvé le premier téléchargement déjà écrit, alors
  qu'elle avait été reçue avant son début) ne laisse aucune trace chez
  Stripe : le vendeur ne la connaît que par la copie cachée de son accusé,
  pas par la liste quotidienne.
- **Le quota gratuit de Resend** : 100 destinataires par jour — chaque
  destinataire compte, copies cachées comprises (les e-mails reçus aussi) —,
  remis à zéro à minuit UTC (la page des erreurs de Resend parle, elle, de
  24 heures), et 3 000 par mois. Une commande payée puis rétractée compte au
  pire 14 destinataires : la confirmation (l'acheteur et le vendeur : 2),
  puis les quatre accusés de la route (l'adresse saisie, l'acheteur en copie
  cachée si elle diffère, le vendeur : 3 chacun, 12). **Huit commandes payées
  puis rétractées le même jour suffisent donc à l'épuiser** (sept en
  consomment 98) ; au-delà, plus aucune confirmation ne part ce jour-là, et
  rien n'est livré. La réponse serait une offre payante de Resend, à décider
  par le vendeur.
- **Les lectures de Stripe** : la recherche est limitée à 20 lectures par
  seconde, et un compte dispose d'une allocation de lectures de 500 par
  transaction en moyenne sur 30 jours glissants, avec un minimum de 10 000 par
  mois (https://docs.stripe.com/rate-limits ; la documentation ne dit pas ce
  qui arrive au-delà). Chaque visite d'une page de commande et chaque
  déclaration en coûtent une à trois (une seule recherche pour une référence
  inventée) : un afflux de requêtes peut épuiser l'allocation d'un mois de
  lancement, quand les transactions sont encore rares. La règle de limitation
  de débit du pare-feu de Vercel (par adresse IP ; l'offre Hobby en permet
  une, en fenêtre fixe de 10 secondes à 10 minutes) est donc **à poser avant
  l'ouverture de la vente**, hors de ce dépôt. Elle ne protège pas à elle
  seule le quota de Resend ; ce qui le protège : aucun e-mail sans commande
  payée retrouvée, le plafond par commande, des noms sans lien ni adresse, et
  le refus des requêtes d'un autre site.
- **Les journaux d'exécution de l'offre Hobby de Vercel ne sont gardés
  qu'une heure** : la liste quotidienne des commandes à traiter les remplace
  pour la surveillance ; ils restent un complément, à lire dans l'heure (ou à
  exporter par un drain de journaux, payant).
- Une course téléchargement / rétractation dont la route perdante n'a pas pu
  écrire `course` reste « à examiner » : c'est au vendeur de trancher, en
  écrivant `course` (`telechargement` ou `retractation`) dans le tableau de
  bord de Stripe, et de rembourser s'il le faut ; la liste quotidienne la lui
  rappelle.
- Hors production, toutes les adresses sauf celles de test et celle du vendeur
  sont remplacées : l'abus y est limité à `…@resend.dev` et au vendeur.
- Une requête du kit qui lit la commande pendant les quelques millisecondes où
  les deux marques existent sans `course` répond 409 (« à examiner ») : un
  rechargement de la page suffit, la course étant écrite aussitôt après.
- Un litige se lit sur `disputed` du dernier débit. La documentation de Stripe
  ne dit pas si ce drapeau repasse à faux une fois le litige clos : par
  prudence, tant qu'il est vrai, la commande reste bloquée. Aucun déblocage à
  la main n'existe dans le code : si un litige se termine en faveur du
  vendeur, le client est servi à la main.
- Le lien des e-mails suit l'adresse du déploiement : si le domaine de
  production change entre deux tentatives d'une même confirmation (moins de
  24 heures), la seconde est une requête différente pour Resend, journalisée ;
  la page propose alors d'écrire au service client.
- La tâche quotidienne passe deux fois par jour, à l'heure près : une
  configuration peut survivre jusqu'à un demi-jour de plus que 30 jours (la
  livraison, elle, s'arrête à 30 jours pile).
- Pas de webhook : le site ne sait d'une commande que ce qu'il demande à Stripe
  au moment où une page, un bouton ou la tâche l'interrogent.
- Sans clé Stripe (ou en production sans clé réelle), une référence est
  « introuvable » : un tel déploiement n'a jamais pu vendre. Retirer la clé de
  la production après l'ouverture ferait donc lire « commande introuvable » à
  des clients qui ont payé, et « aucune commande payée » à leurs déclarations
  (le service client et l'e-mail de secours restent indiqués) ; une panne de
  Stripe, elle, affiche « vérification momentanément impossible ».
- Le retour de Stripe se fait sur l'adresse du déploiement (production :
  `VERCEL_PROJECT_PRODUCTION_URL` ; préversion : `VERCEL_URL`). Un parent parti
  d'une autre adresse (alias de branche d'une préversion, autre alias
  `*.vercel.app`) ne retrouve pas son formulaire en cas d'annulation.
- Les champs libres (invités, date, heure, adresse, contact) refusent les
  accolades, qui casseraient les gabarits du kit. Un caractère absent des
  polices Nunito et Fredoka (émoji, écriture non latine) serait dessiné avec
  une police de secours dans le PDF.

## Données personnelles

L'aperçu ne conserve rien : ses réponses ne sont ni enregistrées, ni
journalisées, ni transmises à un tiers (le journal de l'hébergeur ne note que
la requête elle-même : méthode, adresse, heure, code de réponse, navigateur). La route de l'aperçu reçoit les données en POST —
jamais dans l'adresse, pour que le prénom de l'enfant n'apparaisse dans aucun
journal de serveur —, valide ses entrées avec `zod` et borne la taille de la
requête à 8 ko.

L'achat conserve ce que dit la page `/confidentialite` : la configuration,
chiffrée, 30 jours chez Stripe, puis effacée ; la trace de la commande et les
heures de son suivi, chez Stripe, aussi longtemps que la facture (10 ans) ;
l'e-mail, le nom, l'adresse de facturation et la facture, chez Stripe, au
titre des obligations comptables (10 ans) ; les e-mails de confirmation et
d'accusé de réception chez Resend (30 jours, selon Resend), et leur copie dans
la messagerie du vendeur, hébergée par Google (Gmail, 5 ans). Une déclaration
de rétractation n'est gardée que dans son accusé de réception et sa copie ;
s'y ajoutent chez Stripe l'heure de la rétractation, l'empreinte de la
déclaration qui l'a enregistrée et le nombre d'accusés envoyés. Une
déclaration non transmise n'est gardée nulle part, sinon sa référence et son
heure dans le journal (une heure chez Vercel). Aucun journal, de Vercel ou du
code, ne contient de prénom, de donnée de la fête, d'e-mail, de nom ni de
contenu chiffré : les routes de la vente ne journalisent que des noms
d'événements, des compteurs et, quand le vendeur peut avoir à agir, la
référence d'une commande ; les tests le vérifient.

Le site ne pose aucun cookie, n'emploie aucun traceur, et ne charge aucune
ressource depuis un autre domaine : polices et images sont servies par le site
lui-même, et le paiement se fait sur la page hébergée par Stripe. Seul le
`sessionStorage` de l'onglet sert, le temps du paiement. Les e-mails ne
contiennent ni image ni ressource distante.

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

La cause est connue : fontkit garde en cache chaque glyphe d'une police, et
un glyphe créé d'abord comme composant d'une lettre accentuée (le « A » de
« À »), au moment d'incorporer la police dans un document, y reste sans
caractère ; un document produit ensuite dans le même processus l'écrit sans
correspondance. Le PDF des CGV joint à la confirmation de commande y échappe
(polices réservées, amorcées caractère par caractère : voir « La confirmation
de commande »). Les kits et les aperçus restent tels quels : amorcer aussi
leurs polices changerait leurs fichiers, et le jeu ne change pas dans ce lot.
Le défaut y est donc surveillé plutôt que corrigé — `tests/lirePdf.ts` relit
chaque fichier produit et `tests/polices.test.ts` refuse qu'il dépasse un
glyphe par document. Si une version future de la bibliothèque le corrige, ce
contrôle passera à zéro tout seul.
