"use client";
// PROTOTYPE JETABLE — ticket 21, variante A « Constellation ». Le graphe « comme
// un Obsidian » : chaque catégorie de Google est un nœud, ses termes listés sont
// reliés autour ; un terme rangé dans deux catégories relie les deux grappes.
// La disposition sort d'une petite simulation de forces, calculée une fois et
// déterministe (même rendu serveur et client). Jamais en production.
import { useMemo, useState } from "react";
import type { CatRangee, Taille } from "./groupes-donnees";

type N = { id: string; cat?: string; texte: string; v: number; r: number; x: number; y: number; vx: number; vy: number; couleur: string; hub: boolean };
type L = { a: number; b: number; long: number };

const W = 920, H = 560;
const fmtV = (t: Taille, v: number) => (t === "conversions" ? v.toLocaleString("fr-CH", { maximumFractionDigits: 1 }) : Math.round(v).toLocaleString("fr-CH"));

function disposer(cats: CatRangee[], t: Taille) {
  const max = Math.max(1, ...cats.map((c) => c.c[t]));
  const rayon = (v: number, min: number) => Math.max(min, 42 * Math.sqrt(v / max));
  const nodes: N[] = [];
  const links: L[] = [];
  const parTexte = new Map<string, number>();
  cats.forEach((c, i) => {
    // Spirale à l'angle d'or : les plus grosses au centre, les autres autour,
    // sans que les couleurs se tassent d'un seul côté.
    const ang = i * 2.39996, dist = 40 + 34 * Math.sqrt(i);
    const hub = nodes.push({ id: c.id, cat: c.id, texte: c.id, v: c.c[t], r: rayon(c.c[t], 7), x: W / 2 + Math.cos(ang) * dist * 1.5, y: H / 2 + Math.sin(ang) * dist, vx: 0, vy: 0, couleur: c.couleur, hub: true }) - 1;
    c.termes.forEach((tm, j) => {
      let k = parTexte.get(tm.texte);
      if (k === undefined) {
        const a2 = ang + j * 1.3;
        k = nodes.push({ id: `${c.id}:${tm.texte}`, cat: c.id, texte: tm.texte, v: tm.c[t], r: rayon(tm.c[t], 2.5), x: nodes[hub].x + Math.cos(a2) * 50, y: nodes[hub].y + Math.sin(a2) * 50, vx: 0, vy: 0, couleur: c.couleur, hub: false }) - 1;
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

export function Constellation({ cats, taille, total }: { cats: CatRangee[]; taille: Taille; total: number }) {
  const { nodes, links } = useMemo(() => disposer(cats, taille), [cats, taille]);
  const [survol, setSurvol] = useState<string | null>(null);
  const [choisie, setChoisie] = useState<string>(cats[0]?.id ?? "");
  const actif = survol ?? choisie;
  const cat = cats.find((c) => c.id === actif) ?? cats[0];
  // Un terme partagé appartient aux deux grappes : allumé si l'une des deux l'est.
  const allume = (i: number) => nodes[i].hub ? nodes[i].cat === actif : links.some((l) => l.b === i && nodes[l.a].cat === actif);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 rounded-2xl border border-line bg-white p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" onMouseLeave={() => setSurvol(null)}>
          {links.map((l, i) => {
            const p = nodes[l.a], q = nodes[l.b], on = p.cat === actif;
            return <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={on ? p.couleur : "#d9d6ce"} strokeOpacity={on ? 0.7 : 0.5} strokeWidth={on ? 1.4 : 0.8} />;
          })}
          {nodes.map((n, i) => {
            const on = allume(i);
            const c = cats.find((x) => x.id === n.cat)!;
            const special = n.hub && (c.fourreTout || c.traine);
            return (
              <g key={n.id} onMouseEnter={() => setSurvol(n.hub ? n.cat! : nodes[links.find((l) => l.b === i)!.a].cat!)} onClick={() => setChoisie(n.hub ? n.cat! : nodes[links.find((l) => l.b === i)!.a].cat!)} className="cursor-pointer">
                <circle cx={n.x} cy={n.y} r={n.r} fill={special ? "url(#hachure)" : n.couleur} fillOpacity={n.hub ? (on ? 0.95 : 0.55) : on ? 0.75 : 0.3} stroke={special ? "#a9a59b" : "white"} strokeDasharray={special ? "3 2" : undefined} strokeWidth={n.hub ? 2 : 1} />
                <title>{n.hub ? `${special ? (c.fourreTout ? "Sans catégorie" : `${c.traine} petites catégories`) : c.libelle} — ${fmtV(taille, n.v)}` : `${n.texte} — ${fmtV(taille, n.v)}`}</title>
              </g>
            );
          })}
          {nodes.map((n, i) => {
            const c = cats.find((x) => x.id === n.cat)!;
            const on = allume(i);
            const montrer = n.hub ? c.rang < 8 || c.fourreTout || c.traine || on : on;
            if (!montrer) return null;
            const nom = n.hub ? (c.fourreTout ? "Sans catégorie" : c.traine ? `${c.traine} petites catégories` : c.libelle) : n.texte;
            return (
              <text key={`t${n.id}`} x={n.x} y={n.y + n.r + (n.hub ? 13 : 10)} textAnchor="middle" fontSize={n.hub ? 12 : 10.5} fontWeight={n.hub ? 600 : 400} fill={n.hub ? "#1d1b16" : "#55524a"} style={{ paintOrder: "stroke", stroke: "white", strokeWidth: 3, pointerEvents: "none" }}>
                {nom}
              </text>
            );
          })}
          <defs>
            <pattern id="hachure" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#efede7" /><line x1="0" y1="0" x2="0" y2="6" stroke="#c9c6bd" strokeWidth="2.5" />
            </pattern>
          </defs>
        </svg>
        <p className="px-3 pb-2 text-[12px] text-muted">Taille d'un rond = {taille} · un trait relie un terme à sa catégorie · survole ou clique une grappe pour la lire.</p>
      </div>

      <aside className="min-w-0 space-y-3">
        {cat && <FicheCat cat={cat} taille={taille} total={total} />}
        <ol className="space-y-1 rounded-2xl border border-line bg-white p-3 text-[12.5px]">
          {cats.map((c) => (
            <li key={c.id}>
              <button onClick={() => setChoisie(c.id)} onMouseEnter={() => setSurvol(c.id)} onMouseLeave={() => setSurvol(null)} className={`flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 text-left ${c.id === actif ? "bg-canvas" : ""}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.fourreTout || c.traine ? "repeating-linear-gradient(135deg,#c9c6bd 0 2px,#efede7 2px 4px)" : c.couleur }} />
                <span className={`min-w-0 flex-1 truncate ${c.fourreTout || c.traine ? "italic text-muted" : "text-ink"}`}>{c.fourreTout ? "Sans catégorie" : c.traine ? `${c.traine} petites catégories` : c.libelle}</span>
                <span className="tabular-nums text-muted">{total ? Math.round((c.c[taille] / total) * 100) : 0} %</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

function FicheCat({ cat, taille, total }: { cat: CatRangee; taille: Taille; total: number }) {
  const special = cat.fourreTout || cat.traine;
  const masque = cat.c[taille] - cat.listes[taille];
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
        <span className="h-3 w-3 rounded-full" style={{ background: special ? "#c9c6bd" : cat.couleur }} />
        {cat.fourreTout ? "Sans catégorie" : cat.traine ? `${cat.traine} petites catégories` : cat.libelle}
      </p>
      <p className="mt-1 text-[24px] font-semibold tabular-nums text-ink">{fmtV(taille, cat.c[taille])} <span className="text-[13px] font-normal text-muted">{taille} · {total ? Math.round((cat.c[taille] / total) * 100) : 0} % du total</span></p>
      {special ? (
        <p className="mt-2 text-[12.5px] text-muted">{cat.fourreTout ? "Google range ici ce qu'il ne classe nulle part, et n'en liste aucun terme." : "Chacune pèse 5 clics au plus : regroupées pour rester lisibles."}</p>
      ) : (
        <>
          <ul className="mt-3 space-y-1 text-[12.5px]">
            {[...cat.termes].sort((a, b) => b.c[taille] - a.c[taille]).map((t) => (
              <li key={t.texte} className="flex min-w-0 justify-between gap-2"><span className="min-w-0 truncate text-ink">{t.texte}</span><span className="tabular-nums text-muted">{fmtV(taille, t.c[taille])}</span></li>
            ))}
            <li className="flex justify-between gap-2 border-t border-line pt-1 italic text-muted"><span>Termes masqués par Google</span><span className="tabular-nums">{fmtV(taille, masque)}</span></li>
          </ul>
        </>
      )}
    </div>
  );
}
