"use client";

import { useState, useTransition } from "react";
import { saveCategoryForEvent } from "@/app/actions";

// Assigne une catégorie à une conversion, directement dans la table —
// MÊME PATRON QUE `CampaignLabelSelect` (thème d'une campagne), sur
// `ga4_event_categories` au lieu de `meta_campaign_config.label` : même
// select inline, même code couleur (rempli = brand, vide = faint).
export function ConversionCategorySelect({
  eventName,
  current,
  categories,
}: {
  eventName: string;
  current: string | null;
  categories: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={current ?? ""}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            const r = await saveCategoryForEvent(eventName, e.target.value || null);
            setMessage(r.ok ? null : r.message ?? null);
          })
        }
        title="Catégorie de cette conversion"
        className={`text-[11px] font-medium rounded-full border px-2 py-1 outline-none cursor-pointer disabled:opacity-50 max-w-[140px] ${
          current
            ? "border-brand/25 text-brand bg-brand/[0.05]"
            : "border-line text-faint bg-white"
        }`}
      >
        <option value="">— sans catégorie</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {message && <span className="text-[10px] text-neg">{message}</span>}
    </span>
  );
}
