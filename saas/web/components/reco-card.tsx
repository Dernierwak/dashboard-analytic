import { RecoActions } from "@/components/reco-actions";
import type { PayloadReco, TrackedAction } from "@/lib/report";

const CONF: Record<string, { symbol: string; label: string }> = {
  solide: { symbol: "●", label: "Solide" },
  creuser: { symbol: "◐", label: "À creuser" },
  piste: { symbol: "○", label: "Piste" },
};

// UNE VEILLE N'EST PAS UN CONSEIL — c'est une chose qu'on regarde.
//
// Le worker en produit pour les campagnes lancées depuis moins de quatorze
// jours : trop jeunes pour être jugées, trop récentes pour être passées sous
// silence. Elles portent une clé `veille_…`, et c'est le seul signal dont la
// carte a besoin — aucun champ n'a été ajouté au payload pour ça.
//
// Trois choses changent, et toutes disent la même : il n'y a rien à faire.
//   · le badge dit « Veille » plutôt que « Règle » ;
//   · « Avant d'agir » devient « Ce qu'on surveille » ;
//   · le bouton « ▶ Je le teste » DISPARAÎT. Le prendre créerait une action
//     dont le verdict tomberait dans quatorze jours sur une décision que
//     personne n'a prise — un verdict se mérite, celui-là serait fabriqué.
// Les retours (utile / pas pour moi / commenter) restent : on a le droit de
// dire qu'une veille ne sert à rien.
//
// Deux veilles, deux badges, parce qu'elles ne demandent pas la même chose. La
// veille ORDINAIRE dit « attends le 24 ». La veille d'une campagne déclarée qui
// ne dépense rien (`…_muette`) demande d'aller regarder le gestionnaire tout de
// suite : lui écrire « rien à faire » serait faux, et sur la seule carte du
// rapport où chaque jour perdu ne se rattrape pas.
const estVeille = (key: string) => key.startsWith("veille_");
const veilleUrgente = (key: string) => key.endsWith("_muette");

// Carte de reco ALLÉGÉE : par défaut on ne voit que l'essentiel (badge, titre,
// le fait, feedback). Le détail (pourquoi / comment tester / angle mort) est
// replié derrière « ▸ Pourquoi & comment tester » — <details> natif, zéro JS.
export function RecoCard({
  r,
  current,
  comment,
  theme = null,
  action = null,
  capReached = false,
}: {
  r: PayloadReco;
  current: string | null;
  comment: string | null;
  theme?: string | null;
  /** L'action que ce conseil a produite, si elle existe et court encore. La
   *  carte en est le MIROIR : elle lit l'état, elle ne le détient pas. */
  action?: TrackedAction | null;
  capReached?: boolean;
}) {
  const cf = CONF[r.confidence] ?? CONF.piste;
  const veille = estVeille(r.key);
  const hasDetail = Boolean(r.pourquoi || r.verifier || r.repere || r.angle_mort);
  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-1.5">
        {veille ? (
          <span className="text-[9.5px] font-semibold text-warn bg-warn/10 rounded-full px-2 py-0.5">
            {veilleUrgente(r.key) ? "◷ Veille · à vérifier" : "◷ Veille · rien à faire"}
          </span>
        ) : r.source === "ai" ? (
          <span className="text-[9.5px] font-semibold text-ig bg-ig/10 rounded-full px-2 py-0.5">
            IA · à tester
          </span>
        ) : (
          <span className="text-[9.5px] font-semibold text-muted bg-black/[0.06] rounded-full px-2 py-0.5">
            Règle
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold text-muted">
          <span className="text-[12px] text-ink">{cf.symbol}</span>
          {cf.label}
        </span>
      </div>
      <h3 className="text-[14px] font-semibold text-ink leading-snug">{r.title}</h3>
      <p className="text-[12.5px] text-muted leading-relaxed mt-1">{r.observation}</p>

      {/* Les deux infos qui permettent de trancher en 5 secondes : ce que ça
          coûte à faire, et l'indicateur qu'on regardera après. */}
      {(r.effort || r.metric_label) && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {r.effort && (
            <span className="text-[11px] font-semibold text-muted bg-black/[0.05] rounded-full px-2.5 py-1">
              ⏱ {r.effort}
            </span>
          )}
          {r.metric_label && (
            <span className="text-[11px] font-semibold text-brand bg-brand/[0.07] rounded-full px-2.5 py-1">
              ↗ {r.metric_label}
            </span>
          )}
        </div>
      )}

      {hasDetail && (
        <details className="mt-2 group">
          <summary className="text-[11.5px] font-semibold text-brand cursor-pointer select-none list-none">
            <span className="group-open:hidden">
              {veille ? "▸ Pourquoi & ce qu'on surveille" : "▸ Pourquoi & comment tester"}
            </span>
            <span className="hidden group-open:inline">▾ Replier</span>
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {r.pourquoi && (
              <p className="text-[12px] text-muted leading-relaxed">
                <span className="font-semibold text-ink">Pourquoi — </span>
                {r.pourquoi}
              </p>
            )}
            {r.verifier && (
              <p className="text-[12px] text-muted leading-relaxed">
                <span className="font-semibold text-ink">
                  {veille ? "Ce qu'on surveille — " : "Avant d'agir — "}
                </span>
                {r.verifier}
              </p>
            )}
            {r.repere && (
              <div className="text-[12px] text-ink leading-relaxed bg-brand/[0.05] border border-brand/[0.14] rounded-lg px-2.5 py-1.5">
                <span className="font-semibold text-brand">Repère — </span>
                {r.repere}
              </div>
            )}
            {r.angle_mort && (
              <p className="text-[11.5px] text-faint leading-relaxed">
                <span className="font-semibold">Angle mort — </span>
                {r.angle_mort}
              </p>
            )}
          </div>
        </details>
      )}

      <RecoActions
        // La `key` dépend de l'état : sans elle, le `useState` local survit à
        // `revalidatePath` et la carte reste figée pendant que le rail bouge.
        key={`${action?.id ?? "libre"}:${action?.status ?? ""}`}
        recoKey={r.key}
        current={current}
        comment={comment}
        action={action}
        capReached={capReached}
        // Pas de `track` sur une veille : sans lui, `RecoActions` n'affiche ni
        // « ▶ Je le teste » ni l'état d'une action. Il ne reste que les retours,
        // et c'est exactement ce qu'on veut pouvoir donner sur une veille.
        track={
          veille
            ? undefined
            : {
                title: r.title,
                theme,
                metric: r.metric ?? null,
                metricLabel: r.metric_label ?? null,
                direction: r.direction ?? null,
                baseline: r.baseline ?? null,
                detail: {
                  observation: r.observation,
                  pourquoi: r.pourquoi,
                  verifier: r.verifier,
                  effort: r.effort ?? null,
                },
              }
        }
      />
    </div>
  );
}
