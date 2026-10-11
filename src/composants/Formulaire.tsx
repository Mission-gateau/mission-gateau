"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CACHETTES, CACHETTES_PRESELECTIONNEES, LIBELLES_PIECES } from "@/engine/cachettes";
import {
  AGE_MAX,
  AGE_MIN,
  DUREES,
  ENFANTS_MAX,
  ENFANTS_MIN,
  LIBELLES_FORMATS,
  PRENOM_MAX,
  TRANCHES_AGE,
  cachettesMinimum,
  formatPourAge,
  minutesParEtape,
  nombreEquipes,
  nombreEtapes,
  schemaConfiguration,
} from "@/engine/configuration";
import type { Cachette, Configuration, Duree, IdTheme } from "@/engine/types";
import { remplir } from "@/engine/texte";
import { FORMULAIRE } from "@/contenu/formulaire";
import { LISTE_THEMES } from "@/contenu/themes";
import { ACHAT } from "@/contenu/vente";
import { BlocAchat, type OffreEnVente } from "./BlocAchat";
import { compterLApercu } from "./mesure";
import { CarteChoix, ChampTexte, GroupeChamps, Resume } from "./champs";
import {
  abonnerSauvegarde,
  analyserSauvegarde,
  lireSauvegardeBrute,
  lireSauvegardeCoteServeur,
  oublierSauvegarde,
} from "./sauvegarde";

interface Brouillon {
  theme: IdTheme | null;
  age: number | null;
  prenom: string;
  nombreEnfants: number | null;
  duree: Duree | null;
  cachettes: string[];
  date: string;
  heure: string;
  adresse: string;
  contact: string;
  invites: string;
}

const BROUILLON_VIDE: Brouillon = {
  theme: null,
  age: null,
  prenom: "",
  nombreEnfants: null,
  duree: null,
  cachettes: [...CACHETTES_PRESELECTIONNEES],
  date: "",
  heure: "",
  adresse: "",
  contact: "",
  invites: "",
};

const PIECES = ["salon", "chambre", "cuisine", "entree"] as const;

/** Une sauvegarde relue du sessionStorage n'est reprise que si elle a exactement cette forme. */
function brouillonValide(valeur: unknown): valeur is Brouillon {
  if (!valeur || typeof valeur !== "object") return false;
  const b = valeur as Record<string, unknown>;
  const textes = ["prenom", "date", "heure", "adresse", "contact", "invites"] as const;
  return (
    textes.every((cle) => typeof b[cle] === "string") &&
    Array.isArray(b.cachettes) &&
    b.cachettes.every((id) => typeof id === "string") &&
    (b.theme === null || LISTE_THEMES.some((theme) => theme.id === b.theme)) &&
    (b.age === null || typeof b.age === "number") &&
    (b.nombreEnfants === null || typeof b.nombreEnfants === "number") &&
    (b.duree === null || (DUREES as readonly unknown[]).includes(b.duree))
  );
}

/** L'aperçu affiché : `url` est nulle quand il a été retrouvé après un aller-retour chez Stripe. */
interface Resultat {
  url: string | null;
  graine: string;
  configuration: Configuration;
}

function parPiece(piece: Cachette["piece"]) {
  return CACHETTES.filter((c) => c.piece === piece);
}

/** Règles locales de chaque étape : mêmes messages que le schéma du serveur. */
function erreursEtape(etape: number, brouillon: Brouillon): string[] {
  switch (etape) {
    case 0:
      return brouillon.theme ? [] : ["Merci de choisir un thème."];
    case 1:
      return brouillon.age ? [] : ["Merci d'indiquer l'âge fêté."];
    case 2: {
      const prenom = brouillon.prenom.trim();
      if (!prenom) return ["Merci d'indiquer le prénom de l'enfant."];
      if (prenom.length > PRENOM_MAX) return [`Le prénom ne peut pas dépasser ${PRENOM_MAX} caractères.`];
      if (!/^\p{L}[\p{L} '’-]*$/u.test(prenom)) {
        return ["Le prénom n'accepte que des lettres, des espaces, des tirets et des apostrophes."];
      }
      return [];
    }
    case 3:
      return brouillon.nombreEnfants ? [] : ["Merci d'indiquer le nombre d'enfants."];
    case 4:
      return brouillon.duree ? [] : ["Merci de choisir une durée."];
    case 5: {
      if (!brouillon.age || !brouillon.duree) return [];
      const minimum = cachettesMinimum(formatPourAge(brouillon.age), brouillon.duree);
      return brouillon.cachettes.length >= minimum
        ? []
        : [`Ce jeu compte ${minimum} étapes : cochez au moins ${minimum} cachettes.`];
    }
    default:
      return [];
  }
}

function construireConfiguration(brouillon: Brouillon): unknown {
  const invites = brouillon.invites
    .split("\n")
    .map((ligne) => ligne.trim())
    .filter(Boolean)
    .slice(0, ENFANTS_MAX);
  const fete = {
    ...(brouillon.date.trim() ? { date: brouillon.date.trim() } : {}),
    ...(brouillon.heure.trim() ? { heure: brouillon.heure.trim() } : {}),
    ...(brouillon.adresse.trim() ? { adresse: brouillon.adresse.trim() } : {}),
    ...(brouillon.contact.trim() ? { contact: brouillon.contact.trim() } : {}),
    ...(invites.length > 0 ? { invites } : {}),
  };
  return {
    theme: brouillon.theme,
    age: brouillon.age,
    prenom: brouillon.prenom.trim(),
    nombreEnfants: brouillon.nombreEnfants,
    duree: brouillon.duree,
    cachettes: brouillon.cachettes,
    ...(Object.keys(fete).length > 0 ? { fete } : {}),
  };
}

/**
 * `vente` n'est fourni que lorsque la vente est ouverte : le bloc d'achat
 * apparaît alors sous l'aperçu. Sinon, l'aperçu annonce que la vente ouvre
 * bientôt, sans prix ni bouton.
 */
export function Formulaire({ vente = null }: { vente?: OffreEnVente | null }) {
  // Au retour d'un paiement annulé, l'onglet retrouve ce qu'il avait gardé
  // (voir ./sauvegarde). Le rendu serveur et l'hydratation n'en voient rien.
  const sauvegardeBrute = useSyncExternalStore(abonnerSauvegarde, lireSauvegardeBrute, lireSauvegardeCoteServeur);
  const sauvegarde = useMemo(() => analyserSauvegarde(sauvegardeBrute), [sauvegardeBrute]);

  const [brouillonLocal, setBrouillonLocal] = useState<Brouillon | null>(null);
  const [etape, setEtape] = useState(0);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  // `undefined` : rien de décidé ici, on reprend l'aperçu gardé s'il y en a un.
  const [resultatLocal, setResultatLocal] = useState<Resultat | null | undefined>(undefined);
  const titreRef = useRef<HTMLHeadingElement>(null);
  const premierRendu = useRef(true);

  const brouillonGarde = sauvegarde && brouillonValide(sauvegarde.brouillon) ? sauvegarde.brouillon : null;
  const brouillon = brouillonLocal ?? brouillonGarde ?? BROUILLON_VIDE;
  const resultat = useMemo<Resultat | null>(() => {
    if (resultatLocal !== undefined) return resultatLocal;
    return sauvegarde ? { url: null, graine: sauvegarde.graine, configuration: sauvegarde.configuration } : null;
  }, [resultatLocal, sauvegarde]);

  const total = FORMULAIRE.etapes.length;
  const infos = FORMULAIRE.etapes[etape]!;

  const modifier = (champs: Partial<Brouillon>) =>
    setBrouillonLocal((actuel) => ({ ...(actuel ?? brouillon), ...champs }));

  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    titreRef.current?.focus();
  }, [etape, resultat]);

  // L'URL d'objet est libérée quand on en crée une autre ou qu'on quitte.
  useEffect(() => {
    return () => {
      if (resultat?.url) URL.revokeObjectURL(resultat.url);
    };
  }, [resultat]);

  const regles = useMemo(() => {
    if (!brouillon.age || !brouillon.duree) return null;
    const format = formatPourAge(brouillon.age);
    return {
      format,
      etapes: nombreEtapes(format, brouillon.duree),
      minimum: cachettesMinimum(format, brouillon.duree),
      minutes: minutesParEtape(format, brouillon.duree),
    };
  }, [brouillon.age, brouillon.duree]);

  const avancer = () => {
    const soucis = erreursEtape(etape, brouillon);
    setErreurs(soucis);
    if (soucis.length === 0) setEtape((n) => Math.min(n + 1, total - 1));
  };

  const reculer = () => {
    setErreurs([]);
    setEtape((n) => Math.max(n - 1, 0));
  };

  /**
   * Demande l'aperçu. Sans graine, le serveur en tire une nouvelle ; avec la
   * graine d'un aperçu déjà vu, il redonne exactement le même.
   */
  const demanderApercu = async (
    configuration: Configuration,
    graine?: string,
  ): Promise<{ erreurs: string[] } | { url: string; graine: string }> => {
    const reponse = await fetch("/api/apercu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(graine ? { configuration, graine } : { configuration }),
    });
    if (!reponse.ok) {
      const corps = (await reponse.json().catch(() => null)) as
        | { erreur?: string; details?: { message?: string }[] }
        | null;
      return {
        erreurs: corps?.details?.map((d) => d.message ?? "").filter(Boolean) ?? [
          corps?.erreur ?? FORMULAIRE.erreurReseau,
        ],
      };
    }
    const graineRecue = reponse.headers.get("X-Graine") ?? "";
    return { url: URL.createObjectURL(await reponse.blob()), graine: graineRecue };
  };

  const envoyer = async () => {
    const configuration = construireConfiguration(brouillon);
    const analyse = schemaConfiguration.safeParse(configuration);
    if (!analyse.success) {
      setErreurs(analyse.error.issues.map((souci) => souci.message));
      return;
    }
    setErreurs([]);
    setEnvoi(true);
    try {
      const obtenu = await demanderApercu(analyse.data as Configuration);
      if ("erreurs" in obtenu) {
        setErreurs(obtenu.erreurs);
        return;
      }
      if (resultat?.url) URL.revokeObjectURL(resultat.url);
      // Le bloc d'achat achètera exactement cette configuration et cette graine.
      setResultatLocal({ url: obtenu.url, graine: obtenu.graine, configuration: analyse.data as Configuration });
      // Le compteur anonyme des aperçus : l'âge et la durée, jamais le prénom ni un détail de la fête.
      compterLApercu(analyse.data.age, analyse.data.duree);
    } catch {
      setErreurs([FORMULAIRE.erreurReseau]);
    } finally {
      setEnvoi(false);
    }
  };

  /** Après un aller-retour chez Stripe, l'aperçu gardé se recompose à l'identique, avec sa graine. */
  const revoirApercu = async (actuel: Resultat) => {
    setErreurs([]);
    setEnvoi(true);
    try {
      const obtenu = await demanderApercu(actuel.configuration, actuel.graine);
      if ("erreurs" in obtenu) setErreurs(obtenu.erreurs);
      else setResultatLocal({ ...actuel, url: obtenu.url });
    } catch {
      setErreurs([FORMULAIRE.erreurReseau]);
    } finally {
      setEnvoi(false);
    }
  };

  if (resultat) {
    return (
      <>
        <section className="rounded-2xl border-2 border-accent bg-white p-6">
          <h2 ref={titreRef} tabIndex={-1} className="font-titre text-2xl text-accent">
            {FORMULAIRE.titreResultat}
          </h2>
          <p className="mt-3 leading-relaxed">{FORMULAIRE.texteResultat}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {resultat.url ? (
              <>
                <a
                  href={resultat.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-full bg-accent px-6 py-3 font-bold text-white hover:bg-accent-clair"
                >
                  {FORMULAIRE.ouvrir}
                </a>
                <a
                  href={resultat.url}
                  download="apercu-mission-gateau.pdf"
                  className="rounded-full border-2 border-accent px-6 py-3 font-bold text-accent hover:bg-creme-fonce"
                >
                  {FORMULAIRE.telecharger}
                </a>
              </>
            ) : (
              <button
                type="button"
                disabled={envoi}
                onClick={() => void revoirApercu(resultat)}
                className="rounded-full bg-accent px-6 py-3 font-bold text-white hover:bg-accent-clair disabled:opacity-60"
              >
                {envoi ? ACHAT.apercuEnCours : ACHAT.revoirApercu}
              </button>
            )}
          </div>
          {erreurs.length > 0 ? (
            <p role="alert" className="mt-4 font-bold text-brique">
              {erreurs.join(" ")}
            </p>
          ) : null}
          <dl className="mt-6 rounded-xl bg-creme-fonce px-4 py-3 text-sm">
            <dt className="font-bold">{FORMULAIRE.graineLibelle}</dt>
            <dd className="mt-1 font-mono text-base tracking-widest">{resultat.graine}</dd>
            <dd className="mt-1 text-encre-douce">{FORMULAIRE.graineAide}</dd>
          </dl>
          <button
            type="button"
            onClick={() => {
              if (resultat.url) URL.revokeObjectURL(resultat.url);
              // Composer un autre jeu abandonne l'aperçu, et avec lui la sauvegarde.
              oublierSauvegarde();
              setBrouillonLocal(brouillon);
              setResultatLocal(null);
              setErreurs([]);
              setEtape(0);
            }}
            className="mt-6 underline underline-offset-4 hover:text-accent"
          >
            {FORMULAIRE.refaire}
          </button>
        </section>
        {vente ? (
          <BlocAchat
            key={`${resultat.graine}`}
            configuration={resultat.configuration}
            graine={resultat.graine}
            brouillon={brouillon}
            paysInitial={sauvegarde?.graine === resultat.graine ? sauvegarde.pays : null}
            offre={vente}
          />
        ) : (
          <p className="mt-6 rounded-2xl border border-bordure bg-creme-fonce p-5 font-bold">{ACHAT.bientot}</p>
        )}
      </>
    );
  }

  return (
    <form
      onSubmit={(evenement) => {
        evenement.preventDefault();
        if (etape === total - 1) void envoyer();
        else avancer();
      }}
      noValidate
    >
      <p className="text-sm font-bold uppercase tracking-wide text-brique">
        {remplir(FORMULAIRE.etapeSur, { courante: etape + 1, total })}
      </p>
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-creme-fonce"
        role="progressbar"
        aria-valuenow={etape + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={remplir(FORMULAIRE.etapeSur, { courante: etape + 1, total })}
      >
        <span className="block h-full bg-accent" style={{ width: `${((etape + 1) / total) * 100}%` }} />
      </div>

      <h2 ref={titreRef} tabIndex={-1} className="mt-6 font-titre text-2xl text-accent">
        {infos.titre}
      </h2>
      <p className="mt-1 text-encre-douce">{infos.aide}</p>

      {erreurs.length > 0 ? (
        <div role="alert" className="mt-4 rounded-xl border-2 border-brique bg-white p-4">
          <p className="font-bold text-brique">
            {erreurs.length > 1 ? FORMULAIRE.titreErreursPluriel : FORMULAIRE.titreErreurs}
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {erreurs.map((erreur) => (
              <li key={erreur}>{erreur}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6">
        {etape === 0 ? (
          <GroupeChamps legende={FORMULAIRE.labelTheme}>
            <div className="grid gap-3">
              {LISTE_THEMES.map((theme) => (
                <CarteChoix
                  key={theme.id}
                  nom="theme"
                  valeur={theme.id}
                  coche={brouillon.theme === theme.id}
                  onChange={(valeur) => modifier({ theme: valeur as IdTheme })}
                  titre={theme.nom}
                  description={theme.accroche}
                  icone={theme.icones[0]}
                />
              ))}
            </div>
          </GroupeChamps>
        ) : null}

        {etape === 1 ? (
          <GroupeChamps legende={FORMULAIRE.labelAge}>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: AGE_MAX - AGE_MIN + 1 }, (_, i) => AGE_MIN + i).map((age) => (
                <label
                  key={age}
                  className={`cursor-pointer rounded-xl border-2 px-5 py-3 font-bold ${
                    brouillon.age === age ? "border-accent bg-accent text-white" : "border-bordure bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="age"
                    value={age}
                    checked={brouillon.age === age}
                    onChange={() => modifier({ age })}
                    className="sr-only"
                  />
                  {age} ans
                </label>
              ))}
            </div>
            {brouillon.age ? (
              <Resume>
                {remplir(FORMULAIRE.resumeFormat, {
                  format: LIBELLES_FORMATS[formatPourAge(brouillon.age)],
                  tranche: TRANCHES_AGE[formatPourAge(brouillon.age)],
                })}
              </Resume>
            ) : null}
          </GroupeChamps>
        ) : null}

        {etape === 2 ? (
          <ChampTexte
            id="prenom"
            label={FORMULAIRE.labelPrenom}
            aide={FORMULAIRE.aidePrenom}
            value={brouillon.prenom}
            maxLength={PRENOM_MAX}
            autoComplete="off"
            onChange={(evenement) => modifier({ prenom: evenement.target.value })}
          />
        ) : null}

        {etape === 3 ? (
          <GroupeChamps legende={FORMULAIRE.labelEnfants}>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: ENFANTS_MAX - ENFANTS_MIN + 1 }, (_, i) => ENFANTS_MIN + i).map((n) => (
                <label
                  key={n}
                  className={`cursor-pointer rounded-xl border-2 px-5 py-3 font-bold ${
                    brouillon.nombreEnfants === n ? "border-accent bg-accent text-white" : "border-bordure bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="nombreEnfants"
                    value={n}
                    checked={brouillon.nombreEnfants === n}
                    onChange={() => modifier({ nombreEnfants: n })}
                    className="sr-only"
                  />
                  {n}
                </label>
              ))}
            </div>
            {brouillon.age && brouillon.nombreEnfants ? (
              <Resume>
                {nombreEquipes(formatPourAge(brouillon.age), brouillon.nombreEnfants) > 1
                  ? remplir(FORMULAIRE.resumeEquipes.plusieurs, {
                      nombre: nombreEquipes(formatPourAge(brouillon.age), brouillon.nombreEnfants),
                    })
                  : FORMULAIRE.resumeEquipes.une}
              </Resume>
            ) : null}
          </GroupeChamps>
        ) : null}

        {etape === 4 ? (
          <GroupeChamps legende={FORMULAIRE.labelDuree}>
            <div className="grid gap-3 sm:grid-cols-3">
              {DUREES.map((duree) => (
                <CarteChoix
                  key={duree}
                  nom="duree"
                  valeur={String(duree)}
                  coche={brouillon.duree === duree}
                  onChange={(valeur) => modifier({ duree: Number(valeur) as Duree })}
                  titre={`${duree} minutes`}
                  description={
                    brouillon.age
                      ? `${nombreEtapes(formatPourAge(brouillon.age), duree)} étapes`
                      : undefined
                  }
                  icone="montre"
                />
              ))}
            </div>
            {regles ? (
              <Resume>
                {remplir(FORMULAIRE.resumeEtapes, { etapes: regles.etapes, minutes: regles.minutes })}
              </Resume>
            ) : null}
          </GroupeChamps>
        ) : null}

        {etape === 5 ? (
          <GroupeChamps legende={FORMULAIRE.labelCachettes}>
            <div className="mb-3 flex gap-3 text-sm">
              <button
                type="button"
                className="underline underline-offset-4 hover:text-accent"
                onClick={() => modifier({ cachettes: CACHETTES.map((c) => c.id) })}
              >
                {FORMULAIRE.toutCocher}
              </button>
              <button
                type="button"
                className="underline underline-offset-4 hover:text-accent"
                onClick={() => modifier({ cachettes: [] })}
              >
                {FORMULAIRE.toutDecocher}
              </button>
            </div>
            {PIECES.map((piece) => (
              <div key={piece} className="mb-5">
                <h3 className="mb-2 font-titre text-lg">{LIBELLES_PIECES[piece]}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {parPiece(piece).map((lieu) => (
                    <CarteChoix
                      key={lieu.id}
                      type="checkbox"
                      nom="cachettes"
                      valeur={lieu.id}
                      coche={brouillon.cachettes.includes(lieu.id)}
                      onChange={(valeur, coche) =>
                        modifier({
                          cachettes: coche
                            ? [...brouillon.cachettes, valeur]
                            : brouillon.cachettes.filter((id) => id !== valeur),
                        })
                      }
                      titre={lieu.libelle}
                      icone={lieu.icone}
                    />
                  ))}
                </div>
              </div>
            ))}
            {regles ? (
              <Resume>
                {remplir(
                  brouillon.cachettes.length >= regles.minimum
                    ? FORMULAIRE.compteurCachettesOk
                    : FORMULAIRE.compteurCachettes,
                  { cochees: brouillon.cachettes.length, minimum: regles.minimum },
                )}
              </Resume>
            ) : null}
          </GroupeChamps>
        ) : null}

        {etape === 6 ? (
          <>
            <ChampTexte
              id="date"
              label={FORMULAIRE.labelDate}
              value={brouillon.date}
              placeholder={FORMULAIRE.placeholderDate}
              onChange={(evenement) => modifier({ date: evenement.target.value })}
            />
            <ChampTexte
              id="heure"
              label={FORMULAIRE.labelHeure}
              value={brouillon.heure}
              placeholder={FORMULAIRE.placeholderHeure}
              onChange={(evenement) => modifier({ heure: evenement.target.value })}
            />
            <ChampTexte
              id="adresse"
              label={FORMULAIRE.labelAdresse}
              value={brouillon.adresse}
              placeholder={FORMULAIRE.placeholderAdresse}
              onChange={(evenement) => modifier({ adresse: evenement.target.value })}
            />
            <ChampTexte
              id="contact"
              label={FORMULAIRE.labelContact}
              value={brouillon.contact}
              placeholder={FORMULAIRE.placeholderContact}
              onChange={(evenement) => modifier({ contact: evenement.target.value })}
            />
            <div className="mb-4">
              <label htmlFor="invites" className="block font-bold">
                {FORMULAIRE.labelInvites}
              </label>
              <p id="invites-aide" className="mt-1 text-sm text-encre-douce">
                {FORMULAIRE.aideInvites}
              </p>
              <textarea
                id="invites"
                aria-describedby="invites-aide"
                rows={5}
                value={brouillon.invites}
                onChange={(evenement) => modifier({ invites: evenement.target.value })}
                className="mt-2 w-full rounded-xl border-2 border-bordure bg-white px-4 py-3 text-base focus:border-accent"
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {etape > 0 ? (
          <button
            type="button"
            onClick={reculer}
            className="rounded-full border-2 border-accent px-6 py-3 font-bold text-accent hover:bg-creme-fonce"
          >
            {FORMULAIRE.precedent}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={envoi}
          className="rounded-full bg-accent px-7 py-3 font-bold text-white hover:bg-accent-clair disabled:opacity-60"
        >
          {etape === total - 1 ? (envoi ? FORMULAIRE.enCours : FORMULAIRE.voirApercu) : FORMULAIRE.suivant}
        </button>
      </div>
      <p aria-live="polite" className="sr-only">
        {envoi ? FORMULAIRE.enCours : ""}
      </p>
    </form>
  );
}
