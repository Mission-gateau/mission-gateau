import Image from "next/image";
import Link from "next/link";
import { remplir } from "@/engine/texte";
import { COMMANDE } from "@/contenu/vente";
import type { NomEtat } from "@/vente/commande";
import { texteDeLEtat, type EtatSansLivraison } from "@/vente/etats";
import { OublierSauvegarde, Telechargement } from "./Telechargement";

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/**
 * La page d'une commande, un message par cas. Elle ne reçoit que le nom de
 * l'état et la date d'expiration : jamais la configuration déchiffrée, qui ne
 * doit pas quitter le serveur.
 */
export function VueCommande({
  etat,
  expireLe,
  reference,
  sessionId,
  email,
}: {
  etat: NomEtat;
  expireLe: Date | null;
  /** Null si l'adresse ne porte pas une référence valable : elle n'est alors pas recopiée. */
  reference: string | null;
  sessionId: string | null;
  email: string;
}) {
  const serviceClient = remplir(COMMANDE.serviceClient, { email });

  return (
    <section>
      <p className="text-sm font-bold uppercase tracking-wide text-brique">{COMMANDE.titrePage}</p>
      {etat === "payee" && reference ? (
        <>
          <OublierSauvegarde />
          <div className="mt-3 flex items-center gap-3">
            <Image src="/icones/cadeau.png" alt="" width={40} height={40} aria-hidden />
            <h1 className="font-titre text-3xl text-accent sm:text-4xl">{COMMANDE.payee.titre}</h1>
          </div>
          <p className="mt-4 leading-relaxed">{COMMANDE.payee.texte}</p>
          <Telechargement reference={reference} sessionId={sessionId} />
          <ul className="mt-8 space-y-2 text-sm leading-relaxed">
            {expireLe ? <li>{remplir(COMMANDE.payee.validite, { date: DATE_LONGUE.format(expireLe) })}</li> : null}
            <li>{COMMANDE.payee.email}</li>
            <li>{serviceClient}</li>
          </ul>
        </>
      ) : (
        <EtatSansJeu etat={etat === "payee" ? "introuvable" : etat} serviceClient={serviceClient} />
      )}
      {reference ? (
        <dl className="mt-8 rounded-xl bg-creme-fonce px-4 py-3 text-sm">
          <dt className="font-bold">{COMMANDE.reference}</dt>
          <dd className="mt-1 break-all font-mono">{reference}</dd>
        </dl>
      ) : null}
    </section>
  );
}

function EtatSansJeu({ etat, serviceClient }: { etat: EtatSansLivraison; serviceClient: string }) {
  const { titre, texte } = texteDeLEtat(etat);
  return (
    <>
      <h1 className="mt-3 font-titre text-3xl text-accent sm:text-4xl">{titre}</h1>
      <p className="mt-4 leading-relaxed">{texte}</p>
      {etat === "non_aboutie" ? (
        <p className="mt-6">
          <Link
            href="/creer"
            className="inline-block rounded-full bg-accent px-6 py-3 font-bold text-white hover:bg-accent-clair"
          >
            {COMMANDE.retourCreer}
          </Link>
        </p>
      ) : null}
      <p className="mt-6 text-sm leading-relaxed">{serviceClient}</p>
    </>
  );
}
