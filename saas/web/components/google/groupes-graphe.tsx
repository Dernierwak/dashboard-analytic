"use client";

import { useMemo, useState } from "react";
import { chiffre, TAILLES, type Grappe, type ModeGroupes, type Taille } from "@/lib/google/termes";

// ── LE GRAPHE EN GRAPPES, LA FICHE, LE CLASSEMENT ───────────────────────────
//
// Carte, issue 21 : le graphe « comme un Obsidian » validé par David — un rond
// par grappe, ses termes reliés autour ; un terme rangé dans deux grappes relie
// les deux. La disposition sort d'une petite simulation de forces, calculée une
// fois et déterministe (aucun hasard : même rendu au serveur et au navigateur).
// Survol et clic ouvrent la fiche sans relire la page ; ils ne sont pas dans
// l'URL (la spec y met le mode, la campagne et la taille, pas la grappe).

const L = 920;
const H = 580;

// Ce que le graphe dessine — la fiche et le classement, eux, montrent TOUT.
// Un compte réel a des milliers de termes (10 106 lignes sur 90 jours chez A,
// carte issue 19) : la simulation est quadratique en nœuds, et au-delà de
// quelques centaines le graphe n'est plus lisible ni calculable au rendu.
const MAX_GRAPPES_DESSINEES = 40;
const MAX_TERMES_PAR_GRAPPE = 8;
/** Les 8 grappes colorées portent leur nom ; les grises seulement au survol. */
const GRAPPES_NOMMEES = 8;
const HACHURE = "#c3c2bb";

type Noeud = { cle: string; grappe: number; texte: string; v: number; r: number; x: number; y: number; vx: number; vy: number; centre: boolean };
type Lien = { a: number; b: number; long: number };

function disposer(grappes: Grappe[], t: Taille) {
  const val = (v: number | null) => v ?? 0;
  const dessinees = grappes.slice(0, MAX_GRAPPES_DESSINEES);
  const max = Math.max(1, ...dessinees.map((g) => val(g.chiffres[t])));
  // L'AIRE suit la mesure (rayon en racine), avec un plancher pour rester visible.
  const rayon = (v: number, plancher: number) => Math.max(plancher, 44 * Math.sqrt(v / max));
  const noeuds: Noeud[] = [];
  const liens: Lien[] = [];
  const parTexte = new Map<string, number>();
  dessinees.forEach((g, i) => {
    // Spirale à l'angle d'or : les plus grosses au centre, les couleurs réparties.
    const angle = i * 2.39996;
    const dist = 40 + 34 * Math.sqrt(i);
    const v = val(g.chiffres[t]);
    const centre =
      noeuds.push({ cle: g.id, grappe: i, texte: g.libelle, v, r: rayon(v, 7), x: L / 2 + Math.cos(angle) * dist * 1.5, y: H / 2 + Math.sin(angle) * dist, vx: 0, vy: 0, centre: true }) - 1;
    g.termes.slice(0, MAX_TERMES_PAR_GRAPPE).forEach((terme, j) => {
      let k = parTexte.get(terme.texte);
      if (k === undefined) {
        const a2 = angle + j * 1.3;
        const vt = val(terme.chiffres[t]);
        k = noeuds.push({ cle: `${g.id}:${terme.texte}`, grappe: i, texte: terme.texte, v: vt, r: rayon(vt, 2.5), x: noeuds[centre].x + Math.cos(a2) * 50, y: noeuds[centre].y + Math.sin(a2) * 50, vx: 0, vy: 0, centre: false }) - 1;
        parTexte.set(terme.texte, k);
      }
      liens.push({ a: centre, b: k, long: noeuds[centre].r + noeuds[k].r + 34 });
    });
  });
  for (let it = 0, alpha = 1; it < 300; it++, alpha *= 0.985) {
    for (let i = 0; i < noeuds.length; i++)
      for (let j = i + 1; j < noeuds.length; j++) {
        const p = noeuds[i];
        const q = noeuds[j];
        let dx = q.x - p.x;
        let dy = q.y - p.y;
        const d2 = Math.max(dx * dx + dy * dy, 1);
        const d = Math.sqrt(d2);
        const charge = ((p.centre ? p.r + 10 : 4) * (q.centre ? q.r + 10 : 4) * 5) / d2;
        const chevauche = p.r + q.r + 4 - d;
        const f = (charge + (chevauche > 0 ? chevauche * 0.5 : 0)) * alpha;
        dx /= d;
        dy /= d;
        p.vx -= dx * f;
        p.vy -= dy * f;
        q.vx += dx * f;
        q.vy += dy * f;
      }
    for (const l of liens) {
      const p = noeuds[l.a];
      const q = noeuds[l.b];
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = Math.max(Math.hypot(dx, dy), 1);
      const f = ((d - l.long) / d) * 0.08 * alpha;
      p.vx += dx * f * 0.3;
      p.vy += dy * f * 0.3;
      q.vx -= dx * f;
      q.vy -= dy * f;
    }
    for (const n of noeuds) {
      n.vx += (L / 2 - n.x) * 0.0015 * alpha;
      n.vy += (H / 2 - n.y) * 0.004 * alpha;
      n.x = Math.min(L - n.r - 4, Math.max(n.r + 4, n.x + n.vx));
      n.y = Math.min(H - n.r - 4, Math.max(n.r + 4, n.y + n.vy));
      n.vx *= 0.6;
      n.vy *= 0.6;
    }
  }
  // Dernière passe : plus aucun rond n'en recouvre un autre.
  for (let it = 0; it < 80; it++)
    for (let i = 0; i < noeuds.length; i++)
      for (let j = i + 1; j < noeuds.length; j++) {
        const p = noeuds[i];
        const q = noeuds[j];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const d = Math.max(Math.hypot(dx, dy), 0.1);
        const min = p.r + q.r + (p.centre && q.centre ? 18 : 5);
        if (d >= min) continue;
        const k = (min - d) / d / 2;
        p.x -= dx * k;
        p.y -= dy * k;
        q.x += dx * k;
        q.y += dy * k;
      }
  for (const n of noeuds) {
    n.x = Math.min(L - n.r - 4, Math.max(n.r + 4, n.x));
    n.y = Math.min(H - n.r - 4, Math.max(n.r + 4, n.y));
  }
  return { noeuds, liens, dessinees: dessinees.length };
}

const COLONNES: { t: Taille; nom: string }[] = [
  { t: "clics", nom: "Clics" },
  { t: "impressions", nom: "Impr." },
  { t: "conversions", nom: "Conv." },
  { t: "cout", nom: "Coût CHF" },
];
const RAISON_SANS_COUT = "Google ne donne pas ce coût";
const nomTaille = (t: Taille) => TAILLES.find((x) => x.cle === t)!.nom.toLowerCase();

export function GrapheGroupes({ grappes, taille, mode }: { grappes: Grappe[]; taille: Taille; mode: ModeGroupes }) {
  const { noeuds, liens, dessinees } = useMemo(() => disposer(grappes, taille), [grappes, taille]);
  const [survol, setSurvol] = useState<number | null>(null);
  const [choisie, setChoisie] = useState(0);
  const active = survol ?? choisie;
  const grappe = grappes[active] ?? grappes[0];
  // Un terme partagé appartient à chaque grappe qui le relie.
  const grappesDe = useMemo(() => {
    const m = new Map<number, Set<number>>();
    for (const l of liens) {
      const s = m.get(l.b) ?? new Set<number>();
      s.add(noeuds[l.a].grappe);
      m.set(l.b, s);
    }
    return m;
  }, [liens, noeuds]);
  const allume = (i: number) => (noeuds[i].centre ? noeuds[i].grappe === active : grappesDe.get(i)?.has(active) ?? false);
  const unite = mode === "mots-cles" ? "un mot-clé" : "un cluster de Google";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 rounded-2xl border border-line bg-white p-2">
        <svg viewBox={`0 0 ${L} ${H}`} className="h-auto w-full" role="img" aria-label={`Graphe : ${unite} par rond, ses termes de recherche reliés autour`} onMouseLeave={() => setSurvol(null)}>
          <defs>
            <pattern id="hachure-groupes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#efeee9" />
              <line x1="0" y1="0" x2="0" y2="6" stroke={HACHURE} strokeWidth="2.5" />
            </pattern>
          </defs>
          {liens.map((l, i) => {
            const g = grappes[noeuds[l.a].grappe];
            const on = noeuds[l.a].grappe === active;
            return <line key={i} x1={noeuds[l.a].x} y1={noeuds[l.a].y} x2={noeuds[l.b].x} y2={noeuds[l.b].y} stroke={on ? g.couleur ?? HACHURE : "#dcdbd5"} strokeOpacity={on ? 0.75 : 0.5} strokeWidth={on ? 1.4 : 0.8} />;
          })}
          {noeuds.map((n, i) => {
            const g = grappes[n.grappe];
            const on = allume(i);
            const hachuree = n.centre && g.couleur === null;
            return (
              <g key={n.cle} onMouseEnter={() => setSurvol(n.grappe)} onClick={() => setChoisie(n.grappe)} className="cursor-pointer">
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={hachuree ? "url(#hachure-groupes)" : g.couleur ?? HACHURE}
                  fillOpacity={n.centre ? (on ? 0.95 : 0.55) : on ? 0.75 : 0.3}
                  stroke={hachuree ? "#a9a8a1" : "white"}
                  strokeDasharray={hachuree ? "3 2" : undefined}
                  strokeWidth={n.centre ? 2 : 1}
                />
                <title>{`${n.texte} — ${chiffre(taille, n.v)} ${nomTaille(taille)}`}</title>
              </g>
            );
          })}
          {noeuds.map((n, i) => {
            const on = allume(i);
            if (!(n.centre ? n.grappe < GRAPPES_NOMMEES || grappes[n.grappe].couleur === null || on : on)) return null;
            // Le nom d'un terme part vers l'extérieur de sa grappe, pour ne pas
            // s'empiler sous les autres.
            let x = n.x;
            let y = n.y + n.r + 13;
            let ancre: "start" | "middle" | "end" = "middle";
            if (!n.centre) {
              const c = noeuds.find((m) => m.centre && m.grappe === n.grappe)!;
              const dx = n.x - c.x;
              const dy = n.y - c.y;
              const d = Math.max(Math.hypot(dx, dy), 1);
              x = n.x + (dx / d) * (n.r + 4);
              y = n.y + (dy / d) * (n.r + 4) + 3.5;
              ancre = dx / d > 0.3 ? "start" : dx / d < -0.3 ? "end" : "middle";
              if (ancre === "middle") y += dy > 0 ? 6 : -2;
            }
            return (
              <text key={`t${n.cle}`} x={x} y={y} textAnchor={ancre} fontSize={n.centre ? 12 : 10.5} fontWeight={n.centre ? 600 : 400} fill={n.centre ? "#0e0f12" : "#5a5d66"} style={{ paintOrder: "stroke", stroke: "white", strokeWidth: 3, pointerEvents: "none" }}>
                {n.texte}
              </text>
            );
          })}
        </svg>
        <p className="px-3 pb-2 text-[12px] text-muted">
          Un rond = {unite}, ses termes de recherche reliés autour · aire = {nomTaille(taille)} · survole ou clique une grappe.
          {grappes.length > dessinees && ` Le graphe montre les ${dessinees} plus grosses ; toutes sont dans le classement.`}
          {` Au plus ${MAX_TERMES_PAR_GRAPPE} termes dessinés par grappe ; la fiche les liste tous.`}
        </p>
      </div>

      <aside className="min-w-0 space-y-3">
        {grappe && <Fiche grappe={grappe} />}
        <Classement grappes={grappes} active={active} choisir={setChoisie} survoler={setSurvol} mode={mode} />
      </aside>
    </div>
  );
}

function Pastille({ g, petite }: { g: Grappe; petite?: boolean }) {
  const taille = petite ? "h-2.5 w-2.5" : "h-3 w-3";
  return (
    <span
      className={`${taille} shrink-0 rounded-full`}
      style={{ background: g.couleur ?? `repeating-linear-gradient(135deg, ${HACHURE} 0 2px, #efeee9 2px 4px)` }}
    />
  );
}

function Fiche({ grappe }: { grappe: Grappe }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-ink">
        <Pastille g={grappe} />
        <span className="min-w-0 truncate" title={grappe.libelle}>
          {grappe.libelle}
        </span>
        {grappe.correspondance && <span className="shrink-0 rounded bg-canvas px-1.5 py-0.5 text-[11px] font-normal text-muted">{grappe.correspondance}</span>}
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {COLONNES.map(({ t, nom }) => (
          <div key={t} className="min-w-0" title={grappe.chiffres[t] === null && t === "cout" ? RAISON_SANS_COUT : undefined}>
            <p className="text-[11px] text-muted">{nom}</p>
            <p className="text-[16px] font-semibold tabular-nums text-ink">{chiffre(t, grappe.chiffres[t])}</p>
          </div>
        ))}
      </div>
      {grappe.special && <p className="mt-3 text-[12.5px] text-muted">{grappe.special.raison}</p>}
      {grappe.termes.length > 0 && (
        <div className="mt-3 max-h-[360px] overflow-y-auto">
          <table className="w-full table-fixed text-[12px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="w-[44%] pb-1 font-normal">Terme de recherche</th>
                {COLONNES.map((c) => (
                  <th key={c.t} className="pb-1 text-right font-normal">
                    {c.nom}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grappe.termes.map((t) => (
                <tr key={t.texte} className="border-t border-line align-top">
                  <td className="py-1 pr-2">
                    <span className="block truncate text-ink" title={t.texte}>
                      {t.texte}
                    </span>
                    {t.appariement && <span className="block truncate text-[10.5px] text-muted">{t.appariement}</span>}
                  </td>
                  {COLONNES.map((c) => (
                    <td key={c.t} className="py-1 text-right tabular-nums text-ink">
                      {chiffre(c.t, t.chiffres[c.t])}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-line italic text-muted" title={grappe.raisonMasques ?? undefined}>
                <td className="py-1 pr-2">Masqués par Google</td>
                {COLONNES.map((c) => (
                  <td key={c.t} className="py-1 text-right tabular-nums">
                    {chiffre(c.t, grappe.masques ? grappe.masques[c.t] : null)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          {!grappe.masques && grappe.raisonMasques && <p className="mt-2 text-[11.5px] text-muted">{grappe.raisonMasques}</p>}
        </div>
      )}
    </div>
  );
}

function Classement({
  grappes,
  active,
  choisir,
  survoler,
  mode,
}: {
  grappes: Grappe[];
  active: number;
  choisir: (i: number) => void;
  survoler: (i: number | null) => void;
  mode: ModeGroupes;
}) {
  return (
    <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-line bg-white p-3">
      <table className="w-full table-fixed text-[12px]">
        <thead>
          <tr className="text-left text-muted">
            <th className="w-[46%] pb-1 font-normal">{mode === "mots-cles" ? "Mot-clé" : "Cluster"}</th>
            <th className="pb-1 text-right font-normal">Clics</th>
            <th className="pb-1 text-right font-normal">Conv.</th>
            <th className="pb-1 text-right font-normal">Coût CHF</th>
          </tr>
        </thead>
        <tbody>
          {grappes.map((g, i) => (
            <tr key={g.id} onMouseEnter={() => survoler(i)} onMouseLeave={() => survoler(null)} className={i === active ? "bg-canvas" : ""}>
              <td className="py-0.5 pr-2">
                <button type="button" onClick={() => choisir(i)} className="flex w-full min-w-0 items-center gap-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                  <Pastille g={g} petite />
                  <span className={`min-w-0 truncate ${g.special ? "italic text-muted" : "text-ink"}`} title={g.libelle}>
                    {g.libelle}
                  </span>
                </button>
              </td>
              <td className="text-right tabular-nums text-ink">{chiffre("clics", g.chiffres.clics)}</td>
              <td className="text-right tabular-nums text-ink">{chiffre("conversions", g.chiffres.conversions)}</td>
              <td className="text-right tabular-nums text-ink" title={g.chiffres.cout === null ? RAISON_SANS_COUT : undefined}>
                {chiffre("cout", g.chiffres.cout)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
