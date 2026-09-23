import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/contenu/site";

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

export function PiedDeSite() {
  return (
    <footer className="mt-16 border-t border-bordure bg-creme-fonce">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-8 text-sm text-encre-douce sm:flex-row sm:items-center sm:justify-between">
        <p>{SITE.piedDePage}</p>
        <Link href="/credits" className="underline underline-offset-4 hover:text-accent">
          {SITE.lienCredits}
        </Link>
      </div>
    </footer>
  );
}
