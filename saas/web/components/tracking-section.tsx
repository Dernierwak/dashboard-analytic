import type { TrackedAction } from "@/lib/report";
import { ScrollList } from "@/components/scroll-list";

// Le journal : tout ce que tu as décidé, fait, et ce que ça a donné.
// Les actions vivantes sont en haut du rapport ; ici c'est la trace — la
// mémoire de ton activité, du plus récent au plus ancien.

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
function d(iso: string): string {
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(dt.getTime())) return iso;
  return `${dt.getDate()} ${MOIS[dt.getMonth()]}`;
}

const VERDICT: Record<string, { icon: string; cls: string; label: string }> = {
  better: { icon: "✓", cls: "text-pos", label: "ça a marché" },
  worse: { icon: "▲", cls: "text-neg", label: "pas d'effet" },
  stable: { icon: "≈", cls: "text-warn", label: "stable" },
};

function etat(a: TrackedAction): { icon: string; cls: string; label: string } {
  if (a.status === "dropped")
    return { icon: "✕", cls: "text-faint", label: "abandonnée" };
  if (a.status === "archived")
    return a.verdict ? VERDICT[a.verdict] ?? VERDICT.stable : { icon: "✓", cls: "text-muted", label: "rangée" };
  if (a.status === "done")
    return a.due
      ? { icon: "◷", cls: "text-warn", label: "à juger" }
      : { icon: "✓", cls: "text-pos", label: "en observation" };
  return { icon: "▸", cls: "text-brand", label: "à faire" };
}

export function TrackingSection({
  actions,
  archived,
  num,
}: {
  actions: TrackedAction[];
  archived: TrackedAction[];
  num?: number;
}) {
  const rows = [...actions, ...archived].sort((a, b) =>
    a.decided_at < b.decided_at ? 1 : a.decided_at > b.decided_at ? -1 : 0
  );
  if (rows.length === 0) return null;

  const faites = rows.filter((a) => a.status === "done" || a.status === "archived").length;
  const abandons = rows.filter((a) => a.status === "dropped").length;
  const jugees = rows.filter((a) => a.status === "archived").length;

  return (
    <section className="mb-9">
      <h2 className="text-[11px] uppercase tracking-widest text-faint font-bold mb-2">
        {num !== undefined && <span className="font-mono">{num} · </span>}
        Ton historique d&apos;actions
      </h2>
      <p className="text-[12px] text-faint mb-2.5">
        {rows.length} lancée{rows.length > 1 ? "s" : ""} · {faites} faite{faites > 1 ? "s" : ""} ·{" "}
        {jugees} jugée{jugees > 1 ? "s" : ""}
        {abandons > 0 && ` · ${abandons} abandonnée${abandons > 1 ? "s" : ""}`}
      </p>

      <ScrollList title="Tout ce que tu as décidé" count={rows.length} maxH="max-h-[46vh]">
        {rows.map((a) => {
          const e = etat(a);
          return (
            <div key={a.id} className="px-4 py-3">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`text-[11px] font-bold ${e.cls} shrink-0`}>
                  {e.icon} {e.label}
                </span>
                <span className="text-[13.5px] text-ink leading-snug">{a.title}</span>
              </div>
              <div className="text-[11px] text-faint mt-1">
                {a.theme && <span className="text-muted">{a.theme} · </span>}
                décidé le {d(a.decided_at)}
                {a.done_at && ` · fait le ${d(a.done_at)}`}
                {a.status === "done" && !a.due && ` · verdict le ${d(a.check_at)}`}
                {a.verdict && a.metric_label && a.then !== undefined && (
                  <>
                    {" "}· {a.metric_label} {a.then} → <b className="text-ink">{a.now}</b>
                    {a.delta != null && ` (${a.delta > 0 ? "+" : ""}${a.delta.toFixed(0)} %)`}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </ScrollList>

      <p className="text-[11px] text-faint/80 mt-2.5 leading-relaxed">
        Avant/après honnête, pas une preuve absolue — la saisonnalité et le contenu jouent
        aussi. Sur la durée, c&apos;est le meilleur repère de ce qui marche chez toi.
      </p>
    </section>
  );
}
