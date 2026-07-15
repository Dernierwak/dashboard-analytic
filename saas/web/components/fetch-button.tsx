"use client";

import { useState, useTransition } from "react";
import { triggerFetch } from "@/app/actions";

// « ↻ Mes données » : déclenche le fetch GitHub Actions pour cet utilisateur.
export function FetchButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(true);
  const [pending, startTransition] = useTransition();

  return (
    <div className="relative">
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await triggerFetch();
            setOk(res.ok);
            setMessage(res.message);
          })
        }
        className="text-[11px] font-semibold text-brand border border-brand/30 rounded-full px-3 py-1 hover:bg-brand/[0.06] disabled:opacity-50 transition-colors"
      >
        {pending ? "…" : "↻ Mes données"}
      </button>
      {message && (
        <div
          className={`absolute right-0 top-full mt-2 w-64 z-10 text-[11.5px] leading-relaxed rounded-lg border px-3 py-2 shadow-card bg-white ${
            ok ? "text-ink border-line" : "text-neg border-neg/25"
          }`}
        >
          {message}
          <button
            onClick={() => setMessage(null)}
            className="block mt-1 text-[10.5px] font-semibold text-faint"
          >
            fermer
          </button>
        </div>
      )}
    </div>
  );
}
