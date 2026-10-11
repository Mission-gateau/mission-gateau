import Image from "next/image";
import Link from "next/link";
import { remplir } from "@/engine/texte";
import { SITE } from "@/contenu/site";
import { VENDEUR } from "@/contenu/vendeur";
import { denomination } from "@/vente/fiche";
import { venteOuverteMaintenant } from "@/vente/ouverture";

export function EnTeteSite() {
  return (
    <header className="border-b border-bordure bg-creme">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex items-center gap-2.5 font-titre text-lg text-accent">
          <Image src="/icones/gateau.png" alt="" width={28} height={28} aria-hidden />
          {SITE.nom}
        </Link>
        <nav aria-label="Navigation principale">
          <Link
            href="/creer"
            className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-clair"
          >
            {SITE.boutonPrincipal}
          </Link>
        </nav>
      </div>
    </header>
  );
}

/**
 * Les liens légaux du pied de page. « Renoncer au contrat ici » y figure à
 * côté des autres, aussi visible qu'eux, sur toutes les pages : c'est la
 * fonction de rétractation (articles L221-21 et D221-5 du Code de la
 * consommation).
 */
const LIENS_LEGAUX = [
  { href: "/mentions-legales", texte: SITE.lienMentions },
  { href: "/cgv", texte: SITE.lienCgv },
  { href: "/confidentialite", texte: SITE.lienConfidentialite },
  { href: "/renoncer", texte: SITE.lienRenoncer },
  { href: "/credits", texte: SITE.lienCredits },
];

/**
 * Pied de page de toutes les pages. Tant que la vente est fermée, il
 * l'annonce ; ensuite, il nomme l'éditeur, lu dans la fiche du vendeur.
 * L'état de la vente est lu à chaque requête (toutes les pages sont
 * dynamiques) ; `venteOuverte` ne sert qu'aux tests.
 */
export function PiedDeSite({ venteOuverte }: { venteOuverte?: boolean } = {}) {
  const ouverte = venteOuverte ?? venteOuverteMaintenant();
  return (
    <footer className="mt-16 border-t border-bordure bg-creme-fonce">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-sm text-encre-douce sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p>
            {ouverte
              ? remplir(SITE.piedDePageOuvert, { nomCommercial: VENDEUR.nomCommercial, vendeur: denomination(VENDEUR) })
              : SITE.piedDePage}
          </p>
          <nav aria-label={SITE.navigationGuides} className="mt-2">
            <Link href="/guides" className="underline underline-offset-4 hover:text-accent">
              {SITE.lienGuides}
            </Link>
          </nav>
        </div>
        <nav aria-label={SITE.navigationLegale}>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LIENS_LEGAUX.map((lien) => (
              <li key={lien.href}>
                <Link href={lien.href} className="underline underline-offset-4 hover:text-accent">
                  {lien.texte}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
