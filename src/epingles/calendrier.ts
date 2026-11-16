import type { Duree, IdTheme, TypeEnigme } from "../engine/types";

/**
 * Le calendrier des épingles Pinterest : chaque image, le jeu dont elle
 * montre une page, le flux (le tableau Pinterest) où elle paraît, et sa date
 * de publication, fixe, écrite ici une fois pour toutes.
 *
 * Un flux ne montre que les articles dont la date est passée (voir
 * src/epingles/flux.ts) : Pinterest reçoit ainsi une épingle nouvelle tous
 * les deux jours dans chaque flux, jusqu'au bout du calendrier.
 *
 * Ajouter une image : une ligne de plus dans `EPINGLES`, datée après la
 * dernière de son flux (un article tous les deux jours), puis
 * `npm run epingles`, qui fabrique l'image dans public/epingles/ et met à
 * jour src/epingles/images.ts. Ne jamais changer la date, le fichier ni le
 * flux d'une ligne déjà publiée : Pinterest la recevrait comme une autre.
 *
 * Les jeux sont produits par le vrai moteur, avec une graine fixe, un
 * prénom d'exemple et sans aucun champ de la fête (ni date, ni adresse, ni
 * contact, ni invités) : aucune page ne montre ce qu'un parent saisirait.
 */

/** Un flux RSS, donc un tableau Pinterest. */
export type IdFlux = "chasse-4-6-ans" | "mission-7-9-ans" | "escape-game-10-12-ans" | "idees-anniversaire";

/** Le guide vers lequel mène l'article. */
export type IdGuideEpingle = "chasse" | "mission" | "escape" | "deroule" | "cachettes";

/** Un jeu d'exemple : la configuration du moteur, sans champ de la fête, et sa graine. */
export interface JeuEpingle {
  theme: IdTheme;
  age: number;
  prenom: string;
  nombreEnfants: number;
  duree: Duree;
  graine: string;
}

/**
 * La page du kit complet que montre l'image. Les cartes et les fiches sont
 * celles de la première équipe ; `enigmes` dit ce que la page montre, et
 * `npm run epingles` refuse une page qui ne le montre pas.
 */
export type PageDuJeu =
  /** La première page du guide de l'organisateur : fiche technique et déroulé minute par minute. */
  | { section: "deroule" }
  /** La page « à préparer » : plan de pose des cartes, rôle de l'adulte, sécurité. */
  | { section: "preparation" }
  /** L'histoire à lire au départ, la règle et la devinette de départ. */
  | { section: "briefing" }
  | { section: "tresor" }
  /** La première page des diplômes : celui de l'enfant fêté, et un diplôme à remplir. */
  | { section: "diplome" }
  /** La n-ième page de cartes-indices (deux cartes par page). */
  | { section: "cartes"; rang: number; enigmes: readonly TypeEnigme[] }
  /** La fiche d'énigme n° `numero`. */
  | { section: "fiche"; numero: number; enigmes: readonly TypeEnigme[] };

export interface Epingle {
  /** Date de publication, AAAA-MM-JJ ; l'heure est HEURE_DE_PUBLICATION. */
  date: string;
  flux: IdFlux;
  guide: IdGuideEpingle;
  /** Le nom du fichier dans public/epingles/ : stable, il sert aussi au guid. */
  fichier: string;
  jeu: IdJeu;
  page: PageDuJeu;
}

/** L'heure de publication de chaque article, en UTC : 7 h à Paris l'hiver, 8 h l'été. */
export const HEURE_DE_PUBLICATION = "06:00:00Z";

export const JEUX = {
  "chasse-pirates-maya": { theme: "pirates", age: 5, prenom: "Maya", nombreEnfants: 6, duree: 45, graine: "epingle-chasse-pirates-maya" },
  "chasse-pirates-lino": { theme: "pirates", age: 4, prenom: "Lino", nombreEnfants: 5, duree: 60, graine: "epingle-chasse-pirates-lino" },
  "chasse-agents-ines": { theme: "agents", age: 6, prenom: "Inès", nombreEnfants: 6, duree: 45, graine: "epingle-chasse-agents-ines" },
  "chasse-agents-sacha": { theme: "agents", age: 5, prenom: "Sacha", nombreEnfants: 5, duree: 60, graine: "epingle-chasse-agents-sacha" },
  "chasse-dinosaures-timeo": { theme: "dinosaures", age: 4, prenom: "Timéo", nombreEnfants: 6, duree: 45, graine: "epingle-chasse-dinosaures-timeo" },
  "chasse-dinosaures-alba": { theme: "dinosaures", age: 6, prenom: "Alba", nombreEnfants: 5, duree: 60, graine: "epingle-chasse-dinosaures-alba" },
  "mission-pirates-tibo": { theme: "pirates", age: 8, prenom: "Tibo", nombreEnfants: 6, duree: 45, graine: "epingle-mission-pirates-tibo" },
  "mission-pirates-louna": { theme: "pirates", age: 7, prenom: "Louna", nombreEnfants: 8, duree: 60, graine: "epingle-mission-pirates-louna" },
  "mission-agents-jade": { theme: "agents", age: 9, prenom: "Jade", nombreEnfants: 6, duree: 45, graine: "epingle-mission-agents-jade" },
  "mission-agents-nils": { theme: "agents", age: 8, prenom: "Nils", nombreEnfants: 8, duree: 60, graine: "epingle-mission-agents-nils" },
  "mission-dinosaures-marin": { theme: "dinosaures", age: 7, prenom: "Marin", nombreEnfants: 6, duree: 45, graine: "epingle-mission-dinosaures-marin" },
  "mission-dinosaures-zoe": { theme: "dinosaures", age: 9, prenom: "Zoé", nombreEnfants: 8, duree: 60, graine: "epingle-mission-dinosaures-zoe" },
  "escape-pirates-roxane": { theme: "pirates", age: 11, prenom: "Roxane", nombreEnfants: 6, duree: 45, graine: "epingle-escape-pirates-roxane" },
  "escape-pirates-ael": { theme: "pirates", age: 10, prenom: "Aël", nombreEnfants: 10, duree: 60, graine: "epingle-escape-pirates-ael" },
  "escape-agents-elio": { theme: "agents", age: 12, prenom: "Elio", nombreEnfants: 6, duree: 45, graine: "epingle-escape-agents-elio" },
  "escape-agents-lena": { theme: "agents", age: 11, prenom: "Léna", nombreEnfants: 10, duree: 60, graine: "epingle-escape-agents-lena" },
  "escape-dinosaures-sofia": { theme: "dinosaures", age: 10, prenom: "Sofia", nombreEnfants: 6, duree: 45, graine: "epingle-escape-dinosaures-sofia" },
  "escape-dinosaures-hugo": { theme: "dinosaures", age: 12, prenom: "Hugo", nombreEnfants: 10, duree: 60, graine: "epingle-escape-dinosaures-hugo" },
} as const satisfies Record<string, JeuEpingle>;

export type IdJeu = keyof typeof JEUX;

export const EPINGLES: readonly Epingle[] = [
  // chasse-4-6-ans
  { date: "2026-11-17", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-pirates-deroule-maya.jpg", jeu: "chasse-pirates-maya", page: { section: "deroule" } },
  { date: "2026-11-19", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-agents-fiche-1-ines.jpg", jeu: "chasse-agents-ines", page: { section: "fiche", numero: 1, enigmes: ["labyrinthe"] } },
  { date: "2026-11-21", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-dinosaures-tresor-alba.jpg", jeu: "chasse-dinosaures-alba", page: { section: "tresor" } },
  { date: "2026-11-23", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-pirates-cartes-1-lino.jpg", jeu: "chasse-pirates-lino", page: { section: "cartes", rang: 1, enigmes: ["intrus", "suite"] } },
  { date: "2026-11-25", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-agents-briefing-ines.jpg", jeu: "chasse-agents-ines", page: { section: "briefing" } },
  { date: "2026-11-27", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-dinosaures-fiche-1-alba.jpg", jeu: "chasse-dinosaures-alba", page: { section: "fiche", numero: 1, enigmes: ["labyrinthe"] } },
  { date: "2026-11-29", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-pirates-diplome-maya.jpg", jeu: "chasse-pirates-maya", page: { section: "diplome" } },
  { date: "2026-12-01", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-agents-cartes-2-sacha.jpg", jeu: "chasse-agents-sacha", page: { section: "cartes", rang: 2, enigmes: ["comptage"] } },
  { date: "2026-12-03", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-dinosaures-deroule-timeo.jpg", jeu: "chasse-dinosaures-timeo", page: { section: "deroule" } },
  { date: "2026-12-05", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-pirates-fiche-1-maya.jpg", jeu: "chasse-pirates-maya", page: { section: "fiche", numero: 1, enigmes: ["labyrinthe"] } },
  { date: "2026-12-07", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-agents-tresor-sacha.jpg", jeu: "chasse-agents-sacha", page: { section: "tresor" } },
  { date: "2026-12-09", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-dinosaures-cartes-1-alba.jpg", jeu: "chasse-dinosaures-alba", page: { section: "cartes", rang: 1, enigmes: ["intrus", "suite"] } },
  { date: "2026-12-11", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-pirates-briefing-maya.jpg", jeu: "chasse-pirates-maya", page: { section: "briefing" } },
  { date: "2026-12-13", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-agents-fiche-1-sacha.jpg", jeu: "chasse-agents-sacha", page: { section: "fiche", numero: 1, enigmes: ["labyrinthe"] } },
  { date: "2026-12-15", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-dinosaures-diplome-timeo.jpg", jeu: "chasse-dinosaures-timeo", page: { section: "diplome" } },
  { date: "2026-12-17", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-pirates-cartes-2-lino.jpg", jeu: "chasse-pirates-lino", page: { section: "cartes", rang: 2, enigmes: ["comptage"] } },
  { date: "2026-12-19", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-agents-deroule-ines.jpg", jeu: "chasse-agents-ines", page: { section: "deroule" } },
  { date: "2026-12-21", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-dinosaures-fiche-1-timeo.jpg", jeu: "chasse-dinosaures-timeo", page: { section: "fiche", numero: 1, enigmes: ["labyrinthe"] } },
  { date: "2026-12-23", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-pirates-tresor-lino.jpg", jeu: "chasse-pirates-lino", page: { section: "tresor" } },
  { date: "2026-12-25", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-agents-cartes-1-sacha.jpg", jeu: "chasse-agents-sacha", page: { section: "cartes", rang: 1, enigmes: ["intrus", "suite"] } },
  { date: "2026-12-27", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-dinosaures-briefing-timeo.jpg", jeu: "chasse-dinosaures-timeo", page: { section: "briefing" } },
  { date: "2026-12-29", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-pirates-fiche-1-lino.jpg", jeu: "chasse-pirates-lino", page: { section: "fiche", numero: 1, enigmes: ["labyrinthe"] } },
  { date: "2026-12-31", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-agents-diplome-ines.jpg", jeu: "chasse-agents-ines", page: { section: "diplome" } },
  { date: "2027-01-02", flux: "chasse-4-6-ans", guide: "chasse", fichier: "chasse-dinosaures-cartes-2-alba.jpg", jeu: "chasse-dinosaures-alba", page: { section: "cartes", rang: 2, enigmes: ["comptage"] } },
  // mission-7-9-ans
  { date: "2026-11-17", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-pirates-deroule-tibo.jpg", jeu: "mission-pirates-tibo", page: { section: "deroule" } },
  { date: "2026-11-19", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-agents-fiche-1-jade.jpg", jeu: "mission-agents-jade", page: { section: "fiche", numero: 1, enigmes: ["motsmeles"] } },
  { date: "2026-11-21", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-dinosaures-tresor-zoe.jpg", jeu: "mission-dinosaures-zoe", page: { section: "tresor" } },
  { date: "2026-11-23", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-pirates-cartes-1-louna.jpg", jeu: "mission-pirates-louna", page: { section: "cartes", rang: 1, enigmes: ["pictogrammes", "calcul"] } },
  { date: "2026-11-25", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-agents-briefing-jade.jpg", jeu: "mission-agents-jade", page: { section: "briefing" } },
  { date: "2026-11-27", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-dinosaures-fiche-3-zoe.jpg", jeu: "mission-dinosaures-zoe", page: { section: "fiche", numero: 3, enigmes: ["labyrinthe"] } },
  { date: "2026-11-29", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-pirates-diplome-tibo.jpg", jeu: "mission-pirates-tibo", page: { section: "diplome" } },
  { date: "2026-12-01", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-agents-cartes-2-nils.jpg", jeu: "mission-agents-nils", page: { section: "cartes", rang: 2, enigmes: ["miroir", "pictogrammes"] } },
  { date: "2026-12-03", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-dinosaures-deroule-marin.jpg", jeu: "mission-dinosaures-marin", page: { section: "deroule" } },
  { date: "2026-12-05", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-pirates-fiche-1-tibo.jpg", jeu: "mission-pirates-tibo", page: { section: "fiche", numero: 1, enigmes: ["motsmeles"] } },
  { date: "2026-12-07", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-agents-tresor-nils.jpg", jeu: "mission-agents-nils", page: { section: "tresor" } },
  { date: "2026-12-09", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-dinosaures-cartes-1-zoe.jpg", jeu: "mission-dinosaures-zoe", page: { section: "cartes", rang: 1, enigmes: ["pictogrammes", "calcul"] } },
  { date: "2026-12-11", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-pirates-briefing-tibo.jpg", jeu: "mission-pirates-tibo", page: { section: "briefing" } },
  { date: "2026-12-13", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-agents-fiche-3-nils.jpg", jeu: "mission-agents-nils", page: { section: "fiche", numero: 3, enigmes: ["labyrinthe"] } },
  { date: "2026-12-15", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-dinosaures-diplome-marin.jpg", jeu: "mission-dinosaures-marin", page: { section: "diplome" } },
  { date: "2026-12-17", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-pirates-cartes-2-louna.jpg", jeu: "mission-pirates-louna", page: { section: "cartes", rang: 2, enigmes: ["miroir", "pictogrammes"] } },
  { date: "2026-12-19", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-agents-deroule-jade.jpg", jeu: "mission-agents-jade", page: { section: "deroule" } },
  { date: "2026-12-21", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-dinosaures-fiche-1-marin.jpg", jeu: "mission-dinosaures-marin", page: { section: "fiche", numero: 1, enigmes: ["motsmeles"] } },
  { date: "2026-12-23", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-pirates-tresor-louna.jpg", jeu: "mission-pirates-louna", page: { section: "tresor" } },
  { date: "2026-12-25", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-agents-cartes-1-nils.jpg", jeu: "mission-agents-nils", page: { section: "cartes", rang: 1, enigmes: ["pictogrammes", "calcul"] } },
  { date: "2026-12-27", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-dinosaures-briefing-marin.jpg", jeu: "mission-dinosaures-marin", page: { section: "briefing" } },
  { date: "2026-12-29", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-pirates-fiche-3-louna.jpg", jeu: "mission-pirates-louna", page: { section: "fiche", numero: 3, enigmes: ["labyrinthe"] } },
  { date: "2026-12-31", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-agents-diplome-jade.jpg", jeu: "mission-agents-jade", page: { section: "diplome" } },
  { date: "2027-01-02", flux: "mission-7-9-ans", guide: "mission", fichier: "mission-dinosaures-cartes-2-zoe.jpg", jeu: "mission-dinosaures-zoe", page: { section: "cartes", rang: 2, enigmes: ["miroir", "pictogrammes"] } },
  // escape-game-10-12-ans
  { date: "2026-11-17", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-pirates-deroule-roxane.jpg", jeu: "escape-pirates-roxane", page: { section: "deroule" } },
  { date: "2026-11-19", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-agents-fiche-1-elio.jpg", jeu: "escape-agents-elio", page: { section: "fiche", numero: 1, enigmes: ["sudoku"] } },
  { date: "2026-11-21", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-dinosaures-fiche-5-hugo.jpg", jeu: "escape-dinosaures-hugo", page: { section: "fiche", numero: 5, enigmes: ["labyrinthe"] } },
  { date: "2026-11-23", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-pirates-cartes-1-ael.jpg", jeu: "escape-pirates-ael", page: { section: "cartes", rang: 1, enigmes: ["morse", "cesar"] } },
  { date: "2026-11-25", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-agents-briefing-elio.jpg", jeu: "escape-agents-elio", page: { section: "briefing" } },
  { date: "2026-11-27", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-dinosaures-fiche-3-hugo.jpg", jeu: "escape-dinosaures-hugo", page: { section: "fiche", numero: 3, enigmes: ["motsmeles"] } },
  { date: "2026-11-29", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-pirates-diplome-roxane.jpg", jeu: "escape-pirates-roxane", page: { section: "diplome" } },
  { date: "2026-12-01", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-agents-fiche-2-lena.jpg", jeu: "escape-agents-lena", page: { section: "fiche", numero: 2, enigmes: ["logique"] } },
  { date: "2026-12-03", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-dinosaures-deroule-sofia.jpg", jeu: "escape-dinosaures-sofia", page: { section: "deroule" } },
  { date: "2026-12-05", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-pirates-fiche-1-roxane.jpg", jeu: "escape-pirates-roxane", page: { section: "fiche", numero: 1, enigmes: ["sudoku"] } },
  { date: "2026-12-07", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-agents-fiche-5-lena.jpg", jeu: "escape-agents-lena", page: { section: "fiche", numero: 5, enigmes: ["labyrinthe"] } },
  { date: "2026-12-09", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-dinosaures-cartes-1-hugo.jpg", jeu: "escape-dinosaures-hugo", page: { section: "cartes", rang: 1, enigmes: ["morse", "cesar"] } },
  { date: "2026-12-11", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-pirates-briefing-roxane.jpg", jeu: "escape-pirates-roxane", page: { section: "briefing" } },
  { date: "2026-12-13", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-agents-fiche-3-lena.jpg", jeu: "escape-agents-lena", page: { section: "fiche", numero: 3, enigmes: ["motsmeles"] } },
  { date: "2026-12-15", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-dinosaures-diplome-sofia.jpg", jeu: "escape-dinosaures-sofia", page: { section: "diplome" } },
  { date: "2026-12-17", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-pirates-fiche-2-ael.jpg", jeu: "escape-pirates-ael", page: { section: "fiche", numero: 2, enigmes: ["logique"] } },
  { date: "2026-12-19", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-agents-deroule-elio.jpg", jeu: "escape-agents-elio", page: { section: "deroule" } },
  { date: "2026-12-21", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-dinosaures-fiche-1-sofia.jpg", jeu: "escape-dinosaures-sofia", page: { section: "fiche", numero: 1, enigmes: ["sudoku"] } },
  { date: "2026-12-23", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-pirates-fiche-5-ael.jpg", jeu: "escape-pirates-ael", page: { section: "fiche", numero: 5, enigmes: ["labyrinthe"] } },
  { date: "2026-12-25", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-agents-cartes-1-lena.jpg", jeu: "escape-agents-lena", page: { section: "cartes", rang: 1, enigmes: ["morse", "cesar"] } },
  { date: "2026-12-27", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-dinosaures-briefing-sofia.jpg", jeu: "escape-dinosaures-sofia", page: { section: "briefing" } },
  { date: "2026-12-29", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-pirates-fiche-3-ael.jpg", jeu: "escape-pirates-ael", page: { section: "fiche", numero: 3, enigmes: ["motsmeles"] } },
  { date: "2026-12-31", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-agents-diplome-elio.jpg", jeu: "escape-agents-elio", page: { section: "diplome" } },
  { date: "2027-01-02", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-dinosaures-fiche-2-hugo.jpg", jeu: "escape-dinosaures-hugo", page: { section: "fiche", numero: 2, enigmes: ["logique"] } },
  // Ajoutées après le correctif du code final, qui débordait de son cadre sur la page du trésor.
  { date: "2027-01-04", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-pirates-tresor-ael.jpg", jeu: "escape-pirates-ael", page: { section: "tresor" } },
  { date: "2027-01-06", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-agents-tresor-lena.jpg", jeu: "escape-agents-lena", page: { section: "tresor" } },
  { date: "2027-01-08", flux: "escape-game-10-12-ans", guide: "escape", fichier: "escape-dinosaures-tresor-hugo.jpg", jeu: "escape-dinosaures-hugo", page: { section: "tresor" } },
  // idees-anniversaire
  { date: "2026-11-17", flux: "idees-anniversaire", guide: "deroule", fichier: "guide-deroule-chasse-pirates-lino.jpg", jeu: "chasse-pirates-lino", page: { section: "deroule" } },
  { date: "2026-11-19", flux: "idees-anniversaire", guide: "cachettes", fichier: "guide-cachettes-chasse-agents-ines.jpg", jeu: "chasse-agents-ines", page: { section: "preparation" } },
  { date: "2026-11-21", flux: "idees-anniversaire", guide: "deroule", fichier: "guide-deroule-mission-agents-nils.jpg", jeu: "mission-agents-nils", page: { section: "deroule" } },
  { date: "2026-11-23", flux: "idees-anniversaire", guide: "cachettes", fichier: "guide-cachettes-mission-dinosaures-marin.jpg", jeu: "mission-dinosaures-marin", page: { section: "preparation" } },
  { date: "2026-11-25", flux: "idees-anniversaire", guide: "deroule", fichier: "guide-deroule-escape-dinosaures-hugo.jpg", jeu: "escape-dinosaures-hugo", page: { section: "deroule" } },
  { date: "2026-11-27", flux: "idees-anniversaire", guide: "cachettes", fichier: "guide-cachettes-escape-pirates-roxane.jpg", jeu: "escape-pirates-roxane", page: { section: "preparation" } },
  { date: "2026-11-29", flux: "idees-anniversaire", guide: "deroule", fichier: "guide-deroule-chasse-dinosaures-alba.jpg", jeu: "chasse-dinosaures-alba", page: { section: "deroule" } },
  { date: "2026-12-01", flux: "idees-anniversaire", guide: "cachettes", fichier: "guide-cachettes-chasse-pirates-maya.jpg", jeu: "chasse-pirates-maya", page: { section: "preparation" } },
  { date: "2026-12-03", flux: "idees-anniversaire", guide: "deroule", fichier: "guide-deroule-mission-pirates-louna.jpg", jeu: "mission-pirates-louna", page: { section: "deroule" } },
  { date: "2026-12-05", flux: "idees-anniversaire", guide: "cachettes", fichier: "guide-cachettes-mission-agents-jade.jpg", jeu: "mission-agents-jade", page: { section: "preparation" } },
  { date: "2026-12-07", flux: "idees-anniversaire", guide: "deroule", fichier: "guide-deroule-escape-agents-lena.jpg", jeu: "escape-agents-lena", page: { section: "deroule" } },
  { date: "2026-12-09", flux: "idees-anniversaire", guide: "cachettes", fichier: "guide-cachettes-escape-dinosaures-sofia.jpg", jeu: "escape-dinosaures-sofia", page: { section: "preparation" } },
];
