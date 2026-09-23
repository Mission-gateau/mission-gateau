import Image from "next/image";

/**
 * Reconstitution fidèle, en HTML, de quatre pages du kit.
 *
 * Ce ne sont pas des captures : les mêmes textes, la même hiérarchie et la
 * même sobriété que le PDF, pour montrer honnêtement ce qui sort de
 * l'imprimante sans alourdir la page d'images.
 */

function Feuille({ children, titre }: { children: React.ReactNode; titre: string }) {
  return (
    <figure className="flex flex-col">
      <div className="aspect-[1/1.414] overflow-hidden rounded-lg border border-bordure bg-white p-4 text-[7px] leading-snug shadow-sm sm:text-[8px]">
        {children}
      </div>
      <figcaption className="mt-2 text-center text-xs text-encre-douce">{titre}</figcaption>
    </figure>
  );
}

export function ApercusDuKit() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Feuille titre="Guide de l'organisateur">
        <p className="font-titre text-[11px] text-accent">Le trésor du capitaine</p>
        <p className="text-encre-douce">Guide de l&apos;organisateur</p>
        <div className="mt-2 space-y-1">
          {[
            ["0–5 min", "Accueil"],
            ["5–8 min", "Lecture de l'histoire"],
            ["8–14 min", "Étape 1"],
            ["14–20 min", "Étape 2"],
            ["20–26 min", "Étape 3"],
            ["26–32 min", "Étape 4"],
          ].map(([minute, titre]) => (
            <div key={minute} className="flex gap-2">
              <span className="w-12 shrink-0 font-bold">{minute}</span>
              <span>{titre}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 font-titre text-[9px] text-accent">Le plan de pose</p>
        <div className="mt-1 space-y-[2px]">
          {[
            ["1", "Sous le canapé"],
            ["2", "Dans le frigo"],
            ["3", "Sous l'oreiller"],
          ].map(([n, lieu]) => (
            <div key={n} className="flex gap-2 border-b border-bordure pb-[1px]">
              <span className="w-3">{n}</span>
              <span>{lieu}</span>
            </div>
          ))}
        </div>
      </Feuille>

      <Feuille titre="Carte-indice à découper">
        <div className="flex h-full flex-col rounded border border-bordure p-2">
          <div className="flex items-center justify-between border-b border-bordure pb-1">
            <span className="font-titre text-[8px]">Le trésor du capitaine</span>
            <span className="flex items-center gap-1">
              <Image src="/icones/etoile.png" alt="" width={8} height={8} aria-hidden />
              <span>Carte 3</span>
            </span>
          </div>
          <p className="mt-2 text-encre-douce">Le perroquet répète sans arrêt la même phrase :</p>
          <p className="mt-1 font-titre text-[8px]">L&apos;alphabet secret</p>
          <div className="mt-1 flex gap-[3px]">
            {["lettre_f", "lettre_r", "lettre_i", "lettre_g", "lettre_o"].map((cle) => (
              <span key={cle} className="flex flex-col items-center">
                <Image src={`/icones/${cle}.png`} alt="" width={11} height={11} aria-hidden />
                <span className="mt-[1px] block h-[1px] w-3 bg-bordure" />
              </span>
            ))}
          </div>
          <p className="mt-auto text-[6px] text-encre-douce">À poser : sous le tapis — étape 3</p>
        </div>
      </Feuille>

      <Feuille titre="Invitation">
        <div className="flex h-full flex-col rounded border border-dashed border-bordure p-2">
          <div className="flex items-center gap-1">
            <Image src="/icones/enveloppe.png" alt="" width={10} height={10} aria-hidden />
            <span className="font-titre text-[9px] text-accent">Le trésor du capitaine</span>
          </div>
          <p className="mt-2">Pour : ____________</p>
          <p className="mt-2 leading-relaxed">
            Avis à l&apos;équipage ! Le coffre d&apos;un vieux capitaine dort quelque part dans la
            maison. Viens le chercher avec nous.
          </p>
          <div className="mt-3 space-y-1">
            <p>Date : ____________</p>
            <p>Heure : ____________</p>
            <p>Adresse : ____________</p>
          </div>
          <p className="mt-auto text-[5px] text-encre-douce">Jeu créé sur missiongateau.com</p>
        </div>
      </Feuille>

      <Feuille titre="Diplôme">
        <div className="flex h-full flex-col items-center justify-center rounded border border-accent p-2 text-center">
          <Image src="/icones/medaille.png" alt="" width={20} height={20} aria-hidden />
          <p className="mt-1 font-titre text-[10px] text-accent">Diplôme de l&apos;équipage</p>
          <span className="mt-2 block h-[1px] w-2/3 bg-bordure" />
          <p className="mt-2 leading-relaxed">
            Ce diplôme est décerné pour avoir déchiffré les cartes du capitaine et ouvert le coffre
            caché.
          </p>
          <div className="mt-2 flex gap-1">
            <Image src="/icones/coupe.png" alt="" width={9} height={9} aria-hidden />
            <Image src="/icones/gateau.png" alt="" width={9} height={9} aria-hidden />
            <Image src="/icones/cadeau.png" alt="" width={9} height={9} aria-hidden />
          </div>
        </div>
      </Feuille>
    </div>
  );
}
