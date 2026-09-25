# Mission Gâteau

Générateur de jeux d'anniversaire personnalisés à imprimer, pour les enfants
de 4 à 12 ans.

Un parent choisit un thème, l'âge fêté, le prénom de l'enfant, le nombre
d'enfants, la durée et les cachettes dont il dispose chez lui. Le site compose
aussitôt un kit complet : guide de l'organisateur, invitations, cartes-indices
à cacher, fiches d'énigmes, page du trésor, diplômes et page de solutions.

Le dépôt en est au **lot 5**. Les lots 1 à 3 ont livré le moteur de jeu, le
kit PDF, le formulaire et l'aperçu gratuit filigrané, puis les correctifs de
deux audits. Le lot 4 a ajouté la vente du jeu complet à 12,90 € par Stripe, sa
livraison et les pages légales. Le lot 5 met la vente en conformité avec le
droit de rétractation : confirmation de commande par e-mail avant tout
téléchargement, droit de rétractation jusqu'au premier téléchargement, et
fonction « Renoncer au contrat ici ». La vente reste fermée en production tant
qu'il lui manque quelque chose (voir « La vente »). Les pages de contenu
viendront plus tard. Le site reste volontairement invisible des moteurs de
recherche : `robots.txt` interdit tout, et chaque page porte une balise
`noindex, nofollow`.

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
  emails.ts       confirmation de commande et accusé de réception
  retractation.ts la page « Renoncer au contrat »
src/vente/      la vente : ouverture, Stripe, Resend, chiffrement, livraison,
                confirmation, rétractation, délai légal, tâche quotidienne
src/pdf/        les documents imprimés (@react-pdf/renderer)
src/app/        les pages du site et ses routes
tests/          vitest (un faux Stripe, tests/fauxStripe.ts, et un faux
                Resend, tests/fauxEmail.ts)
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
   achète exactement la configuration et la graine de cet aperçu.
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
   rétractation, propose « Renoncer au contrat ici », puis le bouton
   « Télécharger mon jeu (PDF) ». Il appelle `POST /api/commande/<ref>/kit`, qui
   refait la vérification, déchiffre la configuration, construit le kit avec
   la graine, le passe par `verifierKit`, relit le paiement et, au premier
   téléchargement, enregistre son heure **avant** de renvoyer le PDF (si cet
   enregistrement échoue : 503, aucun PDF). La page dit ensuite « Premier
   téléchargement le … à … : votre droit de rétractation a pris fin à ce
   moment ». Délai passé sans téléchargement : « Votre délai de rétractation a
   pris fin le … », sans le lien.
6. Stripe envoie de son côté la facture et le reçu ; plus rien ne s'appuie
   dessus.

`<ref>` est une référence de 128 bits tirée au hasard. Hors d'une commande
payée **et confirmée**, aucune route ne sert le kit complet ; une commande
impayée, introuvable, expirée, remboursée en totalité, rétractée, en litige,
d'une autre version du kit ou illisible reçoit un message clair, et rien
d'autre.

### La confirmation de commande

Elle part à l'adresse que l'acheteur a saisie chez Stripe : `customer_details.email`
de la session Checkout (lue par son identifiant au retour de Stripe, sinon
retrouvée par `checkout.sessions.list({ payment_intent })`), à défaut
`billing_details.email` du dernier débit. Elle contient, dans l'ordre : la
commande (référence, date et heure du paiement à Paris, le jeu par son thème
et sa tranche d'âge, 12,90 € et la mention de TVA, payé par carte) ; le lien
de la page de la commande et sa validité ; la confirmation de l'accord donné
avant le paiement, mot pour mot, avec sa date et son heure ; le droit de
rétractation (jusqu'au premier téléchargement et au plus tard le dernier jour
du délai, par « Renoncer au contrat ici », par le formulaire type ou par toute
déclaration claire ; remboursement sous 14 jours) ; le formulaire type rempli
avec les coordonnées du vendeur ; le vendeur, le service client, la garantie
légale (avec l'article des CGV) et le médiateur, seulement une fois la
convention signée ; enfin, en pièce jointe annoncée, **les CGV dans la version
acceptée**, prix compris, en PDF (`cgv-mission-gateau-<version>.pdf`).

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
service client, et n'affiche aucun bouton de téléchargement. Version des CGV
introuvable : aucun envoi, « confirmation impossible ».

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

Le lien « Renoncer au contrat ici » figure dans le pied de toutes les pages, à
côté des liens légaux, sur la page de la commande et dans la confirmation. Il
mène à `/renoncer` (`?ref=` préremplit la référence), toujours accessible :
nom, prénom, référence (ou lien de la commande), e-mail où recevoir l'accusé,
un récapitulatif, puis « Confirmer la rétractation ». `POST /api/renoncer`
valide avec `zod`, borne la taille à 4 ko, et refuse sans rien faire une
déclaration dont le champ piège (invisible, hors du clavier et des lecteurs
d'écran) est rempli. L'heure de réception par le serveur est celle de l'envoi
de la déclaration. La commande est jugée **sur le paiement lui-même** :

- rétractation déjà enregistrée : la page rappelle sa date et l'état du
  remboursement, sans second remboursement ni second e-mail ;
- déjà téléchargée : accusé qui explique que le droit a pris fin au premier
  téléchargement, sans remboursement ; la livraison continue ;
- délai expiré : accusé qui donne le dernier jour, sans remboursement ;
- sinon, la rétractation est valable : `retractation` est enregistrée (la
  livraison est aussitôt bloquée), puis le paiement est remboursé en totalité
  par Stripe (clé d'idempotence `retractation-<ref>`, motif
  `requested_by_customer`). L'accusé dit « remboursé » si Stripe l'a fait,
  sinon « remboursé sous 14 jours au plus », et la tâche quotidienne retente.
  Déjà remboursée hors rétractation : l'accusé le dit. Litige en cours :
  aucun remboursement automatique, le vendeur répond sous 7 jours ;
- paiement introuvable (référence inconnue, paiement pas encore visible dans
  la recherche de Stripe, Stripe indisponible, ou enregistrement impossible) :
  l'accusé part quand même, en disant que la déclaration n'a pas encore pu
  être reliée à une commande ; sa copie au vendeur, qui porte ce statut, est
  à traiter à la main.

L'accusé de réception reprend la déclaration (nom, prénom, référence, e-mail),
la date et l'heure de son envoi (heure de Paris), et la suite donnée, avec une
ligne « Statut ». Il part sans délai à l'adresse saisie, en copie cachée à
l'adresse de l'acheteur chez Stripe si elle diffère, et au vendeur. La page
affiche le même contenu, dit où il est parti et, s'il n'a pas pu partir,
propose de le renvoyer : le renvoi d'une rétractation enregistrée repart avec
l'heure enregistrée et la même clé (`accuse-<ref>`), une seule fois ; la marque
`retractation_accuse` retient qu'il est parti.

Une rétractation reçue par e-mail ou par courrier se traite à la main dans le
tableau de bord de Stripe : ajouter au paiement la métadonnée `retractation`
(une date ISO, par exemple `2026-10-02`), ce qui bloque aussitôt la livraison,
puis rembourser ; la tâche quotidienne retente le remboursement s'il manque.

### Ce que Stripe garde

Dans les métadonnées du paiement : la référence, `VERSION_KIT`, la graine, le
pays déclaré, la version des CGV acceptée, l'heure des deux accords (heure du
serveur), la configuration complète **chiffrée** (AES-256-GCM, clé dérivée de
`STRIPE_SECRET_KEY` par HKDF-SHA256 avec une étiquette propre à cet usage),
découpée en morceaux de 500 caractères, puis, au fil de la commande :
`confirmation` et `confirmation_id`, `telechargement`, `retractation` et
`retractation_accuse`. C'est tout l'état d'une commande : le site n'a pas de
base de données. Ces cinq clés sont comptées dès la création de la commande
dans les 50 clés permises par Stripe (`depassementsDeMetadonnees`). Aucune
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
fiche du vendeur, copie cachée de chaque confirmation et de chaque accusé de
réception à ce même e-mail (preuve de l'envoi). Une version texte et une
version HTML simple, rendues du même contenu ; aucune image ni ressource
distante ; aucune donnée du jeu. **Le domaine `missiongateau.com` doit être
vérifié dans Resend** : sans cela, Resend refuse l'expéditeur, la confirmation
ne part pas, et rien n'est livré.

Hors production, les e-mails ne partent qu'aux adresses de test de Resend
(`…@resend.dev`) et à l'e-mail du vendeur ; toute autre adresse est remplacée
par `delivered@resend.dev`, et la page le dit.

### La tâche quotidienne

`GET /api/effacement`, déclarée deux fois dans `vercel.json`, vers 3 h et 15 h
UTC : sur l'offre Hobby, chaque tâche ne s'exécute qu'une fois par jour, à
l'heure près (jusqu'à 59 minutes de retard), et une même route peut porter
deux tâches. Elle n'agit que si la requête porte
`Authorization: Bearer <CRON_SECRET>`, que Vercel envoie de lui-même ; sinon, ou
sans la variable, 401 et rien d'autre. Elle :

1. efface la configuration chiffrée des paiements **et** des débits de plus de
   30 jours (comptés à partir du débit réussi) ;
2. envoie la confirmation des commandes payées depuis plus d'une heure qui
   n'en ont pas, sauf celles rétractées, remboursées ou en litige, sans jamais
   en envoyer deux ;
3. retente le remboursement des rétractations enregistrées qui ne sont pas
   encore remboursées, hors litige, une fois par jour (clé
   `retractation-<ref>-<jour>` ; Stripe ne rembourse jamais au-delà du montant
   payé).

Elle examine les paiements aboutis des 45 derniers jours, au plus 2 000 par
passage. Ses compteurs ne partent que dans les journaux ; la réponse ne dit
que `{ "ok": true }` ou `{ "ok": false }`. Une panne en cours de route ne fait
pas perdre les compteurs déjà faits.

### Quand la vente est-elle ouverte ?

Seulement si tout ce qu'il faut pour vendre, confirmer et livrer est réuni
(`src/vente/ouverture.ts`) :

- en production (`VERCEL_ENV=production`) : une clé Stripe **réelle**
  (`sk_live_…` ou `rk_live_…`), la fiche du vendeur complète, convention avec
  le médiateur comprise, et `RESEND_API_KEY` ;
- partout ailleurs (préversions, local) : une clé Stripe **de test**
  (`sk_test_…` ou `rk_test_…`), la fiche complète sauf la convention, et
  `RESEND_API_KEY`. Le médiateur reste non nommé tant que la convention n'est
  pas signée. Le kit livré porte alors sur chaque page, bien visible,
  « Exemplaire d'essai — sans valeur commerciale » (même mécanisme que le
  filigrane de l'aperçu) ; en production, jamais.

Vente fermée : aucun prix affiché, aucun bouton d'achat, `POST /api/commande`
répond 503, et `/creer` annonce après l'aperçu que la vente ouvre bientôt. La
livraison des commandes déjà payées et confirmées n'a besoin que d'une clé
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
`VERCEL_PROJECT_PRODUCTION_URL` (qui suivra le domaine quand il sera branché),
en préversion `VERCEL_URL`, en local `localhost`.

### Les CGV, version par version

Chaque version publiée vit dans `src/contenu/cgv/<identifiant>.ts` et n'est
plus jamais modifiée : une commande garde l'identifiant de la version
acceptée, et sa confirmation joint le PDF de celle-là. `/cgv` affiche la
dernière de `VERSIONS_CGV`. Pour changer les CGV : copier le dernier fichier
sous un nouvel identifiant (la date de publication), l'écrire, l'ajouter à la
fin de `VERSIONS_CGV`, puis ajouter son empreinte dans `tests/cgv.test.ts`, qui
refuse toute retouche d'une version publiée. La version du 24 septembre 2026
reste disponible pour les commandes passées sous elle.

### La fiche du vendeur, et comment changer de vendeur

Tout ce qui concerne le vendeur vit dans `src/contenu/vendeur.ts` : identité,
SIRET, RCS et capital (facultatifs), adresse, téléphone, e-mail du service
client, mention de TVA, médiateur, hébergeur, prestataire de paiement. Les
pages légales, le pied de page, les e-mails, la facture Stripe et la condition
d'ouverture lisent ce seul fichier ; un champ vide n'est jamais affiché, et
tant que `conventionSignee` est faux, le médiateur n'est nommé nulle part.

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
- Vercel, pare-feu : une règle de limitation de débit sur `/api/renoncer`
  (voir « Choix et limites »).

### Choix et limites

- **La fonction de rétractation peut servir à écrire à des inconnus** : n'importe
  qui peut saisir n'importe quelle adresse et lui faire envoyer un accusé de
  réception, ou épuiser le quota d'e-mails (offre gratuite de Resend : 100
  e-mails par jour, chaque destinataire compte, copies cachées comprises). Le
  champ piège n'arrête que les robots naïfs. Parade : une règle de limitation
  de débit du pare-feu de Vercel sur `/api/renoncer`, par adresse IP (l'offre
  Hobby permet une règle, en fenêtre fixe de 10 secondes à 10 minutes), par
  exemple 5 requêtes par 10 minutes. Elle se pose dans le tableau de bord de
  Vercel, hors de ce dépôt.
- Hors production, toutes les adresses sauf celles de test et celle du vendeur
  sont remplacées : l'abus y est limité à `…@resend.dev` et au vendeur.
- Il n'y a pas de verrou : une rétractation déclarée à l'instant exact d'un
  premier téléchargement peut passer avec lui. La route du kit relit le
  paiement juste avant de livrer, ce qui réduit cette fenêtre à quelques
  dizaines de millisecondes ; le cas restant se règle à la main.
- Un litige se lit sur `disputed` du dernier débit. La documentation de Stripe
  ne dit pas si ce drapeau repasse à faux une fois le litige clos : par
  prudence, tant qu'il est vrai, la commande reste bloquée, et le service
  client la débloque à la main s'il le faut.
- Un paiement de moins d'une minute n'est pas toujours visible dans la
  recherche de Stripe : une rétractation déclarée juste après le paiement peut
  être « non reliée », donc traitée à la main.
- La clé d'idempotence de Resend vit 24 heures : au-delà, une confirmation dont
  l'envoi a réussi sans que sa marque ait pu être posée chez Stripe
  repartirait une seconde fois. Il faut pour cela que Stripe refuse
  l'écriture puis que 24 heures passent sans nouvelle tentative réussie.
- Le lien des e-mails suit l'adresse du déploiement : si le domaine de
  production change entre deux tentatives d'une même confirmation (moins de
  24 heures), la seconde est une requête différente pour Resend, journalisée ;
  la page propose alors d'écrire au service client.
- La tâche quotidienne passe deux fois par jour, à l'heure près : une
  configuration peut survivre jusqu'à un demi-jour de plus que 30 jours (la
  livraison, elle, s'arrête à 30 jours pile).
- Pas de webhook : le site ne sait d'une commande que ce qu'il demande à Stripe
  au moment où une page, un bouton ou la tâche l'interrogent.
- Sans clé Stripe, une référence est « introuvable » : un déploiement sans clé
  n'a jamais pu vendre. Retirer la clé de la production après l'ouverture
  ferait donc lire « commande introuvable » à des clients qui ont payé (le
  service client reste indiqué) ; une panne de Stripe, elle, affiche
  « vérification momentanément impossible ».
- Le retour de Stripe se fait sur l'adresse du déploiement (production :
  `VERCEL_PROJECT_PRODUCTION_URL` ; préversion : `VERCEL_URL`). Un parent parti
  d'une autre adresse (alias de branche d'une préversion, autre alias
  `*.vercel.app`) ne retrouve pas son formulaire en cas d'annulation.
- Aucune autre limite de débit : chaque visite de `/commande/<ref>`, chaque
  commande et chaque passage de la tâche interrogent Stripe, dont la recherche
  est limitée à 20 lectures par seconde.
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
chiffrée, 30 jours chez Stripe, puis effacée ; la trace de la commande et les
heures de son suivi, chez Stripe, aussi longtemps que la facture (10 ans) ;
l'e-mail, le nom, l'adresse de facturation et la facture, chez Stripe, au
titre des obligations comptables (10 ans) ; les e-mails de confirmation et
d'accusé de réception chez Resend (30 jours, selon Resend), et leur copie dans
la messagerie du vendeur (5 ans). Une déclaration de rétractation n'est gardée
que dans son accusé de réception et sa copie. Aucun journal, de Vercel ou du
code, ne contient de prénom, de donnée de la fête, d'e-mail, de nom ni de
contenu chiffré : les routes de la vente ne journalisent que des noms
d'événements et des compteurs, et les tests le vérifient.

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
