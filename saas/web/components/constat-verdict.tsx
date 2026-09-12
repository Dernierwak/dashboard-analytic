"use client";

import { useState, useTransition } from "react";
import { saveInsightFeedback } from "@/app/actions";
import { Erreur } from "@/components/erreur";

// LE VERDICT DU CLIENT SUR UN CONSTAT — « ✓ ça me parle » / « ✗ pas d'accord ».
//
// Il n'a rien d'un « j'aime » : un constat rejeté reste ÉCARTÉ quand le moteur
// le régénère à l'identique la semaine suivante (`insight_feedback`, clé stable,
// réappliquée par `saas/recos_ia/insights.py`). C'est donc le seul endroit où le
// client peut dire à Pulse qu'il se trompe sur son propre compte, et ça se dit
// dans le bouton — sans ça, il clique sur un avis sans savoir qu'il coupe une
// mesure.
//
// RE-CLIQUER LE MÊME VERDICT LE RETIRE (`saveInsightFeedback`, `active`) : un
// clic pris par erreur se défait par le même geste que celui qui l'a posé.

const VERDICTS: { value: "agree" | "reject"; label: string; actif: string; titre: string }[] = [
  {
    value: "agree",
    label: "✓ Ça me parle",
    actif: "bg-pos text-white border-pos",
    titre: "Ce constat est juste — Pulse continuera de s'appuyer dessus",
  },
  {
    value: "reject",
    label: "✗ Pas d'accord",
    actif: "bg-faint text-white border-faint",
    titre: "Ce constat est faux — Pulse l'écartera, même régénéré à l'identique",
  },
];

export function ConstatVerdict({
  constatKey,
  verdict,
}: {
  constatKey: string;
  verdict: "agree" | "reject" | null;
}) {
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div className="mt-2.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {VERDICTS.map((v) => {
          const actif = verdict === v.value;
          return (
            <button
              key={v.value}
              type="button"
              disabled={pending}
              title={v.titre}
              onClick={() =>
                startTransition(async () => {
                  setErreur(null);
                  const r = await saveInsightFeedback(constatKey, v.value, actif);
                  if (!r?.ok) setErreur(r?.message ?? "Ça n'a pas été enregistré.");
                })
              }
              className={`text-[10.5px] font-semibold rounded-full px-2.5 py-1 border transition-colors disabled:opacity-50 ${
                actif ? v.actif : "border-line text-muted bg-white hover:bg-black/[0.03]"
              }`}
            >
              {v.label}
            </button>
          );
        })}
        {verdict === "reject" && (
          <span className="text-[10.5px] text-faint">
            écarté des prochains rapports
          </span>
        )}
      </div>
      {erreur && <Erreur texte={erreur} onFermer={() => setErreur(null)} />}
    </div>
  );
}
