"use client";

import { useTransition } from "react";
import { setCampaignLabel } from "@/app/actions";

// Assigne un label à une campagne, directement dans la table.
// source === "ai" → pastille IA (thème proposé par l'IA, corrigible : choisir
// un thème à la main le repasse en 'user' et la pastille disparaît).
export function CampaignLabelSelect({
  channel,
  campaignKey,
  campaignName,
  current,
  labels,
  source,
}: {
  channel: "meta" | "google";
  campaignKey: string;
  campaignName: string;
  current: string | null;
  labels: string[];
  source?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={current ?? ""}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            await setCampaignLabel(channel, campaignKey, campaignName, e.target.value || null);
          })
        }
        className={`text-[11px] font-medium rounded-full border px-2 py-1 outline-none cursor-pointer disabled:opacity-50 max-w-[130px] ${
          current
            ? "border-brand/25 text-brand bg-brand/[0.05]"
            : "border-line text-faint bg-white"
        }`}
      >
        <option value="">— aucun thème</option>
        {labels.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      {current && source === "ai" && (
        <span
          className="text-[9px] font-bold uppercase tracking-wide text-ig bg-ig/10 rounded px-1 py-0.5"
          title="Thème proposé par l'IA — choisis-en un pour le corriger"
        >
          IA
        </span>
      )}
    </span>
  );
}
