"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  triggerClassify,
  checkFetchStatus,
  compterEtiquettesIA,
  annulerEtiquettesIA,
} from "@/app/actions";

type Phase = "idle" | "running" | "ready" | "failed" | "error";

// « ✨ Classer mes contenus » : l'IA donne un thème à chaque post et campagne
// sans thème (workflow GitHub en mode label_only), puis on propose de recharger.
// Un label posé à la main n'est jamais réécrit — le worker saute tout ce qui
// porte `label_source='user'`.
//
// IL APPLIQUE DIRECTEMENT, SANS VALIDATION PRÉALABLE. C'est la décision de
// David, et elle se défend : demander de valider quarante propositions une par
// une, c'est le travail qu'on prétendait éviter. Mais appliquer sans demander
// n'autorise pas à être négligent, et ça se paie en deux garanties.
//
//   1. RIEN N'ÉCRASE UN CHOIX HUMAIN. Garantie côté worker (il ne collecte que
//      les items sans label et sans source 'user') ET côté base (la clause
//      `label_source='ai'` de l'annulation).
//   2. TOUT EST ANNULABLE EN BLOC, tant qu'on est sur la page. C'est ce que ce
//      composant ajoute.
//
// POURQUOI `sessionStorage` ET PAS UN ÉTAT REACT.
// Le classement dure une minute et l'utilisateur recharge, change d'onglet,
// revient. Un état React ne survit à aucun des trois. `sessionStorage` survit
// au rechargement et à la navigation, et meurt avec l'onglet — ce qui est
// exactement la portée demandée, « tant que l'utilisateur est sur la page ».
// La clé ne contient qu'une date ISO : rien de sensible, rien d'exploitable.
//
// La valeur stockée vient du SERVEUR (`triggerClassify` la renvoie) : l'horloge
// du navigateur n'a aucune raison d'être d'accord avec celle de Postgres, et
// c'est Postgres qui horodate les étiquettes.
const CLE_DEPUIS = "pulse.labels.ia.depuis";

export function ClassifyButton({
  libelle = "✨ Classer mes contenus",
  /** true sur la page Thèmes : le bloc « annuler ces N étiquettes » apparaît
   *  sous le bouton. Ailleurs (l'assistant de mise en route), le geste est un
   *  pas du parcours et n'a rien à défaire — on ne l'encombre pas. */
  avecAnnulation = false,
}: {
  libelle?: string;
  avecAnnulation?: boolean;
} = {}) {
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
      return null; // navigation privée verrouillée : on perd l'annulation, pas la page
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
    const r = await compterEtiquettesIA(depuis);
    if (!r.ok) {
      setAnnulMessage(r.message ?? null);
      setAnnulables(0);
      return;
    }
    setAnnulables(r.n);
    // Un passage qui n'a rien produit n'a rien à annuler : on referme.
    if (r.n === 0) oublierDepuis();
  }, []);

  // Au montage : si un classement a eu lieu dans cet onglet, l'offre
  // d'annulation revient — y compris après un rechargement complet.
  useEffect(() => {
    if (avecAnnulation) void recompter();
  }, [avecAnnulation, recompter]);

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
        // (au 1er check, un run « success » peut être l'ANCIEN run — on attend)
        setPhase("running");
        return;
      }
      if (res.state === "success") {
        clearInterval(pollRef.current!);
        setPhase("ready");
        setMessage(null);
        if (avecAnnulation) void recompter();
      } else if (res.state === "failure") {
        clearInterval(pollRef.current!);
        setPhase("failed");
        setMessage("Le classement a échoué — regarde l'onglet Actions sur GitHub.");
      }
      // unknown → on continue de poller
    }, 12_000);
  };

  const launch = () =>
    startTransition(async () => {
      const res = await triggerClassify();
      if (!res.ok) {
        setPhase("error");
        setMessage(res.message);
        return;
      }
      if (res.depuis) {
        try {
          sessionStorage.setItem(CLE_DEPUIS, res.depuis);
        } catch {
          /* pas d'annulation possible dans cet onglet — le bloc ne s'affichera pas */
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
      const r = await annulerEtiquettesIA(depuis);
      if (!r.ok) {
        setAnnulMessage(r.message ?? "Annulation impossible — réessaie.");
        return;
      }
      oublierDepuis();
      setAnnulables(0);
      setAnnulMessage(
        `${r.n} étiquette${r.n > 1 ? "s" : ""} retirée${r.n > 1 ? "s" : ""}. Les thèmes que l'IA a créés restent dans ta liste — supprime-les si tu n'en veux pas.`
      );
      // `router.refresh()` plutôt qu'un rechargement complet : les listes
      // repartent du serveur, ce bloc reste monté avec son message.
      router.refresh();
    });

  const bloc = (
    <>
      {avecAnnulation && annulables > 0 && (
        <div className="mt-2 rounded-lg border border-ig/25 bg-ig/[0.05] px-3 py-2">
          <p className="text-[11.5px] text-ink leading-relaxed">
            L&apos;IA vient de poser{" "}
            <span className="font-semibold">
              {annulables} étiquette{annulables > 1 ? "s" : ""}
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
            if (avecAnnulation) void recompter();
          }}
          className="text-[11px] font-semibold text-white bg-pos rounded-full px-3 py-1 hover:opacity-90 transition-opacity animate-pulse"
        >
          ✓ Contenus classés — recharger
        </button>
        {bloc}
      </div>
    );
  }

  // `shrink-0` : dans l'assistant de mise en route, le bouton partage une
  // rangée flex avec « Plus tard » et ne doit pas se faire écraser. Sur la page
  // Thèmes il vit dans un bloc, la classe y est sans effet — et c'est voulu :
  // le pavé d'annulation qu'il porte y fait 320 px, il ne pourrait pas tenir
  // dans une rangée à 375 px.
  return (
    <div className="relative shrink-0 min-w-0">
      <button
        disabled={pending || phase === "running"}
        onClick={launch}
        className={`text-[11px] font-semibold rounded-full px-3 py-1 border transition-colors disabled:opacity-70 ${
          phase === "running"
            ? "text-warn border-warn/30 bg-warn/[0.06]"
            : "text-ig border-ig/30 hover:bg-ig/[0.06]"
        }`}
      >
        {pending ? "…" : phase === "running" ? "◌ classement en cours…" : libelle}
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
