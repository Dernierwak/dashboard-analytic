"use client";

import { useTransition } from "react";
import { saveObjectif } from "@/app/actions";

const OBJECTIFS = [
  { value: "", label: "Objectif : non défini" },
  { value: "ventes", label: "Objectif : plus de ventes / contacts" },
  { value: "notoriete", label: "Objectif : plus de notoriété / portée" },
  { value: "engagement", label: "Objectif : plus d'engagement" },
];

// L'objectif re-pondère les conseils (comme dans le dashboard). Le changement
// est pris en compte à la prochaine publication du rapport.
export function ObjectifSelect({ current }: { current: string | null }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={current ?? ""}
      disabled={pending}
      onChange={(e) =>
        startTransition(async () => {
          await saveObjectif(e.target.value || null);
        })
      }
      className="text-[11.5px] font-medium text-muted bg-white border border-line rounded-full px-3 py-1.5 outline-none cursor-pointer hover:bg-black/[0.02] disabled:opacity-50"
      title="Re-pondère tes conseils — pris en compte au prochain rapport"
    >
      {OBJECTIFS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
