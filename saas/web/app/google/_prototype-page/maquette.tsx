// PROTOTYPE JETABLE — ticket « La page Google en maquette »
// (.scratch/google-ads/issues/11-la-page-google-en-maquette.md). Ne part
// jamais sur `main` : il vit sur la branche `prototype/google-page`.
//
// Une seule page, celle que les tickets 04 à 09 ont tranchée : Bandeau avec le
// filtre Type de campagne, Sélecteur (Notoriété / Trafic / Conversion) et ses
// moustaches, Tendance, Comparaison esquissée, Tableau dépliant. Chiffres
// FICTIFS, calqués sur le compte A des tickets 03 et 10 (Search + PMax).
//
// Deux réglages dans la barre du bas, et rien d'autre (leçon du ticket 08 :
// montrer la page, pas un catalogue) :
//   ?moustache=oui|non   la question du ticket : lisible ou bruit ?
//   ?types=2|4           2 = le compte réel ; 4 = + Display et Autres types,
//                        pour éprouver une moustache à quatre segments.
// L'état de la page vit dans l'URL : vue, type, deplie.
import Link from "next/link";
import { Icone, type NomIcone } from "@/components/meta/elements";

type SP = Record<string, string | string[] | undefined>;
const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Un lien n'énumère que ce qu'il CHANGE (`CLAUDE.md` §8). */
function lien(sp: SP, patch: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const x = un(v);
    if (x !== undefined && !(k in patch)) q.set(k, x);
  }
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) q.set(k, v);
  return `/google?${q.toString()}`;
}

// ── LES DONNÉES FICTIVES ─────────────────────────────────────────────────────

type Type = "search" | "pmax" | "display" | "autres";
const TYPES: Record<Type, { nom: string; couleur: string }> = {
  search: { nom: "Search", couleur: "#1a56ff" },
  pmax: { nom: "PMax", couleur: "#1a7a4a" },
  display: { nom: "Display", couleur: "#e08b1a" },
  autres: { nom: "Autres types", couleur: "#8a8f98" },
};

type Totaux = { impressions: number; clics: number; cout: number; conversions: number; valeur: number };
// 28 jours, ≈ 31 % des 90 jours du compte A (ticket 10). Display et Autres
// types n'existent qu'avec ?types=4 : sur le compte réel, rien n'a diffusé.
const PERIODE: Record<Type, Totaux> = {
  search: { impressions: 44_700, clics: 5_090, cout: 5_040, conversions: 1_368, valeur: 4_010 },
  pmax: { impressions: 113_700, clics: 7_180, cout: 2_285, conversions: 120, valeur: 1_700 },
  display: { impressions: 61_000, clics: 410, cout: 690, conversions: 3, valeur: 3 },
  autres: { impressions: 98_000, clics: 1_250, cout: 940, conversions: 6, valeur: 6 },
};
const AVANT: Record<Type, number> = { search: 0.91, pmax: 1.12, display: 0.8, autres: 1.3 };

type Ligne = { nom: string; type: Type; vrai: string; part: number; enfants?: Ligne[]; niveau?: string };
const grp = (nom: string, part: number, annonces: [string, number][]): Ligne => ({
  nom, type: "search", vrai: "", part, niveau: "Groupe d'annonces",
  enfants: annonces.map(([n, p]) => ({ nom: n, type: "search", vrai: "", part: p, niveau: "Annonce" })),
});
const CAMPAGNES: Ligne[] = [
  { nom: "Search — Marque", type: "search", vrai: "Search", part: 0.34, enfants: [grp("Marque exacte", 0.7, [["Annonce responsive 1", 0.6], ["Annonce responsive 2", 0.4]]), grp("Marque + produit", 0.3, [["Annonce responsive 1", 1]])] },
  { nom: "Search — Produits", type: "search", vrai: "Search", part: 0.27, enfants: [grp("Gamme A", 0.55, [["Annonce responsive 1", 0.5], ["Annonce responsive 2", 0.5]]), grp("Gamme B", 0.45, [["Annonce responsive 1", 1]])] },
  { nom: "Search — Générique FR", type: "search", vrai: "Search", part: 0.18, enfants: [grp("Générique", 1, [["Annonce responsive 1", 1]])] },
  { nom: "Search — Générique DE", type: "search", vrai: "Search", part: 0.12, enfants: [grp("Generisch", 1, [["Annonce responsive 1", 1]])] },
  { nom: "Search — Concurrents", type: "search", vrai: "Search", part: 0.09, enfants: [grp("Concurrents", 1, [["Annonce responsive 1", 1]])] },
  { nom: "PMax — Catalogue", type: "pmax", vrai: "Performance Max", part: 0.58, enfants: [{ nom: "Tous les produits", type: "pmax", vrai: "", part: 0.7, niveau: "Groupe d'éléments" }, { nom: "Nouveautés", type: "pmax", vrai: "", part: 0.3, niveau: "Groupe d'éléments" }] },
  { nom: "PMax — Leads", type: "pmax", vrai: "Performance Max", part: 0.31, enfants: [{ nom: "Formulaire", type: "pmax", vrai: "", part: 1, niveau: "Groupe d'éléments" }] },
  { nom: "PMax — Saison", type: "pmax", vrai: "Performance Max", part: 0.11, enfants: [{ nom: "Automne", type: "pmax", vrai: "", part: 1, niveau: "Groupe d'éléments" }] },
  { nom: "Display — Remarketing", type: "display", vrai: "Display", part: 1, enfants: [{ nom: "Visiteurs 30 j", type: "display", vrai: "", part: 1, niveau: "Groupe d'annonces", enfants: [{ nom: "Annonce display responsive", type: "display", vrai: "", part: 1, niveau: "Annonce" }] }] },
  { nom: "Demand Gen — Découverte", type: "autres", vrai: "Demand Gen", part: 1, enfants: [{ nom: "Audiences similaires", type: "autres", vrai: "", part: 1, niveau: "Groupe d'annonces" }] },
];

const JOURS = 28;
const FIN = new Date("2026-11-09T00:00:00Z");
const dateDu = (i: number) => new Date(FIN.getTime() - (JOURS - 1 - i) * 86400_000);
const jourCourt = (d: Date) => d.toLocaleDateString("fr-CH", { day: "numeric", month: "short", timeZone: "UTC" });

function bruit(i: number, graine: number) {
  const x = Math.sin(i * 12.9898 + graine * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
/** Répartit un total sur 28 jours : creux le week-end, un peu de bruit. */
function serie(total: number, graine: number): number[] {
  const poids = Array.from({ length: JOURS }, (_, i) => {
    const wd = dateDu(i).getUTCDay();
    return (wd === 0 || wd === 6 ? 0.72 : 1.08) * (0.8 + 0.4 * bruit(i, graine));
  });
  const s = poids.reduce((a, b) => a + b, 0);
  return poids.map((p) => (total * p) / s);
}
const CHAMPS: (keyof Totaux)[] = ["impressions", "clics", "cout", "conversions", "valeur"];
const SERIES: Record<Type, Record<keyof Totaux, { maintenant: number[]; avant: number[] }>> = Object.fromEntries(
  (Object.keys(PERIODE) as Type[]).map((t, ti) => [
    t,
    Object.fromEntries(CHAMPS.map((c, ci) => [c, {
      maintenant: serie(PERIODE[t][c], ti * 10 + ci),
      avant: serie(PERIODE[t][c] / AVANT[t], ti * 10 + ci + 50),
    }])),
  ]),
) as never;

// ── LES MÉTRIQUES ET LES VUES (ADR 0011, tickets 04 et 05) ───────────────────

type Cle = "impressions" | "cpm" | "clics" | "ctr" | "cpc" | "conversions" | "cpa" | "taux" | "valeur" | "roas";
const METRIQUES: Record<Cle, { nom: string; additif: boolean; baisseBonne?: boolean; calc: (t: Totaux) => number | null; fmt: (v: number) => string }> = {
  impressions: { nom: "Impressions", additif: true, calc: (t) => t.impressions, fmt: (v) => entier(v) },
  cpm: { nom: "CPM", additif: false, baisseBonne: true, calc: (t) => (t.impressions ? (t.cout / t.impressions) * 1000 : null), fmt: (v) => chf(v) },
  clics: { nom: "Clics", additif: true, calc: (t) => t.clics, fmt: (v) => entier(v) },
  ctr: { nom: "CTR", additif: false, calc: (t) => (t.impressions ? t.clics / t.impressions : null), fmt: (v) => pct(v) },
  cpc: { nom: "CPC", additif: false, baisseBonne: true, calc: (t) => (t.clics ? t.cout / t.clics : null), fmt: (v) => chf(v) },
  conversions: { nom: "Conversions", additif: true, calc: (t) => t.conversions, fmt: (v) => entier(v) },
  cpa: { nom: "Coût par conversion", additif: false, baisseBonne: true, calc: (t) => (t.conversions ? t.cout / t.conversions : null), fmt: (v) => chf(v) },
  taux: { nom: "Taux de conversion", additif: false, calc: (t) => (t.clics ? t.conversions / t.clics : null), fmt: (v) => pct(v) },
  valeur: { nom: "Valeur de conversion", additif: true, calc: (t) => t.valeur, fmt: (v) => chf(v) },
  roas: { nom: "ROAS", additif: false, calc: (t) => (t.cout ? t.valeur / t.cout : null), fmt: (v) => `${v.toFixed(2).replace(".", ",")} ×` },
};
type Vue = "notoriete" | "trafic" | "conversion";
const VUES: Record<Vue, { titre: string; question: string; icone: NomIcone; tendance: Cle[]; tableau: Cle[] }> = {
  notoriete: { titre: "Notoriété", question: "Combien de fois on t'a vu, et à quel prix", icone: "oeil", tendance: ["impressions", "cpm"], tableau: ["impressions", "cpm"] },
  trafic: { titre: "Trafic", question: "Combien de clics tes annonces ont reçus", icone: "clic", tendance: ["clics", "ctr", "cpc"], tableau: ["clics", "ctr", "cpc"] },
  conversion: { titre: "Conversion", question: "Ce que tes campagnes rapportent en actions", icone: "cible", tendance: ["conversions", "cpa", "roas"], tableau: ["conversions", "cpa", "taux", "valeur", "roas"] },
};

const entier = (v: number) => Math.round(v).toLocaleString("fr-CH");
const chf = (v: number) => `${v.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF`;
const pct = (v: number) => `${(v * 100).toLocaleString("fr-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

const vide = (): Totaux => ({ impressions: 0, clics: 0, cout: 0, conversions: 0, valeur: 0 });
function somme(types: Type[], f: (t: Type) => Totaux): Totaux {
  const r = vide();
  for (const t of types) for (const c of CHAMPS) r[c] += f(t)[c];
  return r;
}
const avantDe = (t: Type): Totaux => Object.fromEntries(CHAMPS.map((c) => [c, PERIODE[t][c] / AVANT[t]])) as Totaux;
const ecart = (m: Cle, a: Totaux, b: Totaux) => {
  const x = METRIQUES[m].calc(a), y = METRIQUES[m].calc(b);
  return x === null || y === null || y === 0 ? null : x / y - 1;
};

// ── LA PAGE ──────────────────────────────────────────────────────────────────

export function PrototypePage({ sp }: { sp: SP }) {
  const quatre = un(sp.types) === "4";
  const moustache = un(sp.moustache) !== "non";
  const presents: Type[] = quatre ? ["search", "pmax", "display", "autres"] : ["search", "pmax"];
  const typeBrut = un(sp.type) as Type | undefined;
  const type = typeBrut && presents.includes(typeBrut) ? typeBrut : null;
  const vueBrute = un(sp.vue) as Vue | undefined;
  const vue: Vue = vueBrute && vueBrute in VUES ? vueBrute : "trafic";
  const actifs = type ? [type] : presents;
  // La moustache n'a de sens qu'à deux types ou plus (ticket 04, supposé).
  const avecMoustache = moustache && actifs.length > 1;
  const L = { sp, presents, type, vue, actifs, avecMoustache };

  return (
    <main className="px-4 pb-28 sm:px-6 lg:px-8">
      <Bandeau L={L} />
      <div className="mt-6 space-y-12">
        <Selecteur L={L} />
        <Tendance L={L} />
        <Comparaison L={L} />
        <Tableau L={L} />
      </div>
      <BarreMaquette sp={sp} moustache={moustache} quatre={quatre} />
    </main>
  );
}
type Lecture = { sp: SP; presents: Type[]; type: Type | null; vue: Vue; actifs: Type[]; avecMoustache: boolean };

// ── MODULE 1 · LE BANDEAU DE COMMANDES ───────────────────────────────────────

function Bandeau({ L }: { L: Lecture }) {
  const nomType = L.type ? TYPES[L.type].nom : "Tous les types";
  return (
    <header className="sticky top-0 z-20 -mx-4 bg-canvas/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-2 flex items-center gap-2 text-[22px] font-semibold text-ink">
          <span style={{ color: "#1a7a4a" }}>◆</span> Google Ads.
        </h1>
        <span className="rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-ink">
          <Icone nom="calendrier" className="mr-1.5 inline h-3.5 w-3.5" />28 derniers jours · {jourCourt(dateDu(0))} – {jourCourt(dateDu(JOURS - 1))}
        </span>
        {/* LE FILTRE DU TICKET 04 : choix unique, « Tous les types » par
            défaut, seulement les types qui ont diffusé sur la période. */}
        <details className="relative">
          <summary className={`flex cursor-pointer list-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] ${L.type ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}>
            <Icone nom="calques" className="h-3.5 w-3.5" />
            <span className={L.type ? "text-white/70" : "text-muted"}>Type de campagne :</span> {nomType}
            <Icone nom="chevron" className="h-3.5 w-3.5" />
          </summary>
          <div className="absolute left-0 z-30 mt-1 w-60 rounded-xl border border-line bg-white p-1 shadow-lg">
            {[null, ...L.presents].map((t) => (
              <Link key={t ?? "tous"} href={lien(L.sp, { type: t ?? undefined, deplie: undefined })} scroll={false}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-[13px] hover:bg-canvas ${t === L.type ? "font-semibold text-ink" : "text-ink/80"}`}>
                <span className="flex items-center gap-2">
                  {t && <span className="h-2 w-2 rounded-full" style={{ background: TYPES[t].couleur }} />}
                  {t ? TYPES[t].nom : "Tous les types"}
                </span>
                {t === L.type && <Icone nom="coche" className="h-3.5 w-3.5" />}
              </Link>
            ))}
            {L.presents.includes("autres") && (
              <p className="px-3 pb-2 pt-1 text-[11.5px] text-muted">Autres types : Demand Gen, Shopping, App… — leur vrai type est au Tableau.</p>
            )}
          </div>
        </details>
        <span className="rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-ink">
          <span className="text-muted">Campagne :</span> {L.type ? `toutes les ${TYPES[L.type].nom}` : "toutes"} <Icone nom="chevron" className="inline h-3.5 w-3.5" />
        </span>
        <span className="ml-auto text-[12px] text-muted">Lu chez Google le 10 nov. à 07:04 · jour en cours exclu</span>
      </div>
    </header>
  );
}

// ── LA MOUSTACHE (ticket 04) ─────────────────────────────────────────────────
// Ce qui s'additionne : une barre fine en parts. Un taux : la valeur de chaque
// type côte à côte — un taux ne se découpe pas en parts.

function Moustache({ m, L, sombre = false }: { m: Cle; L: Lecture; sombre?: boolean }) {
  const def = METRIQUES[m];
  const sourd = sombre ? "text-white/60" : "text-muted";
  if (def.additif) {
    const vals = L.actifs.map((t) => ({ t, v: def.calc(PERIODE[t]) ?? 0 }));
    const tot = vals.reduce((a, b) => a + b.v, 0) || 1;
    return (
      <div className="mt-3">
        <div className={`flex h-1.5 overflow-hidden rounded-full ${sombre ? "bg-white/10" : "bg-canvas"}`}>
          {vals.map(({ t, v }) => <span key={t} style={{ width: `${(v / tot) * 100}%`, background: TYPES[t].couleur }} />)}
        </div>
        <p className={`mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] tabular-nums ${sourd}`}>
          {vals.map(({ t, v }) => (
            <span key={t} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: TYPES[t].couleur }} />{TYPES[t].nom} {Math.round((v / tot) * 100)} %</span>
          ))}
        </p>
      </div>
    );
  }
  return (
    <p className={`mt-3 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] tabular-nums ${sourd}`}>
      {L.actifs.map((t) => {
        const v = def.calc(PERIODE[t]);
        return (
          <span key={t} className="flex items-center gap-1" title={v === null ? "Pas de dénominateur sur la période" : undefined}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: TYPES[t].couleur }} />{TYPES[t].nom} {v === null ? "—" : def.fmt(v)}
          </span>
        );
      })}
    </p>
  );
}

function Ecart({ m, e, sombre = false }: { m: Cle; e: number | null; sombre?: boolean }) {
  if (e === null) return <span className={`text-[12px] ${sombre ? "text-white/60" : "text-muted"}`}>—</span>;
  const bon = METRIQUES[m].baisseBonne ? e < 0 : e > 0;
  const texte = `${e >= 0 ? "+" : "−"}${Math.abs(e * 100).toFixed(1).replace(".", ",")} %`;
  if (sombre) return <span className={`text-[12.5px] font-semibold tabular-nums ${bon ? "text-[#7ee2a8]" : "text-[#ff9d8f]"}`}>{texte}</span>;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums ${bon ? "bg-[#e6f3ec] text-pos" : "bg-[#fbe9e7] text-neg"}`}>{texte}</span>;
}

// ── MODULE 2 · LE SÉLECTEUR DE VUE ───────────────────────────────────────────

function Selecteur({ L }: { L: Lecture }) {
  const maintenant = somme(L.actifs, (t) => PERIODE[t]);
  const avant = somme(L.actifs, avantDe);
  return (
    <section>
      <p className="mb-3 text-[13px] text-muted">
        Choisis ce que tu regardes : la vue change toute la page{L.type ? `, resserrée sur ${TYPES[L.type].nom}` : ", tous types de campagne confondus"}.
      </p>
      <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(VUES) as Vue[]).map((v) => {
          const actif = v === L.vue;
          const m = VUES[v].tendance[0];
          return (
            <Link key={v} href={lien(L.sp, { vue: v })} scroll={false}
              className={`group min-w-0 rounded-2xl p-5 transition-all ${actif ? "bg-ink text-white shadow-[0_18px_40px_-12px_rgba(14,15,18,0.45)]" : "border border-line bg-white hover:-translate-y-0.5 hover:border-ink/20"}`}>
              <div className="flex items-center justify-between">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${actif ? "bg-white/10" : "bg-canvas"}`}><Icone nom={VUES[v].icone} className="h-[18px] w-[18px]" /></span>
                <span className={`text-[12.5px] font-medium ${actif ? "text-white/70" : "text-brand"}`}>{actif ? "Vue active" : "Voir cette vue →"}</span>
              </div>
              <p className="mt-4 text-[17px] font-semibold">{VUES[v].titre}</p>
              <p className={`mt-0.5 text-[13px] ${actif ? "text-white/65" : "text-muted"}`}>{VUES[v].question}</p>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
                <span className="text-[28px] font-semibold leading-none tabular-nums">{METRIQUES[m].fmt(METRIQUES[m].calc(maintenant) ?? 0)}</span>
                <span className={`text-[12.5px] ${actif ? "text-white/60" : "text-muted"}`}>{METRIQUES[m].nom.toLowerCase()}</span>
                <span className="ml-auto"><Ecart m={m} e={ecart(m, maintenant, avant)} sombre={actif} /></span>
              </div>
              {L.avecMoustache && <Moustache m={m} L={L} sombre={actif} />}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

// ── MODULE 3 · LA TENDANCE ───────────────────────────────────────────────────

function serieDe(m: Cle, types: Type[], quand: "maintenant" | "avant"): (number | null)[] {
  return Array.from({ length: JOURS }, (_, i) => {
    const t = vide();
    for (const ty of types) for (const c of CHAMPS) t[c] += SERIES[ty][c][quand][i];
    return METRIQUES[m].calc(t);
  });
}

function Courbe({ m, L, grand }: { m: Cle; L: Lecture; grand: boolean }) {
  const W = grand ? 760 : 360, H = grand ? 190 : 96;
  const a = serieDe(m, L.actifs, "maintenant"), b = serieDe(m, L.actifs, "avant");
  const tout = [...a, ...b].filter((x): x is number => x !== null);
  const max = Math.max(...tout) * 1.08, min = Math.min(0, ...tout);
  const pts = (s: (number | null)[]) => s.map((v, i) => `${(i / (JOURS - 1)) * W},${H - (((v ?? 0) - min) / (max - min)) * H}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="mt-3 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts(b)} fill="none" stroke="#b9bcc4" strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <polyline points={pts(a)} fill="none" stroke={L.type ? TYPES[L.type].couleur : "#0e0f12"} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {grand && [0, 7, 14, 21, 27].map((i) => (
        <text key={i} x={(i / (JOURS - 1)) * W} y={H + 14} fontSize={11} fill="#8a8f98" textAnchor={i === 0 ? "start" : i === 27 ? "end" : "middle"}>{jourCourt(dateDu(i))}</text>
      ))}
    </svg>
  );
}

function Tendance({ L }: { L: Lecture }) {
  const [principale, ...autres] = VUES[L.vue].tendance;
  const maintenant = somme(L.actifs, (t) => PERIODE[t]);
  const avant = somme(L.actifs, avantDe);
  const carte = (m: Cle, grand: boolean) => (
    <div key={m} className={`min-w-0 rounded-2xl border border-line bg-white p-5 ${grand ? "lg:col-span-2 lg:row-span-2" : ""}`}>
      <p className="text-[13px] font-medium text-muted">{METRIQUES[m].nom}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
        <span className={`${grand ? "text-[34px]" : "text-[22px]"} font-semibold leading-tight tabular-nums text-ink`}>{METRIQUES[m].fmt(METRIQUES[m].calc(maintenant) ?? 0)}</span>
        <span className="text-[12.5px] text-muted tabular-nums">avant : {METRIQUES[m].fmt(METRIQUES[m].calc(avant) ?? 0)}</span>
        <Ecart m={m} e={ecart(m, maintenant, avant)} />
      </div>
      {L.avecMoustache && <Moustache m={m} L={L} />}
      <Courbe m={m} L={L} grand={grand} />
    </div>
  );
  return (
    <section>
      <Titre titre="Tendance" sous={`Le total ${L.type ? `des campagnes ${TYPES[L.type].nom}` : "de toutes tes campagnes, tous types confondus"}, jour par jour. En pointillé : les 28 jours d'avant.`} />
      <div className="grid gap-3 lg:grid-cols-3">
        {carte(principale, true)}
        {autres.map((m) => carte(m, false))}
      </div>
    </section>
  );
}

// ── MODULE 4 · LA COMPARAISON (esquissée, mécanique de Meta, ticket 08) ──────

/** Sans lui, toutes les campagnes d'un type auraient le même taux : chaque
 *  nom tire son facteur (0,6 à 1,4) sur ce qui suit l'impression. */
const facteur = (nom: string, sel: number) => 0.6 + 0.8 * bruit([...nom].reduce((a, ch) => a + ch.charCodeAt(0), 0), sel);
const totauxLigne = (l: Ligne, parent = 1): Totaux =>
  Object.fromEntries(CHAMPS.map((c, ci) => {
    const base = PERIODE[l.type][c] * l.part * parent;
    return [c, c === "impressions" || c === "cout" ? base : base * facteur(l.nom, ci)];
  })) as Totaux;

function Comparaison({ L }: { L: Lecture }) {
  const m = VUES[L.vue].tendance[0];
  const rangs = CAMPAGNES.filter((c) => L.actifs.includes(c.type))
    .map((c) => ({ c, v: METRIQUES[m].calc(totauxLigne(c)) ?? 0 }))
    .sort((a, b) => b.v - a.v);
  const max = rangs[0]?.v || 1;
  return (
    <section>
      <Titre titre="Comparaison" sous={`Tes campagnes classées sur ${METRIQUES[m].nom.toLowerCase()} — ${L.type ? `seulement ${TYPES[L.type].nom}` : "tous types mêlés"}. Coche-en jusqu'à quatre pour les suivre jour par jour.`}
        droite={<span className="text-[12.5px] text-muted">Niveau : <b className="text-ink">Campagnes</b> · Métrique : <b className="text-ink">{METRIQUES[m].nom}</b></span>} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ol className="rounded-2xl border border-line bg-white p-2">
          {rangs.map(({ c, v }, i) => (
            <li key={c.nom} className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px]">
              <span className={`flex h-4 w-4 items-center justify-center rounded border ${i < 4 ? "border-ink bg-ink text-white" : "border-line"}`}>{i < 4 && <Icone nom="coche" className="h-3 w-3" />}</span>
              <span className="w-5 text-right text-muted tabular-nums">{i + 1}</span>
              <RepereType t={c.type} />
              <span className="min-w-0 flex-1 truncate text-ink">{c.nom}</span>
              <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-canvas sm:block"><span className="block h-full" style={{ width: `${(v / max) * 100}%`, background: TYPES[c.type].couleur }} /></span>
              <span className="w-28 text-right tabular-nums text-ink">{METRIQUES[m].fmt(v)}</span>
            </li>
          ))}
        </ol>
        <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-line bg-white/50 p-6 text-center text-[13px] text-muted">
          Ici, les deux graphes de Meta : les quatre campagnes cochées, jour par jour, sur la métrique 1 et la métrique 2.<br />Esquissé seulement — la maquette pose la question du classement à gauche.
        </div>
      </div>
    </section>
  );
}

// ── MODULE 5 · LE TABLEAU DÉTAILLÉ (ticket 09) ───────────────────────────────

function Tableau({ L }: { L: Lecture }) {
  const cols = VUES[L.vue].tableau;
  const deplie = new Set((un(L.sp.deplie) ?? "").split("~").filter(Boolean));
  const rangees: { l: Ligne; prof: number; t: Totaux; cle: string }[] = [];
  const pousser = (l: Ligne, prof: number, parent: number, cle: string) => {
    const t = totauxLigne(l, parent);
    rangees.push({ l, prof, t, cle });
    if (deplie.has(cle)) l.enfants?.forEach((e, i) => pousser(e, prof + 1, parent * l.part, `${cle}.${i}`));
  };
  CAMPAGNES.forEach((c, i) => L.actifs.includes(c.type) && pousser(c, 0, 1, `${i}`));
  const basculer = (cle: string) => {
    const n = new Set(deplie);
    if (n.has(cle)) n.delete(cle); else n.add(cle);
    return lien(L.sp, { deplie: [...n].join("~") || "_" });
  };
  return (
    <section>
      <Titre titre="Tableau détaillé" sous="Chaque ligne se déplie selon son type : Search et Display jusqu'à l'annonce, PMax jusqu'au groupe d'éléments."
        droite={<span className="rounded-full border border-line bg-white px-3 py-1 text-[12.5px] text-ink">Exporter en CSV</span>} />
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-muted">
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 text-right font-medium">Coût</th>
              {cols.map((c) => <th key={c} className="px-3 py-3 text-right font-medium">{METRIQUES[c].nom}</th>)}
            </tr>
          </thead>
          <tbody>
            {rangees.map(({ l, prof, t, cle }) => {
              const ouvrable = !!l.enfants?.length;
              return (
                <tr key={cle} className={`border-b border-line/60 ${prof ? "bg-canvas/40" : ""}`}>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5" style={{ paddingLeft: prof * 20 }}>
                      {ouvrable ? (
                        <Link href={basculer(cle)} scroll={false} className="flex h-5 w-5 items-center justify-center rounded hover:bg-canvas">
                          <Icone nom="chevron" className={`h-3.5 w-3.5 transition-transform ${deplie.has(cle) ? "" : "-rotate-90"}`} />
                        </Link>
                      ) : <span className="w-5" />}
                      <span className={prof ? "text-ink/85" : "font-medium text-ink"}>{l.nom}</span>
                      {prof > 0 && <span className="text-[11.5px] text-muted">· {l.niveau}</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{prof === 0 && <span className="flex items-center gap-1.5 text-[12px] text-ink/80"><span className="h-2 w-2 rounded-full" style={{ background: TYPES[l.type].couleur }} />{l.vrai}</span>}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{chf(t.cout)}</td>
                  {cols.map((c) => {
                    // PMax n'a pas d'annonce et ne rend pas de valeur par
                    // groupe d'éléments sans valeur déclarée — ici, seul
                    // exemple de « — » avec sa raison au survol (ticket 09).
                    const v = METRIQUES[c].calc(t);
                    return (
                      <td key={c} className="px-3 py-2.5 text-right tabular-nums" title={v === null ? "Pas de dénominateur : aucun clic ou aucune conversion sur la période" : undefined}>
                        {v === null || (c !== "conversions" && t.conversions < 0.5 && (c === "cpa" || c === "roas")) ? <span className="text-muted" title="Aucune conversion sur la période : un coût par conversion ou un ROAS n'existe pas">—</span> : METRIQUES[c].fmt(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── PETITS ÉLÉMENTS ──────────────────────────────────────────────────────────

function RepereType({ t }: { t: Type }) {
  return <span className="shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold text-white" style={{ background: TYPES[t].couleur }}>{TYPES[t].nom}</span>;
}

function Titre({ titre, sous, droite }: { titre: string; sous: string; droite?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold text-ink">{titre}</h2>
        <p className="text-[13px] text-muted">{sous}</p>
      </div>
      {droite}
    </div>
  );
}

function BarreMaquette({ sp, moustache, quatre }: { sp: SP; moustache: boolean; quatre: boolean }) {
  const pastille = (actif: boolean, href: string, texte: string) => (
    <Link href={href} scroll={false} className={`rounded-full px-3 py-1 ${actif ? "bg-white text-ink" : "text-white/70 hover:text-white"}`}>{texte}</Link>
  );
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-full bg-[#2b1a4d] px-4 py-2 text-[12.5px] text-white shadow-2xl">
      <span className="font-semibold">Maquette · chiffres fictifs</span>
      <span className="text-white/50">Moustache</span>
      {pastille(moustache, lien(sp, { moustache: "oui" }), "Avec")}
      {pastille(!moustache, lien(sp, { moustache: "non" }), "Sans")}
      <span className="text-white/50">Types</span>
      {pastille(!quatre, lien(sp, { types: "2", type: undefined }), "2 (le compte réel)")}
      {pastille(quatre, lien(sp, { types: "4" }), "4")}
    </div>
  );
}
