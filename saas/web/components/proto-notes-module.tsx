// PROTOTYPE — À JETER. La coque du module, côté serveur : elle refait celle de
// `MetricChart` (`channel-dash.tsx` l. 613-720) à l'identique et passe le
// dessin des marques à `ProtoNotesCourbe`, qui est client. Ticket 19.
//
// Pas de directive ici — ce fichier lit `ChannelDash` et compose des liens
// serveur ; seul le dessin des variantes a besoin d'état (le survol de D).
import { fmtCHF } from "@/lib/report";
import type { ChannelDash } from "@/lib/channels";
import { lienDash } from "@/lib/liens";
import { Triangle, sensPente } from "@/components/pente";
import { ProtoNotesCourbe } from "@/components/proto-notes-courbe";
import type { NotesCourbe } from "@/lib/proto-notes";

// Recopié de `channel-dash.tsx` : la constante n'y est pas exportée, et on ne
// modifie pas un fichier de production pour un jetable.
const METRICS: { key: string; label: string; unit: string }[] = [
  { key: "spend", label: "Dépense", unit: "CHF" },
  { key: "clicks", label: "Clics", unit: "" },
  { key: "impressions", label: "Impressions", unit: "" },
  { key: "ctr", label: "CTR", unit: "%" },
  { key: "cpc", label: "CPC", unit: "CHF" },
];

export function ProtoNotesModule({
  d,
  path,
  variante,
  notes,
  canal,
}: {
  d: ChannelDash;
  path: string;
  variante: string;
  notes: NotesCourbe;
  canal: string;
}) {
  const pts = d.daily;
  if (pts.length === 0) return null;
  const val = (p: (typeof pts)[0]): number => {
    switch (d.metric) {
      case "clicks": return p.clicks;
      case "impressions": return p.impressions;
      case "ctr": return p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0;
      case "cpc": return p.clicks > 0 ? p.spend / p.clicks : 0;
      default: return p.spend;
    }
  };
  const meta = METRICS.find((m) => m.key === d.metric) ?? METRICS[0];
  const vals = pts.map(val);
  const max = Math.max(...vals, 0.001);
  const fmtV = (v: number) => (v >= 100 ? fmtCHF(v) : v.toFixed(2));

  const taux = d.metric === "ctr" || d.metric === "cpc";
  const valeur = taux
    ? vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.filter((v) => v > 0).length)
    : vals.reduce((a, b) => a + b, 0);

  const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const mi = Math.floor(vals.length / 2);
  const av = moy(vals.slice(0, mi));
  const ap = moy(vals.slice(mi));
  const ec = av > 0 ? ((ap - av) / av) * 100 : null;
  const baisseEstBonne = d.metric === "cpc";
  const s = sensPente(ec, baisseEstBonne, 8);

  return (
    <ProtoNotesCourbe
      variante={variante}
      notes={notes}
      canal={canal}
      labels={pts.map((p) => p.label)}
      valeurs={vals}
      nomSerie={meta.label}
      fmtV={fmtV}
      unite={meta.unit}
      entete={
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2">
          Évolution quotidienne <span className="text-ink">· {meta.label}</span>
          <span className="normal-case tracking-normal font-normal text-muted">
            {" "}· et ce que tu as fait
          </span>
        </div>
      }
      chiffre={
        <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
          <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
            {fmtV(valeur)}
            <span className="text-[15px] text-faint"> {meta.unit}</span>
          </span>
          <span className="text-[11px] text-faint">{taux ? "en moyenne" : "au total"}</span>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.cls}`}
            style={{ background: s.fond }}
            title="Seconde moitié de la période comparée à la première"
          >
            {s.plat ? (
              "≈ stable"
            ) : (
              <>
                <Triangle sens={s.monte ? "haut" : "bas"} /> {ec! > 0 ? "+" : ""}
                {Math.round(ec!)} % sur la période
              </>
            )}
          </span>
        </div>
      }
      selecteur={
        <div className="flex items-center gap-1 overflow-x-auto pt-3 mt-1 border-t border-line">
          {METRICS.map((m) => (
            <a
              key={m.key}
              href={lienDash(path, d.params, { m: m.key }, "spend")}
              className={`shrink-0 text-[10.5px] font-semibold rounded-full px-2.5 py-1 border ${
                d.metric === m.key
                  ? "bg-ink text-white border-ink"
                  : "border-line text-muted hover:bg-black/[0.03] bg-white"
              }`}
            >
              {m.label}
            </a>
          ))}
          <span className="ml-auto shrink-0 text-[10.5px] text-faint pl-3">
            max {fmtV(max)} {meta.unit} / jour
          </span>
        </div>
      }
    />
  );
}
