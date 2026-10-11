import type { Metadata } from "next";
import Link from "next/link";
import { EnTeteSite, PiedDeSite } from "@/composants/Chrome";
import { VersCreer } from "@/composants/Guide";
import { GUIDES, TEXTES_GUIDES } from "@/contenu/guides";
import { metadonneesDePage } from "@/site/referencement";
import { venteOuverteMaintenant } from "@/vente/ouverture";
import { PRIX_AFFICHE } from "@/vente/prix";

/** Titre, description, adresse canonique, Open Graph ; visible des moteurs en production seulement. */
export function generateMetadata(): Metadata {
  return metadonneesDePage("/guides");
}

/** La liste des guides. */
export default function Guides() {
  const prix = venteOuverteMaintenant() ? PRIX_AFFICHE : null;
  return (
    <>
      <EnTeteSite />
      <main id="contenu" className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <h1 className="font-titre text-3xl text-accent sm:text-4xl">{TEXTES_GUIDES.titre}</h1>
        <p className="mt-4 leading-relaxed">{TEXTES_GUIDES.intro}</p>
        <ul className="mt-8 space-y-4">
          {GUIDES.map((guide) => (
            <li key={guide.adresse} className="rounded-2xl border border-bordure bg-white p-5">
              <h2 className="font-titre text-xl text-accent">
                <Link href={`/guides/${guide.adresse}`} className="hover:underline">
                  {guide.titre}
                </Link>
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-encre-douce">{guide.description}</p>
              <p className="mt-3 text-sm">
                <Link href={`/guides/${guide.adresse}`} className="font-bold underline underline-offset-4 hover:text-accent">
                  {TEXTES_GUIDES.lireLeGuide}
                </Link>
              </p>
            </li>
          ))}
        </ul>
        <VersCreer prix={prix} />
      </main>
      <PiedDeSite />
    </>
  );
}
