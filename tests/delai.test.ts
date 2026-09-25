import { describe, expect, it } from "vitest";
import {
  delaiExpire,
  dernierJourDuDelai,
  finDuDelai,
  jourAParis,
  jourIso,
  joursFeries,
  paques,
} from "@/vente/delai";
import { dateAParis, heureAParis, jourEnLettres } from "@/vente/dates";

/**
 * Le délai de rétractation : 14 jours après le jour du paiement (heure de
 * Paris), prorogé au premier jour qui n'est ni un samedi, ni un dimanche, ni
 * un jour férié ; une déclaration n'est tardive qu'une fois le dernier jour
 * fini partout sur Terre, à UTC−12. Les dates attendues sont écrites à la
 * main, calendrier à l'appui.
 */

function dernierJour(paiement: string): string {
  return jourIso(dernierJourDuDelai(new Date(paiement)));
}

describe("jours fériés", () => {
  it("calcule Pâques pour les années connues", () => {
    expect(jourIso(paques(2024))).toBe("2024-03-31");
    expect(jourIso(paques(2025))).toBe("2025-04-20");
    expect(jourIso(paques(2026))).toBe("2026-04-05");
    expect(jourIso(paques(2027))).toBe("2027-03-28");
    expect(jourIso(paques(2038))).toBe("2038-04-25");
  });

  it("retient les onze jours de l'article L3133-1 du Code du travail, plus le Vendredi saint et le 26 décembre", () => {
    expect([...joursFeries(2026)].sort()).toEqual([
      "2026-01-01",
      "2026-04-03", // Vendredi saint
      "2026-04-06", // lundi de Pâques
      "2026-05-01",
      "2026-05-08",
      "2026-05-14", // Ascension
      "2026-05-25", // lundi de Pentecôte
      "2026-07-14",
      "2026-08-15",
      "2026-11-01",
      "2026-11-11",
      "2026-12-25",
      "2026-12-26",
    ]);
  });
});

describe("dernier jour du délai", () => {
  it("ne compte pas le jour du paiement : payé un jeudi, le délai finit le jeudi deux semaines plus tard", () => {
    expect(dernierJour("2026-09-24T12:00:00.000Z")).toBe("2026-10-08");
  });

  it("compte les jours à Paris : payé à 0 h 30 à Paris, c'est déjà le lendemain", () => {
    // 22 h 30 UTC le 24 = 0 h 30 à Paris le 25 (heure d'été).
    expect(jourIso(jourAParis(new Date("2026-09-24T22:30:00.000Z")))).toBe("2026-09-25");
    expect(dernierJour("2026-09-24T22:30:00.000Z")).toBe("2026-10-09");
    // 21 h 59 UTC le 24 = 23 h 59 à Paris le 24.
    expect(dernierJour("2026-09-24T21:59:00.000Z")).toBe("2026-10-08");
  });

  it("repousse un délai qui finit un samedi au lundi", () => {
    expect(dernierJour("2026-09-26T10:00:00.000Z")).toBe("2026-10-12"); // samedi 10 octobre → lundi 12
  });

  it("repousse un délai qui finit un dimanche au lundi", () => {
    expect(dernierJour("2026-09-27T10:00:00.000Z")).toBe("2026-10-12"); // dimanche 11 octobre → lundi 12
  });

  it("repousse un délai qui finit un jour férié au lendemain ouvré", () => {
    expect(dernierJour("2026-10-28T10:00:00.000Z")).toBe("2026-11-12"); // mercredi 11 novembre → jeudi 12
  });

  it("enchaîne jour férié et week-end : Noël un vendredi, puis le 26, puis le dimanche", () => {
    expect(dernierJour("2026-12-11T10:00:00.000Z")).toBe("2026-12-28"); // vendredi 25 décembre → lundi 28
  });

  it("enchaîne Vendredi saint, week-end de Pâques et lundi de Pâques", () => {
    expect(dernierJour("2027-03-12T10:00:00.000Z")).toBe("2027-03-30"); // vendredi 26 mars 2027 → mardi 30
  });

  it("s'écrit en toutes lettres, à la française", () => {
    expect(jourEnLettres(dernierJourDuDelai(new Date("2026-09-24T12:00:00.000Z")))).toBe("8 octobre 2026");
    expect(jourEnLettres({ annee: 2026, mois: 11, jour: 1 })).toBe("1er novembre 2026");
    expect(dateAParis(new Date("2026-09-24T22:30:00.000Z"))).toBe("25 septembre 2026");
    expect(heureAParis(new Date("2026-09-24T07:05:00.000Z"))).toBe("9 h 05");
  });
});

describe("déclaration tardive", () => {
  const PAYE = new Date("2026-09-24T12:00:00.000Z"); // dernier jour : jeudi 8 octobre 2026

  it("n'est tardive qu'après la fin du dernier jour partout sur Terre, à UTC−12", () => {
    expect(finDuDelai(PAYE).toISOString()).toBe("2026-10-09T12:00:00.000Z");
  });

  it("tardive à Paris mais pas encore à UTC−12 : acceptée", () => {
    // 1 h du matin à Paris le 9 octobre : le 8 est fini à Paris, pas à UTC−12.
    expect(delaiExpire(PAYE, new Date("2026-10-08T23:00:00.000Z"))).toBe(false);
    expect(delaiExpire(PAYE, new Date("2026-10-09T11:59:59.999Z"))).toBe(false);
  });

  it("tardive partout : refusée", () => {
    expect(delaiExpire(PAYE, new Date("2026-10-09T12:00:00.000Z"))).toBe(true);
    expect(delaiExpire(PAYE, new Date("2026-10-20T08:00:00.000Z"))).toBe(true);
  });

  it("dans le délai : acceptée, dès le paiement", () => {
    expect(delaiExpire(PAYE, PAYE)).toBe(false);
    expect(delaiExpire(PAYE, new Date("2026-10-08T21:00:00.000Z"))).toBe(false);
  });
});
