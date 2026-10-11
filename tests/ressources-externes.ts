/**
 * Les ressources qu'une page ferait charger depuis un autre domaine : images,
 * scripts, feuilles de style, cadres, polices, sources de médias. Les
 * ressources du site sont toutes servies par lui-même, en chemins relatifs ;
 * une adresse absolue (http, https ou //) dans un attribut qui charge
 * quelque chose est donc une ressource externe. Les liens ordinaires (<a>)
 * et l'adresse canonique ne chargent rien.
 */
export function ressourcesExternes(html: string): string[] {
  const trouvees: string[] = [];
  const absolue = /^(?:https?:)?\/\//i;
  for (const balise of html.match(/<(img|script|iframe|source|video|audio|embed|object|link|image|use)\b[^>]*>/gi) ?? []) {
    const nom = /^<(\w+)/.exec(balise)![1]!.toLowerCase();
    if (nom === "link" && /\brel="(canonical|alternate)"/i.test(balise)) continue;
    for (const attribut of balise.matchAll(/\b(src|href|srcset|data|poster|xlink:href)="([^"]*)"/gi)) {
      const valeurs = attribut[1]!.toLowerCase() === "srcset" ? attribut[2]!.split(",").map((v) => v.trim().split(/\s+/)[0]!) : [attribut[2]!];
      for (const valeur of valeurs) if (absolue.test(valeur.replace(/&amp;/g, "&"))) trouvees.push(`${nom} ${valeur}`);
    }
  }
  for (const style of html.matchAll(/url\(\s*['"]?([^'")]+)/gi)) {
    if (absolue.test(style[1]!)) trouvees.push(`url(${style[1]})`);
  }
  return trouvees;
}
