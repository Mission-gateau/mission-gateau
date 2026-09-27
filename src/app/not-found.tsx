import Link from "next/link";
import { EnTeteSite, PiedDeSite } from "@/composants/Chrome";
import { SITE } from "@/contenu/site";

/**
 * La page 404 du site entier, en français, avec l'en-tête et le pied de page
 * du site : le lien « Renoncer au contrat ici » y figure comme partout.
 */
export default function PageIntrouvable() {
  return (
    <>
      <EnTeteSite />
      <main id="contenu" className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
        <h1 className="font-titre text-3xl text-accent sm:text-4xl">{SITE.introuvable.titre}</h1>
        <p className="mt-4 leading-relaxed">{SITE.introuvable.texte}</p>
        <p className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="inline-block rounded-full bg-accent px-6 py-3 font-bold text-white hover:bg-accent-clair">
            {SITE.introuvable.accueil}
          </Link>
          <Link
            href="/creer"
            className="inline-block rounded-full border-2 border-accent px-6 py-3 font-bold text-accent hover:bg-creme-fonce"
          >
            {SITE.boutonPrincipal}
          </Link>
        </p>
      </main>
      <PiedDeSite />
    </>
  );
}
