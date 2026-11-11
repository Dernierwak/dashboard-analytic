"use client";
// PROTOTYPE JETABLE — ticket 21. Le graphe en grappes « comme un Obsidian » :
// chaque groupe (un mot-clé, ou un cluster de Google) est un rond, les termes de
// recherche sont reliés autour ; un terme rangé dans deux groupes relie les deux
// grappes. La disposition sort d'une petite simulation de forces, calculée une
// fois et déterministe (même rendu serveur et client). Jamais en production.
import { useMemo, useState } from "react";
import type { CatRangee, Mode, Taille } from "./groupes-donnees";

type N = { id: string; cat: string; texte: string; v: number; r: number; x: number; y: number; vx: number; vy: number; couleur: string; hub: boolean };
type L = { a: number; b: number; long: number };

const W = 920, H = 580;
const nf = (v: number, d = 0) => v.toLocaleString("fr-CH", { maximumFractionDigits: d });
// Dans un tableau, « CHF » est dans l'en-tête : la case garde le nombre seul.
const fmtCase = (t: Taille, v: number | null) => (v === null ? "—" : t === "conversions" ? nf(v, 1) : nf(v));
const fmtT = (t: Taille, v: number | null) => (v === null ? "—" : t === "conversions" ? nf(v, 1) : t === "cout" ? `${nf(v)} CHF` : nf(v));

function disposer(cats: CatRangee[], t: Taille) {
  const val = (v: number | null) => v ?? 0;
  const max = Math.max(1, ...cats.map((c) => val(c.c[t])));
  const rayon = (v: number, min: number) => Math.max(min, 44 * Math.sqrt(v / max));
  const nodes: N[] = [];
  const links: L[] = [];
  const parTexte = new Map<string, number>();
  cats.forEach((c, i) => {
    // Spirale à l'angle d'or : les plus gros au centre, sans tasser les couleurs d'un côté.
    const ang = i * 2.39996, dist = 40 + 34 * Math.sqrt(i);
    const hub = nodes.push({ id: c.id, cat: c.id, texte: c.libelle, v: val(c.c[t]), r: rayon(val(c.c[t]), 7), x: W / 2 + Math.cos(ang) * dist * 1.5, y: H / 2 + Math.sin(ang) * dist, vx: 0, vy: 0, couleur: c.couleur, hub: true }) - 1;
    c.termes.forEach((tm, j) => {
      let k = parTexte.get(tm.texte);
      if (k === undefined) {
        const a2 = ang + j * 1.3;
        k = nodes.push({ id: `${c.id}:${tm.texte}`, cat: c.id, texte: tm.texte, v: val(tm.c[t]), r: rayon(val(tm.c[t]), 2.5), x: nodes[hub].x + Math.cos(a2) * 50, y: nodes[hub].y + Math.sin(a2) * 50, vx: 0, vy: 0, couleur: c.couleur, hub: false }) - 1;
        parTexte.set(tm.texte, k);
      }
      links.push({ a: hub, b: k, long: nodes[hub].r + nodes[k].r + 34 });
    });
  });
  for (let it = 0, alpha = 1; it < 600; it++, alpha *= 0.992) {
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const p = nodes[i], q = nodes[j];
      let dx = q.x - p.x, dy = q.y - p.y;
      const d2 = Math.max(dx * dx + dy * dy, 1), d = Math.sqrt(d2);
      const charge = ((p.hub ? p.r + 10 : 4) * (q.hub ? q.r + 10 : 4) * 5) / d2;
      const chevauche = p.r + q.r + 4 - d;
      const f = (charge + (chevauche > 0 ? chevauche * 0.5 : 0)) * alpha;
      dx /= d; dy /= d;
      p.vx -= dx * f; p.vy -= dy * f; q.vx += dx * f; q.vy += dy * f;
    }
    for (const l of links) {
      const p = nodes[l.a], q = nodes[l.b];
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.max(Math.hypot(dx, dy), 1);
      const f = ((d - l.long) / d) * 0.08 * alpha;
      p.vx += dx * f * 0.3; p.vy += dy * f * 0.3; q.vx -= dx * f; q.vy -= dy * f;
    }
    for (const n of nodes) {
      n.vx += (W / 2 - n.x) * 0.0015 * alpha; n.vy += (H / 2 - n.y) * 0.004 * alpha;
      n.x = Math.min(W - n.r - 4, Math.max(n.r + 4, n.x + n.vx)); n.y = Math.min(H - n.r - 4, Math.max(n.r + 4, n.y + n.vy));
      n.vx *= 0.6; n.vy *= 0.6;
    }
  }
  // Dernière passe : plus aucun rond ne recouvre un autre (marge pour l'étiquette).
  for (let it = 0; it < 120; it++) for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const p = nodes[i], q = nodes[j];
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.max(Math.hypot(dx, dy), 0.1);
    const min = p.r + q.r + (p.hub && q.hub ? 18 : 5);
    if (d >= min) continue;
    const k = (min - d) / d / 2;
    p.x -= dx * k; p.y -= dy * k; q.x += dx * k; q.y += dy * k;
    for (const n of [p, q]) { n.x = Math.min(W - n.r - 4, Math.max(n.r + 4, n.x)); n.y = Math.min(H - n.r - 4, Math.max(n.r + 4, n.y)); }
  }
  return { nodes, links };
}

const nomGroupe = (c: CatRangee) => (c.fourreTout ? "Sans cluster" : c.traine ? `${c.traine} petits clusters` : c.libelle);
const special = (c: CatRangee) => Boolean(c.fourreTout || c.traine);

export function Constellation({ cats, taille, mode }: { cats: CatRangee[]; taille: Taille; mode: Mode }) {
  const { nodes, links } = useMemo(() => disposer(cats, taille), [cats, taille]);
  const [survol, setSurvol] = useState<string | null>(null);
  const [choisie, setChoisie] = useState<string>(cats[0]?.id ?? "");
  const actif = survol ?? choisie;
  const cat = cats.find((c) => c.id === actif) ?? cats[0];
  const catDe = (i: number) => (nodes[i].hub ? nodes[i].cat : nodes[links.find((l) => l.b === i)!.a].cat);
  // Un terme partagé appartient aux deux grappes : allumé si l'une des deux l'est.
  const allume = (i: number) => (nodes[i].hub ? nodes[i].cat === actif : links.some((l) => l.b === i && nodes[l.a].cat === actif));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 rounded-2xl border border-line bg-white p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" onMouseLeave={() => setSurvol(null)}>
          <defs>
            <pattern id="hachure" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#efede7" /><line x1="0" y1="0" x2="0" y2="6" stroke="#c9c6bd" strokeWidth="2.5" />
            </pattern>
          </defs>
          {links.map((l, i) => {
            const p = nodes[l.a], q = nodes[l.b], on = p.cat === actif;
            return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={on ? p.couleur : "#d9d6ce"} strokeOpacity={on ? 0.7 : 0.5} strokeWidth={on ? 1.4 : 0.8} />;
          })}
          {nodes.map((n, i) => {
            const on = allume(i);
            const c = cats.find((x) => x.id === n.cat)!;
            const sp = n.hub && special(c);
            return (
              <g key={n.id} onMouseEnter={() => setSurvol(catDe(i))} onClick={() => setChoisie(catDe(i))} className="cursor-pointer">
                <circle cx={n.x} cy={n.y} r={n.r} fill={sp ? "url(#hachure)" : n.couleur} fillOpacity={n.hub ? (on ? 0.95 : 0.55) : on ? 0.75 : 0.3} stroke={sp ? "#a9a59b" : "white"} strokeDasharray={sp ? "3 2" : undefined} strokeWidth={n.hub ? 2 : 1} />
                <title>{`${n.hub ? nomGroupe(c) : n.texte} — ${fmtT(taille, n.v)}`}</title>
              </g>
            );
          })}
          {nodes.map((n, i) => {
            const c = cats.find((x) => x.id === n.cat)!;
            const on = allume(i);
            if (!(n.hub ? c.rang < 8 || special(c) || on : on)) return null;
            // Le nom d'un terme part vers l'extérieur de sa grappe, pour ne pas
            // s'empiler sous les autres.
            let x = n.x, y = n.y + n.r + 13, ancre: "start" | "middle" | "end" = "middle";
            if (!n.hub) {
              const h = nodes[links.find((l) => l.b === i)!.a];
              const dx = n.x - h.x, dy = n.y - h.y, d = Math.max(Math.hypot(dx, dy), 1);
              x = n.x + (dx / d) * (n.r + 4); y = n.y + (dy / d) * (n.r + 4) + 3.5;
              ancre = dx / d > 0.3 ? "start" : dx / d < -0.3 ? "end" : "middle";
              if (ancre === "middle") y += (dy > 0 ? 6 : -2);
            }
            return (
              <text key={`t${n.id}`} x={x} y={y} textAnchor={ancre} fontSize={n.hub ? 12 : 10.5} fontWeight={n.hub ? 600 : 400} fill={n.hub ? "#1d1b16" : "#55524a"} style={{ paintOrder: "stroke", stroke: "white", strokeWidth: 3, pointerEvents: "none" }}>
                {n.hub ? nomGroupe(c) : n.texte}
              </text>
            );
          })}
        </svg>
        <p className="px-3 pb-2 text-[12px] text-muted">
          Un rond = {mode === "clusters" ? "un cluster de Google" : "un mot-clé"}, ses termes de recherche reliés autour · taille = {taille === "cout" ? "coût" : taille} · survole ou clique une grappe.
        </p>
      </div>

      <aside className="min-w-0 space-y-3">
        {cat && <Fiche cat={cat} mode={mode} />}
        <Classement cats={cats} actif={actif} choisir={setChoisie} survoler={setSurvol} mode={mode} />
      </aside>
    </div>
  );
}

const COLONNES: { t: Taille; nom: string }[] = [
  { t: "clics", nom: "Clics" },
  { t: "impressions", nom: "Impr." },
  { t: "conversions", nom: "Conv." },
  { t: "cout", nom: "Coût CHF" },
];

function Fiche({ cat, mode }: { cat: CatRangee; mode: Mode }) {
  const masque = (t: Taille) => (cat.c[t] === null || cat.listes[t] === null ? null : (cat.c[t] as number) - (cat.listes[t] as number));
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-ink">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: special(cat) ? "#c9c6bd" : cat.couleur }} />
        <span className="min-w-0 truncate">{nomGroupe(cat)}</span>
        {cat.correspondance && <span className="shrink-0 rounded bg-canvas px-1.5 py-0.5 text-[11px] font-normal text-muted">{cat.correspondance}</span>}
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {COLONNES.map(({ t, nom }) => (
          <div key={t} title={t === "cout" && mode === "clusters" ? "Google ne donne pas le coût par cluster" : undefined}>
            <p className="text-[11px] text-muted">{nom}</p>
            <p className="text-[16px] font-semibold tabular-nums text-ink">{fmtCase(t, cat.c[t])}</p>
          </div>
        ))}
      </div>
      {special(cat) ? (
        <p className="mt-3 text-[12.5px] text-muted">{cat.fourreTout ? "Google range ici ce qu'il ne classe nulle part, et n'en liste aucun terme." : "Chacun pèse 5 clics au plus : regroupés pour rester lisibles."}</p>
      ) : (
        <table className="mt-3 w-full table-fixed text-[12px]">
          <thead><tr className="text-left text-muted"><th className="w-[46%] pb-1 font-normal">Terme de recherche</th>{COLONNES.map((c) => <th key={c.t} className="pb-1 text-right font-normal">{c.nom}</th>)}</tr></thead>
          <tbody>
            {[...cat.termes].sort((a, b) => b.c.clics - a.c.clics).map((tm) => (
              <tr key={tm.texte} className="border-t border-line/60">
                <td className="truncate py-1 pr-2 text-ink" title={tm.texte}>{tm.texte}</td>
                {COLONNES.map((c) => <td key={c.t} className="py-1 text-right tabular-nums text-ink">{fmtCase(c.t, tm.c[c.t])}</td>)}
              </tr>
            ))}
            <tr className="border-t border-line italic text-muted">
              <td className="py-1 pr-2">Masqués par Google</td>
              {COLONNES.map((c) => <td key={c.t} className="py-1 text-right tabular-nums">{fmtCase(c.t, masque(c.t))}</td>)}
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

function Classement({ cats, actif, choisir, survoler, mode }: { cats: CatRangee[]; actif: string; choisir: (id: string) => void; survoler: (id: string | null) => void; mode: Mode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <table className="w-full table-fixed text-[12px]">
        <thead><tr className="text-left text-muted"><th className="w-[46%] pb-1 font-normal">{mode === "clusters" ? "Cluster" : "Mot-clé"}</th><th className="pb-1 text-right font-normal">Clics</th><th className="pb-1 text-right font-normal">Conv.</th><th className="pb-1 text-right font-normal">Coût</th></tr></thead>
        <tbody>
          {cats.map((c) => (
            <tr key={c.id} onClick={() => choisir(c.id)} onMouseEnter={() => survoler(c.id)} onMouseLeave={() => survoler(null)} className={`cursor-pointer ${c.id === actif ? "bg-canvas" : ""}`}>
              <td className="py-0.5 pr-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: special(c) ? "repeating-linear-gradient(135deg,#c9c6bd 0 2px,#efede7 2px 4px)" : c.couleur }} />
                  <span className={`min-w-0 truncate ${special(c) ? "italic text-muted" : "text-ink"}`}>{nomGroupe(c)}</span>
                </span>
              </td>
              <td className="text-right tabular-nums text-ink">{fmtT("clics", c.c.clics)}</td>
              <td className="text-right tabular-nums text-ink">{fmtT("conversions", c.c.conversions)}</td>
              <td className="text-right tabular-nums text-muted" title={c.c.cout === null ? "Google ne donne pas le coût par cluster" : undefined}>{fmtT("cout", c.c.cout)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
