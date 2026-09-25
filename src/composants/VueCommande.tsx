import Image from "next/image";
import Link from "next/link";
import { remplir } from "@/engine/texte";
import { COMMANDE } from "@/contenu/vente";
import { texteDeLEtat, type Refus } from "@/vente/etats";
import type { SituationCommande } from "@/vente/situation";
import { Confirmation } from "./Confirmation";
import { OublierSauvegarde, Telechargement } from "./Telechargement";

const CLASSE_LIEN = "font-bold underline underline-offset-4 hover:text-accent";

/**
 * La page d'une commande, un message par cas. Elle ne reçoit que ce qu'il
 * faut afficher, préparé côté serveur (voir src/vente/situation.ts) : jamais
 * la configuration déchiffrée, qui ne doit pas quitter le serveur.
 */
export function VueCommande({
  situation,
  reference,
  sessionId,
  email,
}: {
  situation: SituationCommande;
  /** Null si l'adresse ne porte pas une référence valable : elle n'est alors pas recopiée. */
  reference: string | null;
  sessionId: string | null;
  email: string;
}) {
  const serviceClient = remplir(COMMANDE.serviceClient, { email });
  const payee = reference && (situation.type === "a_confirmer" || situation.type === "confirmee");

  return (
    <section>
      <p className="text-sm font-bold uppercase tracking-wide text-brique">{COMMANDE.titrePage}</p>
      {payee ? <OublierSauvegarde /> : null}
      {reference && situation.type === "a_confirmer" ? (
        <>
          <h1 className="mt-3 font-titre text-3xl text-accent sm:text-4xl">{COMMANDE.confirmation.titre}</h1>
          <p className="mt-4 leading-relaxed">{COMMANDE.confirmation.texte}</p>
          <Confirmation reference={reference} sessionId={sessionId} email={email} />
          <p className="mt-8 text-sm leading-relaxed">{serviceClient}</p>
        </>
      ) : reference && situation.type === "confirmee" ? (
        <JeuPret situation={situation} reference={reference} sessionId={sessionId} serviceClient={serviceClient} />
      ) : situation.type === "retractee" ? (
        <>
          <h1 className="mt-3 font-titre text-3xl text-accent sm:text-4xl">{COMMANDE.retractee.titre}</h1>
          <p className="mt-4 leading-relaxed">{COMMANDE.retractee.texte}</p>
          <ul className="mt-4 space-y-2 leading-relaxed">
            <li>{remplir(COMMANDE.retractee.le, { date: situation.date, heure: situation.heure })}</li>
            <li>
              {situation.rembourse
                ? remplir(COMMANDE.retractee.rembourse, { montant: situation.montant })
                : COMMANDE.retractee.aRembourser}
            </li>
          </ul>
          <p className="mt-6 text-sm leading-relaxed">{serviceClient}</p>
        </>
      ) : (
        <EtatSansJeu etat={situation.type === "refus" ? situation.etat : "introuvable"} serviceClient={serviceClient} />
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

function JeuPret({
  situation,
  reference,
  sessionId,
  serviceClient,
}: {
  situation: Extract<SituationCommande, { type: "confirmee" }>;
  reference: string;
  sessionId: string | null;
  serviceClient: string;
}) {
  const { destinataire, remplacement, telechargement, delai } = situation;
  return (
    <>
      <div className="mt-3 flex items-center gap-3">
        <Image src="/icones/cadeau.png" alt="" width={40} height={40} aria-hidden />
        <h1 className="font-titre text-3xl text-accent sm:text-4xl">{COMMANDE.payee.titre}</h1>
      </div>
      <p className="mt-4 leading-relaxed">{COMMANDE.payee.texte}</p>
      <p className="mt-4 leading-relaxed">
        {destinataire
          ? remplir(COMMANDE.payee.confirmationEnvoyee, { adresse: destinataire })
          : COMMANDE.payee.confirmationEnvoyeeSansAdresse}
      </p>
      {remplacement ? (
        <p className="mt-2 rounded-xl border border-bordure bg-white px-4 py-2 text-sm leading-relaxed">
          {remplir(COMMANDE.payee.confirmationEssai, { test: remplacement.test, adresse: remplacement.adresse })}
        </p>
      ) : null}
      <p className="mt-4 leading-relaxed">
        {telechargement ? (
          remplir(COMMANDE.payee.apresTelechargement, { date: telechargement.date, heure: telechargement.heure })
        ) : delai.expire ? (
          remplir(COMMANDE.payee.delaiExpire, { date: delai.dernierJour })
        ) : (
          <>
            {COMMANDE.payee.avantTelechargement}{" "}
            <Link href={`/renoncer?ref=${encodeURIComponent(reference)}`} className={CLASSE_LIEN}>
              {COMMANDE.lienRenoncer}
            </Link>
          </>
        )}
      </p>
      <Telechargement reference={reference} sessionId={sessionId} />
      <ul className="mt-8 space-y-2 text-sm leading-relaxed">
        <li>{remplir(COMMANDE.payee.validite, { date: situation.validite })}</li>
        <li>{COMMANDE.payee.email}</li>
        <li>{serviceClient}</li>
      </ul>
    </>
  );
}

function EtatSansJeu({ etat, serviceClient }: { etat: Refus; serviceClient: string }) {
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
