"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { COMMANDE } from "@/contenu/vente";
import { oublierSauvegarde } from "./sauvegarde";

/** Le nom proposé par le serveur, lu dans Content-Disposition. */
function nomDuFichier(entete: string | null): string {
  const trouve = entete ? /filename="([^"]+)"/.exec(entete) : null;
  return trouve?.[1] ?? "mission-gateau.pdf";
}

/**
 * Le bouton « Télécharger mon jeu ». Il appelle la route du kit en POST : la
 * page elle-même ne génère rien, et un robot qui suit le lien de l'e-mail
 * n'actionne pas ce bouton. Une fois le fichier reçu, la page se met à jour :
 * elle dit alors quand le premier téléchargement a eu lieu.
 */
export function Telechargement({ reference, sessionId }: { reference: string; sessionId: string | null }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const telecharger = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const reponse = await fetch(`/api/commande/${encodeURIComponent(reference)}/kit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
      });
      if (!reponse.ok) {
        const corps = (await reponse.json().catch(() => null)) as { erreur?: unknown } | null;
        setErreur(typeof corps?.erreur === "string" ? corps.erreur : COMMANDE.payee.erreurReseau);
        return;
      }
      const url = URL.createObjectURL(await reponse.blob());
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = nomDuFichier(reponse.headers.get("Content-Disposition"));
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      router.refresh();
    } catch {
      setErreur(COMMANDE.payee.erreurReseau);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => void telecharger()}
        disabled={envoi}
        className="rounded-full bg-accent px-7 py-3 text-lg font-bold text-white hover:bg-accent-clair disabled:opacity-60"
      >
        {envoi ? COMMANDE.payee.enCours : COMMANDE.payee.bouton}
      </button>
      {erreur ? (
        <p role="alert" className="mt-4 rounded-xl border-2 border-brique bg-white p-4 font-bold text-brique">
          {erreur}
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {envoi ? COMMANDE.payee.enCours : ""}
      </p>
    </div>
  );
}

/** Une fois la commande payée, l'onglet oublie ce qu'il gardait pour le paiement. */
export function OublierSauvegarde() {
  useEffect(() => {
    oublierSauvegarde();
  }, []);
  return null;
}
