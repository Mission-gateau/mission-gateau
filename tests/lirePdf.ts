import { inflateSync } from "node:zlib";

/**
 * Petit lecteur de PDF, pour les tests.
 *
 * Il relit le fichier réellement produit et rend le texte de chaque page.
 * C'est le seul moyen de vérifier ce qui est imprimé : un contrôle fait sur
 * l'arbre React passerait au vert même si le moteur de rendu laissait
 * tomber un élément en silence, ce qui est arrivé une fois au pied de page.
 *
 * Le lecteur ne couvre que ce que @react-pdf/renderer produit : des polices
 * TrueType sous-ensemblées, adressées par identifiant de glyphe, avec une
 * table ToUnicode pour revenir aux caractères.
 */

interface ObjetPdf {
  numero: number;
  dictionnaire: string;
  flux: Buffer | null;
}

/**
 * Découpe le fichier en objets.
 *
 * Le balayage est séquentiel et saute par-dessus le contenu des flux : une
 * police ou une image contient à peu près n'importe quelle suite d'octets, y
 * compris « 12 0 obj », et une recherche naïve inventerait des objets.
 */
function decouperObjets(pdf: Buffer): Map<number, ObjetPdf> {
  const texte = pdf.toString("latin1");
  const objets = new Map<number, ObjetPdf>();
  const entete = /(\d+) 0 obj/g;
  let position = 0;

  while (position < texte.length) {
    entete.lastIndex = position;
    const trouve = entete.exec(texte);
    if (!trouve) break;

    const numero = Number(trouve[1]);
    const apresEntete = trouve.index + trouve[0].length;
    const marqueurFlux = texte.indexOf("stream", apresEntete);
    const finSansFlux = texte.indexOf("endobj", apresEntete);
    if (finSansFlux === -1) break;

    const avecFlux = marqueurFlux !== -1 && marqueurFlux < finSansFlux;
    const dictionnaire = texte.slice(apresEntete, avecFlux ? marqueurFlux : finSansFlux);
    let flux: Buffer | null = null;
    let suite = finSansFlux + "endobj".length;

    if (avecFlux) {
      const longueur = /\/Length (\d+)/.exec(dictionnaire);
      let debut = marqueurFlux + "stream".length;
      if (texte[debut] === "\r") debut += 1;
      if (texte[debut] === "\n") debut += 1;
      const fin = longueur ? debut + Number(longueur[1]) : texte.indexOf("endstream", debut);
      let donnees = pdf.subarray(debut, fin);
      if (/\/FlateDecode/.test(dictionnaire)) {
        try {
          donnees = inflateSync(donnees);
        } catch {
          donnees = Buffer.alloc(0);
        }
      }
      flux = donnees;
      const finObjet = texte.indexOf("endobj", fin);
      suite = finObjet === -1 ? texte.length : finObjet + "endobj".length;
    }

    objets.set(numero, { numero, dictionnaire, flux });
    position = suite;
  }
  return objets;
}

/** Lit une table ToUnicode : code de glyphe → caractère. */
function lireToUnicode(flux: Buffer): Map<number, string> {
  const table = new Map<number, string>();
  const texte = flux.toString("latin1");
  // Une destination peut valoir plusieurs caractères : la ligature « fi »
  // s'écrit <0066 0069>, espace comprise.
  const versTexte = (hex: string) => {
    const propre = hex.replace(/\s+/g, "");
    let resultat = "";
    for (let i = 0; i + 3 < propre.length; i += 4) {
      resultat += String.fromCharCode(Number.parseInt(propre.slice(i, i + 4), 16));
    }
    return resultat;
  };

  for (const bloc of texte.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const paire of bloc[1]!.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F\s]+)>/g)) {
      table.set(Number.parseInt(paire[1]!, 16), versTexte(paire[2]!));
    }
  }
  // Une plage s'écrit de deux façons : soit « début fin premier », soit
  // « début fin [ une destination par code ] ». @react-pdf emploie la seconde.
  for (const bloc of texte.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const plages = bloc[1]!.matchAll(
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:\[([\s\S]*?)\]|<([0-9a-fA-F]+)>)/g,
    );
    for (const plage of plages) {
      const debut = Number.parseInt(plage[1]!, 16);
      const fin = Number.parseInt(plage[2]!, 16);
      if (plage[3] !== undefined) {
        const destinations = [...plage[3].matchAll(/<([0-9a-fA-F\s]*)>/g)].map((m) => m[1]!);
        destinations.forEach((hex, i) => {
          if (debut + i <= fin) table.set(debut + i, versTexte(hex));
        });
      } else {
        const premier = Number.parseInt(plage[4]!, 16);
        for (let i = 0; debut + i <= fin; i += 1) {
          table.set(debut + i, String.fromCharCode(premier + i));
        }
      }
    }
  }
  return table;
}

/** Toutes les tables ToUnicode du document, par numéro d'objet de police. */
function tablesDuDocument(objets: Map<number, ObjetPdf>): Map<string, Map<number, string>> {
  const tables = new Map<string, Map<number, string>>();
  for (const objet of objets.values()) {
    if (!objet.flux) continue;
    const apercu = objet.flux.subarray(0, 400).toString("latin1");
    if (!apercu.includes("beginbfchar") && !apercu.includes("beginbfrange")) continue;
    tables.set(String(objet.numero), lireToUnicode(objet.flux));
  }
  return tables;
}

/** Associe le nom de ressource (/F1) à sa table ToUnicode, pour une page. */
function policesDeLaPage(
  ressources: string,
  objets: Map<number, ObjetPdf>,
  tables: Map<string, Map<number, string>>,
): Map<string, Map<number, string>> {
  const resultat = new Map<string, Map<number, string>>();
  for (const entree of ressources.matchAll(/\/(F\d+) (\d+) 0 R/g)) {
    const police = objets.get(Number(entree[2]));
    if (!police) continue;
    const versUnicode = /\/ToUnicode (\d+) 0 R/.exec(police.dictionnaire);
    if (!versUnicode) continue;
    const table = tables.get(versUnicode[1]!);
    if (table) resultat.set(entree[1]!, table);
  }
  return resultat;
}

/** Décode un flux de contenu en texte lisible. */
function decoderContenu(contenu: string, polices: Map<string, Map<number, string>>): string {
  let police: Map<number, string> | undefined;
  let resultat = "";
  const jetons = contenu.matchAll(/\/(F\d+) [\d.]+ Tf|\[([^\]]*)\]\s*TJ|<([0-9a-fA-F\s]*)>\s*Tj|\bTd\b|\bTm\b|\bET\b/g);

  for (const jeton of jetons) {
    if (jeton[1]) {
      police = polices.get(jeton[1]);
      continue;
    }
    const groupes = jeton[2] ?? jeton[3];
    if (groupes === undefined) {
      resultat += " ";
      continue;
    }
    for (const chaine of groupes.matchAll(/<([0-9a-fA-F\s]*)>/g)) {
      const hex = chaine[1]!.replace(/\s+/g, "");
      for (let i = 0; i + 3 < hex.length; i += 4) {
        const code = Number.parseInt(hex.slice(i, i + 4), 16);
        resultat += police?.get(code) ?? "";
      }
    }
  }
  return resultat;
}

/** Le texte de chaque page du PDF, dans l'ordre. */
export function textesDesPages(pdf: Buffer): string[] {
  const objets = decouperObjets(pdf);
  const tables = tablesDuDocument(objets);
  const pages: string[] = [];

  for (const objet of objets.values()) {
    if (!/\/Type\s*\/Page\b/.test(objet.dictionnaire)) continue;
    const contenus = /\/Contents (\d+) 0 R/.exec(objet.dictionnaire);
    if (!contenus) continue;
    const flux = objets.get(Number(contenus[1]))?.flux;
    if (!flux) continue;
    // Les ressources sont presque toujours un renvoi vers un autre objet.
    const renvoiRessources = /\/Resources (\d+) 0 R/.exec(objet.dictionnaire);
    const ressources = renvoiRessources
      ? (objets.get(Number(renvoiRessources[1]))?.dictionnaire ?? "")
      : objet.dictionnaire;
    const polices = policesDeLaPage(ressources, objets, tables);
    pages.push(decoderContenu(flux.toString("latin1"), polices).replace(/\s+/g, " ").trim());
  }
  return pages;
}

/** Tout le texte du PDF, pages confondues. */
export function texteDuPdf(pdf: Buffer): string {
  return textesDesPages(pdf).join("\n");
}
