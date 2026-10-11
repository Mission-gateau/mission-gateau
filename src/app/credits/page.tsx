import type { Metadata } from "next";
import { metadonneesDePage } from "@/site/referencement";
import { EnTeteSite, PiedDeSite } from "@/composants/Chrome";
import { CREDITS } from "@/contenu/site";

/** Titre, description, adresse canonique, Open Graph ; visible des moteurs en production seulement. */
export function generateMetadata(): Metadata {
  return metadonneesDePage("/credits");
}

export default function Credits() {
  return (
    <>
      <EnTeteSite />
      <main id="contenu" className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <h1 className="font-titre text-3xl text-accent sm:text-4xl">{CREDITS.titre}</h1>
        <p className="mt-4 leading-relaxed">{CREDITS.intro}</p>

        <h2 className="mt-10 font-titre text-2xl text-accent">{CREDITS.titreRessources}</h2>
        <ul className="mt-4 space-y-4">
          {CREDITS.ressources.map((ressource) => (
            <li key={ressource.nom} className="rounded-2xl border border-bordure bg-white p-5">
              <h3 className="font-titre text-lg">{ressource.nom}</h3>
              <p className="mt-1 text-sm text-encre-douce">{ressource.usage}</p>
              <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-[7rem_1fr]">
                <dt className="font-bold">Licence</dt>
                <dd>
                  <a
                    className="underline underline-offset-4 hover:text-accent"
                    href={ressource.lienLicence}
                    rel="noreferrer noopener"
                  >
                    {ressource.licence}
                  </a>
                </dd>
                <dt className="font-bold">Crédit</dt>
                <dd>{ressource.credit}</dd>
                <dt className="font-bold">Source</dt>
                <dd className="break-words">
                  <a
                    className="underline underline-offset-4 hover:text-accent"
                    href={ressource.lien}
                    rel="noreferrer noopener"
                  >
                    {ressource.lien}
                  </a>
                </dd>
              </dl>
            </li>
          ))}
        </ul>

        <h2 className="mt-10 font-titre text-2xl text-accent">{CREDITS.titreRegles}</h2>
        <ul className="mt-4 space-y-2">
          {CREDITS.regles.map((regle) => (
            <li key={regle} className="flex gap-3 text-sm leading-relaxed">
              <span aria-hidden className="text-accent">
                ▸
              </span>
              <span>{regle}</span>
            </li>
          ))}
        </ul>

        <h2 className="mt-10 font-titre text-2xl text-accent">{CREDITS.titreTextes}</h2>
        <p className="mt-3 leading-relaxed">{CREDITS.textesTexte}</p>
      </main>
      <PiedDeSite />
    </>
  );
}
