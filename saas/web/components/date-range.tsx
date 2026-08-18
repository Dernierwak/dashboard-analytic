"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Une plage « du … au … » écrite dans l'URL — les presets 7/14/30/90/Tout ne
// couvrent pas tout, ni pour la période affichée ni pour ce à quoi on la compare.
//
// LE MÊME OBJET SERT LES DEUX, avec d'autres noms de paramètres. Le module de
// comparaison a besoin exactement de ce sélecteur : deux dates, une validation,
// une croix pour revenir en arrière. En écrire un second aurait donné deux
// composants qui divergent sur le détail qui compte — ici, le refus silencieux
// quand la date de fin précède celle de début.
export function DateRange({
  from,
  to,
  champs = ["from", "to"],
  efface = ["d"],
  pose,
  etiquette = "ou du",
}: {
  from?: string;
  to?: string;
  /** Les deux paramètres d'URL à écrire. */
  champs?: [string, string];
  /** Ce qu'il faut retirer de l'URL en posant la plage (la période affichée
   *  chasse le preset `d` ; la plage de comparaison ne chasse rien). */
  efface?: string[];
  /** Ce qu'il faut poser en plus — le mode de comparaison, par exemple. */
  pose?: Record<string, string>;
  etiquette?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [f, setF] = useState(from ?? "");
  const [t, setT] = useState(to ?? "");
  const active = Boolean(from && to);
  const [cDebut, cFin] = champs;

  const apply = () => {
    if (!f || !t || f > t) return;
    const q = new URLSearchParams(sp.toString());
    q.set(cDebut, f);
    q.set(cFin, t);
    for (const k of efface) q.delete(k);
    for (const [k, v] of Object.entries(pose ?? {})) q.set(k, v);
    router.push(`${pathname}?${q.toString()}`);
  };
  const clear = () => {
    const q = new URLSearchParams(sp.toString());
    q.delete(cDebut);
    q.delete(cFin);
    // Le mode posé avec la plage part avec elle : garder `cmp=custom` sans
    // dates laisserait le module réclamer une plage qu'on vient d'effacer.
    for (const k of Object.keys(pose ?? {})) q.delete(k);
    router.push(`${pathname}?${q.toString()}`);
  };

  const inputCls =
    "rounded-full border border-line bg-white px-2.5 py-1 text-[11.5px] text-muted outline-none focus:border-brand";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[11px] text-faint">{etiquette}</span>
      <input type="date" value={f} onChange={(e) => setF(e.target.value)} className={inputCls} />
      <span className="text-[11px] text-faint">au</span>
      <input type="date" value={t} onChange={(e) => setT(e.target.value)} className={inputCls} />
      <button
        onClick={apply}
        disabled={!f || !t || f > t}
        className={`text-[11.5px] font-semibold rounded-full px-3 py-1 border transition-colors disabled:opacity-40 ${
          active ? "bg-ink text-white border-ink" : "border-line text-muted hover:bg-black/[0.03] bg-white"
        }`}
      >
        OK
      </button>
      {active && (
        <button onClick={clear} className="text-[11px] font-semibold text-neg">
          ✕
        </button>
      )}
    </div>
  );
}
