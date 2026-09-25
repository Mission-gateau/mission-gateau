"use client";

import { useState } from "react";
import { remplir } from "@/engine/texte";
import { RETRACTATION } from "@/contenu/retractation";
import type { DocumentCourriel } from "@/vente/courriels";
import { VueCourriel } from "./VueCourriel";

interface Saisie {
  nom: string;
  prenom: string;
  reference: string;
  email: string;
}

type Envoi =
  | { etat: "envoye"; adresse: string; saisie: string; remplacee: boolean; copieAcheteur: boolean }
  | { etat: "echec" };

type Reponse =
  | { issue: "accuse"; accuse: DocumentCourriel; envoi: Envoi }
  | { issue: "deja_enregistree"; date: string; heure: string; remboursement: "effectue" | "a_venir" | "litige" };

type Etape = "saisie" | "recapitulatif" | "resultat";

const CLASSE_CHAMP = "mt-2 w-full rounded-xl border-2 border-bordure bg-white px-4 py-3 text-base focus:border-accent";
const CLASSE_BOUTON = "rounded-full bg-accent px-7 py-3 font-bold text-white hover:bg-accent-clair disabled:opacity-60";
const CLASSE_BOUTON_SECONDAIRE =
  "rounded-full border-2 border-accent px-6 py-3 font-bold text-accent hover:bg-creme-fonce disabled:opacity-60";

function erreursDe(saisie: Saisie): Partial<Record<keyof Saisie, string>> {
  const erreurs: Partial<Record<keyof Saisie, string>> = {};
  if (!saisie.nom.trim()) erreurs.nom = RETRACTATION.erreurs.nom;
  if (!saisie.prenom.trim()) erreurs.prenom = RETRACTATION.erreurs.prenom;
  if (!saisie.reference.trim()) erreurs.reference = RETRACTATION.erreurs.reference;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saisie.email.trim())) erreurs.email = RETRACTATION.erreurs.email;
  return erreurs;
}

/**
 * Le formulaire de rétractation : nom, prénom, référence de la commande (ou
 * son lien) et adresse e-mail où recevoir l'accusé de réception. Un premier
 * bouton affiche le récapitulatif ; « Confirmer la rétractation » l'envoie.
 * Le champ piège, invisible, reste vide chez un humain.
 */
export function FormulaireRetractation({ referenceInitiale, email }: { referenceInitiale: string; email: string }) {
  const [etape, setEtape] = useState<Etape>("saisie");
  const [saisie, setSaisie] = useState<Saisie>({ nom: "", prenom: "", reference: referenceInitiale, email: "" });
  const [piege, setPiege] = useState("");
  const [erreurs, setErreurs] = useState<Partial<Record<keyof Saisie, string>>>({});
  const [envoi, setEnvoi] = useState(false);
  const [probleme, setProbleme] = useState<string | null>(null);
  const [reponse, setReponse] = useState<Reponse | null>(null);

  const champ = (cle: keyof Saisie) => ({
    value: saisie[cle],
    onChange: (evenement: React.ChangeEvent<HTMLInputElement>) => setSaisie({ ...saisie, [cle]: evenement.target.value }),
    "aria-invalid": erreurs[cle] ? true : undefined,
    "aria-describedby": erreurs[cle] ? `erreur-${cle}` : undefined,
  });

  const verifier = () => {
    const trouvees = erreursDe(saisie);
    setErreurs(trouvees);
    if (Object.keys(trouvees).length === 0) {
      setProbleme(null);
      setEtape("recapitulatif");
    }
  };

  const confirmer = async () => {
    setEnvoi(true);
    setProbleme(null);
    try {
      const resultat = await fetch("/api/renoncer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: saisie.nom.trim(),
          prenom: saisie.prenom.trim(),
          reference: saisie.reference.trim(),
          email: saisie.email.trim(),
          champ_libre: piege,
        }),
      });
      const corps = (await resultat.json().catch(() => null)) as Reponse | null;
      if (!resultat.ok || !corps || (corps.issue !== "accuse" && corps.issue !== "deja_enregistree")) {
        setProbleme(
          remplir(resultat.status === 400 ? RETRACTATION.erreurs.refusee : RETRACTATION.erreurs.reseau, { email }),
        );
        return;
      }
      setReponse(corps);
      setEtape("resultat");
    } catch {
      setProbleme(remplir(RETRACTATION.erreurs.reseau, { email }));
    } finally {
      setEnvoi(false);
    }
  };

  const recommencer = () => {
    setReponse(null);
    setSaisie({ nom: "", prenom: "", reference: "", email: "" });
    setEtape("saisie");
  };

  if (etape === "resultat" && reponse) {
    return (
      <div className="mt-8" aria-live="polite">
        {reponse.issue === "deja_enregistree" ? (
          <>
            <h2 className="font-titre text-2xl text-accent">{RETRACTATION.titreDejaEnregistree}</h2>
            <p className="mt-3 leading-relaxed">
              {remplir(RETRACTATION.dejaEnregistree, { date: reponse.date, heure: reponse.heure })}
            </p>
            <p className="mt-2 leading-relaxed">{RETRACTATION.dejaAccusee}</p>
            <p className="mt-2 leading-relaxed">
              {reponse.remboursement === "effectue"
                ? RETRACTATION.remboursee
                : reponse.remboursement === "litige"
                  ? RETRACTATION.litige
                  : RETRACTATION.aRembourser}
            </p>
          </>
        ) : (
          <>
            <h2 className="font-titre text-2xl text-accent">
              {reponse.envoi.etat === "envoye" ? RETRACTATION.titreResultat : RETRACTATION.titreEchec}
            </h2>
            {reponse.envoi.etat === "envoye" ? (
              <>
                <p className="mt-3 leading-relaxed">
                  {remplir(RETRACTATION.accuseEnvoye, { adresse: reponse.envoi.adresse })}
                </p>
                {reponse.envoi.copieAcheteur ? <p className="mt-2 leading-relaxed">{RETRACTATION.copieAcheteur}</p> : null}
                {reponse.envoi.remplacee ? (
                  <p className="mt-2 rounded-xl border border-bordure bg-white px-4 py-2 text-sm leading-relaxed">
                    {remplir(RETRACTATION.essai, { test: reponse.envoi.adresse, adresse: reponse.envoi.saisie })}
                  </p>
                ) : null}
              </>
            ) : (
              <div role="alert" className="mt-3 rounded-xl border-2 border-brique bg-white p-4">
                <p className="font-bold text-brique">{RETRACTATION.accuseEchec}</p>
                <button
                  type="button"
                  disabled={envoi}
                  onClick={() => void confirmer()}
                  className={`mt-3 ${CLASSE_BOUTON_SECONDAIRE}`}
                >
                  {envoi ? RETRACTATION.renvoiEnCours : RETRACTATION.renvoyer}
                </button>
                <p className="mt-3 text-sm leading-relaxed">{remplir(RETRACTATION.accuseEchecSuite, { email })}</p>
              </div>
            )}
            <VueCourriel document={reponse.accuse} />
          </>
        )}
        <p className="mt-6">
          <button type="button" onClick={recommencer} className="text-sm underline underline-offset-4 hover:text-accent">
            {RETRACTATION.nouvelleDeclaration}
          </button>
        </p>
      </div>
    );
  }

  if (etape === "recapitulatif") {
    return (
      <div className="mt-8 rounded-2xl border-2 border-accent bg-white p-6">
        <h2 className="font-titre text-2xl text-accent">{RETRACTATION.titreRecapitulatif}</h2>
        <p className="mt-3 leading-relaxed">{RETRACTATION.recapitulatif}</p>
        <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[11rem_1fr]">
          <dt className="font-bold">{RETRACTATION.libelleNom}</dt>
          <dd className="break-words">{saisie.nom.trim()}</dd>
          <dt className="font-bold">{RETRACTATION.libellePrenom}</dt>
          <dd className="break-words">{saisie.prenom.trim()}</dd>
          <dt className="font-bold">{RETRACTATION.libelleReference}</dt>
          <dd className="break-all">{saisie.reference.trim()}</dd>
          <dt className="font-bold">{RETRACTATION.libelleEmail}</dt>
          <dd className="break-words">{saisie.email.trim()}</dd>
        </dl>
        {probleme ? (
          <p role="alert" className="mt-4 rounded-xl border-2 border-brique bg-white p-4 font-bold text-brique">
            {probleme}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={envoi} onClick={() => void confirmer()} className={CLASSE_BOUTON}>
            {envoi ? RETRACTATION.envoi : RETRACTATION.confirmer}
          </button>
          <button type="button" disabled={envoi} onClick={() => setEtape("saisie")} className={CLASSE_BOUTON_SECONDAIRE}>
            {RETRACTATION.modifier}
          </button>
        </div>
        <p aria-live="polite" className="sr-only">
          {envoi ? RETRACTATION.envoi : ""}
        </p>
      </div>
    );
  }

  return (
    <form
      className="mt-8"
      noValidate
      onSubmit={(evenement) => {
        evenement.preventDefault();
        verifier();
      }}
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="nom" className="block font-bold">
            {RETRACTATION.libelleNom}
          </label>
          <input id="nom" name="nom" autoComplete="family-name" maxLength={100} className={CLASSE_CHAMP} {...champ("nom")} />
          {erreurs.nom ? (
            <p id="erreur-nom" className="mt-1 text-sm font-bold text-brique">
              {erreurs.nom}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="prenom" className="block font-bold">
            {RETRACTATION.libellePrenom}
          </label>
          <input
            id="prenom"
            name="prenom"
            autoComplete="given-name"
            maxLength={100}
            className={CLASSE_CHAMP}
            {...champ("prenom")}
          />
          {erreurs.prenom ? (
            <p id="erreur-prenom" className="mt-1 text-sm font-bold text-brique">
              {erreurs.prenom}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="reference" className="block font-bold">
            {RETRACTATION.libelleReference}
          </label>
          <p id="aide-reference" className="mt-1 text-sm text-encre-douce">
            {RETRACTATION.aideReference}
          </p>
          <input
            id="reference"
            name="reference"
            autoComplete="off"
            spellCheck={false}
            maxLength={300}
            className={`${CLASSE_CHAMP} font-mono`}
            {...champ("reference")}
            aria-describedby={erreurs.reference ? "aide-reference erreur-reference" : "aide-reference"}
          />
          {erreurs.reference ? (
            <p id="erreur-reference" className="mt-1 text-sm font-bold text-brique">
              {erreurs.reference}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="email" className="block font-bold">
            {RETRACTATION.libelleEmail}
          </label>
          <p id="aide-email" className="mt-1 text-sm text-encre-douce">
            {RETRACTATION.aideEmail}
          </p>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            className={CLASSE_CHAMP}
            {...champ("email")}
            aria-describedby={erreurs.email ? "aide-email erreur-email" : "aide-email"}
          />
          {erreurs.email ? (
            <p id="erreur-email" className="mt-1 text-sm font-bold text-brique">
              {erreurs.email}
            </p>
          ) : null}
        </div>
        {/* Le piège à robots : hors de l'écran, hors du parcours au clavier et des lecteurs d'écran. */}
        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
          <label htmlFor="champ_libre">{RETRACTATION.libellePiege}</label>
          <input
            id="champ_libre"
            name="champ_libre"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={piege}
            onChange={(evenement) => setPiege(evenement.target.value)}
          />
        </div>
      </div>
      <button type="submit" className={`mt-6 ${CLASSE_BOUTON}`}>
        {RETRACTATION.verifier}
      </button>
    </form>
  );
}
