import { formaterValeur } from "@/lib/instagram/tableau";
import { COULEUR_FORMAT } from "@/lib/instagram/couleurs";
import { METRIQUES, NOM_FORMAT, NOM_FORMAT_PLURIEL, type CleMetrique } from "@/lib/instagram/lecture";
import { textePastille, type PeriodeLue, type Rangee } from "@/lib/instagram/annee";
import type { Params } from "@/lib/instagram/liens";
import { Nuage } from "./nuage";
import { Moustaches } from "./moustaches";

// ── LA RANGÉE D'UN FORMAT ────────────────────────────────────────────────────
//
// Spec, « En tête de rangée » : le post type de l'année et son `n`, le total
// pour ce qui se compte, « 11 images sur 12 ont ce chiffre », puis les deux
// pastilles. Les pastilles sont d'une seule encre : colorer un écart en vert
// ou en rouge le jugerait à la place du client (user story 4).

export function RangeeFormat({
  rangee,
  metrique,
  periode,
  rangs,
  params,
}: {
  rangee: Rangee;
  metrique: CleMetrique;
  periode: PeriodeLue;
  rangs: Record<string, number>;
  params: Params;
}) {
  const c = COULEUR_FORMAT[rangee.format];
  const titre = (
    <span className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.trait }} aria-hidden /> {NOM_FORMAT[rangee.format]}
    </span>
  );

  if (rangee.etat === "sans_metrique") {
    return (
      <div className="border-t border-line pt-4 first:border-0 first:pt-0">
        {titre}
        <p className="mt-2 text-[13px] text-muted">{rangee.phrase}</p>
      </div>
    );
  }

  const pluriel = NOM_FORMAT_PLURIEL[rangee.format].toLowerCase();
  const pastilles = rangee.pastilles.map((p) => textePastille(p, metrique)).filter((t): t is string => t !== null);

  return (
    <div className="border-t border-line pt-4 first:border-0 first:pt-0">
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
        {titre}
        <span className="text-muted">
          post type de l&apos;année{" "}
          <b className="tabular-nums text-ink">{rangee.postType === null ? "–" : formaterValeur(metrique, rangee.postType)}</b>{" "}
          <span className="text-faint">· {rangee.n} posts</span>
        </span>
        {rangee.total && rangee.total.total !== null && (
          <span className="text-muted">
            total <b className="tabular-nums text-ink">{formaterValeur(metrique, rangee.total.total)}</b>
          </span>
        )}
        {rangee.n < rangee.sur && (
          <span className="text-faint">
            {rangee.n} {pluriel} sur {rangee.sur} ont ce chiffre
          </span>
        )}
        {pastilles.map((t) => (
          <span key={t} className="rounded-full bg-canvas px-2 py-0.5 tabular-nums text-muted">
            {t}
          </span>
        ))}
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
        <div className="min-w-0">
          <Nuage rangee={rangee} metrique={metrique} periode={periode} rangs={rangs} params={params} />
        </div>
        <div className="min-w-0">
          <Moustaches rangee={rangee} metrique={metrique} />
        </div>
      </div>
      {rangee.postType === null && rangee.n > 0 && (
        <p className="text-[12px] text-faint">
          {rangee.n} {pluriel} ont {METRIQUES[metrique].nom.toLowerCase()} sur les 12 derniers mois, il en faut 6 pour un post type.
        </p>
      )}
    </div>
  );
}
