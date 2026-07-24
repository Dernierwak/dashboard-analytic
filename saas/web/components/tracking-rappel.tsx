"use client";

import { useTransition } from "react";
import { resolveAction } from "@/app/actions";
import type { TrackedAction } from "@/lib/report";

// Phase 3 — le rappel automatique : quand une action arrive à échéance (~2 sem.),
// le rapport te ramène dessus tout en haut. Tu ne subis plus, tu boucles.

function weeksAgo(iso: string): string {
  const then = new Date(iso + "T00:00:00").getTime();
  const days = Math.max(0, Math.round((Date.now() - then) / 86_400_000));
  if (days < 10) return `il y a ${days} jour${days > 1 ? "s" : ""}`;
  const w = Math.round(days / 7);
  return `il y a ${w} semaine${w > 1 ? "s" : ""}`;
}

const V: Record<string, { cls: string; border: string; icon: string; label: string }> = {
  better: { cls: "text-pos", border: "#1a7a4a", icon: "✓", label: "ça a marché" },
  worse: { cls: "text-neg", border: "#c0392b", icon: "▲", label: "pas d'effet — à revoir" },
  stable: { cls: "text-warn", border: "#b86b00", icon: "≈", label: "stable" },
};

function Card({ a, verified }: { a: TrackedAction; verified: boolean }) {
  const [pending, startTransition] = useTransition();
  const v = verified ? V[a.verdict ?? "stable"] ?? V.stable : null;
  return (
    <div
      className="bg-white border border-line rounded-xl shadow-card px-4 py-3"
      style={{ borderLeft: `3px solid ${v ? v.border : "#b86b00"}` }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {v ? (
              <span className={`text-[11px] font-bold ${v.cls}`}>{v.icon} {v.label}</span>
            ) : (
              <span className="text-[11px] font-bold text-warn">◷ à juger maintenant</span>
            )}
            <span className="text-[10px] uppercase tracking-wide text-faint font-semibold">
              lancé {weeksAgo(a.decided_at)}
            </span>
          </div>
          <div className="text-[13.5px] font-semibold text-ink leading-snug mt-0.5">
            {a.title}
            {a.theme && <span className="text-faint font-normal"> · {a.theme}</span>}
          </div>
          {verified && a.metric_label && a.then !== undefined ? (
            <div className="text-[12px] text-muted mt-0.5">
              {a.metric_label} <b className="text-ink">{a.then}</b> →{" "}
              <b className="text-ink">{a.now}</b>
              {a.delta != null && (
                <span className={v?.cls}> ({a.delta > 0 ? "+" : ""}{a.delta.toFixed(0)} %)</span>
              )}
            </div>
          ) : (
            <div className="text-[12px] text-muted mt-0.5">
              2 semaines ont passé — est-ce que ça a bougé pour toi ?
            </div>
          )}
        </div>
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await resolveAction(a.id, "done"); })}
          className="shrink-0 text-[11px] font-semibold text-white bg-pos rounded-full px-3 py-1.5 disabled:opacity-50"
        >
          ✓ Vu
        </button>
      </div>
    </div>
  );
}

export function TrackingRappel({
  tracking,
}: {
  tracking: { running: TrackedAction[]; verified: TrackedAction[] };
}) {
  const dueRunning = tracking.running.filter((a) => a.due);
  const items = [
    ...tracking.verified.map((a) => ({ a, verified: true })),
    ...dueRunning.map((a) => ({ a, verified: false })),
  ].slice(0, 3);
  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-[13px] font-semibold text-ink mb-2">
        ◷ Tes tests arrivent à échéance
        <span className="text-faint font-normal"> — reviens sur ce que tu as lancé</span>
      </h2>
      <div className="grid gap-2.5 lg:grid-cols-2">
        {items.map(({ a, verified }) => (
          <Card key={a.id} a={a} verified={verified} />
        ))}
      </div>
    </section>
  );
}
