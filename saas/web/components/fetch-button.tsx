"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { triggerFetch, checkFetchStatus } from "@/app/actions";

type Phase = "idle" | "running" | "ready" | "failed" | "error";

// « ↻ Mes données » — déclenche la récolte et la suit.
//
// LA VÉRITÉ EST SUR GITHUB, PAS DANS CE COMPOSANT. C'est le changement de
// fond. Avant, tout l'état vivait ici : lancer depuis la page Connexions puis
// aller voir son rapport démontait le composant, tuait le sondage, et la
// récolte devenait invisible alors qu'elle tournait toujours. Deux exemplaires
// cohabitent d'ailleurs — un dans la barre latérale, un sur /comptes — et
// chacun ignorait l'autre.
//
// Désormais chaque exemplaire demande au montage l'état du dernier run et
// reconstruit tout à partir de sa date de départ. Changer de page, recharger,
// ouvrir un second onglet : la barre reprend là où elle en est.
//
// ET IL N'Y A PLUS DE COUPERET. L'ancienne version abandonnait à 15 minutes
// avec « vérifie l'onglet Actions » — sur un premier chargement de 200 posts
// Instagram, la récolte prend 16 minutes et RÉUSSIT. On annonçait donc un échec
// une minute avant la victoire. Une récolte longue est signalée comme longue,
// jamais comme cassée.

// Les étapes réelles du worker, dans l'ordre. Les secondes sont indicatives :
// la première récolte d'un compte est cent fois plus longue que les suivantes,
// parce que c'est elle qui rapatrie tout l'historique Instagram.
const ETAPES: { at: number; label: string }[] = [
  { at: 0, label: "Lancement de la récolte" },
  { at: 20, label: "Publicités Meta" },
  { at: 60, label: "Posts Instagram" },
  { at: 420, label: "Google Ads" },
  { at: 480, label: "Google Analytics" },
  { at: 540, label: "Classement des contenus par l'IA" },
  { at: 600, label: "Rédaction de ton rapport" },
];
const LONGUE = 10 * 60; // au-delà, on prévient que c'est long — pas que c'est cassé

function etapeDe(sec: number): string {
  let cur = ETAPES[0].label;
  for (const e of ETAPES) if (sec >= e.at) cur = e.label;
  return cur;
}

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, "0")}`;
}

// La barre n'estime pas une durée — elle n'en connaît aucune qui vaille pour
// les deux cas (2 min en routine, 16 min au premier chargement). Elle approche
// 92 % sans jamais l'atteindre : elle avance vite au début, lentement ensuite,
// et ne promet jamais une fin qu'elle ne sait pas dater.
function avancement(sec: number): number {
  return Math.round(92 * (1 - Math.exp(-sec / 260)));
}

export function FetchButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [debut, setDebut] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lien, setLien] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Le moment où CE navigateur a demandé la récolte. Il sert à ne pas prendre
  // le run précédent pour le nôtre pendant les secondes où GitHub n'a pas
  // encore enregistré le nouveau.
  const demandeA = useRef<number | null>(null);

  const stopAll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    pollRef.current = null;
    tickRef.current = null;
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  // Le chronomètre part de la date du run, pas du montage du composant.
  useEffect(() => {
    if (phase !== "running" || debut === null) return;
    const maj = () => setElapsed(Math.max(0, Math.round((Date.now() - debut) / 1000)));
    maj();
    tickRef.current = setInterval(maj, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [phase, debut]);

  const lire = useCallback(
    async (premier: boolean) => {
      const res = await checkFetchStatus();
      if (res.debut) setLien(res.url ?? null);
      const neuf = res.debut ? Date.parse(res.debut) : null;
      // Un run terminé mais ANTÉRIEUR à notre demande est l'ancien : GitHub ne
      // publie le nouveau qu'après quelques secondes. On patiente.
      const aNous =
        demandeA.current === null || (neuf !== null && neuf >= demandeA.current - 60_000);

      if (res.state === "pending") {
        setDebut(neuf);
        setPhase("running");
        return;
      }
      if (!aNous) {
        setPhase("running");
        return;
      }
      if (res.state === "success") {
        stopAll();
        // Au tout premier coup d'œil sans demande de notre part, un run réussi
        // est simplement le dernier en date : rien à annoncer.
        setPhase(premier && demandeA.current === null ? "idle" : "ready");
      } else if (res.state === "failure") {
        stopAll();
        setPhase("failed");
        setMessage("La récolte a échoué — regarde le détail du run sur GitHub.");
      }
    },
    [stopAll]
  );

  // Au montage : si une récolte tourne déjà, on la reprend en cours de route.
  // C'est ce qui rend la barre indépendante de la page où on se trouve.
  useEffect(() => {
    let vivant = true;
    (async () => {
      const res = await checkFetchStatus();
      if (!vivant || res.state !== "pending") return;
      setDebut(res.debut ? Date.parse(res.debut) : Date.now());
      setLien(res.url ?? null);
      setPhase("running");
    })();
    return () => {
      vivant = false;
    };
  }, []);

  // Le sondage vit tant qu'une récolte tourne, quelle qu'en soit l'origine.
  useEffect(() => {
    if (phase !== "running" || pollRef.current) return;
    pollRef.current = setInterval(() => void lire(false), 12_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [phase, lire]);

  const launch = () =>
    startTransition(async () => {
      demandeA.current = Date.now();
      const res = await triggerFetch();
      if (!res.ok) {
        setPhase("error");
        setMessage(res.message);
        return;
      }
      setDebut(Date.now());
      setMessage(null);
      setPhase("running");
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

  const pourcent = avancement(elapsed);
  const longue = elapsed > LONGUE;

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
            {longue ? (
              <>
                C&apos;est plus long que d&apos;habitude, et c&apos;est normal la première
                fois : la récolte rapatrie tout ton historique de publications. Elle va au
                bout.
              </>
            ) : (
              <>
                Compte 2 à 15 minutes selon ce qu&apos;il reste à rapatrier. Tu peux changer
                de page ou fermer l&apos;onglet — la barre te retrouvera.
              </>
            )}
          </p>
          {lien && (
            <a
              href={lien}
              target="_blank"
              rel="noreferrer"
              className="block mt-1.5 text-[10.5px] font-semibold text-brand hover:underline"
            >
              voir le détail →
            </a>
          )}
        </div>
      )}

      {message && (
        <div
          className={`absolute right-0 top-full mt-2 w-64 z-20 text-[11.5px] leading-relaxed rounded-lg border px-3 py-2 shadow-card bg-white ${
            phase === "failed" || phase === "error" ? "text-neg border-neg/25" : "text-ink border-line"
          }`}
        >
          {message}
          {lien && (
            <a
              href={lien}
              target="_blank"
              rel="noreferrer"
              className="block mt-1 text-[10.5px] font-semibold text-brand hover:underline"
            >
              voir le détail →
            </a>
          )}
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
