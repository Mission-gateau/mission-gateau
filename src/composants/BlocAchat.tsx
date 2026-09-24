"use client";

import { useEffect, useState } from "react";
import { remplir } from "@/engine/texte";
import type { Configuration } from "@/engine/types";
import { SITE } from "@/contenu/site";
import { ACHAT, NOMS_PAYS } from "@/contenu/vente";
import { AUTRE_PAYS, PAYS_PAR_DEFAUT, paysAccepte, type CodePays } from "@/vente/pays";
import { allerVers } from "./navigation";
import { sauvegarder } from "./sauvegarde";

/** Ce que la page /creer transmet quand la vente est ouverte. */
export interface OffreEnVente {
  prix: string;
  tva: string;
}

const CLASSE_LIEN = "underline underline-offset-4 hover:text-accent";

const LIENS_LEGAUX = [
  { href: "/cgv", texte: SITE.lienCgv },
  { href: "/mentions-legales", texte: SITE.lienMentions },
  { href: "/confidentialite", texte: SITE.lienConfidentialite },
];

/**
 * Le bloc d'achat : il n'apparaît qu'une fois l'aperçu produit, et achète
 * exactement la configuration et la graine de cet aperçu. Toute modification
 * des réponses repasse par un nouvel aperçu, qui remplace ce bloc.
 *
 * Les deux cases sont distinctes, non cochées au départ, et toutes deux
 * obligatoires ; la route de commande les revérifie, avec le pays.
 */
export function BlocAchat({
  configuration,
  graine,
  brouillon,
  paysInitial,
  offre,
}: {
  configuration: Configuration;
  graine: string;
  /** Les réponses du formulaire, gardées le temps du paiement. */
  brouillon: unknown;
  paysInitial: string | null;
  offre: OffreEnVente;
}) {
  const [pays, setPays] = useState<string>(paysInitial || PAYS_PAR_DEFAUT);
  const [accordCgv, setAccordCgv] = useState(false);
  const [accordAcces, setAccordAcces] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const accepte = paysAccepte(pays);
  const bouton = remplir(ACHAT.bouton, { prix: offre.prix });

  // Revenu de Stripe par le bouton « retour » du navigateur, la page peut être
  // restituée telle qu'on l'a quittée, bouton compris : on le réactive.
  useEffect(() => {
    const reprendre = (evenement: PageTransitionEvent) => {
      if (evenement.persisted) setEnvoi(false);
    };
    window.addEventListener("pageshow", reprendre);
    return () => window.removeEventListener("pageshow", reprendre);
  }, []);

  const commander = async () => {
    const soucis: string[] = [];
    if (!accepte) soucis.push(ACHAT.paysRefuse);
    if (!accordCgv) soucis.push(ACHAT.erreurAccordCgv);
    if (!accordAcces) soucis.push(ACHAT.erreurAccordAcces);
    setErreurs(soucis);
    if (soucis.length > 0) return;

    setEnvoi(true);
    try {
      const reponse = await fetch("/api/commande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configuration, graine, pays, accordCgv, accordAccesImmediat: accordAcces }),
      });
      const corps = (await reponse.json().catch(() => null)) as { url?: unknown; erreur?: unknown } | null;
      const destination = reponse.ok && typeof corps?.url === "string" ? new URL(corps.url) : null;
      if (!destination || destination.protocol !== "https:") {
        setErreurs([typeof corps?.erreur === "string" ? corps.erreur : ACHAT.erreurReseau]);
        setEnvoi(false);
        return;
      }
      // Gardé pour l'aller-retour chez Stripe, et effacé une fois la commande payée.
      sauvegarder({ brouillon, configuration, graine, pays });
      allerVers(destination.toString());
    } catch {
      setErreurs([ACHAT.erreurReseau]);
      setEnvoi(false);
    }
  };

  return (
    <section aria-labelledby="titre-achat" className="mt-8 rounded-2xl border-2 border-accent bg-white p-6">
      <h2 id="titre-achat" className="font-titre text-2xl text-accent">
        {ACHAT.titre}
      </h2>
      <p className="mt-3 leading-relaxed">{ACHAT.intro}</p>

      <h3 className="mt-5 font-titre text-lg">{ACHAT.titreContenu}</h3>
      <ul className="mt-2 space-y-1.5 text-sm">
        {SITE.details.map((detail) => (
          <li key={detail} className="flex gap-2">
            <span aria-hidden className="text-accent">
              ✓
            </span>
            <span>{detail}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-5 grid gap-x-4 gap-y-2 rounded-xl bg-creme-fonce px-4 py-3 text-sm sm:grid-cols-[7rem_1fr]">
        <dt className="font-bold">{ACHAT.libelleFormat}</dt>
        <dd>{ACHAT.format}</dd>
        <dt className="font-bold">{ACHAT.libellePrix}</dt>
        <dd>
          <span className="font-bold">{offre.prix}</span> — {offre.tva}
        </dd>
        <dt className="font-bold">{ACHAT.libelleLivraison}</dt>
        <dd>{ACHAT.livraison}</dd>
      </dl>

      <form
        className="mt-6"
        noValidate
        onSubmit={(evenement) => {
          evenement.preventDefault();
          if (!envoi) void commander();
        }}
      >
        <label htmlFor="pays" className="block font-bold">
          {ACHAT.libellePays}
        </label>
        <select
          id="pays"
          value={pays}
          onChange={(evenement) => setPays(evenement.target.value)}
          aria-describedby={accepte ? undefined : "pays-refuse"}
          className="mt-2 w-full rounded-xl border-2 border-bordure bg-white px-4 py-3 text-base focus:border-accent"
        >
          {(Object.keys(NOMS_PAYS) as CodePays[]).map((code) => (
            <option key={code} value={code}>
              {NOMS_PAYS[code]}
            </option>
          ))}
          <option value={AUTRE_PAYS}>{ACHAT.autrePays}</option>
        </select>
        {accepte ? null : (
          <p id="pays-refuse" role="alert" className="mt-2 font-bold text-brique">
            {ACHAT.paysRefuse}
          </p>
        )}

        <div className="mt-5 space-y-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={accordCgv}
              onChange={(evenement) => setAccordCgv(evenement.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-[#0f4c5c]"
            />
            <span>
              {ACHAT.accordCgvAvant}
              <a href="/cgv" target="_blank" rel="noopener" className={CLASSE_LIEN}>
                {ACHAT.accordCgvLien}
                <span className="sr-only"> {ACHAT.nouvelOnglet}</span>
              </a>
              {ACHAT.accordCgvApres}
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={accordAcces}
              onChange={(evenement) => setAccordAcces(evenement.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-[#0f4c5c]"
            />
            <span>{ACHAT.accordAccesImmediat}</span>
          </label>
        </div>

        {erreurs.length > 0 ? (
          <div role="alert" className="mt-4 rounded-xl border-2 border-brique bg-white p-4">
            <ul className="list-disc pl-5 text-sm">
              {erreurs.map((erreur) => (
                <li key={erreur}>{erreur}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={envoi || !accepte}
          className="mt-6 rounded-full bg-accent px-7 py-3 font-bold text-white hover:bg-accent-clair disabled:opacity-60"
        >
          {envoi ? ACHAT.enCours : bouton}
        </button>
        <p aria-live="polite" className="sr-only">
          {envoi ? ACHAT.enCours : ""}
        </p>
      </form>

      <p className="mt-4 text-sm leading-relaxed text-encre-douce">{ACHAT.paiement}</p>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {LIENS_LEGAUX.map((lien) => (
          <li key={lien.href}>
            <a href={lien.href} target="_blank" rel="noopener" className={CLASSE_LIEN}>
              {lien.texte}
              <span className="sr-only"> {ACHAT.nouvelOnglet}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
