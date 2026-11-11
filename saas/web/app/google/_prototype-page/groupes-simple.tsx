// PROTOTYPE JETABLE — ticket 21, deuxième tour. David, 2026-11-11 : « fais-moi
// un truc simple, je sais pas ce que tu essayes de me dire ». Une seule forme,
// aucun réglage : les groupes de termes de Google, du plus gros au plus petit,
// en clics, avec leurs principaux termes dessous. Le reste (A · B · C) reste
// sur la branche, non affiché.
import Link from "next/link";
import { tous, un, type SP } from "./analyse-donnees";
import { CAMPAGNES_GROUPES, categories, entier, rangees } from "./groupes-donnees";

function lienG(sp: SP, gc: string | undefined): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (k !== "gc") tous(v).forEach((x) => q.append(k, x));
  if (gc) q.append("gc", gc);
  return `/google?${q.toString()}#groupes`;
}

export function GroupesSimple({ sp }: { sp: SP }) {
  const campagne = CAMPAGNES_GROUPES.find((c) => c.id === un(sp.gc));
  const cats = rangees(categories(campagne?.id), "clics");
  const vraies = cats.filter((c) => !c.fourreTout && !c.traine).slice(0, 8);
  const total = cats.reduce((s, c) => s + c.c.clics, 0);
  const nonClasse = total - vraies.reduce((s, c) => s + c.c.clics, 0);
  const max = Math.max(1, ...vraies.map((c) => c.c.clics));

  return (
    <section id="groupes" className="scroll-mt-24">
      <h2 className="text-[17px] font-semibold text-ink">Ce que les gens ont cherché</h2>
      <p className="mb-3 text-[13px] text-muted">Google regroupe les recherches qui ont affiché tes annonces. Voici les groupes qui ont amené le plus de clics.</p>

      <nav className="mb-4 flex flex-wrap gap-1.5 text-[12.5px]">
        <Link href={lienG(sp, undefined)} scroll={false} className={`rounded-full border px-3 py-1 ${!campagne ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}>Toutes les campagnes</Link>
        {CAMPAGNES_GROUPES.map((c) => (
          <Link key={c.id} href={lienG(sp, c.id)} scroll={false} className={`rounded-full border px-3 py-1 ${campagne?.id === c.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}>{c.nom}</Link>
        ))}
      </nav>

      <ol className="space-y-4 rounded-2xl border border-line bg-white p-5">
        {vraies.map((c) => (
          <li key={c.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[14px] font-semibold text-ink">{c.libelle}</span>
              <span className="shrink-0 text-[14px] tabular-nums text-ink">{entier(c.c.clics)} clics <span className="text-muted">· {Math.round((c.c.clics / total) * 100)} %</span></span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-canvas">
              <div className="h-2.5 rounded-full" style={{ width: `${(c.c.clics / max) * 100}%`, background: c.couleur }} />
            </div>
            <p className="mt-1 text-[12.5px] text-muted">{[...c.termes].sort((a, b) => b.c.clics - a.c.clics).slice(0, 4).map((t) => t.texte).join(" · ")}</p>
          </li>
        ))}
        <li className="border-t border-line pt-3 text-[12.5px] text-muted">
          + {entier(nonClasse)} clics dans des groupes plus petits, ou sur des recherches que Google n&apos;a pas regroupées.
        </li>
      </ol>
    </section>
  );
}
