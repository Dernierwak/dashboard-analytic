"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Période custom « du … au … » — complète les presets 7/14/30/90/Tout.
export function DateRange({ from, to }: { from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [f, setF] = useState(from ?? "");
  const [t, setT] = useState(to ?? "");
  const active = Boolean(from && to);

  const apply = () => {
    if (!f || !t || f > t) return;
    const q = new URLSearchParams(sp.toString());
    q.set("from", f);
    q.set("to", t);
    q.delete("d");
    router.push(`${pathname}?${q.toString()}`);
  };
  const clear = () => {
    const q = new URLSearchParams(sp.toString());
    q.delete("from");
    q.delete("to");
    router.push(`${pathname}?${q.toString()}`);
  };

  const inputCls =
    "rounded-full border border-line bg-white px-2.5 py-1 text-[11.5px] text-muted outline-none focus:border-brand";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[11px] text-faint">ou du</span>
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
