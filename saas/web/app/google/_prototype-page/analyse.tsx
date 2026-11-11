// PROTOTYPE JETABLE — ticket « L'Analyse Search en maquette »
// (.scratch/google-ads/issues/20-l-analyse-search-en-maquette.md).
//
// Trois variantes de l'Analyse Search, en bas de la page Google validée au
// ticket 11, switchables par `?av=A|B|C`. La structure est celle du ticket 18
// (onglets de type, nuage piloté par la vue, niveau, Étendue, mots-clés,
// termes, catégories) ; les variantes ne diffèrent que sur les quatre questions
// du ticket : couleurs au-delà de 8 campagnes, phrase de lecture, descente de
// niveau, place du menu des actions de conversion.
//   A · Pas à pas           — contrôles au-dessus, 8 couleurs + « Autres »
//   B · Plonger dans le nuage — on clique un point pour descendre, gris + une couleur
//   C · La liste pilote     — une liste cochable commande le nuage, phrase en titre
import Link from "next/link";
import { Icone } from "@/components/meta/elements";
import {
  ACTIONS, AXES, AXES_ETENDUE, CATEGORIES, CLICS_SEARCH, CLICS_TERMES, GRIS, MOTS_CLES, NIVEAUX, NOEUDS, PALETTE,
  RANG_COUT, TERMES, actionsChoisies, chf0, conv1, enfantsDe, entier, lien, nomCampagne, parId, partActions, pct, tous, un,
  type MotCle, type Niveau, type Noeud, type SP, type Vue,
} from "./analyse-donnees";
import { BarreAnalyse } from "./analyse-barre";

const VARIANTES = [
  { cle: "A", nom: "Pas à pas" },
  { cle: "B", nom: "Plonger dans le nuage" },
  { cle: "C", nom: "La liste pilote" },
];

type Ctx = { sp: SP; vue: Vue; niv: Niveau; onglet: "performance" | "etendue"; actions: string[]; part: number };

export function AnalyseSearch({ sp, vue }: { sp: SP; vue: Vue }) {
  const av = un(sp.av) ?? "A";
  const n = un(sp.niv) as Niveau | undefined;
  const actions = actionsChoisies(sp);
  const ctx: Ctx = { sp, vue, niv: n && NIVEAUX.some((x) => x.cle === n) ? n : "campagnes", onglet: un(sp.onglet) === "etendue" ? "etendue" : "performance", actions, part: partActions(actions) };
  return (
    <section id="analyse" className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-ink">Analyser tes campagnes</h2>
          <p className="text-[13px] text-muted">Période et campagne du bandeau · vue <b className="text-ink">{({ notoriete: "Notoriété", trafic: "Trafic", conversion: "Conversion" } as const)[vue]}</b> du sélecteur</p>
        </div>
        <OngletsType />
      </div>
      {av === "B" ? <VarianteB c={ctx} /> : av === "C" ? <VarianteC c={ctx} /> : <VarianteA c={ctx} />}
      <BarreAnalyse variantes={VARIANTES} />
    </section>
  );
}

// ── Briques communes ─────────────────────────────────────────────────────────

function OngletsType() {
  return (
    <nav className="flex flex-wrap gap-1 rounded-full border border-line bg-white p-1 text-[13px]">
      <span className="rounded-full bg-ink px-3 py-1 font-medium text-white">Search</span>
      {["PMax", "Display", "Vidéo", "Demand Gen"].map((t) => (
        <span key={t} title="À venir — un type de campagne à la fois" className="cursor-not-allowed rounded-full px-3 py-1 text-muted/60">{t}</span>
      ))}
    </nav>
  );
}

type Point = { id: string; label: string; x: number; y: number; r: number; couleur: string; href?: string; etiquette?: boolean; titre: string };

function Nuage({ points, ax, ay, ar, fx = entier, fy = entier, hauteur = 340 }: { points: Point[]; ax: string; ay: string; ar?: string; fx?: (v: number) => string; fy?: (v: number) => string; hauteur?: number }) {
  const W = 1000, H = hauteur, g = 78, b = 40;
  const mx = Math.max(...points.map((p) => p.x), 1) * 1.08, my = Math.max(...points.map((p) => p.y), 1e-9) * 1.12;
  const mr = Math.max(...points.map((p) => p.r), 1);
  const X = (v: number) => g + (v / mx) * (W - g - 12), Y = (v: number) => H - b - (v / my) * (H - b - 12);
  const R = (v: number) => (ar ? 4 + Math.sqrt(v / mr) * 16 : 6);
  const tri = [...points].sort((p, q) => q.r - p.r);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full max-w-[1000px]" role="img" aria-label={`${ay} selon ${ax}`}>
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <g key={k}>
          <line x1={g} x2={W - 12} y1={Y(my * k / 1.12)} y2={Y(my * k / 1.12)} stroke="#efede7" />
          <text x={g - 8} y={Y(my * k / 1.12) + 4} textAnchor="end" className="fill-[#8a877f] text-[11px] tabular-nums">{fy(my * k / 1.12)}</text>
          <text x={X(mx * k / 1.08)} y={H - b + 16} textAnchor="middle" className="fill-[#8a877f] text-[11px] tabular-nums">{fx(mx * k / 1.08)}</text>
        </g>
      ))}
      <line x1={g} x2={W - 12} y1={H - b} y2={H - b} stroke="#d9d6cd" />
      <line x1={g} x2={g} y1={12} y2={H - b} stroke="#d9d6cd" />
      <text x={W - 12} y={H - 4} textAnchor="end" className="fill-[#8a877f] text-[11px]">{ax} →</text>
      <text x={g + 4} y={22} className="fill-[#8a877f] text-[11px]">↑ {ay}{ar ? ` · taille : ${ar.toLowerCase()}` : ""}</text>
      {tri.map((p) => {
        const dot = (
          <g key={p.id}>
            <circle cx={X(p.x)} cy={Y(p.y)} r={R(p.r)} fill={p.couleur} fillOpacity={p.couleur === GRIS ? 0.55 : 0.78} stroke="white" strokeWidth={1.2}><title>{p.titre}</title></circle>
            {p.etiquette && (X(p.x) > W * 0.7
              ? <text x={X(p.x) - R(p.r) - 4} y={Y(p.y) + 4} textAnchor="end" className="fill-[#0e0f12] text-[11px] font-medium">{p.label}</text>
              : <text x={X(p.x) + R(p.r) + 4} y={Y(p.y) + 4} className="fill-[#0e0f12] text-[11px] font-medium">{p.label}</text>)}
          </g>
        );
        return p.href ? <a key={p.id} href={p.href}>{dot}</a> : dot;
      })}
    </svg>
  );
}

function pointsPerf(c: Ctx, noeuds: Noeud[], couleur: (n: Noeud) => string, href?: (n: Noeud) => string | undefined, etiquette?: (n: Noeud) => boolean): Point[] {
  const a = AXES[c.vue];
  return noeuds.map((n) => {
    const x = a.x.v(n.c, c.part) ?? 0, y = a.y.v(n.c, c.part) ?? 0, r = a.r ? a.r.v(n.c, c.part) ?? 0 : 0;
    return { id: n.id, label: n.nom, x, y, r, couleur: couleur(n), href: href?.(n), etiquette: etiquette?.(n),
      titre: `${n.nom}${n.niveau !== "campagnes" ? ` (${nomCampagne(n.campagne)})` : ""}\n${a.x.nom} : ${a.x.fmt(x)}\n${a.y.nom} : ${a.y.fmt(y)}${a.r ? `\n${a.r.nom} : ${a.r.fmt(r)}` : ""}` };
  });
}
function pointsEtendue(mcs: MotCle[], couleur: (k: MotCle) => string, etiquette?: (k: MotCle) => boolean): Point[] {
  return mcs.filter((k) => k.c).map((k) => ({ id: k.id, label: k.texte, x: k.termes, y: k.partIdentique, r: k.c!.cout, couleur: couleur(k), etiquette: etiquette?.(k),
    titre: `${k.texte} (${nomCampagne(k.campagne)})\n${AXES_ETENDUE.x.nom} : ${k.termes}\n${AXES_ETENDUE.y.nom} : ${pct(k.partIdentique)}\nCoût : ${chf0(k.c!.cout)}` }));
}

function NoteElements() {
  return <p className="mt-2 rounded-lg bg-[#fff6e5] px-3 py-2 text-[12.5px] text-[#7a5200]">Un titre ou une description est compté chaque fois que l&apos;annonce le sert avec d&apos;autres : leurs chiffres ne s&apos;additionnent pas et ne redonnent pas l&apos;annonce. Chaque point se lit seul.</p>;
}

function SansAction() {
  return <p className="rounded-2xl border border-dashed border-line bg-white/60 p-8 text-center text-[13px] text-muted">Aucune action de conversion choisie : coche au moins une action pour voir le nuage Conversion.</p>;
}

function Onglets({ c }: { c: Ctx }) {
  return (
    <div className="flex gap-4 border-b border-line text-[13px]">
      {([["performance", "Performance"], ["etendue", "Étendue des mots-clés"]] as const).map(([k, nom]) => (
        <Link key={k} href={lien(c.sp, { onglet: k === "performance" ? undefined : k })} scroll={false}
          className={`-mb-px border-b-2 pb-2 ${c.onglet === k ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}>{nom}</Link>
      ))}
    </div>
  );
}

const QS_ABSENT = "Google ne donne pas de niveau de qualité pour ce mot-clé aujourd'hui (pas assez de recherches, ou mot-clé en pause).";

function TableMotsCles({ c, mcs, compact = false }: { c: Ctx; mcs: MotCle[]; compact?: boolean }) {
  const actif = un(c.sp.mc);
  const tri = [...mcs].sort((a, b) => (b.c?.cout ?? -1) - (a.c?.cout ?? -1));
  return (
    <div className="min-w-0 overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full text-[12.5px]">
        <thead className="text-left text-muted"><tr className="border-b border-line">
          <th className="px-3 py-2 font-medium">Mot-clé</th>{!compact && <th className="px-3 py-2 font-medium">Campagne</th>}
          <th className="px-3 py-2 text-right font-medium">Clics</th><th className="px-3 py-2 text-right font-medium">Coût</th>
          {c.vue === "conversion" && <th className="px-3 py-2 text-right font-medium">Conv.</th>}
          <th className="px-3 py-2 text-right font-medium" title="État du jour, pas celui de la période">Niveau de qualité (aujourd&apos;hui)</th>
        </tr></thead>
        <tbody>
          {tri.map((k) => (
            <tr key={k.id} className={`border-b border-line/60 last:border-0 ${actif === k.id ? "bg-canvas" : ""}`}>
              <td className="px-3 py-1.5"><Link href={lien(c.sp, { mc: actif === k.id ? undefined : k.id })} scroll={false} className="text-ink hover:underline">{k.texte}</Link> <span className="text-muted">· {k.correspondance.toLowerCase()}</span></td>
              {!compact && <td className="truncate px-3 py-1.5 text-muted">{nomCampagne(k.campagne)}</td>}
              {k.c ? <>
                <td className="px-3 py-1.5 text-right tabular-nums">{entier(k.c.clics)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{chf0(k.c.cout)}</td>
                {c.vue === "conversion" && <td className="px-3 py-1.5 text-right tabular-nums">{conv1(k.c.conversions * c.part)}</td>}
              </> : <td colSpan={c.vue === "conversion" ? 3 : 2} className="px-3 py-1.5 text-right text-muted">aucune impression sur la période</td>}
              <td className="px-3 py-1.5 text-right tabular-nums">{k.qualite ?? <span className="cursor-help text-muted" title={QS_ABSENT}>—</span>}{k.qualite && <span className="text-muted">/10</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableTermes({ c, campagnes, limite = 14 }: { c: Ctx; campagnes?: string[]; limite?: number }) {
  const mc = un(c.sp.mc);
  const k = mc ? MOTS_CLES.find((x) => x.id === mc) : undefined;
  const liste = TERMES.filter((t) => (mc ? t.motCle === mc : !campagnes || campagnes.includes(MOTS_CLES.find((x) => x.id === t.motCle)!.campagne)));
  const masques = CLICS_SEARCH - CLICS_TERMES;
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2 text-[12.5px]">
        <span className="text-muted">{k ? <>Termes déclenchés par <b className="text-ink">{k.texte}</b> · <Link className="text-brand" href={lien(c.sp, { mc: undefined })} scroll={false}>tous les termes</Link></> : <>Termes de recherche, du plus coûteux au moins coûteux{c.vue === "conversion" ? " — ceux qui ont coûté sans convertir apparaissent d'eux-mêmes" : ""}</>}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="text-left text-muted"><tr className="border-b border-line">
            <th className="px-3 py-2 font-medium">Terme</th><th className="px-3 py-2 font-medium">Mot-clé déclencheur</th>
            <th className="px-3 py-2 text-right font-medium">Clics</th><th className="px-3 py-2 text-right font-medium">Coût</th>
            {c.vue === "conversion" && <th className="px-3 py-2 text-right font-medium">Conv.</th>}
          </tr></thead>
          <tbody>
            {liste.slice(0, limite).map((t, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                <td className="px-3 py-1.5 text-ink">{t.texte}
                  {t.appariement === "EXACT" && <span className="ml-1.5 rounded bg-canvas px-1.5 py-0.5 text-[11px] text-muted" title="Le terme tapé est le mot-clé lui-même">identique au mot-clé</span>}
                  {t.exclu && <span className="ml-1.5 rounded bg-canvas px-1.5 py-0.5 text-[11px] text-muted">déjà exclu</span>}</td>
                <td className="px-3 py-1.5 text-muted">{MOTS_CLES.find((x) => x.id === t.motCle)!.texte}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{entier(t.c.clics)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{chf0(t.c.cout)}</td>
                {c.vue === "conversion" && <td className="px-3 py-1.5 text-right tabular-nums">{conv1(t.c.conversions * c.part)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-3 py-2 text-[12px] text-muted">
        {liste.length > limite && <>{liste.length - limite} autres termes · </>}
        Google masque une partie des recherches : <b className="text-ink">{pct(masques / CLICS_SEARCH)} des clics</b> ({entier(masques)}) viennent de termes qu&apos;il ne liste pas. Ils comptent dans les campagnes, pas ici.
      </p>
    </div>
  );
}

function Categories({ c, forme }: { c: Ctx; forme: "table" | "cartes" }) {
  const ouverte = un(c.sp.cat);
  const tri = [...CATEGORIES].sort((a, b) => b.clics - a.clics);
  const nom = (l: string) => l || "Sans catégorie";
  const detail = (id: string) => {
    const x = CATEGORIES.find((y) => y.id === id)!;
    return x.libelle ? <ul className="mt-1 space-y-0.5 text-[12px] text-muted">{x.termes.map((t) => <li key={t}>· {t}</li>)}<li className="italic">et des termes que Google ne liste pas</li></ul>
      : <p className="mt-1 text-[12px] text-muted">Google regroupe ici ce qu&apos;il ne classe pas, sans en lister les termes.</p>;
  };
  const tete = <p className="mb-2 text-[12.5px] text-muted">Les groupes que Google fait de tes recherches, Search et Performance Max ensemble. <b className="text-ink">Sans coût</b> : Google ne le donne pas pour ces groupes. Un même sujet peut apparaître une fois par langue.</p>;
  if (forme === "cartes") return (
    <div>{tete}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {tri.map((x) => (
          <Link key={x.id} href={lien(c.sp, { cat: ouverte === x.id ? undefined : x.id })} scroll={false} className={`min-w-0 rounded-xl border p-3 ${ouverte === x.id ? "border-ink bg-white" : "border-line bg-white hover:border-ink/30"}`}>
            <p className={`truncate text-[13px] font-medium ${x.libelle ? "text-ink" : "italic text-muted"}`}>{nom(x.libelle)}</p>
            <p className="mt-1 text-[12px] tabular-nums text-muted">{entier(x.clics)} clics · {entier(x.impressions)} impr.{c.vue === "conversion" ? ` · ${conv1(x.conversions * c.part)} conv.` : ""}</p>
            {ouverte === x.id && detail(x.id)}
          </Link>
        ))}
      </div>
    </div>
  );
  return (
    <div>{tete}
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-[12.5px]">
          <thead className="text-left text-muted"><tr className="border-b border-line">
            <th className="px-3 py-2 font-medium">Catégorie de termes</th><th className="px-3 py-2 text-right font-medium">Impressions</th>
            <th className="px-3 py-2 text-right font-medium">Clics</th>{c.vue === "conversion" && <th className="px-3 py-2 text-right font-medium">Conv.</th>}
            <th className="px-3 py-2 text-right font-medium">Coût</th>
          </tr></thead>
          <tbody>
            {tri.map((x) => (
              <tr key={x.id} className="border-b border-line/60 align-top last:border-0">
                <td className="px-3 py-1.5"><Link href={lien(c.sp, { cat: ouverte === x.id ? undefined : x.id })} scroll={false} className={x.libelle ? "text-ink hover:underline" : "italic text-muted hover:underline"}>{ouverte === x.id ? "▾" : "▸"} {nom(x.libelle)}</Link>{ouverte === x.id && detail(x.id)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{entier(x.impressions)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{entier(x.clics)}</td>
                {c.vue === "conversion" && <td className="px-3 py-1.5 text-right tabular-nums">{conv1(x.conversions * c.part)}</td>}
                <td className="px-3 py-1.5 text-right text-muted" title="Google ne donne pas le coût des catégories">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const noeudsDuNiveau = (niv: Niveau, dans?: string) => {
  if (!dans) return NOEUDS.filter((n) => n.niveau === niv);
  const desc = (id: string): Noeud[] => enfantsDe(id).flatMap((e) => [e, ...desc(e.id)]);
  return desc(dans).filter((n) => n.niveau === niv);
};
const titreActions = (c: Ctx) => c.actions.length === ACTIONS.length ? "toutes les actions" : c.actions.length === 0 ? "aucune action" : ACTIONS.filter((a) => c.actions.includes(a.id)).map((a) => a.nom.toLowerCase()).join(", ");
const basculerAction = (c: Ctx, id: string) => {
  const n = c.actions.includes(id) ? c.actions.filter((x) => x !== id) : [...c.actions, id];
  return lien(c.sp, { act: n.length ? n : ["_"] });
};
const MODE_EMPLOI: Record<Vue, string> = {
  notoriete: "Plus un point est à droite, plus il a été vu ; plus il est haut, plus mille affichages ont coûté cher.",
  trafic: "Plus un point est à droite, plus il a reçu de clics ; plus il est haut, plus on a cliqué souvent en le voyant ; sa taille dit ce qu'il a coûté.",
  conversion: "Plus un point est à droite, plus il a coûté ; plus il est haut, plus il a converti ; sa taille dit ses clics.",
};
const MODE_ETENDUE = "Plus un mot-clé est à droite, plus il attrape de recherches différentes ; plus il est haut, plus ses clics viennent de gens qui ont tapé le mot-clé lui-même. Une variante proche (pluriel, faute) compte comme une autre recherche.";
function constat(c: Ctx, ns: Noeud[], unite: string) {
  const a = AXES[c.vue];
  const parX = [...ns].sort((p, q) => (a.x.v(q.c, c.part) ?? 0) - (a.x.v(p.c, c.part) ?? 0))[0];
  const parY = [...ns].sort((p, q) => (a.y.v(q.c, c.part) ?? 0) - (a.y.v(p.c, c.part) ?? 0))[0];
  if (!parX || !parY) return "";
  return `${ns.length} ${unite}. Le plus à droite est « ${parX.nom} » (${a.x.fmt(a.x.v(parX.c, c.part) ?? 0)} ${a.x.nom.toLowerCase()}), le plus haut « ${parY.nom} » (${a.y.fmt(a.y.v(parY.c, c.part) ?? 0)} ${a.y.nom === "CTR" || a.y.nom === "CPM" ? a.y.nom : a.y.nom.toLowerCase()}).`;
}

// ── A · Pas à pas ────────────────────────────────────────────────────────────
// Contrôles au-dessus du nuage, dans l'ordre où on les règle ; couleurs : les
// 8 campagnes qui ont le plus coûté ont leur teinte, les autres sont grises sous
// « Autres campagnes ». La légende met une campagne en avant (`hl`). Phrase =
// mode d'emploi au-dessus du nuage. Actions : une rangée de pastilles.

function VarianteA({ c }: { c: Ctx }) {
  const hl = un(c.sp.hl);
  const rang = (id: string) => RANG_COUT.indexOf(id);
  const teinte = (camp: string) => (rang(camp) < 8 ? PALETTE[rang(camp)] : GRIS);
  const couleur = (camp: string) => (hl && hl !== camp ? "#e8e6e0" : teinte(camp));
  const ns = noeudsDuNiveau(c.niv);
  const mcs = MOTS_CLES.filter((k) => !hl || k.campagne === hl);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-3">
        <span className="text-[12.5px] text-muted">Comparer les</span>
        <div className="flex flex-wrap gap-1 rounded-full bg-canvas p-1 text-[12.5px]">
          {NIVEAUX.map((x) => (
            <Link key={x.cle} href={lien(c.sp, { niv: x.cle === "campagnes" ? undefined : x.cle, onglet: undefined })} scroll={false}
              className={`rounded-full px-3 py-1 ${c.niv === x.cle && c.onglet === "performance" ? "bg-white font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{x.nom}</Link>
          ))}
        </div>
        <span className="text-line">|</span>
        <Link href={lien(c.sp, { onglet: c.onglet === "etendue" ? undefined : "etendue" })} scroll={false} className={`rounded-full px-3 py-1 text-[12.5px] ${c.onglet === "etendue" ? "bg-ink text-white" : "border border-line text-ink hover:border-ink/30"}`}>Étendue des mots-clés</Link>
      </div>
      {c.vue === "conversion" && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="text-muted">Actions comptées :</span>
          {ACTIONS.map((a) => {
            const on = c.actions.includes(a.id);
            return <Link key={a.id} href={basculerAction(c, a.id)} scroll={false} title={a.principale ? "Action principale" : `Non principale, mais comptée par ${a.compteePar} campagnes sur 12`}
              className={`rounded-full border px-3 py-1 ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-muted"}`}>{on ? "✓ " : ""}{a.nom}{!a.principale && <span className={on ? "text-white/60" : ""}> · {a.compteePar} campagnes</span>}</Link>;
          })}
        </div>
      )}
      <div className="rounded-2xl border border-line bg-white p-5">
        <p className="text-[13px] text-ink">{c.onglet === "etendue" ? MODE_ETENDUE : MODE_EMPLOI[c.vue]}</p>
        <p className="mt-0.5 text-[12px] text-muted">{c.onglet === "etendue" ? `Un point par mot-clé · ${mcs.filter((k) => k.c).length} mots-clés` : `Un point par ${NIVEAUX.find((x) => x.cle === c.niv)!.un} · ${ns.length} points`}{c.vue === "conversion" && c.onglet === "performance" ? ` · conversions : ${titreActions(c)}` : ""}</p>
        <div className="mt-3">
          {c.vue === "conversion" && c.onglet === "performance" && c.actions.length === 0 ? <SansAction /> :
            c.onglet === "etendue" ? <Nuage fx={AXES_ETENDUE.x.fmt} fy={AXES_ETENDUE.y.fmt} ax={AXES_ETENDUE.x.nom} ay="Part des clics « identique au mot-clé »" ar="Coût" points={pointsEtendue(mcs, (k) => couleur(k.campagne))} /> :
              <Nuage fx={AXES[c.vue].x.fmt} fy={AXES[c.vue].y.fmt} ax={AXES[c.vue].x.nom} ay={AXES[c.vue].y.nom} ar={AXES[c.vue].r?.nom} points={pointsPerf(c, ns, (n) => couleur(n.campagne))} />}
        </div>
        {c.niv === "elements" && c.onglet === "performance" && <NoteElements />}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-line pt-3 text-[12px]">
          {RANG_COUT.slice(0, 8).map((id) => (
            <Link key={id} href={lien(c.sp, { hl: hl === id ? undefined : id })} scroll={false} className={`flex items-center gap-1.5 ${hl && hl !== id ? "text-muted" : "text-ink"}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: teinte(id) }} />{nomCampagne(id)}</Link>
          ))}
          <span className="flex items-center gap-1.5 text-muted" title={RANG_COUT.slice(8).map(nomCampagne).join(", ")}><span className="h-2.5 w-2.5 rounded-full" style={{ background: GRIS }} />Autres campagnes ({RANG_COUT.length - 8})</span>
          {hl && <Link href={lien(c.sp, { hl: undefined })} scroll={false} className="text-brand">toutes</Link>}
        </div>
      </div>
      <h3 className="pt-2 text-[14px] font-semibold text-ink">Mots-clés{hl ? ` · ${nomCampagne(hl)}` : ""}</h3>
      <TableMotsCles c={c} mcs={mcs} />
      <h3 className="pt-2 text-[14px] font-semibold text-ink">Termes de recherche</h3>
      <TableTermes c={c} campagnes={hl ? [hl] : undefined} />
      <h3 className="pt-2 text-[14px] font-semibold text-ink">Catégories de termes</h3>
      <Categories c={c} forme="table" />
    </div>
  );
}

// ── B · Plonger dans le nuage ────────────────────────────────────────────────
// On descend en cliquant un point : une campagne ouvre ses groupes, un groupe
// ses annonces, une annonce ses éléments ; un fil d'Ariane remonte. Couleurs :
// tout est gris sauf ce qu'on survole/choisit — la règle tient à 12 comme à 50
// campagnes ; les plus gros points portent leur nom écrit. Phrase = constat
// sous le nuage. Actions : une colonne à gauche, toujours visible en vue
// Conversion.

function VarianteB({ c }: { c: Ctx }) {
  const dans = un(c.sp.dans);
  const lieu = dans ? parId(dans) : undefined;
  const nivEnfant: Niveau = !lieu ? c.niv : (NIVEAUX[Math.min(3, NIVEAUX.findIndex((x) => x.cle === lieu.niveau) + 1)].cle);
  const ns = lieu ? enfantsDe(lieu.id) : noeudsDuNiveau(c.niv);
  const chaine: Noeud[] = [];
  for (let n = lieu; n; n = n.parent ? parId(n.parent) : undefined) chaine.unshift(n);
  const gros = new Set([...ns].sort((p, q) => q.c.cout - p.c.cout).slice(0, 5).map((n) => n.id));
  const couleur = (n: Noeud) => (lieu ? PALETTE[0] : gros.has(n.id) ? "#0e0f12" : GRIS);
  const peutDescendre = (n: Noeud) => n.niveau !== "elements";
  const camp = lieu?.campagne;
  const mcs = MOTS_CLES.filter((k) => !lieu || (lieu.niveau === "campagnes" ? k.campagne === lieu.id : lieu.niveau === "groupes" ? k.groupe === lieu.id : k.campagne === camp));
  const conversion = c.vue === "conversion";
  return (
    <div className={`grid gap-4 ${conversion ? "lg:grid-cols-[220px_minmax(0,1fr)]" : ""}`}>
      {conversion && (
        <aside className="h-fit rounded-2xl border border-line bg-white p-4 text-[12.5px] lg:sticky lg:top-24">
          <p className="font-medium text-ink">Ce qui compte comme conversion</p>
          <p className="mt-0.5 text-muted">Par défaut, ce que tes campagnes comptent chez Google.</p>
          <ul className="mt-3 space-y-2">
            {ACTIONS.map((a) => {
              const on = c.actions.includes(a.id);
              return (
                <li key={a.id}><Link href={basculerAction(c, a.id)} scroll={false} className="flex items-start gap-2">
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-ink bg-ink text-white" : "border-line"}`}>{on && <Icone nom="coche" className="h-3 w-3" />}</span>
                  <span className="min-w-0"><span className="text-ink">{a.nom}</span><br /><span className="text-[11.5px] text-muted">{a.principale ? "principale" : "non principale"} · comptée par {a.compteePar} campagne{a.compteePar > 1 ? "s" : ""} sur 12</span></span>
                </Link></li>
              );
            })}
          </ul>
        </aside>
      )}
      <div className="min-w-0 space-y-4">
        <Onglets c={c} />
        {c.onglet === "performance" && (
          <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
            {lieu ? <Link href={lien(c.sp, { dans: undefined })} scroll={false} className="text-brand">Toutes les campagnes</Link>
              : <span className="text-ink">Toutes les {NIVEAUX.find((x) => x.cle === c.niv)!.nom.toLowerCase()}</span>}
            {chaine.map((n, i) => (
              <span key={n.id} className="flex items-center gap-1.5"><span className="text-muted">›</span>
                {i === chaine.length - 1 ? <span className="font-medium text-ink">{n.nom}</span> : <Link href={lien(c.sp, { dans: n.id })} scroll={false} className="text-brand">{n.nom}</Link>}</span>
            ))}
            {!lieu && <span className="ml-auto text-[12px] text-muted">Voir directement :{" "}
              {NIVEAUX.map((x) => <Link key={x.cle} href={lien(c.sp, { niv: x.cle === "campagnes" ? undefined : x.cle })} scroll={false} className={`ml-2 ${c.niv === x.cle ? "font-medium text-ink" : "text-brand"}`}>{x.nom.toLowerCase()}</Link>)}</span>}
          </div>
        )}
        <div className="rounded-2xl border border-line bg-white p-5">
          {conversion && c.onglet === "performance" && c.actions.length === 0 ? <SansAction /> :
            c.onglet === "etendue" ? <Nuage fx={AXES_ETENDUE.x.fmt} fy={AXES_ETENDUE.y.fmt} ax={AXES_ETENDUE.x.nom} ay="Part des clics « identique au mot-clé »" ar="Coût" points={pointsEtendue(mcs, () => GRIS, (k) => (k.c?.cout ?? 0) > 300)} /> :
              <Nuage fx={AXES[c.vue].x.fmt} fy={AXES[c.vue].y.fmt} ax={AXES[c.vue].x.nom} ay={AXES[c.vue].y.nom} ar={AXES[c.vue].r?.nom} points={pointsPerf(c, ns, couleur, (n) => (peutDescendre(n) ? lien(c.sp, { dans: n.id }) : undefined), (n) => gros.has(n.id))} />}
          {nivEnfant === "elements" && c.onglet === "performance" && <NoteElements />}
          <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink">
            {c.onglet === "etendue" ? MODE_ETENDUE : constat(c, ns, `${ns.length > 1 ? NIVEAUX.find((x) => x.cle === nivEnfant)!.nom.toLowerCase() : NIVEAUX.find((x) => x.cle === nivEnfant)!.un}`)}
            {c.onglet === "performance" && nivEnfant !== "elements" && <span className="text-muted"> Clique un point pour voir ce qu&apos;il contient.</span>}
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="min-w-0"><h3 className="mb-2 text-[14px] font-semibold text-ink">Mots-clés{lieu ? ` · ${lieu.nom}` : ""}</h3><TableMotsCles c={c} mcs={mcs} compact /></div>
          <div className="min-w-0"><h3 className="mb-2 text-[14px] font-semibold text-ink">Termes de recherche</h3><TableTermes c={c} campagnes={camp ? [camp] : undefined} limite={10} /></div>
        </div>
        <h3 className="pt-2 text-[14px] font-semibold text-ink">Catégories de termes</h3>
        <Categories c={c} forme="cartes" />
      </div>
    </div>
  );
}

// ── C · La liste pilote ──────────────────────────────────────────────────────
// À gauche, la liste du niveau choisi, classée sur l'axe horizontal ; on y
// coche jusqu'à 8 lignes, qui prennent leur couleur dans le nuage — le reste
// reste gris (même geste que la Comparaison Meta). Le niveau se choisit en tête
// de liste. Phrase = le titre du module, un constat. Actions : un menu
// déroulant dans l'en-tête. Mots-clés, termes et catégories en onglets.

function VarianteC({ c }: { c: Ctx }) {
  const a = AXES[c.vue];
  const ns = [...noeudsDuNiveau(c.niv)].sort((p, q) => (a.x.v(q.c, c.part) ?? 0) - (a.x.v(p.c, c.part) ?? 0));
  const demandes = tous(c.sp.voir).filter((id) => ns.some((n) => n.id === id));
  const coches = tous(c.sp.voir).includes("_") ? [] : demandes.length ? demandes.slice(0, 8) : ns.slice(0, 4).map((n) => n.id);
  const couleur = (id: string) => (coches.includes(id) ? PALETTE[coches.indexOf(id)] : GRIS);
  const basculer = (id: string) => {
    const n = coches.includes(id) ? coches.filter((x) => x !== id) : [...coches, id].slice(-8);
    return lien(c.sp, { voir: n.length ? n : ["_"] });
  };
  const liste = un(c.sp.liste) ?? "mc";
  const titre = c.onglet === "etendue" ? "Quels mots-clés attrapent beaucoup de recherches différentes, et lesquels sont tapés tels quels" : constat(c, ns, NIVEAUX.find((x) => x.cle === c.niv)!.nom.toLowerCase());
  const campCoches = c.niv === "campagnes" ? coches : [...new Set(coches.map((id) => parId(id)!.campagne))];
  const mcs = MOTS_CLES.filter((k) => !campCoches.length || campCoches.includes(k.campagne));
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-3xl text-[15px] font-medium leading-snug text-ink">{titre}</p>
          {c.vue === "conversion" && (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-full border border-line px-3 py-1.5 text-[12.5px] text-ink hover:border-ink/30">Conversions : {c.actions.length} action{c.actions.length > 1 ? "s" : ""} sur {ACTIONS.length} <Icone nom="chevron" className="inline h-3.5 w-3.5" /></summary>
              <div className="absolute right-0 z-10 mt-1 w-72 rounded-xl border border-line bg-white p-3 shadow-xl">
                {ACTIONS.map((x) => {
                  const on = c.actions.includes(x.id);
                  return <Link key={x.id} href={basculerAction(c, x.id)} scroll={false} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-canvas">
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-ink bg-ink text-white" : "border-line"}`}>{on && <Icone nom="coche" className="h-3 w-3" />}</span>
                    <span><span className="text-ink">{x.nom}</span><br /><span className="text-[11.5px] text-muted">{x.principale ? "principale" : "non principale"} · {x.compteePar}/12 campagnes la comptent</span></span></Link>;
                })}
              </div>
            </details>
          )}
        </div>
        <p className="mt-1 text-[12.5px] text-muted">{c.onglet === "etendue" ? MODE_ETENDUE : MODE_EMPLOI[c.vue]}{c.vue === "conversion" && c.onglet === "performance" ? ` Conversions : ${titreActions(c)}.` : ""}</p>
        <div className="mt-3"><Onglets c={c} /></div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
          {c.onglet === "performance" ? (
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-1 text-[11.5px]"><span className="mr-1 text-[12.5px] text-muted">Voir les</span>{NIVEAUX.map((x) => <Link key={x.cle} href={lien(c.sp, { niv: x.cle === "campagnes" ? undefined : x.cle, voir: undefined })} scroll={false} className={`rounded px-2 py-0.5 ${c.niv === x.cle ? "bg-ink text-white" : "bg-canvas text-muted"}`}>{x.nom}</Link>)}</div>
              <ol className="max-h-[340px] overflow-y-auto rounded-xl border border-line">
                {ns.map((n, i) => {
                  const on = coches.includes(n.id);
                  return (
                    <li key={n.id}><Link href={basculer(n.id)} scroll={false} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] hover:bg-canvas">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border text-white" style={on ? { background: couleur(n.id), borderColor: couleur(n.id) } : { borderColor: "#e4e2dc" }}>{on && <Icone nom="coche" className="h-3 w-3" />}</span>
                      <span className="w-5 text-right tabular-nums text-muted">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-ink">{n.nom}{n.niveau !== "campagnes" && <span className="text-muted"> · {nomCampagne(n.campagne)}</span>}</span>
                      <span className="tabular-nums text-ink">{a.x.fmt(a.x.v(n.c, c.part) ?? 0)}</span>
                    </Link></li>
                  );
                })}
              </ol>
              <p className="mt-1.5 text-[11.5px] text-muted">Coche jusqu&apos;à 8 lignes pour les colorer ; les autres restent en gris.</p>
            </div>
          ) : (
            <div className="min-w-0 text-[12.5px] text-muted">Un point par mot-clé, coloré par campagne si sa campagne est cochée.</div>
          )}
          <div className="min-w-0">
            {c.vue === "conversion" && c.onglet === "performance" && c.actions.length === 0 ? <SansAction /> :
              c.onglet === "etendue" ? <Nuage fx={AXES_ETENDUE.x.fmt} fy={AXES_ETENDUE.y.fmt} ax={AXES_ETENDUE.x.nom} ay="Part des clics « identique au mot-clé »" ar="Coût" points={pointsEtendue(MOTS_CLES, (k) => (campCoches.includes(k.campagne) ? PALETTE[campCoches.indexOf(k.campagne)] ?? GRIS : GRIS))} /> :
                <Nuage fx={a.x.fmt} fy={a.y.fmt} ax={a.x.nom} ay={a.y.nom} ar={a.r?.nom} hauteur={360} points={pointsPerf(c, ns, (n) => couleur(n.id), undefined, (n) => coches.includes(n.id))} />}
            {c.niv === "elements" && c.onglet === "performance" && <NoteElements />}
          </div>
        </div>
      </div>
      <div className="flex gap-4 border-b border-line text-[13px]">
        {([["mc", "Mots-clés"], ["termes", "Termes de recherche"], ["cat", "Catégories de termes"]] as const).map(([k, nom]) => (
          <Link key={k} href={lien(c.sp, { liste: k === "mc" ? undefined : k })} scroll={false} className={`-mb-px border-b-2 pb-2 ${liste === k ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}>{nom}</Link>
        ))}
        <span className="ml-auto self-center text-[12px] text-muted">{campCoches.length ? `limité aux campagnes cochées (${campCoches.length})` : "toutes les campagnes"}</span>
      </div>
      {liste === "termes" ? <TableTermes c={c} campagnes={campCoches.length ? campCoches : undefined} limite={20} /> : liste === "cat" ? <Categories c={c} forme="table" /> : <TableMotsCles c={c} mcs={mcs} />}
    </div>
  );
}

