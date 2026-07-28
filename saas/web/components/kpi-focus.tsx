import { LineChart } from "@/components/line-chart";
import type { KpiFocus } from "@/lib/report";

// « Ta boussole » — le module de l'indicateur qui compte, choisi selon ton
// objectif (ROAS si tu vends, engagement si tu construis une communauté…).
//
// Un chiffre seul ne décide rien. Ce module donne les trois choses qui le
// rendent actionnable en trois secondes :
//   1. sa VALEUR, en grand
//   2. sa TRAJECTOIRE sur 10 semaines — un niveau ne vaut rien sans sa pente
//   3. sa ZONE — « tu perds / fragile / sain / scalable ». C'est elle qui
//      transforme « ROAS 2,4 » en « je peux augmenter les budgets ».

const TONE: Record<string, { bar: string; texte: string }> = {
  neg: { bar: "#c0392b", texte: "text-neg" },
  warn: { bar: "#b86b00", texte: "text-warn" },
  pos: { bar: "#1a7a4a", texte: "text-pos" },
};

export function KpiFocusCard({ k }: { k: KpiFocus }) {
  const bandes = k.bandes ?? [];
  // Une échelle bornée pour la jauge : la dernière zone est ouverte, on lui
  // donne la largeur d'un cran pour qu'elle reste dessinable.
  const bornes = bandes.map((b) => b.max).filter((m): m is number => m !== null);
  const dernier = bornes.length ? bornes[bornes.length - 1] : 0;
  const echelle = bornes.length ? dernier * 1.35 : Math.max(k.valeur, 1);

  const zone =
    bandes.find((b) => b.max === null || k.valeur < b.max) ?? bandes[bandes.length - 1];
  const tone = TONE[zone?.tone ?? "warn"] ?? TONE.warn;

  const delta =
    k.precedent !== null && k.precedent !== undefined && k.precedent !== 0
      ? ((k.valeur - k.precedent) / Math.abs(k.precedent)) * 100
      : null;
  const stable = delta !== null && Math.abs(delta) < 0.5;
  const bon = delta === null ? null : k.direction === "down" ? delta < 0 : delta > 0;
  const deltaCls = delta === null || stable ? "text-faint" : bon ? "text-pos" : "text-neg";

  const fmtV = (v: number) =>
    k.unite === " %" || k.key === "roas" ? v.toFixed(k.key === "roas" ? 1 : 1) : Math.round(v).toLocaleString("fr-CH");

  return (
    <div className="bg-white border border-line rounded-2xl shadow-card overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-faint font-bold">
              Ta boussole · {k.titre}
            </div>
            <div className="flex items-baseline gap-3 mt-1.5 flex-wrap">
              <span className="font-mono text-[38px] sm:text-[44px] leading-none font-medium text-ink">
                {fmtV(k.valeur)}
                <span className="text-[20px] text-faint">{k.unite}</span>
              </span>
              {zone && (
                <span
                  className="text-[12px] font-bold px-2.5 py-1 rounded-full"
                  style={{ color: tone.bar, background: `${tone.bar}14` }}
                >
                  {zone.label}
                </span>
              )}
            </div>
            {delta !== null && (
              <div className={`text-[12.5px] font-semibold mt-1.5 ${deltaCls}`}>
                {stable ? "≈ stable" : `${delta > 0 ? "▲ +" : "▼ "}${delta.toFixed(0)} %`}
                <span className="text-faint font-normal">
                  {" "}vs la semaine dernière ({fmtV(k.precedent!)}
                  {k.unite})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* La jauge : les zones nommées, et où tu te situes dedans */}
        {bandes.length > 0 && (
          <div className="mt-5">
            <div className="flex h-2.5 rounded-full overflow-hidden">
              {bandes.map((b, i) => {
                const bas = i === 0 ? 0 : (bandes[i - 1].max ?? 0);
                const haut = b.max ?? echelle;
                return (
                  <div
                    key={b.label}
                    style={{
                      width: `${((haut - bas) / echelle) * 100}%`,
                      background: TONE[b.tone]?.bar ?? "#b86b00",
                      opacity: 0.28,
                    }}
                  />
                );
              })}
            </div>
            {/* Le curseur : ta position réelle sur cette échelle */}
            <div className="relative h-0">
              <div
                className="absolute -top-[13px] h-[17px] w-[3px] rounded-full"
                style={{
                  left: `calc(${Math.min(99.5, (k.valeur / echelle) * 100)}% - 1.5px)`,
                  background: tone.bar,
                }}
              />
            </div>
            <div className="flex justify-between mt-2.5 text-[10px] text-faint">
              {bandes.map((b, i) => (
                <span key={b.label} className={i === 0 ? "" : "text-right"}>
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* La trajectoire : un niveau ne veut rien dire sans sa pente */}
      <div className="border-t border-line bg-black/[0.012] px-2 pt-2 pb-1">
        <LineChart
          labels={k.labels}
          series={[{ name: k.titre, color: "#1a56ff", values: k.points }]}
          height={120}
          fmt={fmtV}
          unit={k.unite}
          ariaLabel={`${k.titre} sur 10 semaines`}
        />
      </div>

      {k.repere && (
        <p className="text-[11.5px] text-muted leading-relaxed px-5 sm:px-6 py-3 border-t border-line">
          <span className="font-semibold text-ink">Comment le lire — </span>
          {k.repere}
        </p>
      )}
    </div>
  );
}
