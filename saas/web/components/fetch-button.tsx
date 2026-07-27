"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { triggerFetch, checkFetchStatus } from "@/app/actions";

type Phase = "idle" | "running" | "ready" | "failed" | "error";

// Les étapes réelles du worker, dans l'ordre où il les exécute — le temps
// indiqué est le moment où chacune démarre en général. Ça permet de dire ce
// qui se passe pendant l'attente au lieu d'un sablier muet.
const ETAPES: { at: number; label: string }[] = [
  { at: 0, label: "Lancement de la récolte" },
  { at: 20, label: "Publicités Meta" },
  { at: 60, label: "Posts Instagram" },
  { at: 240, label: "Google Ads" },
  { at: 300, label: "Google Analytics" },
  { at: 360, label: "Classement des contenus par l'IA" },
  { at: 400, label: "Rédaction de ton rapport" },
];
const DUREE_TYPE = 460; // secondes : la barre vise ça, sans jamais atteindre 100 %

function etapeDe(sec: number): string {
  let cur = ETAPES[0].label;
  for (const e of ETAPES) if (sec >= e.at) cur = e.label;
  return cur;
}

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// « ↻ Mes données » : déclenche le fetch GitHub Actions pour cet utilisateur,
// suit son état avec une barre de progression, et propose de recharger la page.
export function FetchButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pending, startTransition] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const stopAll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
  };

  const startPolling = () => {
    const startedAt = Date.now();
    setElapsed(0);
    tickRef.current = setInterval(
      () => setElapsed(Math.round((Date.now() - startedAt) / 1000)),
      1000
    );
    let checks = 0;
    pollRef.current = setInterval(async () => {
      checks += 1;
      if (Date.now() - startedAt > 15 * 60_000) {
        stopAll();
        setPhase("error");
        setMessage("Toujours en cours après 15 min — vérifie l'onglet Actions sur GitHub.");
        return;
      }
      const res = await checkFetchStatus();
      if (res.state === "pending" || (res.state === "success" && checks <= 1)) {
        // (au 1er check, un run « success » peut être l'ANCIEN run — on attend)
        setPhase("running");
        return;
      }
      if (res.state === "success") {
        stopAll();
        setPhase("ready");
        setMessage(null);
      } else if (res.state === "failure") {
        stopAll();
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

  // Progression estimée : elle avance avec le temps écoulé et plafonne à 92 %
  // tant que GitHub n'a pas confirmé la fin — jamais de faux 100 %.
  const pourcent = Math.min(92, Math.round((elapsed / DUREE_TYPE) * 100));

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
        {pending ? "…" : phase === "running" ? `◌ récolte ${pourcent} %` : "↻ Mes données"}
      </button>

      {phase === "running" && (
        <div className="absolute right-0 top-full mt-2 w-64 z-20 rounded-lg border border-line bg-white shadow-card px-3 py-2.5">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11.5px] font-semibold text-ink">{etapeDe(elapsed)}</span>
            <span className="font-mono text-[10.5px] text-faint">{mmss(elapsed)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-black/[0.07] overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-1000 ease-linear"
              style={{ width: `${Math.max(4, pourcent)}%` }}
            />
          </div>
          <p className="text-[10.5px] text-faint mt-1.5 leading-relaxed">
            Compte 5 à 8 minutes. Tu peux fermer la page — la récolte continue de son
            côté et les données t&apos;attendront ici.
          </p>
        </div>
      )}

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
