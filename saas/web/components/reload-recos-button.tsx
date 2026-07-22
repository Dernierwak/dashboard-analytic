"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { triggerReport, checkFetchStatus } from "@/app/actions";

type Phase = "idle" | "running" | "ready" | "failed" | "error";

// « ↻ Recharger mes conseils » : recalcule le rapport (conseils par thème) à
// partir des données déjà en base, sans re-fetch réseau (~30 s), puis propose
// de recharger la page. Même mécanique de suivi que le bouton Mes données.
export function ReloadRecosButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const startPolling = () => {
    const startedAt = Date.now();
    let checks = 0;
    pollRef.current = setInterval(async () => {
      checks += 1;
      if (Date.now() - startedAt > 5 * 60_000) {
        clearInterval(pollRef.current!);
        setPhase("error");
        setMessage("Toujours en cours après 5 min — vérifie l'onglet Actions sur GitHub.");
        return;
      }
      const res = await checkFetchStatus();
      if (res.state === "pending" || (res.state === "success" && checks <= 1)) {
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
        setMessage("Le recalcul a échoué — regarde l'onglet Actions sur GitHub.");
      }
    }, 8_000);
  };

  const launch = () =>
    startTransition(async () => {
      const res = await triggerReport();
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
        className="text-[11px] font-semibold text-white bg-pos rounded-full px-3 py-1 hover:opacity-90 transition-opacity animate-pulse shrink-0"
      >
        ✓ Conseils prêts — recharger
      </button>
    );
  }

  return (
    <div className="relative shrink-0">
      <button
        disabled={pending || phase === "running"}
        onClick={launch}
        className={`text-[11px] font-semibold rounded-full px-3 py-1 border transition-colors disabled:opacity-70 ${
          phase === "running"
            ? "text-warn border-warn/30 bg-warn/[0.06]"
            : "text-brand border-brand/30 hover:bg-brand/[0.06]"
        }`}
      >
        {pending ? "…" : phase === "running" ? "◌ recalcul…" : "↻ Recharger mes conseils"}
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
