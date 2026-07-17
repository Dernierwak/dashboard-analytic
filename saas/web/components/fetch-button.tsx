"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { triggerFetch, checkFetchStatus } from "@/app/actions";

type Phase = "idle" | "running" | "ready" | "failed" | "error";

// « ↻ Mes données » : déclenche le fetch GitHub Actions pour cet utilisateur,
// suit son état, et propose de recharger la page quand tout est prêt.
export function FetchButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = () => {
    const startedAt = Date.now();
    // Petit délai avant le 1er check : le run GitHub met ~5 s à apparaître.
    let checks = 0;
    pollRef.current = setInterval(async () => {
      checks += 1;
      if (Date.now() - startedAt > 10 * 60_000) {
        clearInterval(pollRef.current!);
        setPhase("error");
        setMessage("Toujours en cours après 10 min — vérifie l'onglet Actions sur GitHub.");
        return;
      }
      const res = await checkFetchStatus();
      if (res.state === "pending" || (res.state === "success" && checks <= 1)) {
        // (au 1er check, un run « success » peut être l'ANCIEN run — on attend)
        setPhase("running");
        return;
      }
      if (res.state === "success") {
        clearInterval(pollRef.current!);
        setPhase("ready");
        setMessage(null);
      } else if (res.state === "failure") {
        clearInterval(pollRef.current!);
        setPhase("failed");
        setMessage("La récolte a échoué — regarde l'onglet Actions sur GitHub.");
      }
      // unknown → on continue de poller
    }, 12_000);
  };

  const launch = () =>
    startTransition(async () => {
      const res = await triggerFetch();
      if (!res.ok) {
        setPhase("error");
        setMessage(res.message);
        return;
      }
      setPhase("running");
      setMessage(null);
      startPolling();
    });

  if (phase === "ready") {
    return (
      <button
        onClick={() => window.location.reload()}
        className="text-[11px] font-semibold text-white bg-pos rounded-full px-3 py-1 hover:opacity-90 transition-opacity animate-pulse"
      >
        ✓ Données prêtes — recharger
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        disabled={pending || phase === "running"}
        onClick={launch}
        className={`text-[11px] font-semibold rounded-full px-3 py-1 border transition-colors disabled:opacity-70 ${
          phase === "running"
            ? "text-warn border-warn/30 bg-warn/[0.06]"
            : "text-brand border-brand/30 hover:bg-brand/[0.06]"
        }`}
      >
        {pending ? "…" : phase === "running" ? "◌ récolte en cours…" : "↻ Mes données"}
      </button>
      {message && (
        <div
          className={`absolute right-0 top-full mt-2 w-64 z-20 text-[11.5px] leading-relaxed rounded-lg border px-3 py-2 shadow-card bg-white ${
            phase === "failed" || phase === "error" ? "text-neg border-neg/25" : "text-ink border-line"
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
