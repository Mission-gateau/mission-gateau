import type { Jour } from "./delai";

/**
 * Dates et heures telles que le site les écrit : en français, à l'heure de
 * Paris. « 1er octobre 2026 », « 14 h 05 ». Les espaces autour du « h » sont
 * insécables : une heure ne se coupe jamais en fin de ligne.
 */

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const PARTIES_PARIS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partiesAParis(instant: Date): { annee: number; mois: number; jour: number; heure: number; minute: number } {
  const parties = PARTIES_PARIS.formatToParts(instant);
  const partie = (type: Intl.DateTimeFormatPartTypes) => Number(parties.find((p) => p.type === type)!.value);
  return { annee: partie("year"), mois: partie("month"), jour: partie("day"), heure: partie("hour"), minute: partie("minute") };
}

/** « 12 octobre 2026 », « 1er novembre 2026 » : un jour du calendrier. */
export function jourEnLettres(jour: Jour): string {
  return `${jour.jour === 1 ? "1er" : jour.jour} ${MOIS[jour.mois - 1]} ${jour.annee}`;
}

/** La date d'un instant, à Paris. */
export function dateAParis(instant: Date): string {
  const { annee, mois, jour } = partiesAParis(instant);
  return jourEnLettres({ annee, mois, jour });
}

/** L'heure d'un instant, à Paris : « 14 h 05 ». */
export function heureAParis(instant: Date): string {
  const { heure, minute } = partiesAParis(instant);
  return `${heure} h ${String(minute).padStart(2, "0")}`;
}
