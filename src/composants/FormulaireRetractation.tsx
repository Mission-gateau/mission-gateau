"use client";

import { useEffect, useRef, useState } from "react";
import { remplir } from "@/engine/texte";
import { RETRACTATION } from "@/contenu/retractation";
import type { DocumentCourriel } from "@/vente/courriels";
import {
  LONGUEUR_MAX_EMAIL,
  LONGUEUR_MAX_NOM_SAISI,
  LONGUEUR_MAX_REFERENCE,
  champsRefuses,
  extraireReference,
  normaliserEmail,
  normaliserNom,
  type ChampDeclaration,
} from "@/vente/declaration";
import { VueCourriel } from "./VueCourriel";

type Saisie = Record<ChampDeclaration, string>;

type Envoi =
  | { etat: "envoye"; adresse: string; saisie: string; remplacee: boolean }
  | { etat: "echec" }
  | { etat: "plafond" }
  | { etat: "non_envoye" }
  | { etat: "incertain" };

type Reponse =
  | { issue: "accuse"; accuse: DocumentCourriel; envoi: Envoi; mailto: string | null; droitAPreserver: boolean }
  | { issue: "non_transmise"; cause: "introuvable" | "indisponible"; date: string; heure: string; mailto: string; attente: number }
  | { issue: "deja_accusee"; date: string; heure: string; accuse: DocumentCourriel | null }
  | { issue: "en_cours"; mailto: string };

type Etape = "saisie" | "recapitulatif" | "resultat";

const ISSUES = new Set(["accuse", "non_transmise", "deja_accusee", "en_cours"]);
const ORDRE: ChampDeclaration[] = ["nom", "prenom", "reference", "email"];

const CLASSE_CHAMP = "mt-2 w-full rounded-xl border-2 border-bordure bg-white px-4 py-3 text-base focus:border-accent";
const CLASSE_BOUTON = "rounded-full bg-accent px-7 py-3 font-bold text-white hover:bg-accent-clair disabled:opacity-60";
const CLASSE_BOUTON_SECONDAIRE =
  "rounded-full border-2 border-accent px-6 py-3 font-bold text-accent hover:bg-creme-fonce disabled:opacity-60";
const CLASSE_TITRE = "font-titre text-2xl text-accent focus:outline-none";

/** La déclaration telle qu'elle part : champs normalisés, référence extraite. */
function declarationDe(saisie: Saisie) {
  return {
    nom: normaliserNom(saisie.nom),
    prenom: normaliserNom(saisie.prenom),
    reference: extraireReference(saisie.reference) ?? "",
    email: normaliserEmail(saisie.email),
  };
}

/**
 * Le formulaire de rétractation : nom, prénom, référence de la commande (ou
 * son lien) et adresse e-mail où recevoir l'accusé de réception, vérifiés ici
 * comme sur le serveur (src/vente/declaration.ts). Un premier bouton affiche
 * le récapitulatif ; « Confirmer la rétractation » l'envoie. Les erreurs
 * s'affichent sous chaque champ et sont annoncées ; le focus va au premier
 * champ en erreur, puis au titre de chaque nouvelle étape. Le champ piège,
 * invisible, reste vide chez un humain.
 */
export function FormulaireRetractation({
  referenceInitiale,
  sessionId,
  vendeur,
}: {
  referenceInitiale: string;
  /** La session Stripe de la commande, quand on vient de sa page : elle suffit à la retrouver. */
  sessionId: string | null;
  vendeur: { email: string; adresse: string };
}) {
  const [etape, setEtape] = useState<Etape>("saisie");
  const [saisie, setSaisie] = useState<Saisie>({ nom: "", prenom: "", reference: referenceInitiale, email: "" });
  const [piege, setPiege] = useState("");
  const [erreurs, setErreurs] = useState<ChampDeclaration[]>([]);
  const [verifications, setVerifications] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [probleme, setProbleme] = useState<string | null>(null);
  const [reponse, setReponse] = useState<Reponse | null>(null);
  // Chaque réponse reçue a son numéro : deux réponses à la même heure affichée restent deux réponses.
  const [numeroDeReponse, setNumeroDeReponse] = useState(0);

  const titre = useRef<HTMLHeadingElement | null>(null);
  const etapePrecedente = useRef<Etape>(etape);
  const reponsePrecedente = useRef<Reponse | null>(reponse);

  // À chaque changement d'étape (ou de résultat), le focus va au titre de l'étape.
  useEffect(() => {
    if (etapePrecedente.current !== etape || reponsePrecedente.current !== reponse) titre.current?.focus();
    etapePrecedente.current = etape;
    reponsePrecedente.current = reponse;
  }, [etape, reponse]);

  // Après une vérification refusée, le focus va au premier champ en erreur.
  useEffect(() => {
    if (verifications > 0 && erreurs.length > 0) document.getElementById(erreurs[0]!)?.focus();
  }, [verifications, erreurs]);

  const champ = (cle: ChampDeclaration, aide?: string) => ({
    id: cle,
    name: cle,
    value: saisie[cle],
    onChange: (evenement: React.ChangeEvent<HTMLInputElement>) => setSaisie({ ...saisie, [cle]: evenement.target.value }),
    "aria-invalid": erreurs.includes(cle) ? true : undefined,
    "aria-describedby": [aide, erreurs.includes(cle) ? `erreur-${cle}` : null].filter(Boolean).join(" ") || undefined,
  });

  const erreurDe = (cle: ChampDeclaration) =>
    erreurs.includes(cle) ? (
      <p id={`erreur-${cle}`} role="alert" className="mt-1 text-sm font-bold text-brique">
        {RETRACTATION.erreurs[cle]}
      </p>
    ) : null;

  const verifier = () => {
    const refuses = champsRefuses(saisie);
    setErreurs(ORDRE.filter((cle) => refuses.includes(cle)));
    setVerifications((n) => n + 1);
    if (refuses.length === 0) {
      setProbleme(null);
      setEtape("recapitulatif");
    }
  };

  const declaration = declarationDe(saisie);
  // La session ne vaut que pour la commande dont la page l'a donnée.
  const session = sessionId && declaration.reference === referenceInitiale ? sessionId : null;

  const confirmer = async () => {
    setEnvoi(true);
    setProbleme(null);
    try {
      const resultat = await fetch("/api/renoncer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...declaration, ...(session ? { session_id: session } : {}), champ_libre: piege }),
      });
      const corps = (await resultat.json().catch(() => null)) as Reponse | null;
      if (!corps || !ISSUES.has(corps.issue)) {
        setProbleme(remplir(resultat.status === 400 ? RETRACTATION.erreurs.refusee : RETRACTATION.erreurs.reseau, vendeur));
        return;
      }
      setReponse(corps);
      setNumeroDeReponse((numero) => numero + 1);
      setEtape("resultat");
    } catch {
      setProbleme(remplir(RETRACTATION.erreurs.reseau, vendeur));
    } finally {
      setEnvoi(false);
    }
  };

  const recommencer = () => {
    setReponse(null);
    setProbleme(null);
    setErreurs([]);
    setSaisie({ nom: "", prenom: "", reference: "", email: "" });
    setEtape("saisie");
  };

  const corriger = () => {
    setReponse(null);
    setProbleme(null);
    setEtape("saisie");
  };

  if (etape === "resultat" && reponse) {
    return (
      <div className="mt-8">
        <Resultat
          reponse={reponse}
          numero={numeroDeReponse}
          vendeur={vendeur}
          envoi={envoi}
          probleme={probleme}
          titre={titre}
          renvoyer={() => void confirmer()}
          corriger={corriger}
        />
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
        <h2 ref={titre} tabIndex={-1} className={CLASSE_TITRE}>
          {RETRACTATION.titreRecapitulatif}
        </h2>
        <p className="mt-3 leading-relaxed">{RETRACTATION.recapitulatif}</p>
        <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[11rem_1fr]">
          <dt className="font-bold">{RETRACTATION.libelleNom}</dt>
          <dd className="break-words">{declaration.nom}</dd>
          <dt className="font-bold">{RETRACTATION.libellePrenom}</dt>
          <dd className="break-words">{declaration.prenom}</dd>
          <dt className="font-bold">{RETRACTATION.libelleReference}</dt>
          <dd className="break-all font-mono">{declaration.reference}</dd>
          <dt className="font-bold">{RETRACTATION.libelleEmail}</dt>
          <dd className="break-words">{declaration.email}</dd>
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
      <h2 ref={titre} tabIndex={-1} className={CLASSE_TITRE}>
        {RETRACTATION.titreSaisie}
      </h2>
      <div className="mt-5 space-y-5">
        <div>
          <label htmlFor="nom" className="block font-bold">
            {RETRACTATION.libelleNom}
          </label>
          <input autoComplete="family-name" maxLength={LONGUEUR_MAX_NOM_SAISI} className={CLASSE_CHAMP} {...champ("nom")} />
          {erreurDe("nom")}
        </div>
        <div>
          <label htmlFor="prenom" className="block font-bold">
            {RETRACTATION.libellePrenom}
          </label>
          <input autoComplete="given-name" maxLength={LONGUEUR_MAX_NOM_SAISI} className={CLASSE_CHAMP} {...champ("prenom")} />
          {erreurDe("prenom")}
        </div>
        <div>
          <label htmlFor="reference" className="block font-bold">
            {RETRACTATION.libelleReference}
          </label>
          <p id="aide-reference" className="mt-1 text-sm text-encre-douce">
            {RETRACTATION.aideReference}
          </p>
          <input
            autoComplete="off"
            spellCheck={false}
            maxLength={LONGUEUR_MAX_REFERENCE}
            className={`${CLASSE_CHAMP} font-mono`}
            {...champ("reference", "aide-reference")}
          />
          {erreurDe("reference")}
        </div>
        <div>
          <label htmlFor="email" className="block font-bold">
            {RETRACTATION.libelleEmail}
          </label>
          <p id="aide-email" className="mt-1 text-sm text-encre-douce">
            {RETRACTATION.aideEmail}
          </p>
          <input
            type="email"
            autoComplete="email"
            maxLength={LONGUEUR_MAX_EMAIL}
            className={CLASSE_CHAMP}
            {...champ("email", "aide-email")}
          />
          {erreurDe("email")}
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

/** Le titre d'une étape : il reçoit le focus quand l'étape s'affiche. */
function TitreDEtape({ cible, children }: { cible: React.Ref<HTMLHeadingElement>; children: string }) {
  return (
    <h2 ref={cible} tabIndex={-1} className={CLASSE_TITRE}>
      {children}
    </h2>
  );
}

/** Un nouvel envoi (« Réessayer », « Renvoyer ») qui n'a pas abouti : dit sous son bouton, et annoncé. */
function ProblemeDEnvoi({ probleme }: { probleme: string | null }) {
  return probleme ? (
    <p role="alert" className="mt-3 rounded-xl border-2 border-brique bg-white p-4 font-bold text-brique">
      {probleme}
    </p>
  ) : null;
}

/** Le bouton qui ouvre la messagerie de la personne avec sa déclaration, à l'heure de réception d'origine. */
function BoutonEmail({ mailto }: { mailto: string }) {
  const { nonTransmise } = RETRACTATION;
  return (
    <>
      <p className="mt-5">
        <a href={mailto} className={`inline-block ${CLASSE_BOUTON}`}>
          {nonTransmise.boutonEmail}
        </a>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-encre-douce">{nonTransmise.aideEmail}</p>
    </>
  );
}

/**
 * « Réessayer », grisé pendant `attente` secondes, compte à rebours affiché :
 * après une écriture impossible chez Stripe, dix clics pendant une même panne
 * épuiseraient pour 24 heures les dix clés de la marque. Le bouton est monté à
 * neuf pour chaque réponse (clé : son numéro) : le compte à rebours part de
 * l'attente de cette réponse dès le premier rendu, même quand la précédente,
 * à la même heure affichée, n'en demandait aucune.
 */
function BoutonReessayer({ attente, envoi, renvoyer }: { attente: number; envoi: boolean; renvoyer: () => void }) {
  const [restant, setRestant] = useState(attente);
  useEffect(() => {
    if (attente <= 0) return;
    const fin = Date.now() + attente * 1000;
    const minuterie = setInterval(() => {
      const secondes = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
      setRestant(secondes);
      if (secondes === 0) clearInterval(minuterie);
    }, 250);
    return () => clearInterval(minuterie);
  }, [attente]);
  return (
    <button type="button" disabled={envoi || restant > 0} onClick={renvoyer} className={CLASSE_BOUTON_SECONDAIRE}>
      {restant > 0 ? remplir(RETRACTATION.nonTransmise.reessayerDans, { secondes: restant }) : RETRACTATION.reessayer}
    </button>
  );
}

/** Ce que la page dit une fois la déclaration envoyée : elle ne dit jamais qu'un accusé est parti quand il n'est pas parti. */
function Resultat({
  reponse,
  numero,
  vendeur,
  envoi,
  probleme,
  titre,
  renvoyer,
  corriger,
}: {
  reponse: Reponse;
  /** Le numéro de cette réponse : un de plus à chaque réponse reçue. */
  numero: number;
  vendeur: { email: string; adresse: string };
  envoi: boolean;
  /** L'échec du dernier nouvel envoi, s'il y en a un. */
  probleme: string | null;
  titre: React.RefObject<HTMLHeadingElement | null>;
  renvoyer: () => void;
  corriger: () => void;
}) {
  switch (reponse.issue) {
    case "non_transmise": {
      const { nonTransmise } = RETRACTATION;
      return (
        <>
          <TitreDEtape cible={titre}>{nonTransmise.titre}</TitreDEtape>
          <p role="alert" className="mt-3 rounded-xl border-2 border-brique bg-white p-4 font-bold text-brique">
            {nonTransmise[reponse.cause]}
          </p>
          {reponse.cause === "introuvable" ? (
            <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed">
              {nonTransmise.conseils.map((conseil) => (
                <li key={conseil}>{remplir(conseil, vendeur)}</li>
              ))}
            </ul>
          ) : null}
          <BoutonEmail mailto={reponse.mailto} />
          <p className="mt-5">
            {reponse.cause === "introuvable" ? (
              <button type="button" onClick={corriger} className={CLASSE_BOUTON_SECONDAIRE}>
                {nonTransmise.corriger}
              </button>
            ) : (
              <BoutonReessayer key={numero} attente={reponse.attente ?? 0} envoi={envoi} renvoyer={renvoyer} />
            )}
          </p>
          <ProblemeDEnvoi probleme={probleme} />
        </>
      );
    }
    case "deja_accusee":
      return (
        <>
          <TitreDEtape cible={titre}>{RETRACTATION.titreDejaAccusee}</TitreDEtape>
          <p className="mt-3 leading-relaxed">{remplir(RETRACTATION.dejaAccusee, { date: reponse.date, heure: reponse.heure })}</p>
          {reponse.accuse ? <VueCourriel document={reponse.accuse} /> : null}
        </>
      );
    case "en_cours":
      return (
        <>
          <TitreDEtape cible={titre}>{RETRACTATION.titreEnCours}</TitreDEtape>
          <p role="status" className="mt-3 rounded-xl bg-creme-fonce p-4 leading-relaxed">
            {RETRACTATION.enCours}
          </p>
          <p className="mt-3 leading-relaxed">{RETRACTATION.aideEnCours}</p>
          <BoutonEmail mailto={reponse.mailto} />
          <p className="mt-4">
            <button type="button" disabled={envoi} onClick={renvoyer} className={CLASSE_BOUTON_SECONDAIRE}>
              {RETRACTATION.reessayer}
            </button>
          </p>
          <ProblemeDEnvoi probleme={probleme} />
        </>
      );
    case "accuse": {
      const envoiAccuse = reponse.envoi;
      return (
        <>
          <TitreDEtape cible={titre}>
            {envoiAccuse.etat === "envoye" || envoiAccuse.etat === "plafond" ? RETRACTATION.titreResultat : RETRACTATION.titreEchec}
          </TitreDEtape>
          {envoiAccuse.etat === "envoye" ? (
            <>
              <p className="mt-3 leading-relaxed">{remplir(RETRACTATION.accuseEnvoye, { adresse: envoiAccuse.adresse })}</p>
              {/* Hors production, la copie part elle aussi à l'adresse de test : la page ne l'annonce pas. */}
              {envoiAccuse.remplacee ? (
                <p className="mt-2 rounded-xl border border-bordure bg-white px-4 py-2 text-sm leading-relaxed">
                  {remplir(RETRACTATION.essai, { test: envoiAccuse.adresse, adresse: envoiAccuse.saisie })}
                </p>
              ) : (
                <p className="mt-2 leading-relaxed">{RETRACTATION.copie}</p>
              )}
            </>
          ) : (
            <NonParti reponse={reponse} vendeur={vendeur} envoi={envoi} probleme={probleme} renvoyer={renvoyer} />
          )}
          <VueCourriel document={reponse.accuse} />
        </>
      );
    }
  }
}

/**
 * L'accusé qui n'est pas parti : la page le dit, sans jamais rester vide, et
 * propose le bouton d'e-mail. « Renvoyer » n'est proposé qu'après un échec
 * d'envoi, et jamais pour une déclaration « arrivée en même temps » que le
 * premier téléchargement (un nouvel essai la referait à une heure nouvelle).
 */
function NonParti({
  reponse,
  vendeur,
  envoi,
  probleme,
  renvoyer,
}: {
  reponse: Extract<Reponse, { issue: "accuse" }>;
  vendeur: { email: string; adresse: string };
  envoi: boolean;
  probleme: string | null;
  renvoyer: () => void;
}) {
  const etat = reponse.envoi.etat;
  const bouton = reponse.mailto ? <BoutonEmail mailto={reponse.mailto} /> : null;
  if (reponse.droitAPreserver) {
    return (
      <div role="alert" className="mt-3 rounded-xl border-2 border-brique bg-white p-4">
        <p className="font-bold text-brique">{RETRACTATION.preserver}</p>
        {bouton}
      </div>
    );
  }
  if (etat === "echec") {
    return (
      <div role="alert" className="mt-3 rounded-xl border-2 border-brique bg-white p-4">
        <p className="font-bold text-brique">{RETRACTATION.accuseEchec}</p>
        <button type="button" disabled={envoi} onClick={renvoyer} className={`mt-3 ${CLASSE_BOUTON_SECONDAIRE}`}>
          {envoi ? RETRACTATION.renvoiEnCours : RETRACTATION.renvoyer}
        </button>
        <ProblemeDEnvoi probleme={probleme} />
        <p className="mt-3 text-sm leading-relaxed">{remplir(RETRACTATION.accuseEchecSuite, vendeur)}</p>
        {bouton}
      </div>
    );
  }
  const texte =
    etat === "plafond"
      ? remplir(RETRACTATION.plafond, vendeur)
      : etat === "incertain"
        ? remplir(RETRACTATION.incertain, vendeur)
        : RETRACTATION.nonEnvoye;
  return (
    <div className="mt-3 rounded-xl border border-bordure bg-white p-4">
      <p className="leading-relaxed">{texte}</p>
      {bouton}
    </div>
  );
}
