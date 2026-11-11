// PROTOTYPE JETABLE — ticket « Les groupes de termes de recherche »
// (.scratch/google-ads/issues/21-les-groupes-de-termes-de-recherche.md).
//
// Trois formes pour la même lecture — les catégories de termes que Google forme
// déjà, laquelle pèse le plus, et ce qu'il y a dedans — en bas de la page Google
// validée au ticket 11, switchables par `?gv=A|B|C` :
//   A · Constellation — le graphe « comme Obsidian », grappes reliées
//   B · Blocs         — un bloc proportionnel par catégorie, ses termes dedans
//   C · Barres        — une ligne par catégorie, la barre découpée en ses termes
// En commun : le filtre par campagne (`gc=`), la taille (`gt=`, par défaut celle
// de la vue du Sélecteur), 8 couleurs puis gris, la fourre-tout et la longue
// traîne nommées, la part masquée par Google hachurée — jamais inventée.
import Link from "next/link";
import { tous, un, type SP, type Vue } from "./analyse-donnees";
import { BarreGroupes } from "./groupes-barre";
import { Constellation } from "./groupes-graphe";
import {
  CAMPAGNES_GROUPES, TAILLES, categories, entier, fmt, pct0, rangees, termesPartages,
  type CatRangee, type Taille,
} from "./groupes-donnees";

const VARIANTES = [
  { cle: "A", nom: "Constellation" },
  { cle: "B", nom: "Blocs" },
  { cle: "C", nom: "Barres" },
];
const TAILLE_DE_LA_VUE: Record<Vue, Taille> = { notoriete: "impressions", trafic: "clics", conversion: "conversions" };
const HACHURE = "repeating-linear-gradient(135deg, #dedbd3 0 3px, #f4f2ec 3px 7px)";

/** Un lien n'énumère que ce qu'il CHANGE (`CLAUDE.md` §8). */
function lienG(sp: SP, patch: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (!(k in patch)) tous(v).forEach((x) => q.append(k, x));
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) q.append(k, v);
  return `/google?${q.toString()}#groupes`;
}

export function GroupesTermes({ sp, vue }: { sp: SP; vue: Vue }) {
  const gv = un(sp.gv) ?? "A";
  const gc = un(sp.gc);
  const campagne = CAMPAGNES_GROUPES.find((c) => c.id === gc);
  const gt = un(sp.gt) as Taille | undefined;
  const taille: Taille = gt && TAILLES.some((t) => t.cle === gt) ? gt : TAILLE_DE_LA_VUE[vue];
  const cats = rangees(categories(campagne?.id), taille);
  const total = cats.reduce((s, c) => s + c.c[taille], 0);
  const listes = cats.reduce((s, c) => s + c.listes[taille], 0);
  const nVraies = cats.filter((c) => !c.fourreTout && !c.traine).length + (cats.find((c) => c.traine)?.traine ?? 0);
  const partages = termesPartages(cats);
  const premiere = cats[0];

  return (
    <section id="groupes" className="scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-ink">Ce que les gens ont cherché</h2>
          <p className="text-[13px] text-muted">Les groupes que Google forme avec les recherches qui ont affiché tes annonces Search · période du bandeau</p>
        </div>
        <nav className="flex flex-wrap gap-1 rounded-full border border-line bg-white p-1 text-[13px]">
          {TAILLES.map((t) => (
            <Link key={t.cle} href={lienG(sp, { gt: t.cle })} scroll={false} className={`rounded-full px-3 py-1 ${t.cle === taille ? "bg-ink font-medium text-white" : "text-muted hover:text-ink"}`}>{t.nom}</Link>
          ))}
        </nav>
      </div>

      <nav className="mb-4 flex flex-wrap gap-1.5 text-[12.5px]">
        <Link href={lienG(sp, { gc: undefined })} scroll={false} className={`rounded-full border px-3 py-1 ${!campagne ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}>Toutes les campagnes Search</Link>
        {CAMPAGNES_GROUPES.map((c) => (
          <Link key={c.id} href={lienG(sp, { gc: c.id })} scroll={false} className={`rounded-full border px-3 py-1 ${campagne?.id === c.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}>{c.nom}</Link>
        ))}
      </nav>

      {/* Rang 3 : le chiffre qui compte — la catégorie qui pèse le plus. */}
      <p className="mb-1 text-[15px] text-ink">
        <b style={{ color: premiere.couleur }}>« {premiere.libelle} »</b> pèse <b>{pct0(premiere.c[taille] / total)}</b> des {taille}
        {campagne ? <> de <b>{campagne.nom}</b></> : <> de tes campagnes Search</>} — {entier(nVraies)} catégories en tout.
      </p>
      <p className="mb-4 text-[12.5px] text-muted">
        {fmt(taille, total)} {taille} · {pct0(listes / total)} dans des termes que Google liste, le reste est masqué (confidentialité) ou sans catégorie
        {partages.size > 0 && <> · {partages.size} terme{partages.size > 1 ? "s" : ""} rangé{partages.size > 1 ? "s" : ""} dans deux catégories</>} · pas de coût : Google ne le donne pas par catégorie.
      </p>

      {gv === "B" ? <Blocs cats={cats} taille={taille} total={total} /> : gv === "C" ? <Barres cats={cats} taille={taille} total={total} /> : <Constellation cats={cats} taille={taille} total={total} />}
      <BarreGroupes variantes={VARIANTES} />
    </section>
  );
}

const nom = (c: CatRangee) => (c.fourreTout ? "Sans catégorie" : c.traine ? `${c.traine} petites catégories` : c.libelle);
const special = (c: CatRangee) => Boolean(c.fourreTout || c.traine);
const pourquoi = (c: CatRangee) => (c.fourreTout ? "Google range ici ce qu'il ne classe nulle part, et n'en liste aucun terme." : "Chacune pèse 5 clics au plus, regroupées pour rester lisibles.");

// ── B · Blocs — treemap « squarifié » ────────────────────────────────────────

type Rect = { x: number; y: number; w: number; h: number };
function squarifier(vals: number[], r: Rect): Rect[] {
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const aires = vals.map((v) => (v / total) * r.w * r.h);
  const out: Rect[] = [];
  let reste = { ...r }, rangee: number[] = [], i = 0;
  const pire = (row: number[], cote: number) => {
    const s = row.reduce((a, b) => a + b, 0), mx = Math.max(...row), mn = Math.min(...row);
    return Math.max((cote * cote * mx) / (s * s), (s * s) / (cote * cote * mn));
  };
  const poser = (row: number[]) => {
    const s = row.reduce((a, b) => a + b, 0);
    if (reste.w >= reste.h) {
      const w = s / reste.h; let y = reste.y;
      row.forEach((a) => { out.push({ x: reste.x, y, w, h: a / w }); y += a / w; });
      reste = { x: reste.x + w, y: reste.y, w: reste.w - w, h: reste.h };
    } else {
      const h = s / reste.w; let x = reste.x;
      row.forEach((a) => { out.push({ x, y: reste.y, w: a / h, h }); x += a / h; });
      reste = { x: reste.x, y: reste.y + h, w: reste.w, h: reste.h - h };
    }
  };
  while (i < aires.length) {
    const cote = Math.min(reste.w, reste.h), a = Math.max(aires[i], 0.0001);
    if (rangee.length === 0 || pire([...rangee, a], cote) <= pire(rangee, cote)) { rangee.push(a); i++; }
    else { poser(rangee); rangee = []; }
  }
  if (rangee.length) poser(rangee);
  return out;
}

function Blocs({ cats, taille, total }: { cats: CatRangee[]; taille: Taille; total: number }) {
  const W = 1000, H = 560;
  const rects = squarifier(cats.map((c) => c.c[taille]), { x: 0, y: 0, w: W, h: H });
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-white" style={{ aspectRatio: `${W} / ${H}` }}>
      {cats.map((c, i) => {
        const r = rects[i];
        if (!r) return null;
        const v = c.c[taille];
        const partMasquee = special(c) || v === 0 ? 0 : (v - c.listes[taille]) / v;
        const petit = r.w < 110 || r.h < 60;
        return (
          <div key={c.id} title={`${nom(c)} — ${fmt(taille, v)} ${taille}${special(c) ? ` · ${pourquoi(c)}` : ` · ${pct0(partMasquee)} masqué par Google`}`}
            className="absolute flex min-h-0 min-w-0 flex-col overflow-hidden border-2 border-white"
            style={{ left: `${(r.x / W) * 100}%`, top: `${(r.y / H) * 100}%`, width: `${(r.w / W) * 100}%`, height: `${(r.h / H) * 100}%`, background: special(c) ? HACHURE : `${c.couleur}1f` }}>
            {!special(c) && <span className="absolute inset-y-0 left-0 w-1" style={{ background: c.couleur }} />}
            <div className="min-h-0 flex-1 overflow-hidden px-2.5 py-1.5">
              <p className={`truncate font-semibold ${petit ? "text-[11px]" : "text-[13px]"} ${special(c) ? "italic text-muted" : "text-ink"}`}>{nom(c)}</p>
              {!petit && <p className="text-[12px] tabular-nums text-muted">{fmt(taille, v)} · {pct0(v / (total || 1))}</p>}
              {!petit && !special(c) && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {[...c.termes].sort((a, b) => b.c[taille] - a.c[taille]).map((t) => (
                    <span key={t.texte} className="rounded bg-white/80 px-1.5 py-0.5 text-[11px] text-ink">{t.texte} <span className="tabular-nums text-muted">{fmt(taille, t.c[taille])}</span></span>
                  ))}
                </div>
              )}
              {!petit && special(c) && <p className="mt-1 max-w-[30ch] text-[11.5px] text-muted">{pourquoi(c)}</p>}
            </div>
            {/* La part masquée, au pied du bloc et à sa proportion : ce qu'on ne lit pas se voit. */}
            {partMasquee > 0 && !petit && (
              <div className="shrink-0 px-2.5 text-[10.5px] text-muted" style={{ height: `${partMasquee * 100}%`, background: HACHURE }}>
                masqué · {pct0(partMasquee)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── C · Barres — une ligne par catégorie, découpée en ses termes ─────────────

function Barres({ cats, taille, total }: { cats: CatRangee[]; taille: Taille; total: number }) {
  const max = Math.max(1, ...cats.map((c) => c.c[taille]));
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <ol className="space-y-2.5">
        {cats.map((c) => {
          const v = c.c[taille];
          const termes = [...c.termes].sort((a, b) => b.c[taille] - a.c[taille]);
          const masque = special(c) ? v : v - c.listes[taille];
          return (
            <li key={c.id} className="grid grid-cols-[minmax(0,15rem)_minmax(0,1fr)_4.5rem] items-center gap-3">
              <span className={`flex min-w-0 items-center gap-2 text-[13px] ${special(c) ? "italic text-muted" : "text-ink"}`} title={special(c) ? pourquoi(c) : undefined}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: special(c) ? HACHURE : c.couleur }} />
                <span className="min-w-0 truncate">{nom(c)}</span>
              </span>
              <span className="flex h-6 min-w-0 overflow-hidden rounded" style={{ width: `${Math.max(1, (v / max) * 100)}%` }}>
                {!special(c) && termes.map((t, j) => {
                  const part = v ? t.c[taille] / v : 0;
                  return (
                    <span key={t.texte} title={`${t.texte} — ${fmt(taille, t.c[taille])}`} className="flex min-w-0 items-center overflow-hidden border-r border-white px-1 text-[10.5px] text-white"
                      style={{ width: `${part * 100}%`, background: c.couleur, opacity: 1 - j * 0.12 }}>
                      {part * (v / max) > 0.12 && <span className="truncate">{t.texte}</span>}
                    </span>
                  );
                })}
                {masque > 0 && (
                  <span title={special(c) ? pourquoi(c) : `Termes masqués par Google — ${fmt(taille, masque)}`} className="flex min-w-0 items-center overflow-hidden px-1 text-[10.5px] text-muted" style={{ width: `${(masque / (v || 1)) * 100}%`, background: HACHURE }}>
                    {!special(c) && (masque / max) > 0.1 && <span className="truncate">masqué</span>}
                  </span>
                )}
              </span>
              <span className="text-right text-[12.5px] tabular-nums text-ink">{fmt(taille, v)} <span className="text-muted">{pct0(v / (total || 1))}</span></span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[12px] text-muted">Chaque segment est un terme listé par Google (survole pour le lire) ; la hachure, ce qu'il ne liste pas.</p>
    </div>
  );
}
