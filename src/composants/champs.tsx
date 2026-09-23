"use client";

import Image from "next/image";
import type { ReactNode } from "react";

/** Briques de formulaire : grandes cibles tactiles, focus visible, AA partout. */

export function CarteChoix({
  nom,
  valeur,
  coche,
  onChange,
  titre,
  description,
  icone,
  type = "radio",
}: {
  nom: string;
  valeur: string;
  coche: boolean;
  onChange: (valeur: string, coche: boolean) => void;
  titre: string;
  description?: string;
  icone?: string;
  type?: "radio" | "checkbox";
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors ${
        coche ? "border-accent bg-white" : "border-bordure bg-white/60 hover:border-accent-clair"
      }`}
    >
      <input
        type={type}
        name={nom}
        value={valeur}
        checked={coche}
        onChange={(evenement) => onChange(valeur, evenement.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-[#0f4c5c]"
      />
      {icone ? <Image src={`/icones/${icone}.png`} alt="" width={28} height={28} aria-hidden /> : null}
      <span className="min-w-0">
        <span className="block font-bold">{titre}</span>
        {description ? <span className="mt-0.5 block text-sm text-encre-douce">{description}</span> : null}
      </span>
    </label>
  );
}

export function ChampTexte({
  id,
  label,
  aide,
  erreur,
  ...props
}: {
  id: string;
  label: string;
  aide?: string;
  erreur?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const idAide = aide ? `${id}-aide` : undefined;
  const idErreur = erreur ? `${id}-erreur` : undefined;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block font-bold">
        {label}
      </label>
      {aide ? (
        <p id={idAide} className="mt-1 text-sm text-encre-douce">
          {aide}
        </p>
      ) : null}
      <input
        id={id}
        aria-describedby={[idAide, idErreur].filter(Boolean).join(" ") || undefined}
        aria-invalid={erreur ? true : undefined}
        className={`mt-2 w-full rounded-xl border-2 bg-white px-4 py-3 text-base ${
          erreur ? "border-brique" : "border-bordure focus:border-accent"
        }`}
        {...props}
      />
      {erreur ? (
        <p id={idErreur} className="mt-1.5 text-sm font-bold text-brique">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

export function GroupeChamps({
  legende,
  aide,
  erreur,
  children,
}: {
  legende: string;
  aide?: string;
  erreur?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="mb-4 border-0 p-0">
      <legend className="font-bold">{legende}</legend>
      {aide ? <p className="mt-1 text-sm text-encre-douce">{aide}</p> : null}
      <div className="mt-3">{children}</div>
      {erreur ? (
        <p className="mt-2 text-sm font-bold text-brique" role="alert">
          {erreur}
        </p>
      ) : null}
    </fieldset>
  );
}

export function Resume({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-xl bg-creme-fonce px-4 py-3 text-sm" aria-live="polite">
      {children}
    </p>
  );
}
