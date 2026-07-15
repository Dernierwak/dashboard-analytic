"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

// Filtres Statut / Campagne / Thème — comme les multiselects du Streamlit.
// Chaque changement met à jour l'URL (?status=…&camp=…&label=…) → la page
// serveur re-filtre KPIs, graphe et tables ensemble.
export function FilterBar({
  statusOptions,
  campOptions,
  labels,
  current,
}: {
  statusOptions: string[];
  campOptions: { key: string; name: string }[];
  labels: string[];
  current: { status: string; camp: string; label: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const set = (key: string, value: string) => {
    const q = new URLSearchParams(sp.toString());
    if (value) q.set(key, value);
    else q.delete(key);
    router.push(`${pathname}?${q.toString()}`);
  };

  const cls =
    "text-[11.5px] font-medium rounded-full border px-2.5 py-1.5 outline-none cursor-pointer bg-white max-w-[180px]";
  const active = "border-brand/30 text-brand";
  const idle = "border-line text-muted";
  const hasFilter = current.status || current.camp || current.label;

  return (
    <div className="flex items-center gap-2 flex-wrap mb-5">
      {statusOptions.length > 0 && (
        <select
          value={current.status}
          onChange={(e) => set("status", e.target.value)}
          className={`${cls} ${current.status ? active : idle}`}
        >
          <option value="">Statut : tous</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s === "ACTIVE" ? "● Actives" : s === "PAUSED" ? "◦ En pause" : s}
            </option>
          ))}
        </select>
      )}
      <select
        value={current.camp}
        onChange={(e) => set("camp", e.target.value)}
        className={`${cls} ${current.camp ? active : idle}`}
      >
        <option value="">Campagne : toutes</option>
        {campOptions.map((c) => (
          <option key={c.key} value={c.key}>
            {c.name}
          </option>
        ))}
      </select>
      {labels.length > 0 && (
        <select
          value={current.label}
          onChange={(e) => set("label", e.target.value)}
          className={`${cls} ${current.label ? active : idle}`}
        >
          <option value="">Thème : tous</option>
          {labels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      )}
      {hasFilter && (
        <button
          onClick={() => {
            const q = new URLSearchParams(sp.toString());
            q.delete("status");
            q.delete("camp");
            q.delete("label");
            router.push(`${pathname}?${q.toString()}`);
          }}
          className="text-[11px] font-semibold text-neg"
        >
          ✕ effacer les filtres
        </button>
      )}
    </div>
  );
}
