import type { Metadata } from "next";
import { EnTeteSite, PiedDeSite } from "@/composants/Chrome";
import { Formulaire } from "@/composants/Formulaire";
import { FORMULAIRE } from "@/contenu/formulaire";

export const metadata: Metadata = {
  title: "Créer mon jeu",
  description: "Composez votre jeu d'anniversaire en six questions et voyez aussitôt un aperçu gratuit.",
  robots: { index: false, follow: false },
};

export default function Creer() {
  return (
    <>
      <EnTeteSite />
      <main id="contenu" className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:py-12">
        <h1 className="font-titre text-3xl text-accent sm:text-4xl">{FORMULAIRE.titre}</h1>
        <p className="mt-3 leading-relaxed text-encre-douce">{FORMULAIRE.intro}</p>
        <div className="mt-8">
          <Formulaire />
        </div>
      </main>
      <PiedDeSite />
    </>
  );
}
