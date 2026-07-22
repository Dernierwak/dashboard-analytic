import { RecoActions } from "@/components/reco-actions";
import type { PayloadReco } from "@/lib/report";

const CONF: Record<string, { symbol: string; label: string }> = {
  solide: { symbol: "●", label: "Solide" },
  creuser: { symbol: "◐", label: "À creuser" },
  piste: { symbol: "○", label: "Piste" },
};

// Une recommandation : observation → pourquoi → avant d'agir → repère → angle
// mort, plus les boutons de feedback. Réutilisée par le rapport (par thème) et
// les réglages de base.
export function RecoCard({
  r,
  current,
  comment,
}: {
  r: PayloadReco;
  current: string | null;
  comment: string | null;
}) {
  const cf = CONF[r.confidence] ?? CONF.piste;
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5">
      <div className="flex items-center gap-2 mb-1.5">
        {r.source === "ai" ? (
          <span className="text-[10px] font-semibold text-ig bg-ig/10 rounded-full px-2 py-0.5">
            IA · idée à tester
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-muted bg-black/[0.06] rounded-full px-2 py-0.5">
            Règle
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted">
          <span className="text-[13px] text-ink">{cf.symbol}</span>
          {cf.label}
        </span>
      </div>
      <h3 className="text-[15px] font-semibold text-ink leading-snug">{r.title}</h3>
      <p className="text-[13px] text-ink leading-relaxed mt-1.5">{r.observation}</p>
      <p className="text-[13px] text-muted leading-relaxed mt-1.5">
        <span className="font-semibold text-ink">Pourquoi — </span>
        {r.pourquoi}
      </p>
      <p className="text-[13px] text-muted leading-relaxed mt-1.5">
        <span className="font-semibold text-ink">Avant d&apos;agir — </span>
        {r.verifier}
      </p>
      {r.repere && (
        <div className="text-[12.5px] text-ink leading-relaxed mt-2.5 bg-brand/[0.05] border border-brand/[0.14] rounded-lg px-3 py-2">
          <span className="font-semibold text-brand">Repère — </span>
          {r.repere}
        </div>
      )}
      {r.angle_mort && (
        <p className="text-[12px] text-faint leading-relaxed mt-2.5">
          <span className="font-semibold">Angle mort — </span>
          {r.angle_mort}
        </p>
      )}
      <RecoActions recoKey={r.key} current={current} comment={comment} />
    </div>
  );
}
