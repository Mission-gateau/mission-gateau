/**
 * Le délai de rétractation d'une commande.
 *
 * Articles L221-18 et L221-19 du Code de la consommation : 14 jours à compter
 * de la conclusion du contrat, ici le paiement. Le jour du paiement ne compte
 * pas ; le délai prend fin à l'expiration de la dernière heure du quatorzième
 * jour, et il est prorogé jusqu'au premier jour ouvrable suivant s'il expire
 * un samedi, un dimanche ou un jour férié ou chômé.
 *
 * Choix prudents, tous en faveur de l'acheteur :
 * - les jours sont comptés à l'heure de Paris ;
 * - le délai n'expire jamais un samedi, même si le samedi est ouvrable : il
 *   passe au premier jour qui n'est ni un samedi, ni un dimanche, ni férié ;
 * - les jours fériés sont les onze de l'article L3133-1 du Code du travail,
 *   plus le Vendredi saint et le 26 décembre, fériés en Alsace-Moselle ;
 * - une déclaration n'est tenue pour tardive qu'une fois le dernier jour
 *   terminé partout sur Terre, c'est-à-dire à UTC−12 : des acheteurs vivent
 *   à d'autres fuseaux que Paris.
 */

/** Un jour du calendrier, sans heure ni fuseau. `mois` va de 1 à 12. */
export interface Jour {
  annee: number;
  mois: number;
  jour: number;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

const FORMAT_JOUR_PARIS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Le jour du calendrier, à Paris, d'un instant donné. */
export function jourAParis(instant: Date): Jour {
  const parties = FORMAT_JOUR_PARIS.formatToParts(instant);
  const partie = (type: Intl.DateTimeFormatPartTypes) => Number(parties.find((p) => p.type === type)!.value);
  return { annee: partie("year"), mois: partie("month"), jour: partie("day") };
}

function versMs(jour: Jour): number {
  return Date.UTC(jour.annee, jour.mois - 1, jour.jour);
}

function depuisMs(ms: number): Jour {
  const date = new Date(ms);
  return { annee: date.getUTCFullYear(), mois: date.getUTCMonth() + 1, jour: date.getUTCDate() };
}

export function ajouterJours(jour: Jour, nombre: number): Jour {
  return depuisMs(versMs(jour) + nombre * JOUR_MS);
}

/** « 2026-10-08 » : la forme des comparaisons et des tests. */
export function jourIso(jour: Jour): string {
  return `${String(jour.annee).padStart(4, "0")}-${String(jour.mois).padStart(2, "0")}-${String(jour.jour).padStart(2, "0")}`;
}

/** Dimanche de Pâques, calendrier grégorien (algorithme anonyme dit de Meeus, Jones et Butcher). */
export function paques(annee: number): Jour {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return { annee, mois: Math.floor(n / 31), jour: (n % 31) + 1 };
}

/** Les jours fériés retenus pour une année, sous la forme « AAAA-MM-JJ ». */
export function joursFeries(annee: number): Set<string> {
  const pa = paques(annee);
  const fixes: [number, number][] = [
    [1, 1], // jour de l'an
    [5, 1], // fête du Travail
    [5, 8], // victoire de 1945
    [7, 14], // fête nationale
    [8, 15], // Assomption
    [11, 1], // Toussaint
    [11, 11], // armistice de 1918
    [12, 25], // Noël
    [12, 26], // saint Étienne, férié en Alsace-Moselle : retenu par prudence
  ];
  const mobiles = [
    -2, // Vendredi saint, férié en Alsace-Moselle : retenu par prudence
    1, // lundi de Pâques
    39, // Ascension
    50, // lundi de Pentecôte
  ].map((ecart) => ajouterJours(pa, ecart));
  return new Set([
    ...fixes.map(([mois, jour]) => jourIso({ annee, mois, jour })),
    ...mobiles.map(jourIso),
  ]);
}

export function estFerie(jour: Jour): boolean {
  return joursFeries(jour.annee).has(jourIso(jour));
}

export function estSamediOuDimanche(jour: Jour): boolean {
  const semaine = new Date(versMs(jour)).getUTCDay();
  return semaine === 0 || semaine === 6;
}

/**
 * Le dernier jour du délai : le quatorzième jour qui suit celui du paiement
 * (heure de Paris), repoussé tant qu'il tombe un samedi, un dimanche ou un
 * jour férié.
 */
export function dernierJourDuDelai(payeLe: Date): Jour {
  let jour = ajouterJours(jourAParis(payeLe), 14);
  while (estSamediOuDimanche(jour) || estFerie(jour)) jour = ajouterJours(jour, 1);
  return jour;
}

/**
 * L'instant où le délai est dépassé partout sur Terre : minuit à la fin du
 * dernier jour, à UTC−12, soit midi UTC le lendemain.
 */
export function finDuDelai(payeLe: Date): Date {
  return new Date(versMs(ajouterJours(dernierJourDuDelai(payeLe), 1)) + 12 * 60 * 60 * 1000);
}

/** Une déclaration reçue à `recueLe` est-elle tardive ? */
export function delaiExpire(payeLe: Date, recueLe: Date): boolean {
  return recueLe.getTime() >= finDuDelai(payeLe).getTime();
}
