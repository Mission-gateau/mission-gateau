import Image from "next/image";
import Link from "next/link";
import { ApercusDuKit } from "@/composants/Apercus";
import { EnTeteSite, PiedDeSite } from "@/composants/Chrome";
import { SITE } from "@/contenu/site";
import { LISTE_THEMES } from "@/contenu/themes";

function Section({
  titre,
  children,
  id,
}: {
  titre: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
      <h2 className="font-titre text-2xl text-accent sm:text-3xl">{titre}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function Accueil() {
  return (
    <>
      <EnTeteSite />
      <main id="contenu" className="flex-1">
        <div className="bg-creme-fonce">
          <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 sm:py-20 md:grid-cols-[1.1fr_1fr] md:items-center">
            <div>
              <h1 className="font-titre text-3xl leading-tight text-accent sm:text-5xl">
                {SITE.promesse}
              </h1>
              <p className="mt-5 max-w-prose text-base leading-relaxed sm:text-lg">{SITE.sousTitre}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/creer"
                  className="rounded-full bg-accent px-6 py-3 text-base font-bold text-white transition-colors hover:bg-accent-clair"
                >
                  {SITE.boutonPrincipal}
                </Link>
                <a
                  href="#etapes"
                  className="rounded-full border-2 border-accent px-6 py-3 text-base font-bold text-accent transition-colors hover:bg-white"
                >
                  {SITE.boutonSecondaire}
                </a>
              </div>
            </div>
            <div className="flex justify-center gap-4 sm:gap-7" aria-hidden>
              {["carte_tresor", "loupe", "dinosaure"].map((cle, i) => (
                <div
                  key={cle}
                  className="rounded-2xl border border-bordure bg-white p-4 shadow-sm sm:p-6"
                  style={{ transform: `rotate(${(i - 1) * 5}deg)` }}
                >
                  <Image src={`/icones/${cle}.png`} alt="" width={56} height={56} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <Section titre={SITE.titreEtapes} id="etapes">
          <ol className="grid gap-5 sm:grid-cols-3">
            {SITE.etapes.map((etape, i) => (
              <li key={etape.titre} className="rounded-2xl border border-bordure bg-white p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-titre text-lg text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-titre text-lg">{etape.titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-encre-douce">{etape.texte}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section titre={SITE.titreFormats}>
          <div className="grid gap-5 sm:grid-cols-3">
            {SITE.formats.map((format) => (
              <article key={format.cle} className="flex flex-col rounded-2xl border border-bordure bg-white p-5">
                <p className="text-sm font-bold uppercase tracking-wide text-brique">{format.age}</p>
                <h3 className="mt-1 font-titre text-xl text-accent">{format.titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-encre-douce">{format.texte}</p>
                <ul className="mt-4 space-y-1.5 text-sm">
                  {format.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span aria-hidden className="text-accent">
                        ▸
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Section>

        <Section titre={SITE.titreThemes}>
          <div className="grid gap-5 sm:grid-cols-3">
            {LISTE_THEMES.map((theme) => (
              <article key={theme.id} className="rounded-2xl border border-bordure bg-white p-5">
                <div className="flex gap-2" aria-hidden>
                  {theme.icones.slice(0, 4).map((cle) => (
                    <Image key={cle} src={`/icones/${cle}.png`} alt="" width={26} height={26} />
                  ))}
                </div>
                <h3 className="mt-3 font-titre text-xl text-accent">{theme.nom}</h3>
                <p className="mt-2 text-sm leading-relaxed text-encre-douce">{theme.accroche}</p>
              </article>
            ))}
          </div>
        </Section>

        <Section titre={SITE.titreExemple}>
          <p className="mb-6 max-w-prose text-sm leading-relaxed text-encre-douce">{SITE.exempleTexte}</p>
          <ApercusDuKit />
        </Section>

        <Section titre={SITE.titreDetails}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {SITE.details.map((detail) => (
              <li key={detail} className="flex gap-3 rounded-xl border border-bordure bg-white p-4 text-sm">
                <span aria-hidden className="text-accent">
                  ✓
                </span>
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </Section>

        <div className="mx-auto grid max-w-5xl gap-5 px-5 pb-6 sm:grid-cols-2">
          <section className="rounded-2xl border border-bordure bg-creme-fonce p-6">
            <h2 className="font-titre text-xl text-accent">{SITE.titreSecurite}</h2>
            <p className="mt-3 text-sm leading-relaxed">{SITE.securiteTexte}</p>
          </section>
          <section className="rounded-2xl border border-bordure bg-creme-fonce p-6">
            <h2 className="font-titre text-xl text-accent">{SITE.titreDonnees}</h2>
            <p className="mt-3 text-sm leading-relaxed">{SITE.donneesTexte}</p>
          </section>
        </div>

        <div className="mx-auto max-w-5xl px-5 py-10 text-center">
          <Link
            href="/creer"
            className="inline-block rounded-full bg-accent px-8 py-4 text-lg font-bold text-white transition-colors hover:bg-accent-clair"
          >
            {SITE.boutonPrincipal}
          </Link>
        </div>
      </main>
      <PiedDeSite />
    </>
  );
}
