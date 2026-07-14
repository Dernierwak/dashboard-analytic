"use client";

import { useTransition } from "react";
import { saveRecoFeedback, type Reaction } from "@/app/actions";

// Boutons de réaction sous chaque conseil — même boucle que le Streamlit :
// « Fait » nourrit la boucle de la preuve (effet mesuré la semaine suivante),
// « Utile » / « Pas pour moi » re-pondèrent les conseils de l'IA.
const BUTTONS: { reaction: Reaction; label: string; activeCls: string }[] = [
  { reaction: "done", label: "✓ Fait", activeCls: "bg-pos text-white border-pos" },
  { reaction: "useful", label: "● Utile", activeCls: "bg-brand text-white border-brand" },
  { reaction: "not_for_me", label: "✕ Pas pour moi", activeCls: "bg-faint text-white border-faint" },
];

export function RecoActions({ recoKey, current }: { recoKey: string; current: string | null }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 mt-3.5 pt-3 border-t border-line">
      {BUTTONS.map((b) => {
        const active = current === b.reaction;
        return (
          <button
            key={b.reaction}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await saveRecoFeedback(recoKey, b.reaction, active);
              })
            }
            className={`text-[11.5px] font-semibold rounded-full border px-3 py-1.5 transition-colors disabled:opacity-50 ${
              active
                ? b.activeCls
                : "border-line text-muted hover:bg-black/[0.03] bg-white"
            }`}
          >
            {b.label}
          </button>
        );
      })}
      {pending && <span className="text-[11px] text-faint ml-1">…</span>}
    </div>
  );
}
