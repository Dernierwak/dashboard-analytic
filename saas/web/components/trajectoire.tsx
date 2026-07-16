// La Trajectoire — le chiffre de ta mission sur 12 semaines, avec des
// marqueurs là où tu as appliqué un conseil. On VOIT si ça paie.
import type { MissionData } from "@/lib/mission";

export function Trajectoire({ m }: { m: MissionData }) {
  const pts = m.points;
  const vals = pts.map((p) => p.value).filter((v): v is number => v !== null);
  if (vals.length < 2) return null; // pas assez d'historique → la section attendra

  const W = 640, H = 150, PADX = 8, PADT = 14, PADB = 22;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(max - min, max * 0.05, 0.001);
  const x = (i: number) => PADX + (i / (pts.length - 1)) * (W - PADX * 2);
  const y = (v: number) => PADT + (1 - (v - min) / span) * (H - PADT - PADB);

  let path = "";
  let started = false;
  pts.forEach((p, i) => {
    if (p.value === null) return;
    path += `${started ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)} `;
    started = true;
  });

  const markerIdx = new Map<number, string[]>();
  for (const mk of m.markers) {
    const i = pts.findIndex((p) => p.weekStart === mk.weekStart);
    if (i >= 0) markerIdx.set(i, [...(markerIdx.get(i) ?? []), mk.title]);
  }
  const lastFull = [...pts.slice(0, -1)].reverse().find((p) => p.value !== null);
  const step = Math.max(1, Math.ceil(pts.length / 6));
  const fmtV = (v: number) =>
    v.toLocaleString("fr-CH", { maximumFractionDigits: v < 100 ? 1 : 0 }).replace(/,/g, ".");

  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-brand font-bold mb-1">
            {m.missionLabel ? `Mission : ${m.missionLabel}` : "Ta trajectoire"}
          </div>
          <div className="text-[12px] text-faint">{m.metricLabel} · 12 dernières semaines</div>
        </div>
        {m.hero && (
          <div className="text-right">
            <div className="font-mono text-[26px] font-medium text-ink leading-none">
              {m.hero.value}
            </div>
            {m.hero.deltaPct !== null && Math.abs(m.hero.deltaPct) >= 0.5 && (
              <div
                className={`text-[11px] font-semibold mt-1 ${
                  m.hero.deltaPct > 0 ? "text-pos" : "text-neg"
                }`}
              >
                {m.hero.deltaPct > 0 ? "▲ +" : "▼ "}
                {m.hero.deltaPct.toFixed(0)} %{" "}
                <span className="text-faint font-normal">vs sem. préc.</span>
              </div>
            )}
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={m.metricLabel}>
        {/* Courbe */}
        <path d={path} fill="none" stroke="#1a56ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Points + marqueurs Fait */}
        {pts.map((p, i) => {
          if (p.value === null) return null;
          const isMarker = markerIdx.has(i);
          return (
            <g key={p.weekStart}>
              <circle
                cx={x(i)}
                cy={y(p.value)}
                r={isMarker ? 5 : 2.5}
                fill={isMarker ? "#1a7a4a" : "#1a56ff"}
                opacity={p.partial ? 0.4 : 1}
              >
                <title>
                  {`sem. du ${p.label} — ${fmtV(p.value)}${m.unit ? ` ${m.unit}` : ""}${
                    isMarker ? `\n✓ ${markerIdx.get(i)!.join(" · ")}` : ""
                  }${p.partial ? "\n(semaine en cours, partielle)" : ""}`}
                </title>
              </circle>
              {isMarker && (
                <text x={x(i)} y={y(p.value) - 10} textAnchor="middle" fontSize="11" fill="#1a7a4a" fontWeight="700">
                  ✓
                </text>
              )}
            </g>
          );
        })}
        {/* Étiquettes de semaines */}
        {pts.map((p, i) =>
          i % step === 0 ? (
            <text key={p.weekStart} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#8b8e98">
              {p.label}
            </text>
          ) : null
        )}
      </svg>

      <div className="flex items-center gap-4 text-[10.5px] text-faint mt-1 flex-wrap">
        <span><span className="text-pos font-bold">✓●</span> conseil appliqué cette semaine-là</span>
        {lastFull && <span>dernière semaine pleine : {lastFull.label}</span>}
        <span className="opacity-70">point pâle = semaine en cours</span>
      </div>

      {m.coach && (
        <div className="mt-3 bg-brand/[0.04] border border-brand/[0.14] rounded-lg px-3.5 py-2.5">
          <p className="text-[12.5px] text-ink leading-relaxed">
            <span className="font-semibold text-brand">Le coach — </span>
            {m.coach}
          </p>
        </div>
      )}
      {m.needsGa4 && (
        <p className="text-[11px] text-warn mt-2.5">
          Mission « ventes » sans Google Analytics : je te montre les clics en attendant.
          Connecte GA4 pour suivre le vrai chiffre — le revenu.
        </p>
      )}
    </div>
  );
}
