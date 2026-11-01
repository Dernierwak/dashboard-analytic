"use client";

import { useRef } from "react";

// Le défilement du rail des canaux : glisser (le `snap-x` natif suffit) ou ‹ ›.
// Seul morceau client du module — les cartes restent rendues côté serveur et
// arrivent en `children`, pour que la colonne des changements (ticket 06)
// puisse lire ses données sans passer par le navigateur.
export function RailDefilant({
  titre,
  plusieurs,
  children,
}: {
  titre: React.ReactNode;
  /** Une carte seule n'a rien à faire défiler : pas de ‹ ›. */
  plusieurs: boolean;
  children: React.ReactNode;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const defiler = (sens: 1 | -1) =>
    rail.current?.scrollBy({ left: sens * rail.current.clientWidth * 0.9, behavior: "smooth" });

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        {titre}
        <div className={`gap-1.5 shrink-0 mb-3.5 ${plusieurs ? "flex" : "hidden"}`}>
          {([[-1, "‹", "Canal précédent"], [1, "›", "Canal suivant"]] as const).map(([sens, glyphe, nom]) => (
            <button
              key={sens}
              type="button"
              onClick={() => defiler(sens)}
              aria-label={nom}
              className="h-8 w-8 rounded-full border border-line bg-white text-muted hover:text-ink"
            >
              {glyphe}
            </button>
          ))}
        </div>
      </div>
      <div ref={rail} className="flex gap-3.5 overflow-x-auto snap-x snap-mandatory pb-2">
        {children}
      </div>
    </>
  );
}
