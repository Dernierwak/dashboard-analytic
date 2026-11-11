// PROTOTYPE JETABLE — ticket « Améliorer la Comparaison »
// (.scratch/google-ads/issues/16-ameliorer-la-comparaison.md). Ne part jamais
// sur `main` : il vit sur la branche `prototype/comparaison`.
//
// Trois variantes de la Comparaison sur la page Google validée (`b19d03f`),
// changées par `?av=A|B|C` (M = la Comparaison de Meta telle qu'aujourd'hui).
// Toutes suivent ce que David a décrit au ticket 20 : le choix AU-DESSUS, et
// dessous, côte à côte, un nuage des éléments sur la période et la courbe jour
// par jour ; quatre cases au plus ; on descend jusqu'aux annonces, jamais aux
// éléments (« ce sera dans analyse »). Elles diffèrent sur les trois questions
// du ticket : les axes du nuage, ce que deviennent les non-cochés, le chemin de
// la descente. `?plateforme=meta` montre la même chose avec les noms de Meta
// (ADR 0011 : une amélioration vaut pour les deux pages).
//
// Tout est calculé à l'appel, jamais au chargement du module : ce fichier et
// `maquette.tsx` s'importent l'un l'autre.
import Link from "next/link";
import { Icone } from "@/components/meta/elements";
import {
  CAMPAGNES, JOURS, METRIQUES, SERIE, VUES, Lignes, Titre, annonces, chf, dateDu, graineDe, jourCourt, lien, serieJours, tous, un,
  type Cle, type Ligne, type SP, type Totaux, type Vue,
} from "./maquette";

// ── LES DONNÉES, VUES DEPUIS GOOGLE OU DEPUIS META ───────────────────────────

type Plat = "google" | "meta";
type Axe = Cle | "cout";
const COUT = { nom: "Coût", baisseBonne: true, calc: (x: Totaux) => x.cout, fmt: (v: number) => chf(v) };
const M = (a: Axe) => (a === "cout" ? COUT : METRIQUES[a]);

const NOMS: Record<Plat, { niveaux: [string, string, string]; un: [string, string, string]; type: string; types: [string, string] }> = {
  google: { niveaux: ["Campagnes", "Groupes", "Annonces"], un: ["Campagne", "Groupe", "Annonce"], type: "Type de campagne", types: ["Search", "PMax"] },
  meta: { niveaux: ["Campagnes", "Ensembles de pub", "Publicités"], un: ["Campagne", "Ensemble de pub", "Publicité"], type: "Objectif", types: ["Trafic", "Ventes"] },
};
const NOMS_META: Record<string, string> = {
  Marque: "Retargeting 30 j", Produits: "Prospection large", Catalogue: "Catalogue Advantage+", "Générique FR": "Lookalike FR",
  Leads: "Formulaires instantanés", "Générique DE": "Lookalike DE", Concurrents: "Intérêts concurrents", Saison: "Saison automne",
};

/** Sur Meta, tout se déplie jusqu'aux publicités ; sur Google, PMax s'arrête au groupe d'éléments. */
function metaDe(l: Ligne, prof: number): Ligne {
  const nom = prof === 0 ? NOMS_META[l.nom] ?? l.nom : prof === 1 ? `Ensemble · ${l.nom}` : l.nom.replace("Annonce responsive", "Publicité");
  const sous = prof === 1 && !l.enfants.length ? annonces(l.id, l.t) : l.enfants;
  return { ...l, nom, niveau: NOMS.meta.un[prof], enfants: sous.map((e) => metaDe(e, prof + 1)) };
}

type Noeud = { l: Ligne; prof: number; type: 0 | 1; campagne: string };
const cache = new Map<Plat, Noeud[]>();
function noeuds(plat: Plat): Noeud[] {
  if (!cache.has(plat)) {
    const out: Noeud[] = [];
    const racines = plat === "meta" ? CAMPAGNES.map((c) => metaDe(c, 0)) : CAMPAGNES;
    racines.forEach((c, i) => {
      const type = CAMPAGNES[i].enfants[0]?.niveau === "Groupe d'éléments" ? 1 : 0;
      const pousser = (l: Ligne, prof: number) => { out.push({ l, prof, type, campagne: c.id }); l.enfants.forEach((e) => pousser(e, prof + 1)); };
      pousser(c, 0);
    });
    cache.set(plat, out);
  }
  return cache.get(plat)!;
}
const noeud = (plat: Plat, id: string) => noeuds(plat).find((n) => n.l.id === id);

const series = new Map<string, Totaux[]>();
function serieDe(l: Ligne): Totaux[] {
  const s = SERIE.get(l.id)?.maintenant;
  if (s) return s;
  if (!series.has(l.id)) series.set(l.id, serieJours(l.t, graineDe(l.id)));
  return series.get(l.id)!;
}

type Etat = { sp: SP; vue: Vue; plat: Plat; type: "tous" | "0" | "1" };
function lire(sp: SP, vue: Vue): Etat {
  const t = un(sp.type);
  return { sp, vue, plat: un(sp.plateforme) === "meta" ? "meta" : "google", type: t === "0" || t === "1" ? t : "tous" };
}
const duType = (E: Etat) => (n: Noeud) => E.type === "tous" || String(n.type) === E.type;

const COULEURS = ["#1a56ff", "#e08b1a", "#7b4fff", "#0d9aa8"];
const MAX = 4;
function cochage(E: Etat, candidats: Noeud[], classe: Axe): string[] {
  const brut = tous(E.sp.comparer);
  if (brut.includes("_")) return [];
  const ok = brut.filter((id) => candidats.some((n) => n.l.id === id));
  if (brut.length) return ok.slice(0, MAX);
  return [...candidats].sort((a, b) => (M(classe).calc(b.l.t) ?? 0) - (M(classe).calc(a.l.t) ?? 0)).slice(0, MAX).map((n) => n.l.id);
}
const basculer = (E: Etat, cochees: string[], id: string) => {
  const n = cochees.includes(id) ? cochees.filter((x) => x !== id) : [...cochees, id].slice(-MAX);
  return lien(E.sp, { comparer: n.length ? n : ["_"] });
};
/** Les axes de la vue, comme l'Analyse du ticket 18. */
const AXES_VUE: Record<Vue, [Axe, Axe]> = { notoriete: ["impressions", "cpm"], trafic: ["clics", "ctr"], conversion: ["cout", "conversions"] };
const axesPossibles = (vue: Vue): Axe[] => ["cout", ...VUES[vue].tableau];

// ── LES DEUX GRAPHES ─────────────────────────────────────────────────────────

type Point = { id: string; nom: string; t: Totaux; couleur?: string; creux?: boolean };

function etendue(vs: number[]): [number, number] {
  const lo = Math.min(...vs), hi = Math.max(...vs);
  const pad = (hi - lo || hi || 1) * 0.12;
  return [Math.max(0, lo - pad), hi + pad];
}

function Nuage({ points, mx, my, note }: { points: Point[]; mx: Axe; my: Axe; note: string }) {
  const W = 520, H = 340, P = { l: 78, r: 18, t: 30, b: 44 };
  const ok = points.filter((p) => M(mx).calc(p.t) !== null && M(my).calc(p.t) !== null);
  const sans = points.length - ok.length;
  if (!ok.length) return <Cadre titre="Sur toute la période" note={note}><p className="py-16 text-center text-[13px] text-muted">Rien à placer : coche au moins une ligne.</p></Cadre>;
  const X = ok.map((p) => M(mx).calc(p.t)!), Y = ok.map((p) => M(my).calc(p.t)!);
  const [x0, x1] = etendue(X), [y0, y1] = etendue(Y);
  const sx = (v: number) => P.l + ((v - x0) / (x1 - x0)) * (W - P.l - P.r);
  const sy = (v: number) => H - P.b - ((v - y0) / (y1 - y0)) * (H - P.t - P.b);
  const maxCout = Math.max(...ok.map((p) => p.t.cout)) || 1;
  const r = (p: Point) => (p.creux ? 3 : 4) + (p.creux ? 7 : 11) * Math.sqrt(p.t.cout / maxCout);
  const graduations = (a: number, b: number) => [a, (a + b) / 2, b];
  const tri = [...ok].sort((a, b) => Number(!!a.couleur) - Number(!!b.couleur));
  return (
    <Cadre titre={`${M(my).nom} selon ${M(mx).nom.toLowerCase()}, sur toute la période`} note={note + (sans ? ` ${sans} sans valeur (« — ») ne se placent pas.` : "")}>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Nuage de points">
        {graduations(x0, x1).map((v, i) => (
          <g key={`x${i}`}>
            <line x1={sx(v)} x2={sx(v)} y1={P.t} y2={H - P.b} stroke="#efeee9" />
            <text x={sx(v)} y={H - P.b + 16} fontSize={11} fill="#8a8f98" textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}>{M(mx).fmt(v)}</text>
          </g>
        ))}
        {graduations(y0, y1).map((v, i) => (
          <g key={`y${i}`}>
            <line x1={P.l} x2={W - P.r} y1={sy(v)} y2={sy(v)} stroke="#efeee9" />
            <text x={P.l - 6} y={sy(v) + 4} fontSize={11} fill="#8a8f98" textAnchor="end">{M(my).fmt(v)}</text>
          </g>
        ))}
        <text x={W - P.r} y={H - 6} fontSize={11.5} fill="#5b6070" textAnchor="end">{M(mx).nom} →</text>
        <text x={8} y={14} fontSize={11.5} fill="#5b6070">↑ {M(my).nom}</text>
        {tri.map((p) => {
          const cx = sx(M(mx).calc(p.t)!), cy = sy(M(my).calc(p.t)!);
          const c = p.couleur ?? "#c9cbd1";
          return (
            <g key={p.id}>
              <title>{`${p.nom} — ${M(mx).nom} ${M(mx).fmt(M(mx).calc(p.t)!)} · ${M(my).nom} ${M(my).fmt(M(my).calc(p.t)!)} · coût ${chf(p.t.cout)}`}</title>
              <circle cx={cx} cy={cy} r={r(p)} fill={p.creux ? "white" : c} fillOpacity={p.couleur ? 0.85 : 0.6} stroke={c} strokeWidth={p.creux ? 2 : 1} />
              {p.couleur && <text x={cx + r(p) + 4} y={cy + 4} fontSize={11.5} fontWeight={600} fill="#0e0f12" textAnchor={cx > W * 0.75 ? "end" : "start"} dx={cx > W * 0.75 ? -2 * r(p) - 8 : 0}>{p.nom}</text>}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[11.5px] text-muted">Taille d&apos;un point : son coût sur la période.</p>
    </Cadre>
  );
}

function Courbe({ E, cochees, m, choix, cle }: { E: Etat; cochees: Ligne[]; m: Axe; choix: Axe[]; cle: string }) {
  return (
    <Cadre titre={`${M(m).nom}, jour par jour`} note={`Les ${JOURS} derniers jours, jour en cours exclu.`}
      droite={choix.length > 1 && (
        <span className="flex gap-1">
          {choix.map((a) => (
            <Link key={a} href={lien(E.sp, { [cle]: a })} scroll={false}
              className={`rounded-full px-2.5 py-0.5 text-[12px] ${a === m ? "bg-ink text-white" : "bg-canvas text-muted hover:text-ink"}`}>{M(a).nom}</Link>
          ))}
        </span>
      )}>
      {cochees.length ? (
        <>
          <Lignes W={520} H={250} axe couleurs={cochees.map((_, k) => COULEURS[k])} series={cochees.map((l) => serieDe(l).map((x) => M(m).calc(x)))} />
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
            {cochees.map((l, k) => <li key={l.id} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COULEURS[k] }} />{l.nom}</li>)}
          </ul>
        </>
      ) : <p className="py-16 text-center text-[13px] text-muted">Coche au moins une ligne pour la suivre jour par jour.</p>}
    </Cadre>
  );
}

function Cadre({ titre, note, droite, children }: { titre: string; note: string; droite?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-ink">{titre}</p>
        {droite}
      </div>
      {children}
      <p className="mt-2 text-[11.5px] text-muted">{note}</p>
    </div>
  );
}

// ── LES PETITES PIÈCES DU CHOIX ──────────────────────────────────────────────

function Pastilles<T extends string>({ E, cle, valeurs, actuelle, noms, retire = [] }: { E: Etat; cle: string; valeurs: T[]; actuelle: T; noms: (v: T) => string; retire?: string[] }) {
  return (
    <nav className="inline-flex max-w-full flex-wrap rounded-full bg-[#efeee9] p-1">
      {valeurs.map((v) => (
        <Link key={v} href={lien(E.sp, Object.fromEntries([[cle, v], ...retire.map((r) => [r, undefined])]))} scroll={false}
          className={`rounded-full px-3 py-1 text-[12.5px] font-medium ${v === actuelle ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{noms(v)}</Link>
      ))}
    </nav>
  );
}
const typeNoms = (E: Etat) => (v: "tous" | "0" | "1") => (v === "tous" ? "Tous" : NOMS[E.plat].types[Number(v)]);

function Plateforme({ E }: { E: Etat }) {
  return (
    <span className="flex items-center gap-2 text-[12px] text-muted">
      Maquette vue sur
      <Pastilles E={E} cle="plateforme" valeurs={["google", "meta"] as Plat[]} actuelle={E.plat} noms={(p) => (p === "google" ? "Google" : "Meta")} />
    </span>
  );
}

function Case({ k }: { k: number }) {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border text-white" style={k >= 0 ? { background: COULEURS[k], borderColor: COULEURS[k] } : { borderColor: "#d9d7d0" }}>
      {k >= 0 && <Icone nom="coche" className="h-3 w-3" />}
    </span>
  );
}
const typeCourt = (E: Etat, n: Noeud) => NOMS[E.plat].types[n.type];

// ── A · LES RÉGLAGES (la mécanique de Meta, un nuage à la place du 1er graphe) ─
// Axes = les deux métriques choisies (la 1re classe la liste) ; non cochées en
// gris ; on descend par le réglage « Niveau », qui repart du pré-cochage.

function VarianteA({ E }: { E: Etat }) {
  const choix = axesPossibles(E.vue);
  const lu = (k: string, d: Axe) => { const v = un(E.sp[k]) as Axe | undefined; return v && choix.includes(v) ? v : d; };
  const mx = lu("mx", VUES[E.vue].tendance[0]);
  const my = lu("my", VUES[E.vue].tendance[1]);
  const niveauBrut = Math.min(2, Math.max(0, Number(un(E.sp.niveau) ?? 0) || 0));
  const pmaxSeul = E.plat === "google" && E.type === "1";
  const niveau = pmaxSeul && niveauBrut === 2 ? 1 : niveauBrut;
  const candidats = noeuds(E.plat).filter((n) => n.prof === niveau && duType(E)(n) && (niveau < 2 || n.l.niveau !== "Groupe d'éléments"));
  const rangs = [...candidats].sort((a, b) => (M(mx).calc(b.l.t) ?? -1) - (M(mx).calc(a.l.t) ?? -1));
  const cochees = cochage(E, candidats, mx);
  const max = Math.max(...rangs.map((n) => M(mx).calc(n.l.t) ?? 0)) || 1;
  const m = lu("courbe", mx) === my ? my : mx;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-line bg-white px-4 py-3">
        <Reglage nom={NOMS[E.plat].type}><Pastilles E={E} cle="type" valeurs={["tous", "0", "1"] as ("tous" | "0" | "1")[]} actuelle={E.type} noms={typeNoms(E)} retire={["comparer"]} /></Reglage>
        <Reglage nom="Niveau">
          <Pastilles E={E} cle="niveau" valeurs={pmaxSeul ? ["0", "1"] : ["0", "1", "2"]} actuelle={String(niveau)} noms={(v) => NOMS[E.plat].niveaux[Number(v)]} retire={["comparer"]} />
        </Reglage>
        <Reglage nom="Axe horizontal · classe la liste"><Pastilles E={E} cle="mx" valeurs={choix} actuelle={mx} noms={(a) => M(a).nom} /></Reglage>
        <Reglage nom="Axe vertical"><Pastilles E={E} cle="my" valeurs={choix} actuelle={my} noms={(a) => M(a).nom} /></Reglage>
      </div>
      {pmaxSeul && <p className="-mt-2 mb-3 text-[12px] text-muted">PMax n&apos;a pas d&apos;annonces : il s&apos;arrête au groupe d&apos;éléments. Ses éléments seront dans l&apos;Analyse.</p>}
      <ol className="grid gap-x-6 rounded-2xl border border-line bg-white p-2 md:grid-cols-2">
        {rangs.map((n, i) => {
          const k = cochees.indexOf(n.l.id), v = M(mx).calc(n.l.t);
          return (
            <li key={n.l.id} className="min-w-0">
              <Link href={basculer(E, cochees, n.l.id)} scroll={false} className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] hover:bg-canvas">
                <Case k={k} />
                <span className="w-5 text-right tabular-nums text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{n.l.nom}{niveau > 0 && <span className="text-muted"> · {noeud(E.plat, n.campagne)!.l.nom}</span>}</span>
                <span className="rounded bg-canvas px-1.5 text-[11px] text-muted">{typeCourt(E, n)}</span>
                <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-canvas lg:block"><span className="block h-full bg-ink/70" style={{ width: `${((v ?? 0) / max) * 100}%` }} /></span>
                <span className="w-24 text-right font-semibold tabular-nums text-ink">{v === null ? "—" : M(mx).fmt(v)}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Nuage mx={mx} my={my} note="En gris : les lignes non cochées du même niveau."
          points={candidats.map((n) => ({ id: n.l.id, nom: n.l.nom, t: n.l.t, couleur: cochees.includes(n.l.id) ? COULEURS[cochees.indexOf(n.l.id)] : undefined }))} />
        <Courbe E={E} cle="courbe" m={m} choix={[mx, my]} cochees={cochees.map((id) => noeud(E.plat, id)!.l)} />
      </div>
    </>
  );
}
function Reglage({ nom, children }: { nom: string; children: React.ReactNode }) {
  return <div className="min-w-0"><p className="mb-1 text-[11.5px] font-medium text-muted">{nom}</p>{children}</div>;
}

// ── B · DESCENDRE D'UN CRAN ──────────────────────────────────────────────────
// Axes = ceux de la vue, rien à régler ; seules les cochées sont dans le nuage ;
// une ligne cochée qui a des enfants porte « descendre », un fil d'Ariane
// remonte. On compare toujours des frères.

function VarianteB({ E }: { E: Etat }) {
  const [mx, my] = AXES_VUE[E.vue];
  const parent = un(E.sp.parent) ? noeud(E.plat, un(E.sp.parent)!) : undefined;
  const candidats = parent
    ? parent.l.enfants.map((e) => noeud(E.plat, e.id)!)
    : noeuds(E.plat).filter((n) => n.prof === 0 && duType(E)(n));
  const cochees = cochage(E, candidats, mx);
  const chemin: Noeud[] = [];
  for (let n = parent; n; n = n.prof > 0 ? noeud(E.plat, n.l.id.split(".").slice(0, -1).join(".")) : undefined) chemin.unshift(n);
  const niveau = parent ? parent.prof + 1 : 0;
  const choixCourbe = VUES[E.vue].tendance;
  const lu = un(E.sp.courbe) as Cle | undefined;
  const m = lu && choixCourbe.includes(lu) ? lu : choixCourbe[0];
  return (
    <>
      {!parent && (
        <div className="mb-3 flex gap-5 border-b border-line text-[13.5px]">
          {(["tous", "0", "1"] as const).map((v) => (
            <Link key={v} href={lien(E.sp, { type: v, comparer: undefined })} scroll={false}
              className={`-mb-px border-b-2 pb-2 ${E.type === v ? "border-ink font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {v === "tous" ? `Tous les ${NOMS[E.plat].type === "Objectif" ? "objectifs" : "types"}` : NOMS[E.plat].types[Number(v)]}
            </Link>
          ))}
        </div>
      )}
      <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-[13px]">
        <Link href={lien(E.sp, { parent: undefined, comparer: undefined })} scroll={false} className={parent ? "text-brand hover:underline" : "font-semibold text-ink"}>Toutes les campagnes</Link>
        {chemin.map((n, i) => (
          <span key={n.l.id} className="flex items-center gap-1.5">
            <span className="text-muted">›</span>
            {i === chemin.length - 1
              ? <span className="font-semibold text-ink">{n.l.nom}</span>
              : <Link href={lien(E.sp, { parent: n.l.id, comparer: undefined })} scroll={false} className="text-brand hover:underline">{n.l.nom}</Link>}
          </span>
        ))}
        <span className="ml-2 text-[12px] text-muted">· {candidats.length} {NOMS[E.plat].niveaux[niveau].toLowerCase()} — coche-en jusqu&apos;à quatre</span>
      </nav>
      <ul className="flex flex-wrap gap-2">
        {candidats.map((n) => {
          const k = cochees.indexOf(n.l.id);
          const enfants = n.l.enfants.length > 0;
          return (
            <li key={n.l.id} className={`flex items-center overflow-hidden rounded-full border text-[13px] ${k >= 0 ? "border-ink/25 bg-white" : "border-line bg-white/70"}`}>
              <Link href={basculer(E, cochees, n.l.id)} scroll={false} className="flex items-center gap-2 py-1.5 pl-3 pr-3 hover:bg-canvas">
                <Case k={k} />
                <span className={k >= 0 ? "font-medium text-ink" : "text-ink/80"}>{n.l.nom}</span>
                {!parent && <span className="text-[11px] text-muted">{typeCourt(E, n)}</span>}
                <span className="tabular-nums text-muted">{M(mx).fmt(M(mx).calc(n.l.t) ?? 0)}</span>
              </Link>
              {k >= 0 && (enfants
                ? <Link href={lien(E.sp, { parent: n.l.id, comparer: undefined })} scroll={false} className="border-l border-line px-3 py-1.5 font-medium text-brand hover:bg-canvas" title={`Comparer ses ${NOMS[E.plat].niveaux[niveau + 1].toLowerCase()}`}>Descendre ↓</Link>
                : n.l.niveau === "Groupe d'éléments" && <span className="border-l border-line px-3 py-1.5 text-[12px] text-muted" title="Ses éléments seront dans l'Analyse">fin · PMax</span>)}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Nuage mx={mx} my={my} note={`Les axes suivent la vue ${VUES[E.vue].titre}. Seules les lignes cochées sont placées.`}
          points={cochees.map((id, k) => { const n = noeud(E.plat, id)!; return { id, nom: n.l.nom, t: n.l.t, couleur: COULEURS[k] }; })} />
        <Courbe E={E} cle="courbe" m={m} choix={choixCourbe} cochees={cochees.map((id) => noeud(E.plat, id)!.l)} />
      </div>
    </>
  );
}

// ── C · LA LISTE SE DÉPLIE SUR PLACE ─────────────────────────────────────────
// Le choix est un petit tableau qui se déplie comme le Tableau détaillé ; on
// coche à n'importe quel niveau, on peut mettre une campagne face au groupe
// d'une autre. Le nuage montre tout ce qui est déplié, non cochés en gris,
// groupes et annonces en cercles creux. Axes = ceux de la vue, échangeables.

function VarianteC({ E }: { E: Etat }) {
  const [a, b] = AXES_VUE[E.vue];
  const inv = un(E.sp.inv) === "1";
  const [mx, my] = inv ? [b, a] : [a, b];
  const ouvert = new Set((un(E.sp.ouvert) ?? "").split("~").filter(Boolean));
  const visibles: Noeud[] = [];
  const pousser = (n: Noeud) => { visibles.push(n); if (ouvert.has(n.l.id)) n.l.enfants.forEach((e) => pousser(noeud(E.plat, e.id)!)); };
  noeuds(E.plat).filter((n) => n.prof === 0 && duType(E)(n)).sort((x, y) => y.l.t.cout - x.l.t.cout).forEach(pousser);
  const cochees = cochage(E, visibles.filter((n) => n.prof === 0), mx).filter(Boolean);
  const brut = tous(E.sp.comparer);
  const vraies = brut.length ? (brut.includes("_") ? [] : brut.filter((id) => noeud(E.plat, id)).slice(0, MAX)) : cochees;
  const deplier = (id: string) => { const n = new Set(ouvert); if (n.has(id)) n.delete(id); else n.add(id); return lien(E.sp, { ouvert: [...n].join("~") || undefined }); };
  const melange = new Set(vraies.map((id) => noeud(E.plat, id)!.prof)).size > 1;
  const choixCourbe: Axe[] = [mx, my];
  const lu = un(E.sp.courbe) as Axe | undefined;
  const m = lu && choixCourbe.includes(lu) ? lu : mx;
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Pastilles E={E} cle="type" valeurs={["tous", "0", "1"] as ("tous" | "0" | "1")[]} actuelle={E.type} noms={typeNoms(E)} retire={["ouvert"]} />
        <Link href={lien(E.sp, { inv: inv ? undefined : "1" })} scroll={false} className="rounded-full border border-line bg-white px-3 py-1 text-[12.5px] text-ink hover:border-ink/30">⇄ Échanger les axes</Link>
        <span className="text-[12px] text-muted">Déplie une ligne pour cocher ses {NOMS[E.plat].niveaux[1].toLowerCase()} ou ses {NOMS[E.plat].niveaux[2].toLowerCase()}.</span>
      </div>
      <div className="max-h-[340px] overflow-y-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-line text-left text-[12px] text-muted">
              <th className="w-10 px-3 py-2" />
              <th className="px-2 py-2 font-medium">Nom</th>
              <th className="px-2 py-2 font-medium">{NOMS[E.plat].type}</th>
              <th className="px-3 py-2 text-right font-medium">{M(mx).nom} →</th>
              <th className="px-3 py-2 text-right font-medium">↑ {M(my).nom}</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((n) => {
              const k = vraies.indexOf(n.l.id);
              return (
                <tr key={n.l.id} className={`border-b border-line/60 ${n.prof ? "bg-canvas/40" : ""}`}>
                  <td className="px-3 py-1.5"><Link href={basculer(E, vraies, n.l.id)} scroll={false} aria-label="Cocher"><Case k={k} /></Link></td>
                  <td className="px-2 py-1.5">
                    <span className="flex items-center gap-1.5" style={{ paddingLeft: n.prof * 18 }}>
                      {n.l.enfants.length
                        ? <Link href={deplier(n.l.id)} scroll={false} className="flex h-5 w-5 items-center justify-center rounded hover:bg-canvas"><Icone nom="chevron" className={`h-3.5 w-3.5 ${ouvert.has(n.l.id) ? "" : "-rotate-90"}`} /></Link>
                        : <span className="w-5" />}
                      <span className={n.prof ? "text-ink/85" : "font-medium text-ink"}>{n.l.nom}</span>
                      {n.prof > 0 && <span className="text-[11.5px] text-muted">· {n.l.niveau}</span>}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-[12px] text-muted">{n.prof === 0 ? typeCourt(E, n) : ""}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{M(mx).calc(n.l.t) === null ? "—" : M(mx).fmt(M(mx).calc(n.l.t)!)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{M(my).calc(n.l.t) === null ? "—" : M(my).fmt(M(my).calc(n.l.t)!)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {melange && <p className="mt-2 text-[12px] text-[#9a5b00]">Tu compares des niveaux différents : une campagne pèse forcément plus que l&apos;un de ses groupes.</p>}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Nuage mx={mx} my={my} note="Tout ce qui est déplié est placé. En gris : non coché ; cercle creux : groupe ou annonce."
          points={visibles.map((n) => ({ id: n.l.id, nom: n.l.nom, t: n.l.t, creux: n.prof > 0, couleur: vraies.includes(n.l.id) ? COULEURS[vraies.indexOf(n.l.id)] : undefined }))} />
        <Courbe E={E} cle="courbe" m={m} choix={choixCourbe} cochees={vraies.map((id) => noeud(E.plat, id)!.l)} />
      </div>
    </>
  );
}

// ── LE MODULE ────────────────────────────────────────────────────────────────

export const VARIANTES = [
  { cle: "M", nom: "Meta aujourd'hui" },
  { cle: "A", nom: "Réglages" },
  { cle: "B", nom: "Descendre d'un cran" },
  { cle: "C", nom: "La liste se déplie" },
];

export function ComparaisonNeuve({ sp, vue, av }: { sp: SP; vue: Vue; av: "A" | "B" | "C" }) {
  const E = lire(sp, vue);
  const sous = {
    A: "Règle le niveau et les deux métriques, coche jusqu'à quatre lignes : le nuage les place sur toute la période, la courbe les suit jour par jour.",
    B: "Coche jusqu'à quatre lignes : le nuage les place sur la période, la courbe les suit jour par jour. Descends d'un cran depuis une ligne cochée.",
    C: "Coche jusqu'à quatre lignes, à n'importe quel niveau : le nuage place tout ce qui est déplié, la courbe suit les cochées jour par jour.",
  }[av];
  return (
    <section id="comparaison">
      <Titre titre="Comparaison" sous={sous} droite={<Plateforme E={E} />} />
      {av === "A" && <VarianteA E={E} />}
      {av === "B" && <VarianteB E={E} />}
      {av === "C" && <VarianteC E={E} />}
      <p className="mt-2 text-[11.5px] text-muted">Période du Bandeau : {jourCourt(dateDu(0))} – {jourCourt(dateDu(JOURS - 1))}.</p>
    </section>
  );
}
