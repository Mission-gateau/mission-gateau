"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { remplir } from "@/engine/texte";
import { COMMANDE } from "@/contenu/vente";

type Affichage = "envoi" | "en_attente" | "echec" | "non_enregistree" | "impossible";

/** Au plus six nouvelles tentatives, espacées de cinq secondes, tant que Resend répond « en cours ». */
const ESSAIS_EN_ATTENTE = 6;
const ATTENTE_MS = 5000;

/**
 * La page d'une commande payée dont la confirmation n'est pas encore partie
 * l'envoie à son chargement, par la route de confirmation (en POST : la page
 * elle-même ne génère rien). Une fois l'e-mail parti, la page se recharge et
 * propose le téléchargement ; tant qu'il n'est pas parti, aucun bouton de
 * téléchargement n'apparaît.
 */
export function Confirmation({
  reference,
  sessionId,
  email,
}: {
  reference: string;
  sessionId: string | null;
  email: string;
}) {
  const router = useRouter();
  const [affichage, setAffichage] = useState<Affichage>("envoi");
  /** Chaque changement relance l'envoi : au chargement, après une attente, ou sur « Réessayer ». */
  const [tentative, setTentative] = useState(0);
  const attentes = useRef(0);
  // L'envoi ne dépend que de la commande : jamais de l'identité du routeur,
  // pour qu'un nouveau rendu ne relance pas la requête.
  const rafraichir = useRef(() => router.refresh());
  useEffect(() => {
    rafraichir.current = () => router.refresh();
  }, [router]);

  useEffect(() => {
    let abandonne = false;
    let minuterie: number | null = null;
    const envoyer = async () => {
      try {
        const reponse = await fetch(`/api/commande/${encodeURIComponent(reference)}/confirmation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
        });
        const corps = (await reponse.json().catch(() => null)) as { etat?: unknown } | null;
        if (abandonne) return;
        const etat = typeof corps?.etat === "string" ? corps.etat : null;
        if (etat === "en_cours") {
          if (attentes.current >= ESSAIS_EN_ATTENTE) {
            setAffichage("echec");
            return;
          }
          attentes.current += 1;
          setAffichage("en_attente");
          minuterie = window.setTimeout(() => setTentative((n) => n + 1), ATTENTE_MS);
          return;
        }
        if (etat === "impossible") {
          setAffichage("impossible");
          return;
        }
        if (etat === "non_enregistree") {
          setAffichage("non_enregistree");
          return;
        }
        if (etat === null || etat === "echec" || etat === "indisponible") {
          setAffichage("echec");
          return;
        }
        // Confirmée, ou la commande a changé d'état : la page dit la suite.
        rafraichir.current();
      } catch {
        if (!abandonne) setAffichage("echec");
      }
    };
    void envoyer();
    return () => {
      abandonne = true;
      if (minuterie !== null) window.clearTimeout(minuterie);
    };
  }, [tentative, reference, sessionId]);

  const texte =
    affichage === "envoi"
      ? COMMANDE.confirmation.envoi
      : affichage === "en_attente"
        ? COMMANDE.confirmation.enAttente
        : affichage === "impossible"
          ? remplir(COMMANDE.confirmation.impossible, { email })
          : affichage === "non_enregistree"
            ? COMMANDE.confirmation.nonEnregistree
            : remplir(COMMANDE.confirmation.echec, { email });
  const alerte = affichage === "echec" || affichage === "non_enregistree" || affichage === "impossible";

  return (
    <div className="mt-6">
      <p
        role={alerte ? "alert" : "status"}
        className={alerte ? "rounded-xl border-2 border-brique bg-white p-4 font-bold text-brique" : "rounded-xl bg-creme-fonce p-4"}
      >
        {texte}
      </p>
      {affichage === "echec" || affichage === "non_enregistree" ? (
        <button
          type="button"
          onClick={() => {
            attentes.current = 0;
            setAffichage("envoi");
            setTentative((n) => n + 1);
          }}
          className="mt-4 rounded-full border-2 border-accent px-6 py-2 font-bold text-accent hover:bg-creme-fonce"
        >
          {COMMANDE.confirmation.reessayer}
        </button>
      ) : null}
    </div>
  );
}
