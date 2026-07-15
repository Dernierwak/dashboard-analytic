"use client";

import { useState, useTransition } from "react";
import { saveBudget } from "@/app/actions";
import type { MonthRow } from "@/lib/couts";

const fmt = (n: number) => n.toLocaleString("fr-CH", { maximumFractionDigits: 0 });

function BudgetCell({
  channel,
  monthIso,
  initial,
}: {
  channel: string;
  monthIso: string;
  initial: number;
}) {
  const [value, setValue] = useState(initial > 0 ? String(Math.round(initial)) : "");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        step={50}
        value={value}
        placeholder="—"
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        onBlur={() => {
          if (Number(value || 0) !== Math.round(initial)) {
            startTransition(async () => {
              await saveBudget(channel, Number(value || 0), monthIso);
              setSaved(true);
            });
          }
        }}
        className="w-20 rounded-md border border-line bg-canvas px-1.5 py-1 text-[12px] font-mono text-ink outline-none focus:border-brand text-right disabled:opacity-50"
        disabled={pending}
      />
      {saved && <span className="text-pos text-[11px]">✓</span>}
    </span>
  );
}

// Table des budgets de l'année — on travaille directement dedans :
// budget éditable par mois × canal (enregistré au blur), dépensé en regard,
// Σ par ligne, carry-forward affiché (un mois vide hérite du précédent).
export function BudgetYearTable({ months }: { months: MonthRow[] }) {
  const totMetaB = months.reduce((a, r) => a + r.metaBudget, 0);
  const totMetaS = months.reduce((a, r) => a + r.metaSpent, 0);
  const totGoogB = months.reduce((a, r) => a + r.googleBudget, 0);
  const totGoogS = months.reduce((a, r) => a + r.googleSpent, 0);

  return (
    <div className="bg-white border border-line rounded-xl shadow-card overflow-x-auto">
      <table className="w-full min-w-[640px] text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-faint">
            <th className="text-left font-semibold px-4 py-3">Mois</th>
            <th className="text-right font-semibold px-2 py-3">
              <span style={{ color: "#1a56ff" }}>▣</span> Budget
            </th>
            <th className="text-right font-semibold px-2 py-3">Dépensé</th>
            <th className="text-right font-semibold px-2 py-3">
              <span style={{ color: "#1a7a4a" }}>◆</span> Budget
            </th>
            <th className="text-right font-semibold px-2 py-3">Dépensé</th>
            <th className="text-right font-semibold px-4 py-3">Σ dépensé</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {months.map((r) => (
            <tr key={r.monthIso} className={r.isFuture ? "opacity-60" : ""}>
              <td className="px-4 py-2 font-medium text-ink whitespace-nowrap">
                {r.isCurrent && <span className="text-brand">● </span>}
                {r.name}
              </td>
              <td className="px-2 py-2 text-right">
                <BudgetCell channel="meta" monthIso={r.monthIso} initial={r.metaBudget} />
              </td>
              <td className="px-2 py-2 text-right font-mono text-muted">
                {r.isFuture ? "—" : `${fmt(r.metaSpent)} CHF`}
              </td>
              <td className="px-2 py-2 text-right">
                <BudgetCell channel="google" monthIso={r.monthIso} initial={r.googleBudget} />
              </td>
              <td className="px-2 py-2 text-right font-mono text-muted">
                {r.isFuture ? "—" : `${fmt(r.googleSpent)} CHF`}
              </td>
              <td className="px-4 py-2 text-right font-mono text-ink font-medium">
                {r.isFuture ? "—" : `${fmt(r.metaSpent + r.googleSpent)} CHF`}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line bg-black/[0.02]">
            <td className="px-4 py-2.5 font-semibold text-ink">Total {months[0]?.name.slice(-4)}</td>
            <td className="px-2 py-2.5 text-right font-mono text-muted">{fmt(totMetaB)} CHF</td>
            <td className="px-2 py-2.5 text-right font-mono text-ink">{fmt(totMetaS)} CHF</td>
            <td className="px-2 py-2.5 text-right font-mono text-muted">{fmt(totGoogB)} CHF</td>
            <td className="px-2 py-2.5 text-right font-mono text-ink">{fmt(totGoogS)} CHF</td>
            <td className="px-4 py-2.5 text-right font-mono text-ink font-semibold">
              {fmt(totMetaS + totGoogS)} CHF
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="text-[10.5px] text-faint px-4 py-2.5">
        Le budget se reporte tout seul (carry-forward) : ne le ressaisis que quand il change.
        Sauvegardé dès que tu quittes la case.
      </p>
    </div>
  );
}
