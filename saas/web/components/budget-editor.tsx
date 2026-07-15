"use client";

import { useState, useTransition } from "react";
import { saveBudget } from "@/app/actions";

// Édition inline du budget mensuel d'un canal (mois en cours).
// Le carry-forward s'applique ensuite : les mois suivants reprennent ce montant
// tant qu'on ne le change pas — même règle que le dashboard.
export function BudgetEditor({ channel, current }: { channel: string; current: number }) {
  const [value, setValue] = useState(current > 0 ? String(Math.round(current)) : "");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = Number(value || 0) !== Math.round(current);

  return (
    <div className="flex items-center gap-2 mt-3">
      <label className="text-[11px] text-faint font-semibold uppercase tracking-wide">
        Budget mensuel
      </label>
      <input
        type="number"
        min={0}
        step={50}
        value={value}
        placeholder="0"
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        className="w-28 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px] font-mono text-ink outline-none focus:border-brand text-right"
      />
      <span className="text-[12px] text-faint">CHF</span>
      {dirty && (
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await saveBudget(channel, Number(value || 0));
              setSaved(true);
            })
          }
          className="text-[11.5px] font-semibold text-white bg-brand rounded-full px-3 py-1.5 hover:bg-brand/90 disabled:opacity-50"
        >
          {pending ? "…" : "Enregistrer"}
        </button>
      )}
      {saved && !dirty && <span className="text-[11.5px] text-pos font-semibold">✓ enregistré</span>}
    </div>
  );
}
