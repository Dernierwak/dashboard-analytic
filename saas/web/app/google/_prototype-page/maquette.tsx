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
import Link from "next/link";
import { Icone, type NomIcone } from "@/components/meta/elements";
// Ticket 20 : l'Analyse Search remplace l'emplacement réservé en bas de page.
import { AnalyseSearch } from "./analyse";

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
type Ligne = { id: string; nom: string; niveau: string; t: Totaux; enfants: Ligne[] };

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
const campagne = (nom: string, tt: Totaux, sous: [string, number][], elements = false): Ligne => ({
  id: nom, nom, niveau: "Campagne", t: tt,
  enfants: elements ? enfants(nom, tt, "Groupe d'éléments", sous) : enfants(nom, tt, "Groupe d'annonces", sous, annonces),
});
// Les 28 jours de A ≈ 31 % de ses 90 jours (ticket 10) : Search ≈ 5 040 CHF,
// PMax ≈ 2 285 CHF — PMax fait beaucoup de clics bon marché.
const CAMPAGNES: Ligne[] = [
  campagne("Marque", t(15_200, 2_310, 1_715, 512, 1_480), [["Marque exacte", 0.7], ["Marque + produit", 0.3]]),
  campagne("Produits", t(12_100, 1_160, 1_360, 371, 1_120), [["Gamme A", 0.55], ["Gamme B", 0.45]]),
  campagne("Catalogue", t(65_900, 4_260, 1_325, 70, 990), [["Tous les produits", 0.7], ["Nouveautés", 0.3]], true),
  campagne("Générique FR", t(8_000, 880, 905, 246, 720), [["Générique", 1]]),
  campagne("Leads", t(35_200, 2_210, 710, 37, 525), [["Formulaire", 1]], true),
  campagne("Générique DE", t(5_400, 470, 605, 140, 410), [["Generisch", 1]]),
  campagne("Concurrents", t(4_000, 270, 455, 99, 280), [["Concurrents", 1]]),
  campagne("Saison", t(12_600, 710, 250, 13, 185), [["Automne", 1]], true),
];
const AVANT = 1 / 1.04; // la période d'avant, un peu plus basse

const vide = (): Totaux => t(0, 0, 0, 0, 0);
const additionner = (ls: Totaux[]) => ls.reduce((a, b) => { CHAMPS.forEach((c) => (a[c] += b[c])); return a; }, vide());
const COMPTE = additionner(CAMPAGNES.map((c) => c.t));
const fois = (x: Totaux, k: number) => Object.fromEntries(CHAMPS.map((c) => [c, x[c] * k])) as Totaux;

/** Répartit un total de campagne sur 28 jours : creux le week-end, du bruit. */
function serieJours(tt: Totaux, graine: number): Totaux[] {
  // Un bruit commun (le volume du jour) et un bruit propre à chaque compteur :
  // sans le second, tous les taux seraient des droites.
  const parChamp = CHAMPS.map((_, ci) => {
    const poids = Array.from({ length: JOURS }, (_, i) => {
      const wd = dateDu(i).getUTCDay();
      return (wd === 0 || wd === 6 ? 0.72 : 1.08) * (0.75 + 0.5 * bruit(i, graine)) * (0.85 + 0.3 * bruit(i, graine + 31 * (ci + 1)));
    });
    const s = poids.reduce((a, b) => a + b, 0);
    return poids.map((p) => p / s);
  });
  return Array.from({ length: JOURS }, (_, i) => Object.fromEntries(CHAMPS.map((c, ci) => [c, tt[c] * parChamp[ci][i]])) as Totaux);
}
const SERIE = new Map(CAMPAGNES.map((c) => [c.id, { maintenant: serieJours(c.t, graineDe(c.nom)), avant: serieJours(fois(c.t, AVANT), graineDe(c.nom) + 7) }]));
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
        <Comparaison L={L} />
        <Tableau L={L} />
        <AnalyseSearch sp={sp} vue={L.vue} />
      </div>
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

function Comparaison({ L }: { L: Lecture }) {
  const [m1, m2] = VUES[L.vue].tendance;
  const rangs = [...CAMPAGNES].sort((a, b) => (METRIQUES[m1].calc(b.t) ?? 0) - (METRIQUES[m1].calc(a.t) ?? 0));
  const demandees = tous(L.sp.comparer).filter((id) => CAMPAGNES.some((c) => c.id === id));
  const cochees = demandees.length ? demandees.slice(0, 4) : rangs.slice(0, 4).map((c) => c.id);
  const max = METRIQUES[m1].calc(rangs[0].t) || 1;
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
    <section>
      <Titre titre="Comparaison" sous={`Tes campagnes classées sur ${METRIQUES[m1].nom.toLowerCase()}. Coche-en jusqu'à quatre pour les suivre jour par jour.`}
        droite={<span className="text-[12.5px] text-muted">Niveau : <b className="text-ink">Campagnes</b> · Métriques : <b className="text-ink">{METRIQUES[m1].nom}</b>, <b className="text-ink">{METRIQUES[m2].nom}</b></span>} />
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
    </section>
  );
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
