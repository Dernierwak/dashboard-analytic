"use client";

import { useTransition } from "react";
import { choisirCompte } from "@/app/actions";
import type { Compte } from "@/lib/account";

// Le sélecteur de compte — n'apparaît que si tu as accès à plus d'un dashboard.
// Quand tu regardes celui de quelqu'un d'autre, il le dit clairement : rien
// n'est plus déroutant que d'agir sur un compte en croyant être sur le sien.
export function CompteSwitch({
  comptes,
  actif,
}: {
  comptes: Compte[];
  actif: string;
}) {
  const [pending, startTransition] = useTransition();
  if (comptes.length < 2) return null;
  const courant = comptes.find((c) => c.id === actif);
  const invite = courant && courant.role !== "owner";

  return (
    <div className="flex items-center gap-2">
      {invite && (
        <span className="text-[10px] font-bold uppercase tracking-wide text-warn bg-warn/10 rounded-full px-2 py-1 whitespace-nowrap">
          {courant?.role === "viewer" ? "lecture seule" : "invité"}
        </span>
      )}
      <select
        disabled={pending}
        value={actif}
        onChange={(e) =>
          startTransition(async () => {
            await choisirCompte(e.target.value);
            window.location.reload();
          })
        }
        aria-label="Compte affiché"
        className={`text-[11.5px] font-semibold rounded-full border px-3 py-1.5 outline-none max-w-[190px] truncate ${
          invite ? "border-warn/40 bg-warn/[0.06] text-ink" : "border-line bg-white text-ink"
        }`}
      >
        {comptes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
