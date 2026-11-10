// PROTOTYPE JETABLE — ticket « La page Google en maquette »
// (.scratch/google-ads/issues/11-la-page-google-en-maquette.md). Ne part
// jamais sur `main` : il vit sur la branche `prototype/google-page`.
//
// Deuxième tour (2026-11-10). Le premier, qui détaillait les types de campagne
// (filtre, moustaches, repères), a été rejeté par David : « on veut pas pour
// l'instant aller dans les détails pour les search pmax ». Celui-ci est la page
// Meta avec les chiffres de Google, rien de propre aux types, et en bas
// l'emplacement de l'analyse des campagnes à venir (ticket 15).
//
// Chiffres FICTIFS, calqués sur le compte A (tickets 03 et 10). L'état vit dans
// l'URL : vue, comparer (répété), deplie.
//
// TROISIÈME TOUR — ticket « Ce qu'on montre pour chaque type de campagne »
// (.scratch/google-ads/issues/15-ce-qu-on-montre-par-type.md). Trois variantes
// de la SEULE Comparaison, qui devient le module des types : `&variant=A|B|C`,
// barre flottante en bas. David : les types se voient d'abord ensemble par
// moustaches, sur ce qui est comparable (les taux), avec l'évolution jour par
// jour ; ensuite on ne compare que des campagnes du même type. Paramètres en
// plus : variant, mt (la métrique du module), type (le type ouvert).
//
// QUATRIÈME TOUR — les trois variantes du troisième (rangées, superposé,
// boîtes d'abord ; commit f0383ae) ont été rejetées. Celui-ci applique le point
// d'analyse .scratch/google-ads/analyses/15-comparer-les-types.md : ni échelle
// commune, ni moustache ; chaque type face à son passé, la répartition entre
// types, puis la Comparaison entre campagnes d'un seul type. `mt` ne sert plus.
import Link from "next/link";
import { Icone, type NomIcone } from "@/components/meta/elements";
import { BarreVariantes } from "./barre-variantes";

type SP = Record<string, string | string[] | undefined>;
const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const tous = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Un lien n'énumère que ce qu'il CHANGE (`CLAUDE.md` §8). */
function lien(sp: SP, patch: Record<string, string | string[] | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (!(k in patch)) tous(v).forEach((x) => q.append(k, x));
  for (const [k, v] of Object.entries(patch)) tous(v).forEach((x) => q.append(k, x));
  return `/google?${q.toString()}`;
}

// ── LES DONNÉES FICTIVES ─────────────────────────────────────────────────────

type Totaux = { impressions: number; clics: number; cout: number; conversions: number; valeur: number };
const CHAMPS: (keyof Totaux)[] = ["impressions", "clics", "cout", "conversions", "valeur"];
type TypeC = "Search" | "PMax" | "Display" | "Vidéo" | "Demand Gen";
type Ligne = { id: string; nom: string; niveau: string; t: Totaux; enfants: Ligne[]; type?: TypeC };

const JOURS = 28;
const FIN = new Date("2026-11-09T00:00:00Z");
const dateDu = (i: number) => new Date(FIN.getTime() - (JOURS - 1 - i) * 86400_000);
const jourCourt = (d: Date) => d.toLocaleDateString("fr-CH", { day: "numeric", month: "short", timeZone: "UTC" });
function bruit(i: number, graine: number) {
  const x = Math.sin(i * 12.9898 + graine * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
const graineDe = (s: string) => [...s].reduce((a, ch) => a + ch.charCodeAt(0), 0);

const t = (impressions: number, clics: number, cout: number, conversions: number, valeur: number): Totaux => ({ impressions, clics, cout, conversions, valeur });
/** Découpe un parent en enfants selon des parts, avec un taux propre à chacun. */
function enfants(id: string, parent: Totaux, niveau: string, noms: [string, number][], petits?: (id: string, t: Totaux) => Ligne[]): Ligne[] {
  return noms.map(([nom, part], i) => {
    const f = 0.75 + 0.5 * bruit(i, graineDe(nom));
    const tt = t(parent.impressions * part, parent.clics * part * f, parent.cout * part, parent.conversions * part * f, parent.valeur * part * f);
    const cid = `${id}.${i}`;
    return { id: cid, nom, niveau, t: tt, enfants: petits ? petits(cid, tt) : [] };
  });
}
const annonces = (id: string, p: Totaux) => enfants(id, p, "Annonce", [["Annonce responsive 1", 0.6], ["Annonce responsive 2", 0.4]]);
const campagne = (type: TypeC, nom: string, tt: Totaux, sous: [string, number][]): Ligne => ({
  id: nom, nom, niveau: "Campagne", t: tt, type,
  enfants: type === "PMax" ? enfants(nom, tt, "Groupe d'éléments", sous) : enfants(nom, tt, "Groupe d'annonces", sous, annonces),
});
// Les 28 jours de A ≈ 31 % de ses 90 jours (ticket 10) : Search ≈ 5 040 CHF,
// PMax ≈ 2 285 CHF — PMax fait beaucoup de clics bon marché. Demand Gen et
// Vidéo sont AJOUTÉS pour la maquette (A a dépensé en Demand Gen sur 36 mois,
// ticket 10) : il faut plus de deux types pour juger le module. Display a
// diffusé dans l'année mais pas sur la période (il garde sa rangée).
const CAMPAGNES: Ligne[] = [
  campagne("Search", "Marque", t(15_200, 2_310, 1_715, 512, 1_480), [["Marque exacte", 0.7], ["Marque + produit", 0.3]]),
  campagne("Search", "Produits", t(12_100, 1_160, 1_360, 371, 1_120), [["Gamme A", 0.55], ["Gamme B", 0.45]]),
  campagne("PMax", "Catalogue", t(65_900, 4_260, 1_325, 70, 990), [["Tous les produits", 0.7], ["Nouveautés", 0.3]]),
  campagne("Demand Gen", "Découverte automne", t(182_000, 1_910, 1_150, 24, 310), [["Lookalike clients", 0.6], ["Centres d'intérêt", 0.4]]),
  campagne("Search", "Générique FR", t(8_000, 880, 905, 246, 720), [["Générique", 1]]),
  campagne("PMax", "Leads", t(35_200, 2_210, 710, 37, 525), [["Formulaire", 1]]),
  campagne("Search", "Générique DE", t(5_400, 470, 605, 140, 410), [["Generisch", 1]]),
  campagne("Vidéo", "Film de marque", t(96_000, 390, 520, 3, 40), [["In-stream", 0.7], ["Bumper", 0.3]]),
  campagne("Search", "Concurrents", t(4_000, 270, 455, 99, 280), [["Concurrents", 1]]),
  campagne("Demand Gen", "Relance Gmail", t(41_000, 520, 310, 9, 95), [["Visiteurs 30 j", 1]]),
  campagne("PMax", "Saison", t(12_600, 710, 250, 13, 185), [["Automne", 1]]),
];
const AVANT = 1 / 1.04; // la période d'avant, un peu plus basse

const vide = (): Totaux => t(0, 0, 0, 0, 0);
const additionner = (ls: Totaux[]) => ls.reduce((a, b) => { CHAMPS.forEach((c) => (a[c] += b[c])); return a; }, vide());
const COMPTE = additionner(CAMPAGNES.map((c) => c.t));

/** Répartit un total de campagne sur 28 jours : creux le week-end, du bruit. */
function serieJours(tt: Totaux, graine: number): Totaux[] {
  // Un bruit commun (le volume du jour) et un bruit propre à chaque compteur :
  // sans le second, tous les taux seraient des droites.
  const parChamp = CHAMPS.map((_, ci) => {
    const poids = Array.from({ length: JOURS }, (_, i) => {
      const wd = dateDu(i).getUTCDay();
      return (wd === 0 || wd === 6 ? 0.72 : 1.08) * (0.75 + 0.5 * bruit(i, graine)) * (0.7 + 0.6 * bruit(i, graine + 31 * (ci + 1)));
    });
    const s = poids.reduce((a, b) => a + b, 0);
    return poids.map((p) => p / s);
  });
  return Array.from({ length: JOURS }, (_, i) => Object.fromEntries(CHAMPS.map((c, ci) => [c, tt[c] * parChamp[ci][i]])) as Totaux);
}
// Un facteur par compteur et par campagne : avec un seul, la période d'avant
// aurait exactement les mêmes taux, et tout écart de taux serait « 0,0 % ».
const avantDe = (c: Ligne) => Object.fromEntries(CHAMPS.map((ch, k) => [ch, c.t[ch] * AVANT * (0.88 + 0.24 * bruit(k, graineDe(c.nom) + 3))])) as Totaux;
const SERIE = new Map(CAMPAGNES.map((c) => [c.id, { maintenant: serieJours(c.t, graineDe(c.nom)), avant: serieJours(avantDe(c), graineDe(c.nom) + 7) }]));
const jourDuCompte = (quand: "maintenant" | "avant") =>
  Array.from({ length: JOURS }, (_, i) => additionner(CAMPAGNES.map((c) => SERIE.get(c.id)![quand][i])));

// ── LES MÉTRIQUES ET LES VUES (comme Meta, ADR 0011) ─────────────────────────

type Cle = "impressions" | "cpm" | "clics" | "ctr" | "cpc" | "conversions" | "cpa" | "taux" | "valeur" | "roas";
const entier = (v: number) => Math.round(v).toLocaleString("fr-CH");
const chf = (v: number) => `${v.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF`;
const pct = (v: number) => `${(v * 100).toLocaleString("fr-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const METRIQUES: Record<Cle, { nom: string; baisseBonne?: boolean; calc: (t: Totaux) => number | null; fmt: (v: number) => string }> = {
  impressions: { nom: "Impressions", calc: (x) => x.impressions, fmt: entier },
  cpm: { nom: "CPM", baisseBonne: true, calc: (x) => (x.impressions ? (x.cout / x.impressions) * 1000 : null), fmt: chf },
  clics: { nom: "Clics", calc: (x) => x.clics, fmt: entier },
  ctr: { nom: "CTR", calc: (x) => (x.impressions ? x.clics / x.impressions : null), fmt: pct },
  cpc: { nom: "CPC", baisseBonne: true, calc: (x) => (x.clics ? x.cout / x.clics : null), fmt: chf },
  conversions: { nom: "Conversions", calc: (x) => x.conversions, fmt: entier },
  cpa: { nom: "Coût par conversion", baisseBonne: true, calc: (x) => (x.conversions >= 0.5 ? x.cout / x.conversions : null), fmt: chf },
  taux: { nom: "Taux de conversion", calc: (x) => (x.clics ? x.conversions / x.clics : null), fmt: pct },
  valeur: { nom: "Valeur de conversion", calc: (x) => x.valeur, fmt: chf },
  roas: { nom: "ROAS", calc: (x) => (x.cout ? x.valeur / x.cout : null), fmt: (v) => `${v.toFixed(2).replace(".", ",")} ×` },
};
type Vue = "notoriete" | "trafic" | "conversion";
const VUES: Record<Vue, { titre: string; question: string; icone: NomIcone; tendance: Cle[]; tableau: Cle[] }> = {
  notoriete: { titre: "Notoriété", question: "Combien de fois on t'a vu, et à quel prix", icone: "oeil", tendance: ["impressions", "cpm"], tableau: ["impressions", "cpm"] },
  trafic: { titre: "Trafic", question: "Combien de clics tes annonces ont reçus", icone: "clic", tendance: ["clics", "ctr", "cpc"], tableau: ["clics", "ctr", "cpc"] },
  conversion: { titre: "Conversion", question: "Ce que tes campagnes rapportent en actions", icone: "cible", tendance: ["conversions", "cpa", "roas"], tableau: ["conversions", "cpa", "taux", "valeur", "roas"] },
};
const ecart = (m: Cle, a: Totaux, b: Totaux) => {
  const x = METRIQUES[m].calc(a), y = METRIQUES[m].calc(b);
  return x === null || y === null || y === 0 ? null : x / y - 1;
};
const valeurDe = (m: Cle, x: Totaux) => {
  const v = METRIQUES[m].calc(x);
  return v === null ? "—" : METRIQUES[m].fmt(v);
};

// ── LA PAGE ──────────────────────────────────────────────────────────────────

type Lecture = { sp: SP; vue: Vue };

export function PrototypePage({ sp }: { sp: SP }) {
  const v = un(sp.vue) as Vue | undefined;
  const L: Lecture = { sp, vue: v && v in VUES ? v : "trafic" };
  return (
    <main className="px-4 pb-16 sm:px-6 lg:px-8">
      <Bandeau />
      <div className="mt-6 space-y-12">
        <Selecteur L={L} />
        <Tendance L={L} />
        <ComparaisonTypes L={L} />
        <Tableau L={L} />
        <AnalyseAVenir />
      </div>
      <BarreVariantes variantes={VARIANTES} />
    </main>
  );
}

// ── MODULE 1 · LE BANDEAU DE COMMANDES ───────────────────────────────────────

function Bandeau() {
  return (
    <header className="sticky top-0 z-20 -mx-4 bg-canvas/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-2 flex items-center gap-2 text-[22px] font-semibold text-ink"><span style={{ color: "#1a7a4a" }}>◆</span> Google Ads.</h1>
        <span className="rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-ink">
          <Icone nom="calendrier" className="mr-1.5 inline h-3.5 w-3.5" />28 derniers jours · {jourCourt(dateDu(0))} – {jourCourt(dateDu(JOURS - 1))}
          <Icone nom="chevron" className="ml-1 inline h-3.5 w-3.5" />
        </span>
        <span className="rounded-full border border-line bg-white px-3 py-1.5 text-[13px] text-ink">
          <span className="text-muted">Campagne :</span> toutes <Icone nom="chevron" className="inline h-3.5 w-3.5" />
        </span>
        <span className="ml-auto text-[12px] text-muted">Lu chez Google le 10 nov. à 07:04 · jour en cours exclu</span>
      </div>
    </header>
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
  const avant = additionner(jourDuCompte("avant"));
  return (
    <section>
      <p className="mb-3 text-[13px] text-muted">Choisis ce que tu regardes : la vue change toute la page, sans écarter aucune campagne.</p>
      <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(VUES) as Vue[]).map((v) => {
          const actif = v === L.vue;
          const m = VUES[v].tendance[0];
          return (
            <Link key={v} href={lien(L.sp, { vue: v, comparer: undefined })} scroll={false}
              className={`group min-w-0 rounded-2xl p-5 transition-all ${actif ? "bg-ink text-white shadow-[0_18px_40px_-12px_rgba(14,15,18,0.45)]" : "border border-line bg-white hover:-translate-y-0.5 hover:border-ink/20"}`}>
              <div className="flex items-center justify-between">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${actif ? "bg-white/10" : "bg-canvas"}`}><Icone nom={VUES[v].icone} className="h-[18px] w-[18px]" /></span>
                <span className={`text-[12.5px] font-medium ${actif ? "text-white/70" : "text-brand"}`}>{actif ? "Vue active" : "Voir cette vue →"}</span>
              </div>
              <p className="mt-4 text-[17px] font-semibold">{VUES[v].titre}</p>
              <p className={`mt-0.5 text-[13px] ${actif ? "text-white/65" : "text-muted"}`}>{VUES[v].question}</p>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
                <span className="text-[28px] font-semibold leading-none tabular-nums">{valeurDe(m, COMPTE)}</span>
                <span className={`text-[12.5px] ${actif ? "text-white/60" : "text-muted"}`}>{METRIQUES[m].nom.toLowerCase()}</span>
                <span className="ml-auto"><Ecart m={m} e={ecart(m, COMPTE, avant)} sombre={actif} /></span>
              </div>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

// ── MODULE 3 · LA TENDANCE ───────────────────────────────────────────────────

function Lignes({ series, W, H, couleurs, pointilles = [], axe = false }: { series: (number | null)[][]; W: number; H: number; couleurs: string[]; pointilles?: number[]; axe?: boolean }) {
  const tout = series.flat().filter((x): x is number => x !== null);
  const max = Math.max(...tout) * 1.08 || 1;
  const pts = (s: (number | null)[]) => s.map((v, i) => `${(i / (JOURS - 1)) * W},${H - ((v ?? 0) / max) * H}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H + (axe ? 18 : 0)}`} className="mt-3 w-full" preserveAspectRatio="none" aria-hidden>
      {series.map((s, k) => (
        <polyline key={k} points={pts(s)} fill="none" stroke={couleurs[k]} strokeWidth={pointilles.includes(k) ? 1.5 : 2} strokeDasharray={pointilles.includes(k) ? "4 4" : undefined} vectorEffect="non-scaling-stroke" />
      ))}
      {axe && [0, 7, 14, 21, 27].map((i) => (
        <text key={i} x={(i / (JOURS - 1)) * W} y={H + 14} fontSize={W / 70} fill="#8a8f98" textAnchor={i === 0 ? "start" : i === 27 ? "end" : "middle"}>{jourCourt(dateDu(i))}</text>
      ))}
    </svg>
  );
}

function Tendance({ L }: { L: Lecture }) {
  const maintenant = jourDuCompte("maintenant"), avantJ = jourDuCompte("avant");
  const totalAvant = additionner(avantJ);
  const [principale, ...autres] = VUES[L.vue].tendance;
  const carte = (m: Cle, grand: boolean) => (
    <div key={m} className={`min-w-0 rounded-2xl border border-line bg-white p-5 ${grand ? "lg:col-span-2 lg:row-span-2" : ""}`}>
      <p className="text-[13px] font-medium text-muted">{METRIQUES[m].nom}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
        <span className={`${grand ? "text-[34px]" : "text-[22px]"} font-semibold leading-tight tabular-nums text-ink`}>{valeurDe(m, COMPTE)}</span>
        <span className="text-[12.5px] tabular-nums text-muted">avant : {valeurDe(m, totalAvant)}</span>
        <Ecart m={m} e={ecart(m, COMPTE, totalAvant)} />
      </div>
      <Lignes W={grand ? 760 : 360} H={grand ? 200 : 96} axe={grand} couleurs={["#b9bcc4", "#0e0f12"]} pointilles={[0]}
        series={[avantJ.map((x) => METRIQUES[m].calc(x)), maintenant.map((x) => METRIQUES[m].calc(x))]} />
    </div>
  );
  return (
    <section>
      <Titre titre="Tendance" sous="Le total de toutes tes campagnes, jour par jour. En pointillé : les 28 jours d'avant." />
      <div className="grid gap-3 lg:grid-cols-3">
        {carte(principale, true)}
        {autres.map((m) => carte(m, false))}
      </div>
    </section>
  );
}

// ── MODULE 4 · LA COMPARAISON (mécanique de Meta) ────────────────────────────

const COULEURS = ["#1a56ff", "#e08b1a", "#7b4fff", "#0d9aa8"];

function Comparaison({ L, campagnes, titre }: { L: Lecture; campagnes: Ligne[]; titre: string }) {
  const [m1, m2] = VUES[L.vue].tendance;
  const rangs = [...campagnes].sort((a, b) => (METRIQUES[m1].calc(b.t) ?? 0) - (METRIQUES[m1].calc(a.t) ?? 0));
  const demandees = tous(L.sp.comparer).filter((id) => campagnes.some((c) => c.id === id));
  const cochees = demandees.length ? demandees.slice(0, 4) : rangs.slice(0, 4).map((c) => c.id);
  const max = (rangs[0] && METRIQUES[m1].calc(rangs[0].t)) || 1;
  const basculer = (id: string) => {
    const n = cochees.includes(id) ? cochees.filter((x) => x !== id) : [...cochees, id].slice(-4);
    return lien(L.sp, { comparer: n.length ? n : ["_"] });
  };
  const graphe = (m: Cle) => (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-5">
      <p className="text-[13px] font-medium text-muted">{METRIQUES[m].nom}, jour par jour</p>
      <Lignes W={420} H={130} axe couleurs={cochees.map((_, k) => COULEURS[k])}
        series={cochees.map((id) => SERIE.get(id)!.maintenant.map((x) => METRIQUES[m].calc(x)))} />
    </div>
  );
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">{titre}</h3>
          <p className="text-[13px] text-muted">Classées sur {METRIQUES[m1].nom.toLowerCase()}. Coche-en jusqu&apos;à quatre pour les suivre jour par jour. La mécanique de Meta, entre campagnes du même type seulement.</p>
        </div>
        <span className="text-[12.5px] text-muted">Niveau : <b className="text-ink">Campagnes</b> · Métriques : <b className="text-ink">{METRIQUES[m1].nom}</b>, <b className="text-ink">{METRIQUES[m2].nom}</b></span>
      </div>
      {campagnes.length === 0 ? <p className="rounded-2xl border border-line bg-white p-5 text-[13px] text-muted">Aucune campagne de ce type n&apos;a diffusé sur la période.</p> : (
      <div className="grid gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <ol className="rounded-2xl border border-line bg-white p-2">
          {rangs.map((c, i) => {
            const k = cochees.indexOf(c.id);
            const v = METRIQUES[m1].calc(c.t) ?? 0;
            return (
              <li key={c.id}>
                <Link href={basculer(c.id)} scroll={false} className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] hover:bg-canvas">
                  <span className="flex h-4 w-4 items-center justify-center rounded border text-white" style={k >= 0 ? { background: COULEURS[k], borderColor: COULEURS[k] } : { borderColor: "#e4e2dc" }}>{k >= 0 && <Icone nom="coche" className="h-3 w-3" />}</span>
                  <span className="w-5 text-right tabular-nums text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{c.nom}</span>
                  <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-canvas sm:block"><span className="block h-full bg-ink/70" style={{ width: `${(v / max) * 100}%` }} /></span>
                  <span className="w-24 text-right tabular-nums text-ink">{METRIQUES[m1].fmt(v)}</span>
                </Link>
              </li>
            );
          })}
        </ol>
        <div className="grid min-w-0 gap-3">{graphe(m1)}{graphe(m2)}</div>
      </div>
      )}
    </div>
  );
}

// ── MODULE 4 · LES TYPES DE CAMPAGNE, PUIS LA COMPARAISON (ticket 15) ────────
// Quatrième tour, d'après le point d'analyse
// (.scratch/google-ads/analyses/15-comparer-les-types.md) : un type est un
// métier, pas une variante. Aucun chiffre commun, aucune échelle commune,
// aucune moustache. Chaque taux se lit face à la période d'avant DU MÊME type ;
// entre types, seulement la répartition (part de la dépense, part du compte de
// la vue). Ensuite, la Comparaison de Meta entre campagnes d'un seul type.

const TYPES: TypeC[] = ["Search", "PMax", "Display", "Vidéo", "Demand Gen"];
const COULEUR_TYPE: Record<TypeC, string> = { Search: "#1a56ff", PMax: "#e08b1a", Display: "#0d9aa8", "Vidéo": "#c2185b", "Demand Gen": "#7b4fff" };
const COMPTE_DE_LA_VUE: Record<Vue, Cle> = { notoriete: "impressions", trafic: "clics", conversion: "conversions" };
const TAUX_DE_LA_VUE: Record<Vue, Cle> = { notoriete: "cpm", trafic: "ctr", conversion: "cpa" };
// Ce qu'une part veut dire, et ce qu'elle ne veut pas dire (analyse, § 3).
const RESERVE_PART: Record<Vue, string> = {
  notoriete: "Une impression Search et une impression Vidéo ne sont pas le même événement : la part dit d'où vient le total, pas qui fait mieux.",
  trafic: "Un clic Search vient d'une recherche, un clic Vidéo vient après une vue : la part dit d'où viennent les clics, pas qui fait mieux.",
  conversion: "Google attribue chaque conversion à une seule campagne ; un type qui donne envie de chercher la marque voit souvent sa conversion comptée chez Search.",
};

const VARIANTES = [
  { cle: "A", nom: "Un bloc Types au-dessus de la Comparaison" },
  { cle: "B", nom: "Les types en tête de la Comparaison" },
  { cle: "C", nom: "Le bloc, avec les chiffres propres à chaque type" },
];

const campagnesDu = (ty: TypeC) => CAMPAGNES.filter((c) => c.type === ty);
const joursDuType = (ty: TypeC, quand: "maintenant" | "avant") =>
  Array.from({ length: JOURS }, (_, i) => additionner(campagnesDu(ty).map((c) => SERIE.get(c.id)![quand][i])));

type LuType = { ty: TypeC; campagnes: Ligne[]; total: Totaux; avant: Totaux; jours: Totaux[]; joursAvant: Totaux[] };
const lireTypes = (): LuType[] =>
  TYPES.map((ty) => {
    const cs = campagnesDu(ty), joursAvant = joursDuType(ty, "avant");
    return { ty, campagnes: cs, total: additionner(cs.map((c) => c.t)), avant: additionner(joursAvant), jours: joursDuType(ty, "maintenant"), joursAvant };
  });

function chemin(s: (number | null)[], max: number, W: number, H: number) {
  let d = "", pose = false;
  s.forEach((v, i) => {
    if (v === null) { pose = false; return; }
    const x = (i / (JOURS - 1)) * W, y = H - (Math.min(v, max) / max) * H;
    d += `${pose ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    pose = true;
  });
  return d;
}

/** La courbe d'UN type, à SA propre échelle : elle se lit face à son passé, jamais face aux autres. */
function Mini({ x, m, H = 34 }: { x: LuType; m: Cle; H?: number }) {
  const W = 300;
  const maintenant = x.jours.map((j) => METRIQUES[m].calc(j)), avant = x.joursAvant.map((j) => METRIQUES[m].calc(j));
  const valeurs = maintenant.filter((v) => v !== null).length;
  // Une courbe faite de 2 ou 3 jours mentirait sur la forme : on dit pourquoi elle manque.
  if (valeurs < JOURS / 2) return <span className="block text-[11.5px] leading-tight text-muted">pas de courbe : la plupart des jours n&apos;ont pas de valeur ({valeurs} / {JOURS})</span>;
  const max = Math.max(...[...maintenant, ...avant].filter((v): v is number => v !== null), 0) * 1.08 || 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height: H }} aria-hidden>
      <path d={chemin(avant, max, W, H)} fill="none" stroke="#b9bcc4" strokeWidth={1.25} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      <path d={chemin(maintenant, max, W, H)} fill="none" stroke={COULEUR_TYPE[x.ty]} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Part({ v, total, couleur }: { v: number; total: number; couleur: string }) {
  const p = total ? v / total : 0;
  return (
    <span className="mt-1 flex items-center gap-2 whitespace-nowrap">
      <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-canvas"><span className="block h-full rounded-full" style={{ width: `${p * 100}%`, background: couleur }} /></span>
      <span className="text-[11.5px] tabular-nums text-muted">{Math.round(p * 100)} %</span>
    </span>
  );
}

function Info({ texte }: { texte: string }) {
  return <span title={texte} className="ml-1 inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-line text-[9px] text-muted">i</span>;
}

// Chiffres FICTIFS. Ce qui est propre à chaque type, s'il est récolté un jour
// (option C de l'analyse). Disponibilité vérifiée : vues et CPV Vidéo, PMax par
// réseau (ticket 10) ; portée par campagne, non additionnable (ticket 01).
function Specialite({ ty }: { ty: TypeC }) {
  if (ty === "Vidéo") return <span className="text-[12px] tabular-nums text-ink">31 200 vues · taux de vue 32,5 % · CPV 0,017 CHF</span>;
  if (ty === "PMax") {
    const reseaux: [string, number, string][] = [["Search", 46, "#1a56ff"], ["YouTube", 21, "#c2185b"], ["Display", 19, "#0d9aa8"], ["Discover · Gmail", 9, "#7b4fff"], ["autres", 5, "#b9bcc4"]];
    return (
      <span className="block min-w-0">
        <span className="flex h-2 w-full overflow-hidden rounded-full">{reseaux.map(([n, p, c]) => <span key={n} style={{ width: `${p}%`, background: c }} />)}</span>
        <span className="mt-1 block text-[11px] leading-snug text-muted">dépense par réseau : {reseaux.map(([n, p]) => `${n} ${p} %`).join(" · ")}</span>
      </span>
    );
  }
  if (ty === "Search") return <span className="text-[12px] text-muted">mots-clés et recherches : à venir</span>;
  if (ty === "Display") return <span className="text-[12px] text-muted">portée et fréquence, par campagne (ne s&apos;additionnent pas)</span>;
  return <span className="text-[12px] text-muted">chiffres de base seulement</span>;
}

function BlocTypes({ L, ouvert, specialites }: { L: Lecture; ouvert: TypeC; specialites: boolean }) {
  const lt = lireTypes(), mc = COMPTE_DE_LA_VUE[L.vue], mt = TAUX_DE_LA_VUE[L.vue];
  const totalCompte = METRIQUES[mc].calc(COMPTE) ?? 0;
  return (
    <section>
      <Titre titre="Types de campagne" sous="Où va ton argent et d'où viennent tes résultats. Chaque type se lit face à ses 28 jours d'avant : les types ne se comparent pas entre eux." />
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className={`w-full text-[13px] ${specialites ? "min-w-[1080px]" : "min-w-[860px]"}`}>
          <thead>
            <tr className="whitespace-nowrap border-b border-line text-left align-bottom text-[12px] text-muted">
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Dépense<span className="block text-[11px] font-normal">et sa part</span></th>
              <th className="px-3 py-3 font-medium">{METRIQUES[mc].nom}<Info texte={RESERVE_PART[L.vue]} /><span className="block text-[11px] font-normal">et leur part</span></th>
              <th className="px-3 py-3 font-medium">{METRIQUES[mt].nom}<span className="block text-[11px] font-normal">face à ses 28 jours d&apos;avant</span></th>
              <th className="w-[18%] px-3 py-3 font-medium">Jour par jour, à son échelle</th>
              {specialites && <th className="w-[24%] px-3 py-3 font-medium">Propre au type</th>}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {lt.map((x) => {
              const actif = x.ty === ouvert, diffuse = x.campagnes.length > 0;
              return (
                <tr key={x.ty} className={`border-b border-line/60 last:border-0 ${actif ? "bg-canvas/60" : ""}`}>
                  <td className="px-4 py-3 align-top">
                    <span className="flex items-center gap-2 whitespace-nowrap font-semibold text-ink"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COULEUR_TYPE[x.ty] }} />{x.ty}</span>
                    <span className="block whitespace-nowrap pl-[18px] text-[11.5px] text-muted">{diffuse ? `${x.campagnes.length} campagne${x.campagnes.length > 1 ? "s" : ""}` : "aucune diffusion sur la période"}</span>
                  </td>
                  {diffuse ? (
                    <>
                      <td className="px-3 py-3 align-top"><span className="tabular-nums text-ink">{chf(x.total.cout)}</span><Part v={x.total.cout} total={COMPTE.cout} couleur={COULEUR_TYPE[x.ty]} /></td>
                      <td className="px-3 py-3 align-top"><span className="tabular-nums text-ink">{valeurDe(mc, x.total)}</span><Part v={METRIQUES[mc].calc(x.total) ?? 0} total={totalCompte} couleur={COULEUR_TYPE[x.ty]} /></td>
                      <td className="px-3 py-3 align-top">
                        <span className="flex flex-wrap items-baseline gap-2"><span className="text-[15px] font-semibold tabular-nums text-ink">{valeurDe(mt, x.total)}</span><Ecart m={mt} e={ecart(mt, x.total, x.avant)} /></span>
                        <span className="block whitespace-nowrap text-[11.5px] tabular-nums text-muted">avant : {valeurDe(mt, x.avant)}</span>
                      </td>
                      <td className="px-3 py-3 align-middle"><Mini x={x} m={mt} /></td>
                      {specialites && <td className="max-w-[300px] px-3 py-3 align-middle"><Specialite ty={x.ty} /></td>}
                      <td className="px-4 py-3 text-right align-middle">
                        {actif ? <span className="text-[12px] font-medium text-ink">ses campagnes ↓</span>
                          : <Link href={lien(L.sp, { type: x.ty, comparer: undefined })} scroll={false} className="whitespace-nowrap text-[12px] font-medium text-brand hover:underline">Ses campagnes →</Link>}
                      </td>
                    </>
                  ) : <td colSpan={specialites ? 6 : 5} className="px-3 py-3 text-[12px] text-muted">A diffusé dans l&apos;année ; rien sur la période choisie.</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] text-muted">
        Ordre fixe, jamais classé. Chaque courbe a sa propre échelle : elle se lit face à son pointillé (les 28 jours d&apos;avant), pas face aux autres types.
        Autres types : aucune diffusion sur 12 mois, pas de ligne.
      </p>
    </section>
  );
}

function OngletsTypes({ L, ouvert }: { L: Lecture; ouvert: TypeC }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px]">
      <span className="text-muted">Type :</span>
      {TYPES.filter((ty) => campagnesDu(ty).length).map((ty) => (
        <Link key={ty} href={lien(L.sp, { type: ty, comparer: undefined })} scroll={false}
          className={`rounded-full px-3 py-1 ${ty === ouvert ? "bg-ink text-white" : "border border-line bg-white text-ink hover:border-ink/30"}`}>{ty}</Link>
      ))}
    </div>
  );
}

function ComparaisonDuType({ L, ouvert }: { L: Lecture; ouvert: TypeC }) {
  return (
    <section>
      <Titre titre="Comparaison" sous="Les campagnes d'un même type entre elles : elles font le même métier." />
      <OngletsTypes L={L} ouvert={ouvert} />
      <Comparaison L={L} campagnes={campagnesDu(ouvert)} titre={`Les campagnes ${ouvert}`} />
    </section>
  );
}

/** Variante B : les types sont la porte d'entrée de la Comparaison, un seul module. */
function TypesEnTete({ L, ouvert }: { L: Lecture; ouvert: TypeC }) {
  const lt = lireTypes(), mc = COMPTE_DE_LA_VUE[L.vue], mt = TAUX_DE_LA_VUE[L.vue];
  const totalCompte = METRIQUES[mc].calc(COMPTE) ?? 0;
  return (
    <section>
      <Titre titre="Comparaison" sous="Choisis un type : ses campagnes se comparent entre elles. Les types, eux, ne se comparent pas — chacun se lit face à ses 28 jours d'avant." />
      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {lt.map((x) => {
          const actif = x.ty === ouvert, diffuse = x.campagnes.length > 0;
          const corps = (
            <>
              <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COULEUR_TYPE[x.ty] }} />{x.ty}</span>
              {diffuse ? (
                <>
                  <span className="mt-2 block text-[11.5px] text-muted">dépense {chf(x.total.cout)}</span>
                  <Part v={x.total.cout} total={COMPTE.cout} couleur={COULEUR_TYPE[x.ty]} />
                  <span className="mt-1.5 block text-[11.5px] text-muted">{METRIQUES[mc].nom.toLowerCase()} {valeurDe(mc, x.total)}<Info texte={RESERVE_PART[L.vue]} /></span>
                  <Part v={METRIQUES[mc].calc(x.total) ?? 0} total={totalCompte} couleur={COULEUR_TYPE[x.ty]} />
                  <span className="mt-3 flex flex-wrap items-baseline gap-2"><span className="text-[11.5px] text-muted">{METRIQUES[mt].nom}</span><span className="text-[17px] font-semibold tabular-nums text-ink">{valeurDe(mt, x.total)}</span><Ecart m={mt} e={ecart(mt, x.total, x.avant)} /></span>
                  <span className="mt-2 block"><Mini x={x} m={mt} H={30} /></span>
                </>
              ) : <span className="mt-2 block text-[12px] text-muted">aucune diffusion sur la période</span>}
            </>
          );
          const cadre = `block min-w-0 rounded-xl border p-3 ${actif ? "border-ink bg-white shadow-[0_8px_20px_-10px_rgba(14,15,18,0.35)]" : "border-line bg-white"}`;
          return diffuse
            ? <Link key={x.ty} href={lien(L.sp, { type: x.ty, comparer: undefined })} scroll={false} className={`${cadre} ${actif ? "" : "hover:border-ink/30"}`}>{corps}</Link>
            : <div key={x.ty} className={`${cadre} opacity-70`}>{corps}</div>;
        })}
      </div>
      <Comparaison L={L} campagnes={campagnesDu(ouvert)} titre={`Les campagnes ${ouvert}`} />
      <p className="mt-3 text-[11.5px] text-muted">Ordre fixe, jamais classé. Chaque petite courbe a sa propre échelle, face à son pointillé (les 28 jours d&apos;avant).</p>
    </section>
  );
}

function ComparaisonTypes({ L }: { L: Lecture }) {
  const variante = un(L.sp.variant) ?? "A";
  const ty = un(L.sp.type) as TypeC | undefined;
  const ouvert: TypeC = ty && TYPES.includes(ty) && campagnesDu(ty).length ? ty : "Search";
  if (variante === "B") return <TypesEnTete L={L} ouvert={ouvert} />;
  return (
    <>
      <BlocTypes L={L} ouvert={ouvert} specialites={variante === "C"} />
      <ComparaisonDuType L={L} ouvert={ouvert} />
    </>
  );
}

function RepereType({ type }: { type: TypeC }) {
  return <span className="rounded border px-1.5 py-px text-[10.5px] font-medium" style={{ color: COULEUR_TYPE[type], borderColor: `${COULEUR_TYPE[type]}55` }}>{type}</span>;
}

// ── MODULE 5 · LE TABLEAU DÉTAILLÉ ───────────────────────────────────────────

function Tableau({ L }: { L: Lecture }) {
  const cols = VUES[L.vue].tableau;
  const deplie = new Set((un(L.sp.deplie) ?? "").split("~").filter(Boolean));
  const rangees: { l: Ligne; prof: number }[] = [];
  const pousser = (l: Ligne, prof: number) => {
    rangees.push({ l, prof });
    if (deplie.has(l.id)) l.enfants.forEach((e) => pousser(e, prof + 1));
  };
  [...CAMPAGNES].sort((a, b) => b.t.cout - a.t.cout).forEach((c) => pousser(c, 0));
  const basculer = (id: string) => {
    const n = new Set(deplie);
    if (n.has(id)) n.delete(id); else n.add(id);
    return lien(L.sp, { deplie: [...n].join("~") || "_" });
  };
  return (
    <section>
      <Titre titre="Tableau détaillé" sous="Toutes tes campagnes, dépliables jusqu'au détail. Les colonnes suivent la vue."
        droite={<span className="rounded-full border border-line bg-white px-3 py-1 text-[12.5px] text-ink">Exporter en CSV</span>} />
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-muted">
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-3 py-3 text-right font-medium">Coût</th>
              {cols.map((c) => <th key={c} className="px-3 py-3 text-right font-medium">{METRIQUES[c].nom}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line bg-canvas/60 font-semibold">
              <td className="px-4 py-2.5">Total</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{chf(COMPTE.cout)}</td>
              {cols.map((c) => <td key={c} className="px-3 py-2.5 text-right tabular-nums">{valeurDe(c, COMPTE)}</td>)}
            </tr>
            {rangees.map(({ l, prof }) => (
              <tr key={l.id} className={`border-b border-line/60 ${prof ? "bg-canvas/40" : ""}`}>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-1.5" style={{ paddingLeft: prof * 20 }}>
                    {l.enfants.length ? (
                      <Link href={basculer(l.id)} scroll={false} className="flex h-5 w-5 items-center justify-center rounded hover:bg-canvas">
                        <Icone nom="chevron" className={`h-3.5 w-3.5 ${deplie.has(l.id) ? "" : "-rotate-90"}`} />
                      </Link>
                    ) : <span className="w-5" />}
                    <span className={prof ? "text-ink/85" : "font-medium text-ink"}>{l.nom}</span>
                    {prof > 0 && <span className="text-[11.5px] text-muted">· {l.niveau}</span>}
                    {prof === 0 && l.type && <RepereType type={l.type} />}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{chf(l.t.cout)}</td>
                {cols.map((c) => (
                  <td key={c} className="px-3 py-2.5 text-right tabular-nums" title={METRIQUES[c].calc(l.t) === null ? "Aucune conversion sur la période : ce rapport n'existe pas" : undefined}>
                    {valeurDe(c, l.t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── EN BAS · L'ANALYSE DES CAMPAGNES, À VENIR ────────────────────────────────
// David, 2026-11-10 : la page d'abord, l'analyse par campagne et par type de
// campagne plus tard (ticket 15, `BACKLOG.md`). L'emplacement est réservé.

function AnalyseAVenir() {
  return (
    <section className="rounded-2xl border border-dashed border-line bg-white/60 p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-canvas text-ink"><Icone nom="loupe" className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold text-ink">Analyser une campagne <span className="ml-1 rounded-full bg-canvas px-2 py-0.5 align-middle text-[11.5px] font-medium text-muted">à venir</span></h2>
          <p className="mt-1 max-w-2xl text-[13px] text-muted">
            Ici viendra l&apos;analyse d&apos;une campagne selon ce qu&apos;elle est : les mots-clés et les recherches d&apos;une campagne
            Search, les groupes d&apos;éléments et les réseaux d&apos;une Performance Max, les emplacements d&apos;une Display, les
            vues d&apos;une Vidéo. Elle se construira un type de campagne à la fois.
          </p>
        </div>
      </div>
    </section>
  );
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
