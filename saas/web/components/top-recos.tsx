import type { TopReco } from "@/lib/report";
import { RecoCard } from "@/components/reco-card";

// « Les 3 du moment » — une seule sélection, tous thèmes confondus, avant le
// détail par thème. Jusqu'à 9 conseils répartis en 3 thèmes, personne ne
// choisit dans 9 : ici on classe par thème prioritaire, confiance, facilité.
export function TopRecos({
  recos,
  feedback,
  comments,
  trackedKeys,
  capReached = false,
}: {
  recos: TopReco[];
  feedback: Record<string, string>;
  comments: Record<string, string>;
  trackedKeys: string[];
  capReached?: boolean;
}) {
  if (recos.length === 0) return null;

  return (
    <div className="mb-7">
      <div className="flex items-baseline gap-2 flex-wrap mb-2.5">
        <h3 className="text-[14px] font-bold text-ink">
          Si tu ne fais que {recos.length === 1 ? "ça" : `${recos.length} choses`} cette semaine
        </h3>
        <span className="text-[11.5px] text-faint">
          — la sélection, tous thèmes confondus
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {recos.map((r, i) => (
          <div key={r.key} className="snap-start shrink-0 w-[300px] sm:w-[340px]">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-brand text-white text-[11px] font-bold shrink-0">
                {i + 1}
              </span>
              {r.theme && (
                <span className="text-[11.5px] font-semibold text-muted truncate">
                  {r.is_priority && <span className="text-warn">★ </span>}
                  {r.theme}
                </span>
              )}
            </div>
            <RecoCard
              r={r}
              current={feedback[r.key] ?? null}
              comment={comments[r.key] ?? null}
              theme={r.theme}
              tracked={trackedKeys.includes(r.key)}
              capReached={capReached}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
