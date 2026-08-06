"use client";

import { useState, useTransition } from "react";
import { resolveAction } from "@/app/actions";
import type { TrackedAction } from "@/lib/report";
import { Triangle } from "@/components/pente";

// « Ce que tu dois faire » — le bloc tout en haut du rapport.
// C'est le SEUL bloc teinté de la page : sur un empilement de cartes blanches
// toutes identiques, la couleur de fond suffit à dire « ici, on agit » sans
// avoir à lire un titre. Un conseil que tu décides de tester atterrit ici et
// n'en bouge plus tant que tu ne l'as pas coché. Une fois fait, il passe en
// observation 14 jours, puis revient te demander un verdict. Chaque étape est
// écrite dans Supabase (running → done → archived) : c'est ça, le suivi.

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

function jour(iso: string): string {
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(dt.getTime())) return iso;
  return `${dt.getDate()} ${MOIS[dt.getMonth()]}`;
}

function depuis(iso: string): string {
  const t = new Date(iso + "T00:00:00").getTime();
  if (isNaN(t)) return "";
  const days = Math.max(0, Math.round((Date.now() - t) / 86_400_000));
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 14) return `il y a ${days} jours`;
  return `il y a ${Math.round(days / 7)} semaines`;
}

// « Pas d'effet » portait un ▲ ROUGE, pointe en haut, sur une mauvaise
// nouvelle : le troisième sens du triangle, et le plus trompeur des trois.
// Le verdict emprunte maintenant la flèche du delta RÉEL — un chiffre qui a
// baissé montre une flèche vers le bas, quoi qu'on pense du résultat.
const V: Record<string, { cls: string; border: string; icon: string | null; label: string }> = {
  better: { cls: "text-pos", border: "#1a7a4a", icon: "✓", label: "ça a marché" },
  worse: { cls: "text-neg", border: "#c0392b", icon: null, label: "pas d'effet — à revoir" },
  stable: { cls: "text-warn", border: "#b86b00", icon: "≈", label: "stable" },
};

function Marque({ icon, delta }: { icon: string | null; delta?: number | null }) {
  if (icon) return <>{icon}</>;
  if (delta === null || delta === undefined || Math.abs(delta) < 0.5) return <>✕</>;
  return <Triangle sens={delta > 0 ? "haut" : "bas"} />;
}

// Un échec doit se voir et se comprendre : un clic sans réponse est la chose
// qui fait le plus douter d'un produit.
function Erreur({ texte, onFermer }: { texte: string; onFermer: () => void }) {
  return (
    <div className="mt-2 text-[11.5px] leading-snug text-neg bg-neg/[0.06] border border-neg/25 rounded-lg px-3 py-2">
      {texte}
      <button onClick={onFermer} className="block mt-1 text-[10.5px] font-semibold text-faint">
        fermer
      </button>
    </div>
  );
}

// À FAIRE — une ligne de liste à cocher. La pastille EST le geste « fait » :
// 44 px de cible, un sens universel, et rien à lire pour comprendre.
function TodoRow({ a }: { a: TrackedAction }) {
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [coche, setCoche] = useState(false);

  const marquerFait = () => {
    setErreur(null);
    setCoche(true); // retour optimiste : la coche part avant la réponse serveur
    startTransition(async () => {
      const r = await resolveAction(a.id, "done", a.reco_key);
      if (!r.ok) {
        setCoche(false);
        setErreur(r.message ?? "Enregistrement impossible — réessaie.");
      }
    });
  };

  return (
    <div className="py-3">
      <div className="flex items-start gap-1">
        <button
          onClick={marquerFait}
          disabled={pending || coche}
          role="checkbox"
          aria-checked={coche}
          aria-label={`Marquer « ${a.title} » comme fait`}
          className="shrink-0 h-11 w-11 -ml-2.5 flex items-center justify-center group"
        >
          <span
            className={`h-[22px] w-[22px] rounded-full border-2 flex items-center justify-center text-[13px] font-bold transition-colors ${
              coche
                ? "bg-pos border-pos text-white"
                : "border-brand/40 text-transparent group-hover:border-brand group-hover:bg-brand/10"
            }`}
          >
            ✓
          </span>
        </button>
        <div className="min-w-0 flex-1 pt-2">
          <div className="text-[14.5px] font-semibold text-ink leading-snug">{a.title}</div>
          <div className="text-[11.5px] text-faint mt-0.5">
            {a.theme && <span className="text-warn font-semibold">★ {a.theme} · </span>}
            décidé {depuis(a.decided_at)}
            {a.detail?.effort ? ` · ⏱ ${a.detail.effort}` : ""}
            {a.metric_label ? ` · on suivra : ${a.metric_label}` : ""}
          </div>

          {/* Le conseil aura disparu du rapport dans deux jours : sans son
              détail sous la main, l'action redevient un titre énigmatique. */}
          {(a.detail?.observation || a.detail?.pourquoi || a.detail?.verifier) && (
            <details className="group mt-1.5">
              <summary className="text-[11.5px] font-semibold text-brand cursor-pointer select-none list-none">
                <span className="group-open:hidden">▸ Voir pourquoi</span>
                <span className="hidden group-open:inline">▾ Replier</span>
              </summary>
              <div className="mt-1.5 space-y-1.5">
                {a.detail?.observation && (
                  <p className="text-[12px] text-muted leading-relaxed">{a.detail.observation}</p>
                )}
                {a.detail?.pourquoi && (
                  <p className="text-[12px] text-muted leading-relaxed">
                    <span className="font-semibold text-ink">Pourquoi — </span>
                    {a.detail.pourquoi}
                  </p>
                )}
                {a.detail?.verifier && (
                  <p className="text-[12px] text-muted leading-relaxed">
                    <span className="font-semibold text-ink">Comment faire — </span>
                    {a.detail.verifier}
                  </p>
                )}
              </div>
            </details>
          )}
        </div>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setErreur(null);
              const r = await resolveAction(a.id, "drop");
              if (!r.ok) setErreur(r.message ?? "Impossible de retirer cette action — réessaie.");
            })
          }
          aria-label="Retirer de ma liste"
          title="Retirer de ma liste"
          className="shrink-0 h-11 w-11 -mr-2 flex items-center justify-center text-[15px] text-faint hover:text-muted"
        >
          ×
        </button>
      </div>
      {erreur && <Erreur texte={erreur} onFermer={() => setErreur(null)} />}
    </div>
  );
}

// À JUGER — l'action est faite depuis 2 semaines : voilà ce que ça a donné.
function JudgeCard({ a }: { a: TrackedAction }) {
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const v = a.verdict ? V[a.verdict] ?? V.stable : null;
  return (
    <div
      className="bg-white border border-line rounded-xl px-4 py-3.5"
      style={{ borderLeft: `3px solid ${v ? v.border : "#b86b00"}` }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {v ? (
          <span className={`text-[11px] font-bold ${v.cls}`}>
            <Marque icon={v.icon} delta={a.delta} /> {v.label}
          </span>
        ) : (
          <span className="text-[11px] font-bold text-warn">◷ à juger maintenant</span>
        )}
        <span className="text-[10px] uppercase tracking-wide text-faint font-semibold">
          fait {depuis(a.done_at ?? a.decided_at)}
        </span>
      </div>
      <div className="text-[14px] font-semibold text-ink leading-snug mt-1">{a.title}</div>
      {v && a.metric_label && a.then !== undefined ? (
        <div className="text-[12.5px] text-muted mt-1">
          {a.metric_label} <b className="text-ink">{a.then}</b> → <b className="text-ink">{a.now}</b>
          {a.delta != null && (
            <span className={v.cls}> ({a.delta > 0 ? "+" : ""}{a.delta.toFixed(0)} %)</span>
          )}
        </div>
      ) : (
        <div className="text-[12.5px] text-muted mt-1">
          Deux semaines ont passé — est-ce que ça a bougé pour toi ?
        </div>
      )}
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setErreur(null);
            const r = await resolveAction(a.id, "seen");
            if (!r.ok) setErreur(r.message ?? "Impossible de ranger cette action — réessaie.");
          })
        }
        className="mt-3 text-[13px] font-semibold text-white bg-ink rounded-full px-4 py-2.5 disabled:opacity-60"
      >
        {pending ? "…" : "✓ Vu — je range"}
      </button>
      {erreur && <Erreur texte={erreur} onFermer={() => setErreur(null)} />}
    </div>
  );
}

export function ActionTop({
  actions,
  num,
}: {
  actions: TrackedAction[];
  num?: number;
}) {
  const todo = actions.filter((a) => a.status !== "done");
  const judge = actions.filter((a) => a.status === "done" && a.due);
  const watch = actions.filter((a) => a.status === "done" && !a.due);

  const compte = [
    todo.length > 0 ? `${todo.length} à faire` : null,
    judge.length > 0 ? `${judge.length} à juger` : null,
    watch.length > 0 ? `${watch.length} en observation` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Liste vide : pas de boîte vide, mais le mécanisme expliqué en une ligne.
  // C'est le moment où l'utilisateur apprend comment l'outil fonctionne.
  if (actions.length === 0) {
    return (
      <section id="a-faire" className="mb-8 scroll-mt-4">
        <div className="rounded-xl border border-dashed border-line bg-black/[0.015] px-4 py-3">
          <span className="text-[12.5px] text-muted leading-relaxed">
            <span className="font-semibold text-ink">Ta liste est vide.</span> Descends
            aux conseils et prends-en un —{" "}
            <a href="#conseils" className="text-brand font-semibold hover:underline">
              il atterrira ici ↓
            </a>{" "}
            et y restera jusqu&apos;à ce que tu le coches.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section
      id="a-faire"
      className="mb-8 scroll-mt-4 rounded-2xl border border-brand/[0.18] bg-brand/[0.035] px-4 py-3.5 sm:px-5 sm:py-4"
    >
      <div className="flex items-baseline gap-2 flex-wrap mb-1">
        <h2 className="font-serif text-[19px] sm:text-[21px] leading-tight text-ink flex items-center gap-2.5">
          <span className="h-4 w-[3px] rounded-full bg-brand shrink-0" />
          {num !== undefined && (
            <span className="text-faint font-mono text-[15px]">{num}</span>
          )}{" "}
          Ce que tu dois faire
        </h2>
        {compte && <span className="text-[11.5px] text-muted font-medium">{compte}</span>}
      </div>

      {todo.length > 0 && (
        <div className="divide-y divide-brand/[0.12]">
          {todo.map((a) => (
            <TodoRow key={a.id} a={a} />
          ))}
        </div>
      )}

      {judge.length > 0 && (
        <div className="grid gap-2.5 lg:grid-cols-2 mt-3">
          {judge.map((a) => (
            <JudgeCard key={a.id} a={a} />
          ))}
        </div>
      )}

      {watch.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-brand/[0.12] space-y-1.5">
          {watch.map((a) => (
            <div key={a.id} className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-pos shrink-0">✓ fait</span>
              <span className="text-[13px] text-muted leading-snug">{a.title}</span>
              <span className="ml-auto text-[11px] text-faint shrink-0">
                verdict le <b className="text-muted">{jour(a.check_at)}</b>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
