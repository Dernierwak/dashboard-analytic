"use client";

import { useTransition } from "react";
import { setCampaignLabel } from "@/app/actions";

// Assigne un label à une campagne, directement dans la table.
export function CampaignLabelSelect({
  channel,
  campaignKey,
  campaignName,
  current,
  labels,
}: {
  channel: "meta" | "google";
  campaignKey: string;
  campaignName: string;
  current: string | null;
  labels: string[];
}) {
  const [pending, startTransition] = useTransition();
  return (
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
  );
}
