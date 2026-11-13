# Mission Gâteau

Générateur de jeux d'anniversaire personnalisés à imprimer, pour les enfants
de 4 à 12 ans.

Un parent choisit un thème, l'âge fêté, le prénom de l'enfant, le nombre
d'enfants, la durée et les cachettes dont il dispose chez lui. Le site compose
aussitôt un kit complet : guide de l'organisateur, invitations, cartes-indices
à cacher, fiches d'énigmes, page du trésor, diplômes et page de solutions.

Le dépôt en est au **lot 9**. Les lots 1 à 3 ont livré le moteur de jeu, le
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
quotidienne des commandes à traiter part au vendeur. Le lot 8 corrige l'audit
du lot 7 (une déclaration dont l'accusé ne part pas n'est plus jamais laissée
sans recours, remboursements partiels, contestations, effacement limité à la
boutique, liste incomplète, heures illisibles), puis ouvre le site à Google :
cinq guides, plan du site, masquage levé en production pour les pages
publiques, mesure des visites (Vercel Web Analytics, sans cookie) et adresse
`contact@missiongateau.com`. Le lot 9 corrige l'audit du lot 8 : la fonction
de rétractation tient compte des heures illisibles comme le reste du site,
une date qui n'existe pas (`2026-02-30T09:15:00Z`) est illisible, et
« Réessayer » est grisé dès l'affichage d'une réponse qui demande d'attendre.
La vente reste fermée en production tant qu'il
lui manque quelque chose — aujourd'hui, une clé Stripe réelle (voir « La
vente »).

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
  guides/         les cinq guides, leurs exemples (moteur, graine fixe), la page /guides
  referencement.ts titres, descriptions et date de modification des pages publiques
src/site/       ce que voient les moteurs : noindex, robots.txt, plan du site, métadonnées
src/proxy.ts    l'en-tête X-Robots-Tag de chaque requête, selon l'environnement
src/vente/      la vente : ouverture, Stripe, Resend, chiffrement, livraison,
                confirmation, rétractation, délai légal, tâche quotidienne
  garde.ts        le contrôle commun des routes POST (JSON, même origine)
  declaration.ts  les entrées de la rétractation, vérifiées ici et dans le navigateur
  course.ts       premier téléchargement contre rétractation : qui l'emporte
  examen.ts       une heure illisible rend la commande « à examiner » : la règle, écrite une fois
  remboursement.ts l'état réel d'un remboursement, lu sur les remboursements
  aTraiter.ts     la liste quotidienne des commandes à traiter, pour le vendeur
src/pdf/        les documents imprimés (@react-pdf/renderer)
src/app/        les pages du site et ses routes (robots.txt et sitemap.xml compris)
src/composants/ les composants React ; mesure.ts et MesureDAudience.tsx : Web Analytics
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
  votre commande pour le moment… Si vous avez déjà reçu un accusé de
  réception pour cette déclaration, il reste valable. » (une déclaration déjà
  enregistrée et accusée, renvoyée pendant une panne de lecture), avec un
  bouton qui ouvre la messagerie de la personne (`mailto:` vers l'e-mail du
  vendeur, objet et corps remplis avec nom, prénom, référence, e-mail, date et
  heure) : aucun e-mail ne part du site, et elle garde sa propre preuve
  d'envoi. Le même bouton est proposé quand la commande est introuvable.
  Après une réponse de cause `ecriture_impossible`, « Réessayer » reste grisé
  60 secondes, compte à rebours affiché (`attente` dans la réponse), dès le
  premier rendu de cette réponse — même quand la précédente, à la même heure
  affichée, ne demandait aucune attente (le bouton est monté à neuf pour
  chaque réponse) : dix
  tentatives pendant une même panne épuiseraient sinon les dix clés de la
  marque pour 24 heures, pendant que le kit reste livrable.

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

- une heure illisible (voir « Heures écrites à la main ») sur le paiement
  retrouvé, à la lecture initiale comme à toute relecture qui décide (la
  réponse à l'écriture de `retractation`, la relecture qui suit son refus ou
  son échec) : la commande est « à examiner ». Rien n'est écrit — ni
  `retractation`, ni son empreinte, ni `course` —, rien n'est remboursé, et la
  marque du vendeur reste intacte. La déclaration est traitée comme une autre
  déclaration : l'accusé n° n, qui annonce l'examen par le vendeur (réponse
  sous 7 jours), sous `accuse-<ref>-<n>`, dans le plafond ci-dessous, puis
  l'accusé affiché sans envoi avec le bouton d'e-mail. Le journal note
  `heure_illisible` et la référence ;

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
- l'écriture de `retractation` échoue (y compris un 409 : une autre requête
  écrit la marque au même instant) : la route relit une fois le paiement.
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
  enregistrée » au-dessus de l'accusé parti, à la même heure —
  `retractation_accuse` garde l'identifiant de l'accusé et la suite qu'il
  annonçait (`<id>|retractee|demande`, par exemple), si bien que la page le
  réaffiche à l'identique même si le remboursement ou la course ont changé
  depuis ; un accusé envoyé à la main (`manuel`) est rappelé sans être
  réaffiché. Si Resend répond
  409 sur `accuse-<ref>` et que la relecture du paiement ne montre pas
  l'accusé enregistré (ou échoue) : 409 `concurrent_idempotent_requests` (même
  clé en cours) → « Votre déclaration est en cours de traitement : rechargez
  la page dans quelques instants. », avec le bouton d'e-mail ; 409
  `invalid_idempotent_request` (le contenu de l'accusé a changé depuis un
  envoi en échec, ou l'accusé est parti sans que `retractation_accuse`
  s'écrive) → l'accusé recalculé, état « incertain » (« Cet accusé vous a
  peut-être déjà été envoyé ; sinon, écrivez au vendeur à <e-mail du vendeur>
  en reprenant ce texte. »), jamais « échec », avec le bouton d'e-mail. Rien
  d'autre ne part ;
- toute autre déclaration (rétractation déjà enregistrée par une déclaration
  différente, commande déjà téléchargée, délai expiré) est nouvelle, avec sa
  propre heure : elle reçoit l'accusé n° n, n = `accuses` + 1, sous la clé
  `accuse-<ref>-<n>`, dans la limite de **trois par commande** ; au-delà, la
  page affiche l'accusé et dit qu'il n'est pas renvoyé par e-mail (« trois
  accusés ont déjà été envoyés ou tentés pour cette commande » : un numéro
  peut être compté sans e-mail quand Resend garde la clé d'un échec), avec
  l'adresse du vendeur et le bouton d'e-mail. Parti, `accuses` = n est écrit sous la clé
  d'idempotence `accuses-<ref>-<n>`, au mieux : son échec, ou une réponse
  rejouée, ne déclenche aucun e-mail et ne change pas la réponse. Si Resend
  répond que la clé du n° n a déjà servi pour une autre requête (409
  `invalid_idempotent_request`), le n° n compte comme parti : `accuses` = n
  est écrit sous sa clé, puis le n° n + 1 est essayé — seulement si Stripe a
  sûrement pris la clé de cette écriture (succès, réponse rejouée, ou réponse
  500, que Stripe garde sous la clé). Toute autre réponse (429, 409 d'une
  requête de même clé encore en cours, autre erreur 5xx, réseau coupé) ne le
  garantit pas : la page affiche alors l'accusé sans envoi (comme au
  plafond), avec le bouton d'e-mail et un texte neutre (« L'accusé de
  réception n'a pas pu être envoyé par e-mail… »), et rien d'autre ne part. La valeur n est ainsi toujours écrite, ou sa clé prise,
  avant que n + 1 puisse l'être : une écriture en retard est rejouée sans
  effet, et le compteur ne recule pas. Si Resend répond que la clé est en cours (409
  `concurrent_idempotent_requests`) : « en cours de traitement », avec le
  bouton d'e-mail, rien d'autre ne part. Jamais un second remboursement. L'accusé d'une
  rétractation déjà enregistrée donne les deux heures ; celui d'une commande
  déjà téléchargée ne promet plus que le jeu reste disponible. Une
  déclaration reçue après la fin du délai, sans rétractation enregistrée,
  n'est jamais « arrivée en même temps » : le droit s'était éteint au premier
  téléchargement s'il avait commencé avant la fin du délai, sinon le délai
  était expiré.

Le remboursement se lit sur les remboursements eux-mêmes (`latest_charge.refunds`,
développé à chaque lecture), jamais sur le drapeau `refunded` du débit, et
sur la couverture du montant payé : effectué quand les remboursements
`succeeded` le couvrent ; demandé quand `succeeded` + `pending` +
`requires_action` le couvrent sans que `succeeded` seul le couvre (au
lancement, Stripe met en attente un remboursement demandé juste après le
paiement : c'est un cas normal) ; sinon à venir (aucun, `failed`,
`canceled`, ou un remboursement partiel). Une rétractation qui l'emporte sur
un paiement remboursé en partie (5,00 € depuis le tableau de bord, par
exemple) rembourse le reste ; l'accusé et la page donnent le montant payé et
ne disent « effectué » qu'une fois tout le montant remboursé.
Les accusés et la page de la commande disent « remboursement demandé » ou
« effectué » selon le cas (`src/vente/remboursement.ts`). Un paiement
remboursé hors rétractation (depuis le tableau de bord de Stripe), dont les
remboursements faits ou demandés couvrent le montant, n'est plus livré ni
confirmé ; la page dit « Remboursement demandé » ou « Commande remboursée ».

L'accusé de réception reprend la déclaration (champs normalisés, référence
extraite), la date et l'heure de son envoi (heure de Paris), et la suite
donnée, avec une ligne « Statut ». Il part à l'adresse saisie, en copie cachée
à l'adresse de l'acheteur chez Stripe si elle diffère, et au vendeur. La
réponse de l'API ne dit pas si l'adresse saisie est celle de l'acheteur. La
page ne dit jamais qu'un accusé est parti quand il n'est pas parti. Un accusé
qui n'a pas pu partir laisse dans le journal `accuse_non_envoye` et la
référence extraite.

**Un accusé qui ne part pas ne laisse jamais la page sans recours.** Quel que
soit le cas (échec de Resend, plafond, 409 de Resend, compteur non écrit), la
réponse porte l'accusé, l'état de l'envoi (`echec`, `plafond`, `non_envoye`,
`incertain`) et le bouton d'e-mail (`mailto`), à l'heure de réception
d'origine de cette déclaration (l'heure enregistrée pour la déclaration qui
enregistre la rétractation), sans aucun e-mail au-delà du plafond. Une
déclaration « arrivée en même temps » (suite `simultanee` : reçue avant le
début du premier téléchargement, mais lue après son écriture), que rien ne
garde chez Stripe, reçoit en plus `droitAPreserver` : la page lui dit de
l'envoyer dès maintenant par e-mail au vendeur pour préserver son droit, et
ne propose ni « Réessayer » ni « Renvoyer », qui la referaient à une heure
nouvelle (« droit éteint »).

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
à Stripe (500 gardé sous sa clé, 500 appliqué, 429, coupure du réseau) et à
Resend (échec d'envoi, clé gardée ou non), l'ordonnanceur retenant aussi les
envois : jamais
le PDF et le remboursement ensemble ; sans panne, jamais ni l'un ni l'autre ;
un remboursement au plus ; aucun accusé annoncé sans être parti ; un compteur
d'accusés qui ne fait que monter ; parmi les e-mails de la route, aucune clé
hors de `accuse-<ref>` et `accuse-<ref>-1` à `-3`, et quatre au plus ; une
requête qui répond « non transmise » n'a envoyé aucun e-mail (deux onglets
d'une même déclaration restent deux requêtes : l'un peut répondre « non
transmise » pendant que l'autre envoie l'accusé) ; un accusé réaffiché est
toujours un e-mail réellement parti ; toute réponse sans e-mail parti porte le
bouton d'e-mail (`mailto`).

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
   l'heure** complètes, au format ISO 8601 avec le fuseau (par exemple
   `2026-10-02T09:15:00+02:00`) : la livraison s'arrête aussitôt. Jamais une
   date seule, qui se lirait minuit UTC, ni une date à la française :
   JavaScript lit « 02/10/2026 09:15 » comme le 10 février, à l'heure du
   serveur (voir « Heures écrites à la main »). Si `telechargement` existe,
   écrire aussi `course` = `retractation` ;
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

### Heures écrites à la main

`retractation`, `telechargement` et `examinee` peuvent être écrites à la main
dans le tableau de bord de Stripe. Une telle heure n'est **lisible** que si :

- elle suit l'ISO 8601 complet, avec le fuseau : `2026-10-02T09:15:00+02:00`,
  `2026-10-02T09:15+02:00` ou `2026-10-02T07:15:00Z` (secondes et
  fractions facultatives) ;
- et sa date et son heure existent : relue dans le fuseau écrit, la date
  obtenue redonne exactement l'année, le mois, le jour, l'heure et les
  minutes écrits (et les secondes, quand elles le sont). JavaScript lit
  `2026-02-30T09:15:00Z` comme le 2 mars et `T24:00` comme minuit le
  lendemain : ces heures, comme `2026-02-29` (2026 n'est pas bissextile),
  `2026-13-01` ou `T24:30`, sont illisibles. Une heure écrite par le code
  (`toISOString()`) est toujours lisible.

Une heure présente mais illisible **ne compte jamais comme absente**. Une
seule règle, écrite dans `src/vente/examen.ts` et suivie par la page de la
commande, la route du kit, la tâche quotidienne et la fonction de
rétractation : tant qu'il en reste une, la commande est « à examiner » — le
kit n'est pas livré, la confirmation n'est pas envoyée par la tâche, aucun
remboursement automatique n'est fait, la fonction de rétractation n'écrit ni
`retractation` ni `course` et répond par l'accusé qui annonce l'examen par le
vendeur, et la liste quotidienne la signale (rubrique « heures
illisibles »). Récrite au bon format, l'heure redevient lisible et la règle
ordinaire reprend.

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
passage du jour repart : deux e-mails par jour au plus, ce qui ne tient que
par la planification (deux passages par jour) ; Vercel prévient qu'un
déclenchement peut exceptionnellement être livré plus d'une fois (« Cron
delivery can also occasionally invoke the same scheduled run more than
once », https://vercel.com/docs/cron-jobs/manage-cron-jobs, mise à jour le
11 août 2026) : la clé de Resend évite alors une seconde liste identique, mais
une liste changée entre deux livraisons repartirait. Rien ne part quand la
liste est vide et complète. Si la recherche des paiements ou la relecture
d'une commande a échoué, la liste part quand même, avec en tête une ligne fixe
« Liste incomplète : la recherche ou la relecture de <n> commande(s) a
échoué ; elle sera refaite au prochain passage. » (ou « la recherche des
commandes a échoué » quand c'est la recherche), sans donnée personnelle et
comprise dans l'empreinte. Chaque commande y figure par sa référence, la date du
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
  `retractation_accuse`) : chercher d'abord, dans la messagerie du vendeur,
  la copie cachée de l'accusé (il a pu partir sans que son identifiant soit
  enregistré) ; sinon, envoyer l'accusé à l'adresse de la commande. Puis
  écrire `retractation_accuse` = `manuel` ;
- **rétractations dont le montant payé n'est pas entièrement remboursé** (la
  rétractation l'a emporté, et les remboursements faits ou demandés ne
  couvrent pas le montant après la phase des remboursements ; jamais un
  paiement contesté, que Stripe ne laisse rembourser que par la procédure de
  contestation : « Vous ne pouvez pas effectuer de remboursement en dehors de
  la procédure de litige tant que le litige est ouvert »,
  https://docs.stripe.com/disputes/how-disputes-work ; la rubrique des
  contestations le couvre) : vérifier le paiement dans Stripe et rembourser
  ce qui reste, au plus tard 14 jours après la rétractation ;
- **remboursements en attente depuis plus de 5 jours** (après l'heure de la
  rétractation ; le délai légal est de 14 jours) : vérifier le remboursement
  dans Stripe (solde disponible, action demandée) ;
- **paiements contestés** : répondre à la contestation dans Stripe et au
  client, puis écrire `examinee` (la commande quitte la rubrique). Une
  contestation peut arriver jusqu'à 120 jours après le paiement (« dans les
  120 jours suivant le paiement initial », en général, selon
  https://docs.stripe.com/disputes/how-disputes-work) ; la liste ne voit que
  les paiements des 45 derniers jours : au-delà, c'est l'e-mail de Stripe au
  vendeur qui prévient ;
- **heures illisibles** (`retractation`, `telechargement` ou `examinee`
  présente mais hors ISO 8601 complet, ou à une date qui n'existe pas) :
  récrire la métadonnée au format `2026-10-02T09:15:00+02:00`, puis
  répondre sous 7 jours au client qui aurait reçu l'accusé « examen par le
  vendeur ».

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
fiche du vendeur, `contact@missiongateau.com`, copie cachée de chaque
confirmation et de chaque accusé de réception à ce même e-mail (preuve de
l'envoi). Les messages adressés à `contact@` et à `commandes@` passent par
ImprovMX (ImprovMX Incorporated, Dover, Delaware, États-Unis), qui les fait
suivre vers deux messageries Gmail personnelles du vendeur ; ce qu'ImprovMX en
garde, tel qu'il le déclare, est dans `/confidentialite` : jamais le contenu,
un journal d'envoi (expéditeur, destinataire, objet, date) gardé 7 jours, une
file d'attente purgée dès la remise sans durée maximale précisée, des serveurs
dans l'Union européenne et aux États-Unis
(https://improvmx.com/transparency/what-do-we-log et
https://improvmx.com/transparency/privacy-policy, sans date, consultées le 11
octobre 2026). Une version texte et une
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
   plus de 30 jours (comptés à partir du débit réussi) de cette boutique : la
   recherche exige `metadata["boutique"]:"mission-gateau"`, et chaque
   paiement et débit est revérifié avant d'écrire (compteur `autresProduits`)
   — un paiement d'un autre produit du même compte, même porteur de
   `config=chiffree`, n'est jamais touché. Les paiements de test du lot 4,
   s'il en reste sans `boutique`, ne sont plus effacés : aucune commande
   réelle n'existe ;
2. `confirmations` : la confirmation des commandes payées depuis plus d'une
   heure qui n'en ont pas, sauf celles rétractées, remboursées (remboursement
   fait ou demandé qui couvre le montant), en litige ou à examiner (une
   heure illisible comprise), sans jamais en envoyer deux ;
3. `remboursements` : le remboursement des rétractations qui ont emporté la
   course (voir plus haut), relues à jour, hors litige, **seulement si les
   remboursements `pending`, `requires_action` et `succeeded` ne couvrent pas
   le montant payé** (Stripe rembourse alors le reste) ; un remboursement
   `failed` ou `canceled` est retenté, une fois par jour (clé
   `retractation-<ref>-<jour>` ; Stripe ne rembourse jamais au-delà du
   montant payé). Une rétractation battue par le premier téléchargement, une
   commande à examiner ou une heure illisible n'est jamais remboursée ici.
   Si la recherche des paiements a échoué, la ligne de journal compte une
   erreur ;
4. `a_traiter` : la liste des commandes à traiter, envoyée au vendeur s'il y
   en a au moins une (voir plus haut). Un 409 de Resend (liste déjà envoyée,
   ou envoi en cours) est compté, ce n'est pas une erreur.

Les quatre phases ne voient que les paiements de cette boutique : la recherche
exige `boutique` = `mission-gateau`, et chaque paiement rendu est revérifié ;
un paiement d'un autre produit du même compte Stripe n'est jamais touché.
Elle examine les paiements aboutis des 45 derniers jours, au plus 2 000 par
passage. Chaque phase écrit sa ligne de journal dès qu'elle finit, même en
échec (`{"tache":"quotidienne","phase":"effacement",…}`, puis `confirmations`,
`remboursements`, `a_traiter`, cette dernière avec un compteur par rubrique
et l'issue de l'envoi : `listeAcceptee`, liste acceptée par Resend — envoyée,
ou déjà envoyée sous la même clé, sans second e-mail, Resend ne distinguant
pas les deux ; `listeEnConflit`, 409) : un dépassement de durée ne fait pas perdre les
compteurs des phases déjà faites. La réponse ne dit que `{ "ok": true }` ou
`{ "ok": false }`.

### Le site visible de Google

Depuis le lot 8, la production montre ses pages publiques aux moteurs :
l'accueil, `/creer`, `/guides` et chaque guide, `/mentions-legales`, `/cgv`,
`/confidentialite` et `/credits` (`src/site/referencement.ts`). Tout le reste
porte `noindex, nofollow`, en en-tête `X-Robots-Tag` (posé par
`src/proxy.ts`, le « proxy » de Next 16, qui remplace le middleware) et en
balise : `/commande/*`, `/renoncer`, `/api/*`, la page 404, et **tout** hors
production (préversions, local), quel que soit le chemin. L'environnement
(`VERCEL_ENV`) est lu à chaque requête, jamais au build.

- `robots.txt` (`src/app/robots.txt/route.ts`) : en production, tout sauf
  `/api/`, `/commande/` et `/renoncer`, et
  `Sitemap: https://www.missiongateau.com/sitemap.xml` ; ailleurs,
  `Disallow: /`.
- `/sitemap.xml` : les pages publiques, en adresses absolues
  `https://www.missiongateau.com`, avec la date de la dernière modification
  de leur contenu, écrite avec lui (`src/contenu/referencement.ts`, et
  `modifieLe` de chaque guide) — jamais la date du build : **à mettre à jour
  quand on change le texte d'une page**. Hors production : 404.
- Chaque page publique a son titre, sa description, une adresse canonique
  absolue en `www`, des balises Open Graph (l'image est l'icône du gâteau,
  servie par notre domaine) ; la langue est `fr`.
- `/favicon.ico` sert l'icône du gâteau existante (`src/app/favicon.ico`, un
  ICO qui contient tel quel le PNG de `src/app/icon.png`).
- Aucun service de Google n'est appelé par le site ; la Search Console se
  validera par un enregistrement DNS, hors de ce dépôt.

### Les guides

Cinq guides, sous `/guides/<adresse>`, listés par `/guides` et reliés depuis
l'accueil et le pied de page : la chasse au trésor des 4-6 ans, la mission
d'agents secrets des 7-9 ans, l'escape game des 10-12 ans, le déroulé de la
fête, et les cachettes et énigmes selon l'âge. Leurs textes vivent dans
`src/contenu/guides/` (un fichier par guide, `types.ts` pour leur forme) ;
chacun montre un exemple produit par le vrai moteur avec une graine fixe et
le prénom d'exemple Camille (`exemples.ts`), et renvoie vers `/creer` et son
aperçu gratuit, avec le prix seulement si la vente est ouverte. Le guide des
cachettes reprend mot pour mot les consignes de sécurité du guide de
l'organisateur et du formulaire. `tests/guides.test.tsx` vérifie 900 à 1 500
mots par guide, le lien vers `/creer`, l'exemple et l'absence de toute
ressource externe ; le correcteur et la liste noire les relisent avec les
autres textes.

### Mesurer les visites

Le critère d'abandon A1 compte les visites des 30 derniers jours, toutes
provenances. La mesure retenue est **Vercel Web Analytics** (paquet
`@vercel/analytics` 2.0.1, `src/composants/MesureDAudience.tsx`), rendue par
la mise en page **en production seulement**, en `mode="production"` (le mode
de débogage chargerait un script d'un autre domaine). Ce que dit la
documentation de Vercel, consultée le 11 octobre 2026 :

- **Ce qui est enregistré** (https://vercel.com/docs/analytics/privacy-policy,
  mise à jour le 26 juin 2026) : à chaque page vue ou événement, l'heure,
  l'adresse et sa route dynamique (`/commande/[ref]`), le référent, certains
  paramètres de l'adresse, la géolocalisation (pays, région, ville), le
  système et le navigateur avec leurs versions, le type d'appareil, la
  version du script.
- **Cookie et stockage** : Vercel dit mesurer « without using any
  third-party cookies » ; sa page ne parle ni des cookies du site ni du
  stockage du navigateur. Le script lui-même
  (https://va.vercel-scripts.com/v1/script.js, relu) n'écrit dans le
  `localStorage` (clé `__va_attribution`) que si le site appelle `identify`
  ou `group`, et ne demande un cookie de session que sur `enableCookie` : ce
  site n'appelle ni l'un ni l'autre. Rien n'est donc stocké dans le
  navigateur, ce que la vérification de la production confirme (aucun
  cookie). Si cela changeait, la règle du lot est de le retirer.
- **Identification d'un visiteur** : une empreinte calculée à partir de la
  requête, abandonnée au bout de 24 heures.
- **Offres** (https://vercel.com/docs/analytics/limits-and-pricing, mise à
  jour le 25 août 2026) : Hobby, 50 000 événements par mois, statistiques sur
  1 mois, **pas d'événements personnalisés**, collecte arrêtée après la
  limite (3 jours de grâce) ; Pro, événements à 0,03 $ les 1 000, sur le
  crédit d'usage, statistiques sur 12 mois, événements personnalisés (2
  propriétés) ; Vercel déclare pouvoir garder les données plus longtemps.
  Événements personnalisés : « available on Enterprise and Pro plans »
  (https://vercel.com/docs/analytics/custom-events, mise à jour le 26 juin
  2026). Filtrer par paramètres `utm` n'est proposé qu'avec Web Analytics
  Plus (https://vercel.com/docs/analytics/filtering).
- **Script** : servi par notre domaine (`/_vercel/insights/script.js`, ou un
  chemin propre au projet en version 2), données envoyées au même domaine.

Ce qui part : `beforeSend` (`src/composants/mesure.ts`) réécrit chaque
adresse — `/commande/<ref>` devient `/commande/[ref]`, `/renoncer` reste
`/renoncer`, sans aucun paramètre ; ailleurs, seuls les paramètres `utm_*`
restent. Aucune adresse e-mail, aucun identifiant de session Stripe, aucune
référence ne part. Le compteur anonyme des aperçus envoie l'événement
`apercu` avec l'âge et la durée choisis, jamais le prénom ni un détail de la
fête ; avec l'offre Hobby, l'appel est fait et Vercel ne l'enregistre pas.

**Web Analytics doit être activé dans le tableau de bord de Vercel** (onglet
Analytics du projet), décision du vendeur : tant qu'il ne l'est pas, le script
répond 404 et rien n'est mesuré.

Provenance : les référents et les paramètres `utm_source` se lisent dans Web
Analytics. Les liens que nous publierons porteront `?utm_source=pinterest`
(Pinterest) et `?utm_source=instagram` (Instagram).

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

Aucune autre variable n'est lue par le code du site (le paquet de Vercel Web
Analytics lit, au build, les variables `NEXT_PUBLIC_VERCEL_OBSERVABILITY_*`
que Vercel pose lui-même). Les adresses de retour de Stripe et les liens
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
  se souvient de ses clés (24 heures). Ensuite, tant qu'une écriture qui
  ferme une clé (`accuses` ≥ n, `retractation_accuse`) échoue durablement, la
  clé resert une fois **par échec et par période de 24 heures**, pas une fois
  par commande : mesuré, une écriture du compteur toujours en 500 laisse
  partir 3 accusés numérotés par jour, et une déclaration identique dont
  `retractation_accuse` ne s'écrit pas renverrait un vrai second exemplaire
  de son accusé chaque jour. « Déjà accusée » reconstruit l'accusé avec la
  fiche du vendeur et les textes actuels : après un changement de vendeur ou
  de texte, ce n'est plus mot pour mot l'e-mail parti (la copie cachée du
  vendeur, elle, l'est). La
  documentation de Resend ne dit pas si une requête en échec garde sa clé :
  si c'est le cas, un numéro peut être compté sans qu'aucun e-mail soit
  parti (l'accusé suivant prend alors le numéro d'après). Ces cas sont
  acceptés ; les tests les jouent tous les deux.
- **Le compteur `accuses` ne recule pas.** Chaque valeur n s'écrit sous sa
  propre clé d'idempotence (`accuses-<ref>-<n>`), et n + 1 ne s'écrit qu'une
  fois n écrit ou sa clé sûrement prise : une écriture en retard est rejouée
  sans effet. Pour cela, quand Resend dit qu'un numéro a déjà servi, la route
  ne passe au numéro suivant que si Stripe a répondu à l'écriture de ce
  numéro par un succès, une réponse rejouée ou un 500 (qu'il garde sous la
  clé) ; sur un 429, un 409 (une autre requête de même clé encore en cours),
  une autre erreur 5xx ou un réseau coupé, rien ne garantit que la clé est
  prise, et la page affiche l'accusé sans envoi, avec le bouton d'e-mail
  (lot 8 ; avant, « en cours de traitement »). C'est un écart au
  cahier du lot 7 (« sans décider sur la réponse ») : l'exploration des
  ordres, puis la relecture, ont montré qu'autrement le compteur pouvait
  reculer. Il repose sur une hypothèse : Stripe garde une réponse 500 sous sa
  clé d'idempotence, comme sa documentation le dit des requêtes exécutées.
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
  d'idempotence 24 heures, échecs compris : dix tentatives pendant une même
  panne d'écriture suffiraient à bloquer l'écriture d'une marque pendant 24
  heures ; c'est pourquoi « Réessayer » reste grisé 60 secondes après une
  réponse de cause `ecriture_impossible`. Clés épuisées, une déclaration reçoit la réponse de panne (503,
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
  Stripe, ni dans la liste quotidienne. Le vendeur la connaît par la copie
  cachée de son accusé **quand l'accusé part** ; quand il ne part pas (échec
  de Resend, plafond, 409, compteur non écrit), seul l'e-mail que la page
  invite à envoyer au vendeur, à l'heure d'origine, la garde.
- **Le quota gratuit de Resend** : 100 destinataires par jour — chaque
  destinataire compte, copies cachées comprises (les e-mails reçus aussi) —,
  remis à zéro à minuit UTC (la page des erreurs de Resend parle, elle, de
  24 heures), et 3 000 par mois. Une commande payée puis rétractée compte au
  pire 14 destinataires : la confirmation (l'acheteur et le vendeur : 2),
  puis les quatre accusés de la route (l'adresse saisie, l'acheteur en copie
  cachée si elle diffère, le vendeur : 3 chacun, 12). Avec les deux listes
  quotidiennes des commandes à traiter (1 destinataire chacune), **sept
  commandes payées puis rétractées le même jour suffisent donc à l'épuiser**
  (7 × 14 + 2 = 100) ; au-delà, plus aucune confirmation ne part ce jour-là,
  et rien n'est livré. La réponse serait une offre payante de Resend, à
  décider par le vendeur.
- **Les lectures de Stripe** : la recherche est limitée à 20 lectures par
  seconde, et un compte dispose d'une allocation de lectures de 500 par
  transaction en moyenne sur 30 jours glissants, avec un minimum de 10 000 par
  mois (https://docs.stripe.com/rate-limits ; la documentation ne dit pas ce
  qui arrive au-delà). Chaque visite d'une page de commande en coûte une à
  trois, une déclaration jusqu'à 13 quand les clés de la marque sont épuisées
  (la recherche, la session, une relecture par clé refusée, puis la relecture
  qui suit l'échec), une seule recherche pour une référence inventée : un afflux de requêtes peut épuiser l'allocation d'un mois de
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
  exporter par un drain de journaux, payant). La liste et les remboursements
  de la tâche partent de la recherche de Stripe, qui peut avoir une minute de
  retard : une rétractation écrite juste avant un passage n'est vue qu'au
  passage suivant.
- **Resend répond 409 sur `accuse-<ref>`, et `retractation_accuse` n'a pas pu
  être écrit** après l'envoi de l'accusé : une déclaration identique dont
  l'accusé aurait changé (remboursement réglé depuis, par exemple) lit
  l'accusé recalculé, « incertain », avec le bouton d'e-mail, jusqu'à ce que
  Resend oublie la clé (24 heures) ; la liste quotidienne montre la commande
  au vendeur.
- Un remboursement **partiel** fait depuis le tableau de bord avant une
  rétractation est complété : la route (clé `retractation-<ref>`) puis, à
  défaut, la tâche (clé du jour) demandent un remboursement sans montant, et
  Stripe rembourse alors le reste : la documentation du paramètre `amount`
  dit qu'un remboursement ne peut porter que sur « the remaining, unrefunded
  amount of the charge » (https://docs.stripe.com/api/refunds/create) ; elle
  ne dit pas en toutes lettres qu'une demande sans `amount` prend ce reste,
  c'est ce que montre son exemple. L'état se lit sur la couverture du montant
  payé (`src/vente/remboursement.ts`) : « effectué » quand les remboursements
  `succeeded` le couvrent, « demandé » quand `succeeded` + `pending` +
  `requires_action` le couvrent, sinon « à venir ». 5,00 € effectués et
  7,90 € en attente, hors rétractation : « Remboursement demandé ».
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
- Une heure écrite à la main illisible (hors ISO 8601 complet, ou date qui
  n'existe pas) rend la commande « à examiner » partout : livraison,
  confirmation par la tâche, remboursement automatique et fonction de
  rétractation (lot 9 ; au lot 8, cette dernière la lisait comme absente).
  La règle (`src/vente/examen.ts`) passe avant le protocole de la course,
  qui ne change pas. Si l'heure illisible apparaît entre la lecture du
  paiement et l'écriture de `retractation` (le vendeur écrit dans le tableau
  de bord au même instant), la marque de la déclaration est déjà écrite :
  ni `course` ni remboursement ne suivent, et l'accusé numéroté annonce
  l'examen ; `retractation_accuse` n'étant pas écrit, la commande figure
  aussi dans la rubrique des accusés non partis. Une déclaration identique
  (« Réessayer ») sur une commande à l'heure illisible reçoit un nouvel
  accusé numéroté, dans le plafond, et non « déjà enregistrée ». Une
  déclaration reçue pendant qu'une heure est illisible n'est gardée chez
  Stripe que par le compteur `accuses` : le vendeur la connaît par la copie
  cachée de son accusé, ou, au-delà du plafond, par l'e-mail que la page
  invite à lui envoyer.
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
la messagerie du vendeur, transmise par ImprovMX (qui n'en garde pas le contenu) et hébergée par Google (Gmail, 5 ans). Une déclaration
de rétractation n'est gardée que dans son accusé de réception et sa copie ;
s'y ajoutent chez Stripe l'heure de la rétractation, l'empreinte de la
déclaration qui l'a enregistrée et le nombre d'accusés envoyés. Une
déclaration non transmise n'est gardée nulle part, sinon sa référence et son
heure dans le journal (une heure chez Vercel). Aucun journal, de Vercel ou du
code, ne contient de prénom, de donnée de la fête, d'e-mail, de nom ni de
contenu chiffré : les routes de la vente ne journalisent que des noms
d'événements, des compteurs et, quand le vendeur peut avoir à agir, la
référence d'une commande ; les tests le vérifient.

Le site ne pose aucun cookie, n'emploie aucun traceur publicitaire, et ne
charge aucune ressource depuis un autre domaine : polices et images sont
servies par le site lui-même, le paiement se fait sur la page hébergée par
Stripe, et la mesure d'audience (Vercel Web Analytics, en production
seulement) passe par notre propre domaine, sans cookie (voir « Mesurer les
visites »). Seul le
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
