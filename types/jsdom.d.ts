/**
 * jsdom n'expose pas de types. Seule la petite part que les tests emploient
 * est déclarée ici : son analyseur XML relit les flux RSS des épingles
 * (tests/epingles.test.ts). jsdom ne sert qu'en développement.
 */
declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string);
    readonly window: { DOMParser: typeof DOMParser };
  }
}
