"use client";

import { useState, useTransition } from "react";
import { saveParier } from "@/app/actions";
import { SENS, dateCourte } from "@/components/etat-action";

// LE PARI. Ce que tu penses qu'il va se passer, dit AVANT de savoir.
//
// C'est la seule récompense du produit qui ne se triche pas : la réponse tombe
// du worker quatorze jours plus tard, pas du clic. Un compteur d'actions
// appliquées récompense le geste — et comme cocher « fait » écrit une baseline
// dans `suivi_actions`, cocher pour faire monter un compteur fabrique un
// verdict faux qui repondère ensuite les conseils. Ici, on ne gagne qu'en ayant
// vu juste, et c'est le produit qui tranche.
//
// Sa place est dans la carte du conseil, au moment où tu décides — parier en
// relisant l'historique, c'est parier après coup.
export function Pari({
  id,
  metricLabel,
  checkAt,
  pariInitial = null,
  compact = false,
}: {
  id: string;
  metricLabel: string | null;
  checkAt: string;
  pariInitial?: "hausse" | "stable" | "baisse" | null;
  /** Dans le rail, la colonne est étroite : le rappel tient sur une ligne. */
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [choisi, setChoisi] = useState<string | null>(pariInitial);
  if (!metricLabel) return null;

  if (choisi) {
    const mot = SENS.find((x) => x.cle === choisi)?.mot ?? choisi;
    return (
      <div className={`text-[11.5px] text-muted ${compact ? "mt-1" : "mt-2"}`}>
        Tu paries que <span className="font-semibold text-ink">{metricLabel}</span> va{" "}
        <span className="font-semibold text-ink">{mot}</span> — réponse le{" "}
        {dateCourte(checkAt)}.
      </div>
    );
  }
  return (
    <div className={compact ? "mt-1.5" : "mt-2.5"}>
      <div className="text-[11.5px] text-muted mb-1">
        À ton avis, <span className="font-semibold text-ink">{metricLabel}</span> va…
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {SENS.map((x) => (
          <button
            key={x.cle}
            disabled={pending}
            onClick={() => {
              setChoisi(x.cle);
              startTransition(async () => {
                const r = await saveParier(id, x.cle);
                if (!r.ok) setChoisi(null);
              });
            }}
            className="text-[11.5px] font-semibold text-brand border border-brand/25 rounded-full px-2.5 py-1 hover:bg-brand/[0.06] disabled:opacity-50"
          >
            {x.mot}
          </button>
        ))}
      </div>
    </div>
  );
}
