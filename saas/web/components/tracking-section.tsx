"use client";

import { useTransition } from "react";
import { resolveAction } from "@/app/actions";
import type { TrackedAction } from "@/lib/report";

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
function d(iso: string): string {
  const dt = new Date(iso + "T00:00:00");
  return `${dt.getDate()} ${MOIS[dt.getMonth()]}`;
}

const VERDICT: Record<string, { icon: string; cls: string; label: string }> = {
  better: { icon: "✓", cls: "text-pos", label: "ça a marché" },
  worse: { icon: "▲", cls: "text-neg", label: "pas d'effet — à revoir" },
  stable: { icon: "≈", cls: "text-warn", label: "stable" },
};

function RunningCard({ a }: { a: TrackedAction }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="py-2.5">
      <div className="text-[12.5px] font-semibold text-ink leading-snug">
        {a.title}
        {a.theme && <span className="text-faint font-normal"> · {a.theme}</span>}
      </div>
      <div className="text-[11px] text-faint mt-0.5">
        lancé le {d(a.decided_at)} ·{" "}
        {a.due ? (
          <span className="text-warn font-semibold">à vérifier maintenant</span>
        ) : (
          <>verdict le <b className="text-ink">{d(a.check_at)}</b></>
        )}
        {a.metric_label ? ` · cible : ${a.metric_label}` : ""}
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await resolveAction(a.id, "done"); })}
          className="text-[11px] font-semibold text-white bg-pos rounded-full px-3 py-1 disabled:opacity-50"
        >
          ✓ C&apos;est fait
        </button>
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await resolveAction(a.id, "drop"); })}
          className="text-[11px] text-faint hover:text-muted px-1"
        >
          retirer
        </button>
      </div>
    </div>
  );
}

// « Suivi de tes conseils » : ce que tu as décidé de tester reste ici jusqu'à
// être fait/vérifié. À l'échéance, on remesure l'indicateur → verdict.
export function TrackingSection({
  tracking,
}: {
  tracking: { running: TrackedAction[]; verified: TrackedAction[] };
}) {
  const { running, verified } = tracking;
  if (running.length === 0 && verified.length === 0) return null;

  return (
    <section className="mb-9">
      <h2 className="text-[14px] font-semibold text-ink mb-3">
        <span className="text-faint font-mono mr-1.5">4</span> Suivi de tes conseils
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="bg-white border border-line rounded-xl shadow-card p-4">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1">
            ◷ En cours ({running.length})
          </div>
          {running.length > 0 ? (
            <div className="divide-y divide-line">
              {running.map((a) => (
                <RunningCard key={a.id} a={a} />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-faint mt-1">
              Rien en test. Sur un conseil, clique « ▶ Je le teste » : il atterrit ici
              et on revérifie dans 2 semaines.
            </p>
          )}
        </div>

        <div className="bg-white border border-line rounded-xl shadow-card p-4">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1">
            ✓ Vérifiées ({verified.length})
          </div>
          {verified.length > 0 ? (
            <div className="divide-y divide-line">
              {verified.map((a) => {
                const v = VERDICT[a.verdict ?? "stable"] ?? VERDICT.stable;
                return (
                  <div key={a.id} className="py-2.5">
                    <div className="text-[12.5px] font-semibold text-ink leading-snug">
                      <span className={v.cls}>{v.icon} </span>
                      {a.title}
                      {a.theme && <span className="text-faint font-normal"> · {a.theme}</span>}
                    </div>
                    <div className="text-[11px] text-faint mt-0.5">
                      <span className={`${v.cls} font-semibold`}>{v.label}</span>
                      {a.metric_label && a.then !== undefined && (
                        <>
                          {" "}· {a.metric_label} {a.then} → <b className="text-ink">{a.now}</b>
                          {a.delta != null && ` (${a.delta > 0 ? "+" : ""}${a.delta.toFixed(0)} %)`}
                        </>
                      )}
                      {" "}· décidé le {d(a.decided_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[12px] text-faint mt-1">
              Les verdicts apparaîtront ici ~2 semaines après tes premiers tests.
            </p>
          )}
        </div>
      </div>
      <p className="text-[11px] text-faint/80 mt-2.5 leading-relaxed">
        Avant/après honnête, pas une preuve absolue — la saisonnalité et le contenu jouent
        aussi. Sur la durée, c&apos;est le meilleur repère de ce qui marche chez toi.
      </p>
    </section>
  );
}
