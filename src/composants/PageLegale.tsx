import { Fragment } from "react";
import Link from "next/link";
import type { Bloc, DocumentLegal, Morceau } from "@/contenu/legal";
import { EnTeteSite, PiedDeSite } from "./Chrome";

const CLASSE_LIEN = "underline underline-offset-4 hover:text-accent";

function Morceaux({ morceaux }: { morceaux: Morceau[] }) {
  return (
    <>
      {morceaux.map((morceau, index) => {
        if (typeof morceau === "string") return <Fragment key={index}>{morceau}</Fragment>;
        return morceau.lien.startsWith("/") ? (
          <Link key={index} href={morceau.lien} className={CLASSE_LIEN}>
            {morceau.texte}
          </Link>
        ) : (
          <a key={index} href={morceau.lien} rel="noreferrer noopener" className={CLASSE_LIEN}>
            {morceau.texte}
          </a>
        );
      })}
    </>
  );
}

function VueBloc({ bloc }: { bloc: Bloc }) {
  switch (bloc.type) {
    case "paragraphe":
      return (
        <p className="mt-3 leading-relaxed">
          <Morceaux morceaux={bloc.morceaux} />
        </p>
      );
    case "liste":
      return (
        <ul className="mt-3 list-disc space-y-1.5 pl-6 leading-relaxed">
          {bloc.elements.map((element, index) => (
            <li key={index}>
              <Morceaux morceaux={element} />
            </li>
          ))}
        </ul>
      );
    case "coordonnees":
      return (
        <dl className="mt-3 grid gap-x-4 gap-y-1 rounded-2xl border border-bordure bg-white p-5 text-sm sm:grid-cols-[9rem_1fr]">
          {bloc.lignes.map((ligne) => (
            <Fragment key={ligne.libelle}>
              <dt className="font-bold">{ligne.libelle}</dt>
              <dd className="mb-1 break-words sm:mb-0">
                <Morceaux morceaux={ligne.valeur} />
              </dd>
            </Fragment>
          ))}
        </dl>
      );
    case "encadre":
      return (
        <div
          data-encadre={bloc.id}
          className="mt-4 rounded-2xl border-2 border-accent bg-white p-5 text-sm leading-relaxed"
        >
          {bloc.paragraphes.map((paragraphe, index) => (
            <p key={index} className={index > 0 ? "mt-2" : undefined}>
              {paragraphe}
            </p>
          ))}
        </div>
      );
  }
}

/** Une page légale, datée, dans la présentation du reste du site. */
export function PageLegale({ document, venteOuverte }: { document: DocumentLegal; venteOuverte?: boolean }) {
  return (
    <>
      <EnTeteSite />
      <main id="contenu" className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <h1 className="font-titre text-3xl text-accent sm:text-4xl">{document.titre}</h1>
        <p className="mt-2 text-sm text-encre-douce">{document.date}</p>
        {document.sections.map((section) => (
          <section key={section.titre} className="mt-9">
            <h2 className="font-titre text-xl text-accent sm:text-2xl">{section.titre}</h2>
            {section.blocs.map((bloc, index) => (
              <VueBloc key={index} bloc={bloc} />
            ))}
          </section>
        ))}
      </main>
      <PiedDeSite venteOuverte={venteOuverte} />
    </>
  );
}
