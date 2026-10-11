import Image from "next/image";
import Link from "next/link";
import { cachette } from "@/engine/cachettes";
import { LIBELLES_THEMES } from "@/engine/configuration";
import { construireKit, toutesLesEnigmes } from "@/engine/kit";
import { remplir } from "@/engine/texte";
import type { Enigme, Kit } from "@/engine/types";
import { FORMULAIRE } from "@/contenu/formulaire";
import { GUIDE } from "@/contenu/guide";
import { TEXTES_GUIDES, type BlocGuide, type Guide } from "@/contenu/guides";
import { EXEMPLES_DES_GUIDES, type ExempleDeGuide } from "@/contenu/guides/exemples";
import { deroule } from "@/pdf/deroule";
import { EnTeteSite, PiedDeSite } from "./Chrome";

const CLASSE_TITRE_2 = "mt-10 font-titre text-2xl text-accent";
const CLASSE_CADRE = "mt-5 rounded-2xl border border-bordure bg-white p-5";

/** Une énigme précise du kit : la première de ce type. Le test des guides vérifie qu'elle existe. */
function enigmeDuType<T extends Enigme["type"]>(kit: Kit, type: T): Extract<Enigme, { type: T }> {
  const trouvee = toutesLesEnigmes(kit).find((enigme) => enigme.type === type);
  if (!trouvee) throw new Error(`Aucune énigme « ${type} » avec cette graine.`);
  return trouvee as Extract<Enigme, { type: T }>;
}

function Legende({ kit, graine }: { kit: Kit; graine: string }) {
  const { prenom, age, theme } = kit.configuration;
  return (
    <p className="mt-3 text-sm text-encre-douce">
      {remplir(TEXTES_GUIDES.legendeExemple, { prenom, age, theme: LIBELLES_THEMES[theme], graine })}
    </p>
  );
}

function Reponse({ texte }: { texte: string }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer font-bold">{TEXTES_GUIDES.exempleSolution}</summary>
      <p className="mt-1">{texte}</p>
    </details>
  );
}

/** L'exemple d'un guide, produit par le vrai moteur avec sa graine fixe, rendu en HTML. */
export function ExempleDuGuide({ exemple }: { exemple: ExempleDeGuide }) {
  const kits = exemple.configurations.map((configuration) => construireKit(configuration, exemple.graine));
  const kit = kits[0]!;
  let contenu: React.ReactNode;
  switch (exemple.genre) {
    case "chasse":
      contenu = (
        <>
          <h3 className="font-titre text-lg">{TEXTES_GUIDES.exempleDevinette}</h3>
          <p className="mt-2 italic leading-relaxed">« {kit.depart.type === "devinette" ? kit.depart.texte : ""} »</p>
          <Reponse texte={kit.depart.solution} />
          <h3 className="mt-5 font-titre text-lg">{TEXTES_GUIDES.exempleOrdre}</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-6">
            {kit.etapes.map((etape) => (
              <li key={etape.numero}>{cachette(etape.cachette).libelle}</li>
            ))}
          </ol>
        </>
      );
      break;
    case "pictogrammes": {
      const enigme = enigmeDuType(kit, "pictogrammes");
      contenu = (
        <>
          <h3 className="font-titre text-lg">{enigme.titre}</h3>
          <p className="mt-2 leading-relaxed">{enigme.consigne}</p>
          <p className="mt-4 text-sm font-bold">{TEXTES_GUIDES.exempleLegende}</p>
          <ul className="mt-2 flex flex-wrap gap-3">
            {enigme.legende.map(({ lettre, icone }) => (
              <li key={lettre} className="flex items-center gap-1.5 rounded-lg border border-bordure px-2 py-1">
                <Image src={`/icones/${icone}.png`} alt="" width={28} height={28} />
                <span className="font-bold">= {lettre}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm font-bold">{TEXTES_GUIDES.exempleMot}</p>
          <p className="mt-2 flex gap-2">
            {enigme.suite.map((icone, rang) => (
              <Image key={rang} src={`/icones/${icone}.png`} alt="" width={36} height={36} />
            ))}
          </p>
          <Reponse texte={enigme.solution} />
        </>
      );
      break;
    }
    case "cesar": {
      const enigme = enigmeDuType(kit, "cesar");
      contenu = (
        <>
          <h3 className="font-titre text-lg">{enigme.titre}</h3>
          <p className="mt-2 leading-relaxed">{enigme.consigne}</p>
          <p className="mt-4 text-sm font-bold">{TEXTES_GUIDES.exempleChiffre}</p>
          <p className="mt-1 font-mono text-2xl tracking-widest">{enigme.texteChiffre}</p>
          <p className="mt-2 text-sm">{remplir(TEXTES_GUIDES.exempleDecalage, { decalage: enigme.decalage })}</p>
          <Reponse texte={enigme.solution} />
        </>
      );
      break;
    }
    case "deroule":
      contenu = (
        <>
          <h3 className="font-titre text-lg">{TEXTES_GUIDES.exempleDeroule}</h3>
          <ol className="mt-3 space-y-2">
            {deroule(kit).map((moment) => (
              <li key={moment.titre} className="grid gap-x-3 sm:grid-cols-[6rem_1fr]">
                <span className="text-sm font-bold text-brique">
                  {remplir(TEXTES_GUIDES.exempleMinute, { debut: moment.debut })}
                  {moment.duree > 0 ? ` (${remplir(TEXTES_GUIDES.exempleDuree, { duree: moment.duree })})` : ""}
                </span>
                <span>
                  <strong>{moment.titre}</strong> — {moment.detail}
                </span>
              </li>
            ))}
          </ol>
        </>
      );
      break;
    case "devinettes_par_age":
      contenu = (
        <ul className="space-y-4">
          {kits.map((parAge) => (
            <li key={parAge.configuration.age}>
              <h3 className="font-titre text-lg">{remplir(TEXTES_GUIDES.exempleAge, { age: parAge.configuration.age })}</h3>
              <p className="mt-1 text-sm text-encre-douce">{parAge.depart.consigne}</p>
              <p className="mt-1 italic leading-relaxed">« {parAge.depart.type === "devinette" ? parAge.depart.texte : ""} »</p>
              <Reponse texte={parAge.depart.solution} />
            </li>
          ))}
        </ul>
      );
      break;
  }
  return (
    <figure className={CLASSE_CADRE} data-exemple={exemple.genre}>
      <p className="text-sm font-bold uppercase tracking-wide text-brique">{TEXTES_GUIDES.titreExemple}</p>
      <div className="mt-3">{contenu}</div>
      <figcaption>
        <Legende kit={kit} graine={exemple.graine} />
      </figcaption>
    </figure>
  );
}

/** Les consignes de sécurité des kits (guide de l'organisateur) et du formulaire, mot pour mot. */
function Securite() {
  const aideCachettes = FORMULAIRE.etapes.find((etape) => etape.cle === "cachettes")?.aide;
  return (
    <div className={CLASSE_CADRE} data-bloc="securite">
      <p className="font-bold">{TEXTES_GUIDES.introSecurite}</p>
      <ul className="mt-3 list-disc space-y-1.5 pl-6 leading-relaxed">
        {GUIDE.securite.map((consigne) => (
          <li key={consigne}>{consigne}</li>
        ))}
        {aideCachettes ? <li>{aideCachettes}</li> : null}
      </ul>
    </div>
  );
}

/** Le lien vers /creer et l'aperçu gratuit ; le prix seulement si la vente est ouverte. */
export function VersCreer({ prix }: { prix: string | null }) {
  return (
    <div className="mt-6 rounded-2xl border-2 border-accent bg-creme-fonce p-6" data-bloc="versCreer">
      <p className="font-titre text-xl text-accent">{TEXTES_GUIDES.titreCreer}</p>
      <p className="mt-2 leading-relaxed">{TEXTES_GUIDES.texteCreer}</p>
      {prix ? <p className="mt-2 text-sm">{remplir(TEXTES_GUIDES.prixCreer, { prix })}</p> : null}
      <Link
        href="/creer"
        className="mt-4 inline-block rounded-full bg-accent px-6 py-3 font-bold text-white transition-colors hover:bg-accent-clair"
      >
        {TEXTES_GUIDES.boutonCreer}
      </Link>
    </div>
  );
}

function VueBloc({ bloc, guide, prix }: { bloc: BlocGuide; guide: Guide; prix: string | null }) {
  switch (bloc.type) {
    case "paragraphe":
      return <p className="mt-3 leading-relaxed">{bloc.texte}</p>;
    case "liste":
      return (
        <ul className="mt-3 list-disc space-y-1.5 pl-6 leading-relaxed">
          {bloc.elements.map((element) => (
            <li key={element}>{element}</li>
          ))}
        </ul>
      );
    case "etapes":
      return (
        <ol className="mt-3 list-decimal space-y-1.5 pl-6 leading-relaxed">
          {bloc.elements.map((element) => (
            <li key={element}>{element}</li>
          ))}
        </ol>
      );
    case "exemple": {
      const exemple = EXEMPLES_DES_GUIDES[guide.adresse];
      return exemple ? <ExempleDuGuide exemple={exemple} /> : null;
    }
    case "securite":
      return <Securite />;
    case "versCreer":
      return <VersCreer prix={prix} />;
  }
}

/** La page d'un guide. `prix` n'est donné que si la vente est ouverte. */
export function PageGuide({ guide, prix, modifieLe }: { guide: Guide; prix: string | null; modifieLe: string }) {
  return (
    <>
      <EnTeteSite />
      <main id="contenu" className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
        <p className="text-sm">
          <Link href="/guides" className="underline underline-offset-4 hover:text-accent">
            {TEXTES_GUIDES.retour}
          </Link>
        </p>
        <article>
          <h1 className="mt-3 font-titre text-3xl text-accent sm:text-4xl">{guide.titre}</h1>
          <p className="mt-2 text-sm text-encre-douce">{remplir(TEXTES_GUIDES.modifieLe, { date: modifieLe })}</p>
          <p className="mt-5 text-lg leading-relaxed">{guide.chapeau}</p>
          {guide.sections.map((section) => (
            <section key={section.titre}>
              <h2 className={CLASSE_TITRE_2}>{section.titre}</h2>
              {section.blocs.map((bloc, rang) => (
                <VueBloc key={rang} bloc={bloc} guide={guide} prix={prix} />
              ))}
            </section>
          ))}
        </article>
      </main>
      <PiedDeSite />
    </>
  );
}
