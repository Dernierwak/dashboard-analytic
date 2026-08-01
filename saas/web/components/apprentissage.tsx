import type { ReportPayload } from "@/lib/report";

// « Aller plus loin » — la section qui répond à ce que tu N'ARRIVES PAS à faire.
//
// Elle ne sort pas de nulle part : elle part de deux signaux mesurés sur ton
// propre usage.
//   · les conseils que tu as marqués « ◇ Trop compliqué » — tu as dit
//     explicitement qu'il te manquait le savoir-faire ;
//   · les conseils qu'on te repropose semaine après semaine sans que tu les
//     appliques — le même constat, dit sans mots.
// C'est la différence entre un contenu pédagogique générique et un contenu qui
// répond à ta situation : ici, on ne t'apprend que ce qui te bloque vraiment.

export function Apprentissage({
  data,
  num,
}: {
  data: NonNullable<ReportPayload["apprentissage"]>;
  num?: number;
}) {
  const { bloques, recurrents, tips } = data;
  const aDesRaisons = bloques.length > 0 || recurrents.length > 0;
  if (tips.length === 0 && !aDesRaisons) return null;

  return (
    <section className="mb-9">
      <h2 className="font-serif text-[19px] sm:text-[21px] leading-tight text-ink mb-1.5 flex items-center gap-2.5">
        <span className="h-4 w-[3px] rounded-full bg-ig shrink-0" />
        {num !== undefined && <span className="text-faint font-mono text-[15px]">{num}</span>}{" "}
        Aller plus loin
      </h2>
      <p className="text-[12.5px] text-muted leading-relaxed mb-4 max-w-[68ch]">
        Les conseils du haut disent quoi faire cette semaine. Ceux-ci
        t&apos;apprennent <span className="font-semibold text-ink">comment</span> — et
        ils sont choisis à partir de ce qui te bloque réellement.
      </p>

      {aDesRaisons && (
        <div className="bg-ig/[0.05] border border-ig/20 rounded-xl px-4 py-3 mb-4">
          <div className="text-[10px] uppercase tracking-widest text-ig font-bold mb-2">
            Pourquoi ces sujets
          </div>
          <ul className="space-y-1.5">
            {bloques.map((b) => (
              <li key={b} className="text-[12.5px] text-ink leading-snug flex gap-2">
                <span className="text-warn font-bold shrink-0">◇</span>
                <span>
                  Tu as marqué <span className="font-semibold">« {b} »</span> comme trop
                  compliqué.
                </span>
              </li>
            ))}
            {recurrents.map((r) => (
              <li key={r.titre} className="text-[12.5px] text-ink leading-snug flex gap-2">
                <span className="text-faint font-bold shrink-0">↻</span>
                <span>
                  <span className="font-semibold">« {r.titre} »</span> revient depuis{" "}
                  {r.fois} semaines sans avoir été appliqué.
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {tips.map((t) => (
          <div key={t.theme} className="bg-white border border-line rounded-xl shadow-card p-4">
            <h3 className="text-[13.5px] font-semibold text-ink mb-2.5">{t.theme}</h3>
            <div className="space-y-2.5">
              {t.tips.map((tip) => (
                <div key={tip.titre}>
                  <div className="text-[12.5px] font-semibold text-ig leading-snug">
                    {tip.titre}
                  </div>
                  <p className="text-[12.5px] text-muted leading-relaxed mt-0.5">{tip.texte}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10.5px] text-faint mt-2.5 leading-relaxed">
        Écrit par l&apos;IA à partir de tes thématiques et de tes blocages — pas de
        l&apos;actualité, et pas lié aux chiffres de ta semaine.
      </p>
    </section>
  );
}
