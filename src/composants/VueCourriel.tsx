import type { BlocCourriel, DocumentCourriel, MorceauCourriel } from "@/vente/courriels";

/**
 * Un e-mail affiché sur une page, bloc pour bloc : la page de rétractation
 * montre ainsi exactement le contenu de l'accusé de réception envoyé.
 */
function Morceaux({ morceaux }: { morceaux: MorceauCourriel[] }) {
  return (
    <>
      {morceaux.map((morceau, index) =>
        typeof morceau === "string" ? (
          <span key={index}>{morceau}</span>
        ) : (
          <a key={index} href={morceau.lien} className="underline underline-offset-4 hover:text-accent">
            {morceau.texte}
          </a>
        ),
      )}
    </>
  );
}

function Bloc({ bloc }: { bloc: BlocCourriel }) {
  switch (bloc.type) {
    case "titre":
      return <h3 className="mt-6 font-titre text-lg text-accent">{bloc.texte}</h3>;
    case "paragraphe":
      return (
        <p className="mt-2 leading-relaxed">
          <Morceaux morceaux={bloc.morceaux} />
        </p>
      );
    case "liste":
      return (
        <ul className="mt-2 list-disc space-y-1 pl-6 leading-relaxed">
          {bloc.elements.map((element, index) => (
            <li key={index}>
              <Morceaux morceaux={element} />
            </li>
          ))}
        </ul>
      );
    case "lignes":
      return (
        <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[11rem_1fr]">
          {bloc.lignes.map((ligne) => (
            <div key={ligne.libelle} className="contents">
              <dt className="font-bold">{ligne.libelle}</dt>
              <dd className="break-words">{ligne.valeur}</dd>
            </div>
          ))}
        </dl>
      );
    case "encadre":
      return (
        <div className="mt-2 rounded-xl border border-bordure bg-white p-4 text-sm leading-relaxed">
          {bloc.paragraphes.map((paragraphe, index) => (
            <p key={index} className={index > 0 ? "mt-1" : undefined}>
              {paragraphe}
            </p>
          ))}
        </div>
      );
  }
}

export function VueCourriel({ document }: { document: DocumentCourriel }) {
  return (
    <div className="mt-4 rounded-2xl border border-bordure bg-white p-5">
      <p className="text-sm font-bold text-encre-douce">{document.objet}</p>
      {document.blocs.map((bloc, index) => (
        <Bloc key={index} bloc={bloc} />
      ))}
    </div>
  );
}
