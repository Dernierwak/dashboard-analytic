// PROTOTYPE JETABLE — ticket « Les groupes de termes de recherche », troisième
// tour. David, 2026-11-11 : la liste en barres est « nulle », une seule métrique
// ne suffit pas ; il faut « le cluster », et pouvoir choisir entre MOTS-CLÉS et
// CLUSTERS pour voir les termes de recherche.
//
// Un seul module, en bas de la page Google :
// - `gm=mots-cles|clusters` : les termes rangés sous leur mot-clé déclencheur,
//   ou sous le cluster que Google forme lui-même ;
// - `gc=` : une campagne, ou toutes ;
// - `gt=` : ce que mesure la taille des ronds (clics, impressions, conversions,
//   coût — le coût n'existe pas pour un cluster, Google ne le donne pas) ;
// - le graphe en grappes, la fiche de la grappe (toutes les métriques, terme
//   par terme) et le classement (clics, conversions, coût côte à côte).
import Link from "next/link";
import { tous, un, type SP } from "./analyse-donnees";
import { Constellation } from "./groupes-graphe";
import { CAMPAGNES_GROUPES, TAILLES, fmt, groupes, rangees, type Mode, type Taille } from "./groupes-donnees";

/** Un lien n'énumère que ce qu'il CHANGE (`CLAUDE.md` §8). */
function lienG(sp: SP, patch: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (!(k in patch)) tous(v).forEach((x) => q.append(k, x));
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) q.append(k, v);
  return `/google?${q.toString()}#groupes`;
}

const pastille = (actif: boolean) => `rounded-full px-3 py-1 ${actif ? "bg-ink font-medium text-white" : "text-muted hover:text-ink"}`;

export function GroupesCluster({ sp }: { sp: SP }) {
  const mode: Mode = un(sp.gm) === "mots-cles" ? "mots-cles" : "clusters";
  const campagne = CAMPAGNES_GROUPES.find((c) => c.id === un(sp.gc));
  const gt = un(sp.gt) as Taille | undefined;
  const taille: Taille = gt && TAILLES.some((t) => t.cle === gt) && !(mode === "clusters" && gt === "cout") ? gt : "clics";
  const cats = rangees(groupes(mode, campagne?.id), taille);
  const somme = (t: Taille) => cats.reduce<number | null>((s, c) => (s === null || c.c[t] === null ? null : s + (c.c[t] as number)), 0);
  const nb = cats.filter((c) => !c.fourreTout && !c.traine).length + (cats.find((c) => c.traine)?.traine ?? 0);

  return (
    <section id="groupes" className="scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-ink">Ce que les gens ont cherché</h2>
          <p className="text-[13px] text-muted">Les recherches qui ont affiché tes annonces Search, regroupées {mode === "clusters" ? "par Google lui-même" : "sous le mot-clé qui les a déclenchées"}.</p>
        </div>
        {/* Le choix qui compte : deux façons de ranger les mêmes termes. */}
        <nav className="flex gap-1 rounded-full border border-line bg-white p-1 text-[13.5px]">
          <Link href={lienG(sp, { gm: "mots-cles", gt: undefined })} scroll={false} className={pastille(mode === "mots-cles")}>Mots-clés</Link>
          <Link href={lienG(sp, { gm: "clusters", gt: undefined })} scroll={false} className={pastille(mode === "clusters")}>Clusters Google</Link>
        </nav>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1.5 text-[12.5px]">
          <Link href={lienG(sp, { gc: undefined })} scroll={false} className={`rounded-full border px-3 py-1 ${!campagne ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}>Toutes les campagnes</Link>
          {CAMPAGNES_GROUPES.map((c) => (
            <Link key={c.id} href={lienG(sp, { gc: c.id })} scroll={false} className={`rounded-full border px-3 py-1 ${campagne?.id === c.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}>{c.nom}</Link>
          ))}
        </nav>
        <nav className="flex items-center gap-1 text-[12.5px]">
          <span className="mr-1 text-muted">Taille des ronds</span>
          {TAILLES.map((t) =>
            mode === "clusters" && t.cle === "cout" ? (
              <span key={t.cle} title="Google ne donne pas le coût par cluster" className="cursor-not-allowed rounded-full px-2.5 py-1 text-muted/50 line-through">{t.nom}</span>
            ) : (
              <Link key={t.cle} href={lienG(sp, { gt: t.cle })} scroll={false} className={`rounded-full border px-2.5 py-1 ${t.cle === taille ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}>{t.nom}</Link>
            ),
          )}
        </nav>
      </div>

      {/* Les chiffres de l'ensemble affiché, toutes métriques. */}
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
        <span><b className="tabular-nums text-ink">{nb}</b> <span className="text-muted">{mode === "clusters" ? "clusters" : "mots-clés"}</span></span>
        {TAILLES.map((t) => (
          <span key={t.cle} title={t.cle === "cout" && mode === "clusters" ? "Google ne donne pas le coût par cluster" : undefined}>
            <b className="tabular-nums text-ink">{fmt(t.cle, somme(t.cle))}</b> <span className="text-muted">{t.nom.toLowerCase()}</span>
          </span>
        ))}
      </div>

      <Constellation key={`${mode}-${campagne?.id ?? "tout"}-${taille}`} cats={cats} taille={taille} mode={mode} />
    </section>
  );
}
