"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  triggerCategorize,
  checkFetchStatus,
  compterCategoriesIA,
  annulerCategoriesIA,
} from "@/app/actions";

type Phase = "idle" | "running" | "ready" | "failed" | "error";

// « ✨ Classer mes conversions » : MÊME PATRON QUE `classify-button.tsx`
// (bouton → workflow GitHub Actions → poll → bloc d'annulation en bloc), sur
// les événements GA4 sans catégorie au lieu des campagnes/posts sans thème.
// Voir l'en-tête de `triggerClassify` (saas/web/app/actions.ts) pour pourquoi
// ce second classifieur ne contredit pas « une seule classification IA » —
// il porte sur un contenu différent.
//
// `sessionStorage` — MÊME RAISON que `classify-button.tsx` : le classement
// dure le temps d'un run GitHub Actions, l'utilisateur peut recharger ou
// changer d'onglet entre-temps, et l'annulation doit survivre aux deux.
const CLE_DEPUIS = "pulse.conversions.ia.depuis";

export function ClassifyConversionsButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [annulables, setAnnulables] = useState<number>(0);
  const [annulMessage, setAnnulMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  const lireDepuis = (): string | null => {
    try {
      return sessionStorage.getItem(CLE_DEPUIS);
    } catch {
      return null;
    }
  };
  const oublierDepuis = () => {
    try {
      sessionStorage.removeItem(CLE_DEPUIS);
    } catch {
      /* rien à faire */
    }
  };

  const recompter = useCallback(async () => {
    const depuis = lireDepuis();
    if (!depuis) {
      setAnnulables(0);
      return;
    }
    const r = await compterCategoriesIA(depuis);
    if (!r.ok) {
      setAnnulMessage(r.message ?? null);
      setAnnulables(0);
      return;
    }
    setAnnulables(r.n);
    if (r.n === 0) oublierDepuis();
  }, []);

  useEffect(() => {
    void recompter();
  }, [recompter]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = () => {
    const startedAt = Date.now();
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
        setPhase("running");
        return;
      }
      if (res.state === "success") {
        clearInterval(pollRef.current!);
        setPhase("ready");
        setMessage(null);
        void recompter();
      } else if (res.state === "failure") {
        clearInterval(pollRef.current!);
        setPhase("failed");
        setMessage("Le classement a échoué — regarde l'onglet Actions sur GitHub.");
      }
    }, 12_000);
  };

  const launch = () =>
    startTransition(async () => {
      const res = await triggerCategorize();
      if (!res.ok) {
        setPhase("error");
        setMessage(res.message);
        return;
      }
      if (res.depuis) {
        try {
          sessionStorage.setItem(CLE_DEPUIS, res.depuis);
        } catch {
          /* pas d'annulation possible dans cet onglet */
        }
      }
      setPhase("running");
      setMessage(null);
      startPolling();
    });

  const annuler = () =>
    startTransition(async () => {
      const depuis = lireDepuis();
      if (!depuis) return;
      const r = await annulerCategoriesIA(depuis);
      if (!r.ok) {
        setAnnulMessage(r.message ?? "Annulation impossible — réessaie.");
        return;
      }
      oublierDepuis();
      setAnnulables(0);
      setAnnulMessage(
        `${r.n} catégorie${r.n > 1 ? "s" : ""} retirée${r.n > 1 ? "s" : ""}. Les catégories que l'IA a créées restent dans ta liste — supprime-les si tu n'en veux pas.`
      );
      router.refresh();
    });

  const bloc = (
    <>
      {annulables > 0 && (
        <div className="mt-2 rounded-lg border border-brand/25 bg-brand/[0.05] px-3 py-2">
          <p className="text-[11.5px] text-ink leading-relaxed">
            L&apos;IA vient de catégoriser{" "}
            <span className="font-semibold">
              {annulables} conversion{annulables > 1 ? "s" : ""}
            </span>
            . Tes choix à la main n&apos;ont pas bougé.
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <button
              disabled={pending}
              onClick={annuler}
              className="text-[11px] font-semibold text-neg border border-neg/30 rounded-full px-3 py-1 hover:bg-neg/[0.06] disabled:opacity-50"
            >
              {pending ? "…" : `Annuler ces ${annulables}`}
            </button>
            <button
              onClick={() => {
                oublierDepuis();
                setAnnulables(0);
              }}
              className="text-[11px] font-semibold text-faint px-2 py-1"
            >
              Je les garde
            </button>
          </div>
        </div>
      )}
      {annulMessage && (
        <p className="mt-2 text-[11px] text-muted leading-relaxed max-w-sm">
          {annulMessage}{" "}
          <button
            onClick={() => setAnnulMessage(null)}
            className="font-semibold text-faint underline"
          >
            fermer
          </button>
        </p>
      )}
    </>
  );

  if (phase === "ready") {
    return (
      <div className="min-w-0">
        <button
          onClick={() => {
            setPhase("idle");
            router.refresh();
            void recompter();
          }}
          className="text-[11px] font-semibold text-white bg-pos rounded-full px-3 py-1 hover:opacity-90 transition-opacity animate-pulse"
        >
          ✓ Conversions catégorisées — recharger
        </button>
        {bloc}
      </div>
    );
  }

  return (
    <div className="relative shrink-0 min-w-0">
      <button
        disabled={pending || phase === "running"}
        onClick={launch}
        className={`text-[11px] font-semibold rounded-full px-3 py-1 border transition-colors disabled:opacity-70 ${
          phase === "running"
            ? "text-warn border-warn/30 bg-warn/[0.06]"
            : "text-brand border-brand/30 hover:bg-brand/[0.06]"
        }`}
      >
        {pending ? "…" : phase === "running" ? "◌ classement en cours…" : "✨ Classer mes conversions via l'IA"}
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
      {bloc}
    </div>
  );
}
