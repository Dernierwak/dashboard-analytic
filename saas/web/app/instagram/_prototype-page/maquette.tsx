// PROTOTYPE JETABLE — ticket « La page entière, en maquette »
// (.scratch/instagram/issues/13-la-page-entiere-en-maquette.md). Ne part
// jamais sur `main` : il vit sur la branche `prototype/instagram-page`.
//
// Version retenue par David (2026-11-06, « part avec ça ») : une rangée par
// format — le nuage des posts de la période sur la bande de son année, et à
// droite ses moustaches pesées (12 mois, la référence ; 3 derniers mois ;
// dernier mois) — et à droite du module, les 5 meilleurs posts de la période.
// Dessous, le Tableau de tous les posts, triable par date, exportable.
// `?etat=neuf|jeton|gratuit` simule les états ; `?ex=0` retire la Tendance
// d'exemple.
//
// Le calcul de base vient du prototype du carré (`calcul.ts`, ticket 12).
import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { lireToutesLesPages } from "@/lib/meta/lecture";
import { lienDash } from "@/lib/liens";
import type { DashParams, FollowerPoint, InstaPost } from "@/lib/channels";
import { NEUTRE } from "@/lib/palette";
import {
  METRIQUES,
  MINIMUM,
  age,
  fmt,
  foules,
  placeEcrite,
  selection,
  type Foule,
  type Mode,
  type Place,
  type PostLu,
} from "../_prototype-selection/calcul";

type SP = DashParams & Record<string, string | string[] | undefined>;

const JOUR = 86400_000;

const POS = "#1a7a4a";
const NEG = "#c0392b";
const COULEUR_FORMAT: Record<string, string> = {
  Reel: "#7b4fff",
  Carrousel: "#1a56ff",
  Image: "#e08b1a",
  "Vidéo du fil": "#0d9aa8",
};

const lien = (sp: SP, patch: Record<string, string | undefined>) =>
  lienDash("/instagram", sp, patch as Partial<DashParams>, "reach");

const pluriel = (format: string, n: number) => (n > 1 && !format.endsWith("fil") ? `${format}s` : format);
const dateCourte = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" }) : "–";

// ── L'OBJECTIF (ticket 01) ET SES MÉTRIQUES (tickets 09, 11) ────────────────
// Une métrique sans `cle` n'est pas en base : grisée avec sa raison (§7).

type Metrique = { cle: string | null; nom: string; pourquoi?: string; definition?: string };
const OBJECTIFS: { cle: string; nom: string; metriques: Metrique[] }[] = [
  {
    cle: "portee",
    nom: "Portée",
    metriques: [
      { cle: "reach", nom: "Portée", definition: "le nombre de comptes qui ont vu le post au moins une fois" },
      { cle: "views", nom: "Vues", definition: "le nombre de fois que le post a été vu, revues comprises" },
      { cle: null, nom: "Portée ÷ abonnés", pourquoi: "il faut les abonnés au jour du post : le relevé quotidien n'existe pas encore" },
    ],
  },
  {
    cle: "engagement",
    nom: "Engagement",
    metriques: [
      { cle: "eng", nom: "Engagement", definition: "(j'aime + commentaires + enregistrements) ÷ portée — sur 100 comptes touchés, combien ont réagi" },
      { cle: "likes", nom: "J'aime", definition: "le nombre de j'aime" },
      { cle: "comments", nom: "Commentaires", definition: "le nombre de commentaires" },
      { cle: "saved", nom: "Enregistrements", definition: "le nombre de comptes qui ont gardé le post" },
      { cle: null, nom: "Partages", pourquoi: "`shares` n'est pas récolté" },
    ],
  },
  {
    cle: "abonnes",
    nom: "Abonnés",
    metriques: [
      { cle: null, nom: "Abonnés gagnés", pourquoi: "`follows` par post n'est pas en base (et Meta ne le rend jamais pour un Reel)" },
      { cle: null, nom: "Pour 1 000 comptes touchés", pourquoi: "même raison : pas de `follows` en base" },
    ],
  },
];

// ── LA FOULE ET SA RÉFÉRENCE ────────────────────────────────────────────────
// David, tour 3 : la référence d'un format est l'année — ses posts des 12
// derniers mois de plus de 48 h, « ça prend vraiment tous les posts », sans
// l'effet Noël puis janvier. 12 mois GLISSANTS : janvier ne remet rien à zéro.
// Elle ne dépend pas de la période affichée, qui ne choisit que les posts posés
// dessus. Remplace « sur la période » du ticket 06 (et les « 20 derniers posts »
// du tour 2).

type FouleN = Foule & {
  /** Valeurs de la référence qu'un filtre écarte (points creux). */
  refEcartes: number[];
  refDe: string | null;
  refA: string | null;
};

// statistics.quantiles(method="exclusive") — même calcul que `calcul.ts`.
function quartiles(v: number[]): { q1: number; med: number; q3: number } | null {
  if (v.length < MINIMUM) return null;
  const d = [...v].sort((a, b) => a - b);
  const m = d.length + 1;
  const q = [1, 2, 3].map((i) => {
    const j = Math.floor((i * m) / 4);
    const delta = i * m - j * 4;
    return (d[j - 1] * (4 - delta) + d[j] * delta) / 4;
  });
  return { q1: q[0], med: q[1], q3: q[2] };
}

type Reference = { n: number } | { jours: number };

function foulesN(historique: InstaPost[], fenetre: InstaPost[], cle: string, sansHorsNorme: boolean, reference: Reference, maintenant: number): FouleN[] {
  const hist = foules(historique, cle, false, maintenant);
  return foules(fenetre, cle, false, maintenant).map((fv) => {
    const ref = (hist.find((h) => h.format === fv.format)?.lus ?? [])
      .filter((l) => l.dehors === null)
      .sort((a, b) => b.post.date.localeCompare(a.post.date))
      .filter((l) => !("jours" in reference) || maintenant - new Date(l.post.date).getTime() <= reference.jours * 86400_000)
      .slice(0, "n" in reference ? reference.n : undefined);
    let gardes = ref.map((l) => l.valeur!);
    let refEcartes: number[] = [];
    let q = quartiles(gardes);
    let bornes: { bas: number; haut: number } | null = null;
    if (q) {
      const ecart = 1.5 * (q.q3 - q.q1);
      const b = { bas: q.q1 - ecart, haut: q.q3 + ecart };
      bornes = b;
      if (sansHorsNorme) {
        refEcartes = gardes.filter((v) => v < b.bas || v > b.haut);
        gardes = gardes.filter((v) => v >= b.bas && v <= b.haut);
        q = quartiles(gardes);
      }
    }
    const lus: PostLu[] = fv.lus.map((l) => {
      if (l.dehors !== null || !bornes) return { ...l, place: null, horsNorme: null, ecarte: false };
      const v = l.valeur!;
      const horsNorme = v > bornes.haut ? "haut" : v < bornes.bas ? "bas" : null;
      const place: Place | null = q
        ? v < q.q1 ? "en dessous" : v < q.med ? "bas de tes habitudes" : v <= q.q3 ? "haut de tes habitudes" : "au-dessus"
        : null;
      return { ...l, horsNorme, place, ecarte: sansHorsNorme && horsNorme !== null };
    });
    return {
      format: fv.format,
      lus,
      valeurs: gardes,
      nAvant: ref.length,
      q,
      refEcartes,
      refDe: ref.length ? ref[ref.length - 1].post.date.slice(0, 10) : null,
      refA: ref.length ? ref[0].post.date.slice(0, 10) : null,
    };
  });
}

function placeN(l: PostLu, f: FouleN | undefined): string {
  if (!l.dehors && f && !f.q) return `pas de place — ${f.nAvant} ${pluriel(f.format, f.nAvant)} lus en tout, il en faut ${MINIMUM}`;
  return placeEcrite(l, f);
}

type Lecture = {
  sp: SP;
  objectif: (typeof OBJECTIFS)[number];
  metrique: Metrique;
  cle: string | null;
  /** Les formats de la période, placés contre leur année. */
  fs: FouleN[];
  /** La liste de droite : sa portée, ses formats, ses posts. */
  portee: "periode" | "an" | "tout";
  fsListe: FouleN[];
  sel: PostLu[];
  /** Le Tableau : la période ou tout l'historique. */
  fsTableau: FouleN[];
  mode: Mode;
  choisis: string[];
  sansHorsNorme: boolean;
  posts: InstaPost[];
  serie: FollowerPoint[];
  debut: string;
  fin: string;
  ouvert: PostLu | undefined;
  places: { nom: string; texte: string; valeur: string }[];
  /** id du post → son lien public Instagram (`permalink`), pour le lecteur. */
  liens: Map<string, string>;
  exemple: boolean;
  fige: boolean;
  /** Les moustaches d'évolution : 3 derniers mois, dernier mois. */
  recents: Map<string, { trois?: FouleN; un?: FouleN }>;
};

/** Ce contre quoi un post est placé, en mots. */
function refTexte(_L: Lecture, f: FouleN | undefined, format: string): string {
  return `tes ${pluriel(format, 2)} des 12 derniers mois (${f?.valeurs.length ?? 0})`;
}

function formatDe(L: Lecture, format: string): FouleN | undefined {
  return L.fsListe.find((f) => f.format === format) ?? L.fs.find((f) => f.format === format) ?? L.fsTableau.find((f) => f.format === format);
}


// `permalink` est en base mais `getInstaDash` ne le lit pas : la maquette va le
// chercher elle-même plutôt que de toucher `lib/channels.ts`.
async function lirePermaliens(): Promise<Map<string, string>> {
  try {
    const supabase = createClient();
    const compte = await getCompteActif();
    const rangs = await lireToutesLesPages<Record<string, unknown>>((de, a) =>
      supabase.from("instagram_organic_posts").select("id, permalink").eq("user_id", compte.uid).order("id").range(de, a)
    );
    return new Map(rangs.filter((r) => r.permalink).map((r) => [String(r.id), String(r.permalink)]));
  } catch {
    return new Map();
  }
}

// ── L'ENTRÉE ────────────────────────────────────────────────────────────────

export async function PrototypePage({
  posts: postsReels,
  historique: historiqueReel,
  serie: serieReelle,
  debut,
  fin,
  sp,
}: {
  posts: InstaPost[];
  historique: InstaPost[];
  serie: FollowerPoint[];
  debut: string;
  fin: string;
  sp: SP;
}) {
  const etat = String(sp.etat ?? "");
  // Le compte gratuit ne suit que les 10 derniers posts (`sync.py:_a_relire`).
  const posts = etat === "neuf" ? [] : etat === "gratuit" ? postsReels.slice(0, 10) : postsReels;
  const historique = etat === "neuf" ? [] : etat === "gratuit" ? historiqueReel.slice(0, 10) : historiqueReel;
  const serie = etat === "neuf" ? [] : serieReelle;

  const objectif = OBJECTIFS.find((o) => o.cle === sp.obj) ?? OBJECTIFS[0];
  const metrique =
    objectif.metriques.find((m) => m.cle !== null && m.cle === sp.pm) ??
    objectif.metriques.find((m) => m.cle !== null) ??
    objectif.metriques[0];
  const cle = metrique.cle;
  const mode: Mode = "haut";
  const sansHorsNorme = sp.phn === "1";
  const choisis = String(sp.ps ?? "").split(",").filter(Boolean).slice(0, 5);
  const maintenant = Date.now();
  const annee: Reference = { jours: 365 };
  const lire = (fenetre: InstaPost[], c: string, ref: Reference = annee) =>
    foulesN(historique, fenetre, c, sansHorsNorme, ref, maintenant).filter((f) => f.lus.length > 0);

  // David : la liste de droite ne montre que les 5 meilleurs de la période ;
  // les meilleurs de tout l'historique se trouvent en triant le Tableau, qui
  // porte toujours tous les posts.
  const portee = "periode" as const;
  const fs = cle ? lire(posts, cle) : [];
  const fsListe = fs;
  const sel = cle ? selection(fs, "haut", [], 5) : [];
  const fsTableau = !cle ? [] : lire(historique, cle);

  const tousLus = foules(historique, "reach", false, maintenant).flatMap((f) => f.lus);
  const ouvert = sp.post
    ? ([...fs, ...fsListe, ...fsTableau].flatMap((f) => f.lus).find((l) => l.post.id === sp.post) ?? tousLus.find((l) => l.post.id === sp.post))
    : undefined;
  const places = ouvert
    ? METRIQUES.map((m) => {
        const f = foulesN(historique, [ouvert.post], m.cle, sansHorsNorme, annee, maintenant).find((x) => x.format === ouvert.post.type);
        const l = f?.lus[0];
        return { nom: m.nom, valeur: fmt(l?.valeur ?? null, m.cle), texte: l ? placeN(l, f) : "–" };
      })
    : [];
  const liens = await lirePermaliens();

  const recents = new Map<string, { trois?: FouleN; un?: FouleN }>();
  if (cle) {
    const trois = foulesN(historique, posts, cle, sansHorsNorme, { jours: 90 }, maintenant);
    const un = foulesN(historique, posts, cle, sansHorsNorme, { jours: 30 }, maintenant);
    for (const f of fs) recents.set(f.format, { trois: trois.find((x) => x.format === f.format), un: un.find((x) => x.format === f.format) });
  }

  const L: Lecture = {
    sp, objectif, metrique, cle, fs, portee, fsListe, sel, fsTableau, mode, choisis, sansHorsNorme, posts, serie, debut, fin, ouvert, places, liens,
    exemple: sp.ex !== "0" && etat !== "neuf",
    fige: etat === "jeton",
    recents,
  };

  return (
    <section className="mt-4">
      <BandeauMaquette sp={sp} etat={etat} n={postsReels.length} />
      {L.fige && <JetonMort fin={fin} />}
      <div className={L.fige ? "pointer-events-none select-none opacity-60 grayscale-[35%]" : ""}>
        <div className="grid gap-8">
          <section>
            <Titre titre="Ta page" droite={L.fige ? <Fige fin={fin} /> : undefined} />
            <Tendance L={L} />
          </section>
          {L.posts.length === 0 ? (
            <CompteNeuf />
          ) : (
            <>
              <SelecteurObjectif L={L} />
              {!L.cle ? <SansMetrique L={L} /> : <PageD L={L} />}
              <section>
                <Titre titre="Tous tes posts" />
                <Tableau L={L} />
              </section>
            </>
          )}
        </div>
      </div>
      {ouvert && <PanneauLateral L={L} />}
    </section>
  );
}

function BandeauMaquette({ sp, etat, n }: { sp: SP; etat: string; n: number }) {
  const etats = [
    { cle: undefined, nom: "Normal" },
    { cle: "gratuit", nom: "Compte gratuit (10 posts)" },
    { cle: "neuf", nom: "Compte neuf" },
    { cle: "jeton", nom: "Jeton mort" },
  ];
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-dashed border-[#7b4fff66] bg-[#7b4fff0d] px-3 py-2 text-[11.5px] text-muted">
      <span>
        <b className="text-ink">Prototype jetable</b> — la version retenue,
        sur les {n} posts de la période.
      </span>
      <span className="inline-flex flex-wrap gap-1">
        {etats.map((e) => (
          <a key={e.nom} href={lien(sp, { etat: e.cle, post: undefined })} className={`rounded-full border px-2 py-0.5 ${(e.cle ?? "") === etat ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
            {e.nom}
          </a>
        ))}
      </span>
      <a href={lien(sp, { ex: sp.ex === "0" ? undefined : "0" })} className="rounded-full border border-line bg-white px-2 py-0.5">
        Tendance : {sp.ex === "0" ? "la base réelle (vide)" : "exemple inventé"} ⇄
      </a>
    </div>
  );
}

// ── LES ÉTATS ───────────────────────────────────────────────────────────────

function JetonMort({ fin }: { fin: string }) {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-[#b86b0040] bg-gradient-to-br from-[#fff6ea] via-white to-white shadow-card">
      <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:p-8">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b86b001a] text-[18px] text-warn">⏸</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-warn">Connexion Instagram expirée</span>
          </div>
          <h2 className="text-[24px] font-semibold leading-tight tracking-tight text-ink">Tes chiffres Instagram sont figés au {dateCourte(fin)}.</h2>
          <p className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-muted">
            Instagram ne laisse plus Pulse lire ton compte : l&apos;autorisation donnée a expiré. Rien n&apos;est perdu — tout ce qui a été lu
            reste juste, daté, et la page reprendra là où elle s&apos;est arrêtée.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a href="/comptes" className="pointer-events-auto rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-black">
              Reconnecter Instagram
            </a>
            <span className="text-[12px] text-faint">Une minute, chez Meta. Le prochain passage du worker (ton Jour de travail, 07:00 UTC) relit tout.</span>
          </div>
        </div>
        <div className="grid min-w-0 content-start gap-3 text-[13px]">
          <div className="rounded-xl border border-line bg-white p-4">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-pos">Ce qui reste juste</div>
            <p className="text-muted">Chaque chiffre affiché, tel qu&apos;il était à son dernier relevé — les posts, leurs places, les moustaches.</p>
          </div>
          <div className="rounded-xl border border-line bg-white p-4">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neg">Ce qui manque</div>
            <p className="text-muted">Les posts publiés depuis, et les jours du compte après le {dateCourte(fin)}. Ils seront lus à la reconnexion — Meta garde 90 jours.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fige({ fin }: { fin: string }) {
  return <span className="rounded-full bg-[#b86b001a] px-3 py-1 text-[11.5px] font-semibold text-warn">figé au {dateCourte(fin)}</span>;
}

function CompteNeuf() {
  return (
    <div className="rounded-2xl border border-line bg-white px-6 py-10 text-center">
      <p className="text-[15px] font-medium text-ink">Ton compte Instagram est branché. Aucun post n&apos;est encore lu.</p>
      <p className="mx-auto mt-2 max-w-[520px] text-[13px] text-muted">
        Le premier passage du worker (ton Jour de travail, 07:00 UTC) lira tes posts et les 90 jours de compte que Meta garde. Les moustaches
        apparaissent dès qu&apos;un format compte {MINIMUM} posts de plus de 48 h.
      </p>
    </div>
  );
}

// ── LES PIÈCES ──────────────────────────────────────────────────────────────

function Titre({ titre, sous, droite }: { titre: string; sous?: string; droite?: React.ReactNode }) {
  return (
    <div className="mb-3 flex min-w-0 flex-wrap items-end gap-3">
      <div className="min-w-0">
        <h2 className="text-[20px] font-semibold tracking-tight text-ink">{titre}</h2>
        {sous && <p className="mt-0.5 text-[13px] text-muted">{sous}</p>}
      </div>
      {droite && <div className="ml-auto">{droite}</div>}
    </div>
  );
}

function Pastille({ href, actif, children, title }: { href?: string; actif: boolean; children: React.ReactNode; title?: string }) {
  const cls = `shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
    actif ? "border-ink bg-ink text-white" : href ? "border-line bg-white text-muted hover:bg-black/[0.03]" : "cursor-not-allowed border-dashed border-line bg-white text-faint"
  }`;
  return href ? <a href={href} className={cls} title={title}>{children}</a> : <span className={cls} title={title}>{children}</span>;
}

function Vignette({ p, taille }: { p: InstaPost; taille: string }) {
  return p.mediaUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.mediaUrl} alt="" className={`${taille} shrink-0 rounded-lg border border-line object-cover`} />
  ) : (
    <div className={`${taille} shrink-0 rounded-lg border border-line bg-black/[0.04]`} />
  );
}

function teinte(l: PostLu): string {
  if (l.ecarte) return "#c9c9cf";
  if (l.horsNorme === "haut" || l.place === "au-dessus") return POS;
  if (l.horsNorme === "bas" || l.place === "en dessous") return NEG;
  return "#5a5d66";
}

// ── LA TENDANCE (ticket 10) ─────────────────────────────────────────────────
// Portée et interactions du compte ne sont pas en base. Pour juger la forme,
// la maquette dessine une série INVENTÉE, marquée « exemple » partout ; les
// jours de publication, eux, sont réels. `?ex=0` montre la base telle quelle.

function pseudo(i: number, graine: number): number {
  const x = Math.sin(i * 12.9898 + graine * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function serieExemple(jours: number, base: number, graine: number, publications: Set<number>): (number | null)[] {
  return Array.from({ length: jours }, (_, i) => {
    if (i === Math.floor(jours * 0.62)) return null; // un jour sans donnée : un trou, jamais un zéro
    const pic = publications.has(i) ? 0.55 : publications.has(i - 1) ? 0.3 : 0;
    return Math.round(base * (0.8 + 0.25 * Math.sin(i / 6 + graine) + 0.2 * pseudo(i, graine) + pic));
  });
}

function CourbeExemple({ nom, resume, courant, avant, jours, pubs, sp, posts, debut, barres, exemple, grand }: {
  nom: string;
  resume: string;
  courant: (number | null)[];
  avant: (number | null)[];
  jours: number;
  pubs: Set<number>;
  sp: SP;
  posts: InstaPost[];
  debut: string;
  barres?: { gagnes: number; perdus: number }[];
  exemple: boolean;
  grand?: boolean;
}) {
  const W = 460;
  const H = grand ? (barres ? 330 : 300) : barres ? 170 : 140;
  const bas = grand ? (barres ? 236 : 270) : barres ? 110 : 118;
  // Les barres gagnés / perdus vivent sous la courbe, sur leur propre ligne.
  const base = H - 24;
  const hGagnes = grand ? 44 : 22;
  const hPerdus = grand ? 28 : 16;
  const toutes = [...courant, ...avant].filter((v): v is number => v !== null);
  const min = barres ? Math.min(...toutes) : 0;
  const max = Math.max(...toutes, 1);
  const x = (i: number) => 10 + (i / Math.max(1, jours - 1)) * (W - 20);
  const y = (v: number) => bas - ((v - min) / (max - min || 1)) * (bas - 14);
  const trace = (s: (number | null)[]) => {
    const morceaux: string[] = [];
    let cur = "";
    s.forEach((v, i) => {
      if (v === null) { if (cur) morceaux.push(cur); cur = ""; return; }
      cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    });
    if (cur) morceaux.push(cur);
    return morceaux.join(" ");
  };
  const t0 = new Date(debut).getTime();
  const maxBarre = barres ? Math.max(...barres.map((b) => Math.max(b.gagnes, b.perdus)), 1) : 1;
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">{nom}</span>
        {exemple && <span className="rounded bg-[#e8590c1a] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[#c2410c]">exemple inventé</span>}
      </div>
      <div className="mt-0.5 font-mono text-[22px] font-medium text-ink">{resume}</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="block" role="img" aria-label={nom}>
        {toutes.length > 0 ? (
          <>
            <path d={trace(avant)} fill="none" stroke={NEUTRE.trait} strokeWidth={1.5} strokeDasharray="4 4" />
            <path d={trace(courant)} fill="none" stroke="#7b4fff" strokeWidth={2} />
            {courant.length >= 2 && courant[jours - 1] !== null && (
              <circle cx={x(jours - 1)} cy={y(courant[jours - 1]!)} r={3.5} fill="#fff" stroke="#7b4fff" strokeWidth={1.5}>
                <title>Les 48 dernières heures peuvent encore changer</title>
              </circle>
            )}
          </>
        ) : (
          <text x={W / 2} y={bas / 2 + 4} fontSize={11} fill="#8b8e98" textAnchor="middle">pas en base pour cette période</text>
        )}
        {barres?.map((b, i) => (
          <g key={i}>
            <rect x={x(i) - 1.6} y={base - (b.gagnes / maxBarre) * hGagnes} width={3.2} height={(b.gagnes / maxBarre) * hGagnes} fill={POS} opacity={0.7} />
            <rect x={x(i) - 1.6} y={base} width={3.2} height={(b.perdus / maxBarre) * hPerdus} fill={NEG} opacity={0.7} />
          </g>
        ))}
        <line x1={10} x2={W - 10} y1={barres ? base : bas + 6} y2={barres ? base : bas + 6} stroke={NEUTRE.trait} strokeOpacity={0.4} />
        {!barres && posts.map((p) => {
          const i = Math.round((new Date(p.date).getTime() - t0) / 86400_000);
          if (i < 0 || i >= jours) return null;
          return (
            <a key={p.id} href={lien(sp, { post: p.id })}>
              <circle cx={x(i)} cy={bas + 15} r={3} fill={COULEUR_FORMAT[p.type] ?? NEUTRE.trait}><title>{`${p.type} — ouvrir le post`}</title></circle>
            </a>
          );
        })}
      </svg>
      {grand && (
        <p className="mt-1 text-[11px] leading-snug text-faint">
          {barres
            ? "Total d'abonnés, jour après jour ; dessous, les gagnés (vert) et les perdus (rouge) de chaque jour."
            : "Trait plein : la période. Pointillé : la période d'avant. Points : tes publications, cliquables. Un trou = un jour sans donnée."}
        </p>
      )}
    </div>
  );
}

function Tendance({ L }: { L: Lecture }) {
  const t0 = new Date(L.debut).getTime();
  const jours = Math.max(7, Math.round((new Date(L.fin).getTime() - t0) / 86400_000) + 1);
  const pubs = new Set(L.posts.map((p) => Math.round((new Date(p.date).getTime() - t0) / 86400_000)));
  const commun = { jours, pubs, sp: L.sp, posts: L.posts, debut: L.debut, exemple: L.exemple };
  if (!L.exemple) {
    const vide = Array<number | null>(jours).fill(null);
    return (
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <CourbeExemple nom="Abonnés" resume="–" courant={vide} avant={vide} grand {...commun} />
        <div className="grid min-w-0 gap-3">
          <CourbeExemple nom="Portée du compte" resume="–" courant={vide} avant={vide} {...commun} />
          <CourbeExemple nom="Interactions du compte" resume="–" courant={vide} avant={vide} {...commun} />
        </div>
      </div>
    );
  }
  const portee = serieExemple(jours, 4200, 1, pubs);
  const porteeAvant = serieExemple(jours, 3700, 7, new Set());
  const inter = serieExemple(jours, 310, 3, pubs);
  const interAvant = serieExemple(jours, 280, 9, new Set());
  const mouvements = Array.from({ length: jours }, (_, i) => ({
    gagnes: Math.round(40 + 60 * pseudo(i, 4) + (pubs.has(i) ? 70 : 0)),
    perdus: Math.round(15 + 30 * pseudo(i, 5)),
  }));
  let total = 76000;
  const abonnes = mouvements.map((m) => (total += m.gagnes - m.perdus));
  const mesure = (s: (number | null)[]) => s.filter((v): v is number => v !== null);
  const moy = Math.round(mesure(portee).reduce((a, b) => a + b, 0) / mesure(portee).length);
  const somme = mesure(inter).reduce((a, b) => a + b, 0);
  const net = abonnes[abonnes.length - 1] - 76000;
  const nf = (v: number) => v.toLocaleString("fr-CH");
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <CourbeExemple nom="Abonnés" resume={`${nf(abonnes[abonnes.length - 1])} · ${net >= 0 ? "+" : "−"}${nf(Math.abs(net))} sur la période`} courant={abonnes} avant={[]} barres={mouvements} grand {...commun} />
      <div className="grid min-w-0 gap-3">
        <CourbeExemple nom="Portée du compte" resume={`${nf(moy)} / jour en moyenne`} courant={portee} avant={porteeAvant} {...commun} />
        <CourbeExemple nom="Interactions du compte" resume={`${nf(somme)} sur la période`} courant={inter} avant={interAvant} {...commun} />
      </div>
    </div>
  );
}

// ── L'OBJECTIF ET LES RÈGLES DE LECTURE ─────────────────────────────────────

function SelecteurObjectif({ L }: { L: Lecture }) {
  const { sp } = L;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex rounded-full border border-line bg-white p-0.5">
        {OBJECTIFS.map((o) => (
          <a key={o.cle} href={lien(sp, { obj: o.cle, pm: undefined })} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${o.cle === L.objectif.cle ? "bg-ig text-white" : "text-muted hover:text-ink"}`}>
            {o.nom}
          </a>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {L.objectif.metriques.map((m) => (
          <Pastille key={m.nom} href={m.cle ? lien(sp, { pm: m.cle }) : undefined} actif={m.cle !== null && m.cle === L.cle} title={m.pourquoi}>
            {m.nom}{!m.cle && " · pas en base"}
          </Pastille>
        ))}
      </div>
      <details className="relative ml-auto">
        <summary className="cursor-pointer list-none rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-muted">
          Règles de lecture{L.sansHorsNorme && <span className="text-ink"> · 1</span>}
        </summary>
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-line bg-white p-3 text-[12px] shadow-lg">
          <a href={lien(L.sp, { phn: L.sansHorsNorme ? undefined : "1" })} className="flex items-center gap-2 py-1 text-ink">
            <span className={`h-3.5 w-3.5 rounded border ${L.sansHorsNorme ? "border-ink bg-ink" : "border-faint"}`} /> Sans les hors norme
          </a>
          <span className="flex items-center gap-2 py-1 text-faint">
            <span className="h-3.5 w-3.5 rounded border border-line" /> Sans les boostés <i>(pas branché)</i>
          </span>
        </div>
      </details>
    </div>
  );
}

function SansMetrique({ L }: { L: Lecture }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-8 text-center text-[13px] text-muted">
      <b className="text-ink">{L.metrique.nom}</b> : Instagram le rend, Pulse ne le récolte pas encore — {L.metrique.pourquoi}.
      <br />Aucune moustache tant que la récolte ne le lit pas.
    </div>
  );
}

function PhraseEcartes({ L }: { L: Lecture }) {
  if (!L.sansHorsNorme) return null;
  const parFormat = L.fs.filter((f) => f.refEcartes.length > 0);
  const total = parFormat.reduce((s, f) => s + f.refEcartes.length, 0);
  return (
    <p className="mb-3 text-[12px] text-muted">
      {total === 0
        ? `Aucun post hors norme sur ${L.metrique.nom.toLowerCase()} : rien n'est écarté. `
        : `${total} post${total > 1 ? "s" : ""} hors norme écarté${total > 1 ? "s" : ""} — ${parFormat
            .map((f) => `moustache sur ${f.valeurs.length} ${pluriel(f.format, f.valeurs.length)} au lieu de ${f.nAvant}`)
            .join(", ")}. `}
      <a href={lien(L.sp, { phn: undefined })} className="font-semibold text-ink underline decoration-line underline-offset-2">Revenir aux règles standard</a>
    </p>
  );
}


// ── LES GRAPHES ─────────────────────────────────────────────────────────────

/** Moustache horizontale : la référence en petits points, le post en gros. */
function MoustacheH({ f, cle, marques = [], haut = 34 }: { f: FouleN; cle: string; marques?: { l: PostLu }[]; haut?: number }) {
  const W = 300;
  const M = 10;
  const Y = haut / 2 + 2;
  const posees = marques.filter(({ l }) => l.dehors === null && l.valeur !== null).map(({ l }) => l.valeur!);
  const tout = [...f.valeurs, ...f.refEcartes, ...posees];
  const min = Math.min(...tout);
  const max = Math.max(...tout);
  const pad = (max - min) * 0.04 || 1;
  const x = (v: number) => M + ((v - (min - pad)) / (max - min + 2 * pad)) * (W - 2 * M);
  return (
    <svg viewBox={`0 0 ${W} ${haut}`} width="100%" className="block" role="img" aria-label={`Place parmi les ${f.format}`}>
      {f.valeurs.length > 0 && <line x1={x(Math.min(...f.valeurs))} x2={x(Math.max(...f.valeurs))} y1={Y} y2={Y} stroke={NEUTRE.trait} strokeOpacity={0.6} strokeWidth={1.5} />}
      {f.q && (
        <>
          <rect x={x(f.q.q1)} y={Y - 8} width={Math.max(3, x(f.q.q3) - x(f.q.q1))} height={16} rx={4} fill={NEUTRE.aplat} />
          <line x1={x(f.q.med)} x2={x(f.q.med)} y1={Y - 11} y2={Y + 11} stroke="#5a5d66" strokeWidth={2} strokeLinecap="round" />
        </>
      )}
      {f.valeurs.map((v, i) => <circle key={i} cx={x(v)} cy={Y} r={2} fill={NEUTRE.trait} />)}
      {f.refEcartes.map((v, i) => <circle key={`e${i}`} cx={x(v)} cy={Y} r={2} fill="none" stroke={NEUTRE.trait} />)}
      {marques.filter(({ l }) => l.dehors === null && l.valeur !== null).map(({ l }) => (
        <circle key={l.post.id} cx={x(l.valeur!)} cy={Y} r={6.5} fill={teinte(l)} stroke="#fff" strokeWidth={2.5}>
          <title>{fmt(l.valeur, cle)}</title>
        </circle>
      ))}
    </svg>
  );
}

// ── LA SÉLECTION ────────────────────────────────────────────────────────────



const CHIFFRES = [
  { cle: "reach", nom: "Portée" },
  { cle: "views", nom: "Vues" },
  { cle: "likes", nom: "J'aime" },
  { cle: "comments", nom: "Comm." },
  { cle: "saved", nom: "Enreg." },
  { cle: "eng", nom: "Eng." },
];

function valeurCellule(p: InstaPost, cle: string): string {
  const x = (p as unknown as Record<string, number | null>)[cle];
  if (x === null || ((cle === "views" || cle === "reach") && x === 0)) return "–";
  if (cle === "likes" && p.type === "Reel" && x === 0) return "–";
  return fmt(x, cle);
}

/** Le média du post : l'image en base ; un Reel ou une vidéo se lit dans le
 *  lecteur public d'Instagram (`?video=`), seul moyen sans garder la vidéo. */
function Media({ L, l, hauteur }: { L: Lecture; l: PostLu; hauteur: string }) {
  const p = l.post;
  const permalien = L.liens.get(p.id);
  const video = p.type === "Reel" || p.type === "Vidéo du fil";
  if (video && permalien && L.sp.video === p.id) {
    return (
      <iframe src={`${permalien.replace(/\/?$/, "/")}embed`} className="h-[560px] w-full rounded-t-xl border-0 bg-black" allow="autoplay; encrypted-media" title="Lecteur Instagram" />
    );
  }
  return (
    <div className="relative">
      <Vignette p={p} taille={`${hauteur} w-full rounded-none border-0`} />
      {video && permalien && (
        <a href={`${lien(L.sp, { video: p.id })}#carte-${p.id}`} className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/25" aria-label="Lire la vidéo">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-[18px] text-ink shadow-lg">▶</span>
        </a>
      )}
      <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: COULEUR_FORMAT[p.type] }}>
        {p.type}
      </span>
    </div>
  );
}

function CartePost({ L, l, n, compacte }: { L: Lecture; l: PostLu; n: number; compacte?: boolean }) {
  const f = formatDe(L, l.post.type);
  return (
    <div id={`carte-${l.post.id}`} className="min-w-0 scroll-mt-20 overflow-hidden rounded-xl border border-line bg-white">
      {!compacte && <Media L={L} l={l} hauteur="h-56" />}
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: COULEUR_FORMAT[l.post.type] }}>{n}</span>
          {compacte && <Vignette p={l.post} taille="h-10 w-10" />}
          <span className="text-[10.5px] text-faint">{dateCourte(l.post.date)} · {age(l.ageH)} {l.recent && <span title="peut encore changer">◔</span>}</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="font-mono text-[22px] text-ink">{fmt(l.valeur, L.cle!)}</span>
          <span className="text-[11px] text-faint">{L.metrique.nom.toLowerCase()}</span>
        </div>
        <div className="text-[12px] font-semibold" style={{ color: teinte(l) }}>{placeN(l, f)}</div>
        {f?.q && l.dehors === null && (
          <div className="mt-1">
            <MoustacheH f={f} cle={L.cle!} marques={[{ l }]} />
            <div className="flex justify-between text-[9.5px] text-faint">
              <span>parmi {refTexte(L, f, f.format)}</span>
              <span>post type {fmt(f.q.med, L.cle!)}</span>
            </div>
          </div>
        )}
        <p className={`mt-2 text-[12px] leading-snug text-muted ${compacte ? "line-clamp-2" : "line-clamp-3"}`}>{l.post.caption || "(sans légende)"}</p>
        {!compacte && (
          <dl className="mt-2.5 grid grid-cols-3 gap-1 text-[11px]">
            {CHIFFRES.map((c) => (
              <div key={c.cle} className={`rounded-md px-2 py-1 ${c.cle === L.cle ? "bg-[#7b4fff14]" : "bg-canvas"}`}>
                <dt className="text-faint">{c.nom}</dt>
                <dd className="font-mono text-ink">{valeurCellule(l.post, c.cle)}</dd>
              </div>
            ))}
          </dl>
        )}
        <a href={lien(L.sp, { post: l.post.id })} className="mt-2.5 inline-block text-[11.5px] font-semibold text-ink underline decoration-line underline-offset-2">Lire le post</a>
      </div>
    </div>
  );
}

// ── LE TABLEAU DES POSTS ────────────────────────────────────────────────────

const nombreBrut = (p: InstaPost, cle: string): number | null => {
  const x = (p as unknown as Record<string, number | null>)[cle];
  if (x === null || ((cle === "views" || cle === "reach") && x === 0)) return null;
  if (cle === "likes" && p.type === "Reel" && x === 0) return null;
  return x;
};

/** Le fichier pour Excel : point-virgule (Excel en français), BOM pour les
 *  accents ; une absence reste une cellule vide, jamais un 0. */
function csvDe(L: Lecture, rangs: PostLu[]): string {
  const cellule = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const tete = ["Date", "Format", "Légende", ...CHIFFRES.map((c) => c.nom), `Place (${L.metrique.nom.toLowerCase()})`, "Lien"];
  const lignes = rangs.map((l) => [
    l.post.date.slice(0, 10),
    l.post.type,
    l.post.caption.replace(/\s+/g, " ").trim(),
    ...CHIFFRES.map((c) => {
      const v = nombreBrut(l.post, c.cle);
      return v === null ? "" : c.cle === "eng" ? v.toFixed(2).replace(".", ",") : String(v);
    }),
    L.cle ? placeN(l, L.fsTableau.find((f) => f.format === l.post.type)) : "",
    L.liens.get(l.post.id) ?? "",
  ]);
  return "\ufeff" + [tete, ...lignes].map((r) => r.map(cellule).join(";")).join("\r\n");
}

function Tableau({ L }: { L: Lecture }) {
  const lus = L.cle ? L.fsTableau.flatMap((f) => f.lus) : foules(L.posts, "reach", false, Date.now()).flatMap((f) => f.lus);
  const s = String(L.sp.s ?? "date");
  const v = (l: PostLu) => nombreBrut(l.post, s) ?? -1;
  const rangs =
    s === "date-asc" ? lus.sort((a, b) => a.post.date.localeCompare(b.post.date))
    : CHIFFRES.some((c) => c.cle === s) ? lus.sort((a, b) => v(b) - v(a))
    : lus.sort((a, b) => b.post.date.localeCompare(a.post.date));
  const triDate = s === "date" || s === "date-asc";
  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 text-[12px]">
        <span className="font-semibold text-ink">{rangs.length} posts</span>
        <span className="text-faint">· tout ton historique · place lue en {L.metrique.nom.toLowerCase()} contre les 12 derniers mois du format</span>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvDe(L, rangs))}`}
          download="pulse-instagram-posts.csv"
          className="ml-auto rounded-full border border-line px-2.5 py-1 font-semibold text-ink hover:bg-black/[0.03]"
        >
          Exporter vers Excel
        </a>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[860px] text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-faint">
              <th className="sticky top-0 bg-white px-3 py-2 text-left">
                <a href={lien(L.sp, { s: s === "date" ? "date-asc" : undefined })} className={triDate ? "text-ink" : ""} title="Du plus récent au plus ancien, ou l'inverse">
                  Date {s === "date-asc" ? "↑" : triDate ? "↓" : ""}
                </a>
              </th>
              <th className="sticky top-0 bg-white px-2 py-2 text-left">Post</th>
              <th className="sticky top-0 bg-white px-2 py-2 text-left">Format · âge</th>
              {CHIFFRES.map((c) => (
                <th key={c.cle} className="sticky top-0 bg-white px-2 py-2 text-right">
                  <a href={lien(L.sp, { s: c.cle })} className={s === c.cle ? "text-ink" : ""}>{c.nom}{s === c.cle && " ↓"}</a>
                </th>
              ))}
              <th className="sticky top-0 bg-white px-3 py-2 text-left">Place</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rangs.map((l) => (
              <tr key={l.post.id} className={l.ecarte ? "opacity-45" : ""}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11.5px] text-muted">{dateCourte(l.post.date)}</td>
                <td className="px-2 py-2">
                  <a href={lien(L.sp, { post: l.post.id })} className="flex items-center gap-2.5 hover:underline">
                    <Vignette p={l.post} taille="h-8 w-8" />
                    <span className="max-w-[240px] truncate text-ink">{l.post.caption || "(sans légende)"}</span>
                  </a>
                </td>
                <td className="whitespace-nowrap px-2 text-muted">{l.post.type} · {age(l.ageH)} {l.recent && <span title="peut encore changer">◔</span>}</td>
                {CHIFFRES.map((c) => (
                  <td key={c.cle} className={`whitespace-nowrap px-2 text-right font-mono ${c.cle === L.cle ? "text-ink" : "text-muted"}`}>{valeurCellule(l.post, c.cle)}</td>
                ))}
                <td className="whitespace-nowrap px-3 text-[11.5px]" style={{ color: L.cle ? teinte(l) : "#8b8e98" }}>
                  {L.cle ? placeN(l, L.fsTableau.find((f) => f.format === l.post.type)) : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2 text-[11px] text-faint">
        Chiffres au dernier relevé du post. Un « – » n&apos;a pas été rendu par Instagram, ce n&apos;est pas un zéro — dans l&apos;export, une cellule vide.
      </p>
    </div>
  );
}

// ── LE PANNEAU LATÉRAL « LIRE UN POST » ─────────────────────────────────────

function PanneauLateral({ L }: { L: Lecture }) {
  const l = L.ouvert!;
  const p = l.post;
  const f = formatDe(L, p.type);
  const permalien = L.liens.get(p.id);
  const video = p.type === "Reel" || p.type === "Vidéo du fil";
  return (
    <>
      <a href={lien(L.sp, { post: undefined })} className="fixed inset-0 z-40 bg-black/20" aria-label="Fermer le panneau" />
      <aside className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-[440px] overflow-y-auto border-l border-line bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-faint">{p.type} · publié le {dateCourte(p.date)} · {age(l.ageH)} {l.recent && "◔ peut encore changer"}</span>
          <a href={lien(L.sp, { post: undefined })} className="text-[13px] text-muted hover:text-ink">Fermer ✕</a>
        </div>
        {video && permalien ? (
          <iframe src={`${permalien.replace(/\/?$/, "/")}embed`} className="h-[520px] w-full rounded-xl border border-line" allow="autoplay; encrypted-media" title="Lecteur Instagram" />
        ) : (
          <Vignette p={p} taille="w-full h-72" />
        )}
        <p className="mt-3 whitespace-pre-line text-[13px] text-ink">{p.caption || "(sans légende)"}</p>
        {permalien && <a href={permalien} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11.5px] font-semibold text-ink underline decoration-line">Voir sur Instagram ↗</a>}
        {L.cle && (
          <div className="mt-4 rounded-xl border border-line p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-faint">{L.metrique.nom}</div>
            <div className="font-mono text-[24px] text-ink">{fmt(l.valeur, L.cle)}</div>
            <div className="mb-1 text-[12px] font-semibold" style={{ color: teinte(l) }}>{placeN(l, f)}</div>
            {f?.q && l.dehors === null && <MoustacheH f={f} cle={L.cle} marques={[{ l }]} />}
          </div>
        )}
        <div className="mt-4">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-faint">Sa place sur chaque métrique, parmi {refTexte(L, f, p.type)}</div>
          <dl className="divide-y divide-line rounded-xl border border-line text-[12px]">
            {L.places.map((x) => (
              <div key={x.nom} className="flex items-baseline gap-2 px-3 py-1.5">
                <dt className="w-28 shrink-0 text-faint">{x.nom}</dt>
                <dd className="w-16 shrink-0 text-right font-mono text-ink">{x.valeur}</dd>
                <dd className="min-w-0 truncate text-muted">{x.texte}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="mt-4 rounded-lg border border-dashed border-line px-3 py-2 text-[11px] text-faint">
          Le lecteur est celui d&apos;Instagram, à partir du lien public : Pulse ne garde pas la vidéo. Carrousel entier, commentaires et temps de visionnage :
          pas en base aujourd&apos;hui.
        </p>
      </aside>
    </>
  );
}


// ── LA PAGE D, ET TROIS FAÇONS DE MONTRER L'ÉVOLUTION ───────────────────────
// David, tour 4 : « on ne voit pas forcément l'évolution, c'est dur de voir quel
// format est mieux » ; « comparer 6 posts avec 12 posts, dur à dire » — 12 mois
// est LA référence, 3 mois se lit avec prudence, le dernier mois manque encore
// de données. Peu de texte au-dessus des graphes.

function tukey(g: FouleN) {
  const e = 1.5 * (g.q!.q3 - g.q!.q1);
  const dedans = g.valeurs.filter((v) => v >= g.q!.q1 - e && v <= g.q!.q3 + e);
  return { haut: Math.max(...dedans), bas: Math.min(...dedans) };
}

const H_RANG = 250;

/** L'échelle commune d'une rangée : le nuage et l'évolution sur le même axe. */
function echelle(f: FouleN, extras: (number | null | undefined)[]) {
  const hauts = [f, ...[]].filter((g) => g.q).map((g) => tukey(g).haut);
  const autres = extras.filter((v): v is number => typeof v === "number");
  const lus = f.lus.filter((l) => l.valeur !== null).map((l) => l.valeur!);
  const plafond = Math.max(...(hauts.length ? hauts : lus), ...autres, 1);
  const vmax = plafond * 1.1;
  return { plafond, vmax, y: (v: number) => H_RANG - 30 - (Math.min(v, vmax) / vmax) * (H_RANG - 56) };
}
type Echelle = ReturnType<typeof echelle>;

function Graduations({ e, cle, W }: { e: Echelle; cle: string; W: number }) {
  return (
    <>
      {[0, 0.5, 1].map((k) => (
        <g key={k}>
          <line x1={58} x2={W - 6} y1={e.y(k * e.plafond)} y2={e.y(k * e.plafond)} stroke={NEUTRE.trait} strokeOpacity={0.2} />
          <text x={52} y={e.y(k * e.plafond) + 3.5} fontSize={11} fill="#8b8e98" textAnchor="end">{fmt(k * e.plafond, cle)}</text>
        </g>
      ))}
    </>
  );
}

/** Le nuage de la période, posé sur la bande de l'année (sa boîte, sa médiane). */
function NuagePeriode({ L, f, e, W = 560 }: { L: Lecture; f: FouleN; e: Echelle; W?: number }) {
  const cle = L.cle!;
  const t0 = new Date(L.debut).getTime();
  const t1 = Math.max(new Date(L.fin).getTime(), t0 + JOUR);
  const x = (t: number) => 66 + ((t - t0) / (t1 - t0)) * (W - 86);
  const c = COULEUR_FORMAT[f.format] ?? NEUTRE.trait;
  const numero = new Map(L.sel.map((l, i) => [l.post.id, i + 1]));
  return (
    <svg viewBox={`0 0 ${W} ${H_RANG}`} width="100%" className="block" role="img" aria-label={`Les ${f.format} de la période`}>
      <Graduations e={e} cle={cle} W={W} />
      {f.q && (
        <>
          <rect x={60} y={e.y(f.q.q3)} width={W - 66} height={Math.max(2, e.y(f.q.q1) - e.y(f.q.q3))} fill={c} fillOpacity={0.08} />
          <line x1={60} x2={W - 6} y1={e.y(f.q.med)} y2={e.y(f.q.med)} stroke={c} strokeOpacity={0.6} strokeDasharray="5 4" />
          <text x={W - 8} y={e.y(f.q.med) - 5} fontSize={10} fill={c} textAnchor="end">post type de l&apos;année</text>
        </>
      )}
      <text x={66} y={H_RANG - 8} fontSize={11} fill="#8b8e98">{dateCourte(L.debut)}</text>
      <text x={W - 20} y={H_RANG - 8} fontSize={11} fill="#8b8e98" textAnchor="end">{dateCourte(L.fin)}</text>
      {f.lus.filter((l) => l.valeur !== null).map((l) => {
        const cx = x(new Date(l.post.date).getTime());
        const dessus = l.valeur! > e.vmax;
        const n = L.portee === "periode" && L.sp.pt !== "1" ? numero.get(l.post.id) : undefined;
        const creux = l.dehors !== null || l.recent || l.ecarte;
        return (
          <a key={l.post.id} href={lien(L.sp, { post: l.post.id })}>
            <title>{`${fmt(l.valeur, cle)} · ${placeN(l, f)}`}</title>
            {dessus ? (
              <>
                <path d={`M${cx - 6},${e.y(e.vmax) + 7} L${cx + 6},${e.y(e.vmax) + 7} L${cx},${e.y(e.vmax) - 2} Z`} fill={c} />
                <text x={cx} y={e.y(e.vmax) - 6} fontSize={10} fill="#5a5d66" textAnchor="middle">{n ? `${n} · ` : ""}{fmt(l.valeur, cle)}</text>
              </>
            ) : (
              <circle cx={cx} cy={e.y(l.valeur!)} r={n ? 10 : 5} fill={creux && !n ? "#fff" : c} stroke={n ? "#fff" : c} strokeWidth={n ? 2.5 : 1.5} opacity={l.ecarte ? 0.4 : 1} />
            )}
            {n && !dessus && <text x={cx} y={e.y(l.valeur!) + 4} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle">{n}</text>}
          </a>
        );
      })}
    </svg>
  );
}

// ── 1 · LES MOUSTACHES, PESÉES ──────────────────────────────────────────────
// La largeur et l'encre d'une boîte suivent son nombre de posts (racine du
// rapport à l'année) : une moustache de 6 posts se voit plus mince qu'une de 42.

const STATUTS = [
  { cle: "annee", nom: "12 mois", statut: "la référence" },
  { cle: "trois", nom: "3 derniers mois", statut: "à lire avec prudence" },
  { cle: "un", nom: "dernier mois", statut: "encore mince" },
] as const;

function MoustachesPesees({ L, f, e }: { L: Lecture; f: FouleN; e: Echelle }) {
  const cle = L.cle!;
  const W = 560;
  const r = L.recents.get(f.format) ?? {};
  const boites = [f, r.trois, r.un];
  const c = COULEUR_FORMAT[f.format] ?? NEUTRE.trait;
  const nAnnee = Math.max(1, f.valeurs.length);
  const colW = (W - 40) / 3;
  return (
    <svg viewBox={`0 0 ${W} ${H_RANG}`} width="100%" className="block" role="img" aria-label={`Les ${f.format} : l'année et les derniers mois`}>
      {f.q && <line x1={10} x2={W - 6} y1={e.y(f.q.med)} y2={e.y(f.q.med)} stroke={c} strokeOpacity={0.6} strokeDasharray="5 4" />}
      {boites.map((g, i) => {
        const cx = 30 + colW * i + colW / 2 - 16;
        const st = STATUTS[i];
        const poids = g ? Math.sqrt(g.valeurs.length / nAnnee) : 0;
        const demi = Math.max(8, 30 * poids);
        return (
          <g key={st.cle} opacity={i === 0 ? 1 : 0.45 + 0.55 * poids}>
            <text x={cx} y={H_RANG - 20} fontSize={11.5} fontWeight={i === 0 ? 700 : 500} fill="#0e0f12" textAnchor="middle">{st.nom}</text>
            <text x={cx} y={H_RANG - 6} fontSize={10} fill="#8b8e98" textAnchor="middle">{g ? `${g.valeurs.length} posts · ${st.statut}` : st.statut}</text>
            {g?.q ? (
              <>
                <line x1={cx} x2={cx} y1={e.y(tukey(g).haut)} y2={e.y(tukey(g).bas)} stroke={c} />
                <rect x={cx - demi} y={e.y(g.q.q3)} width={demi * 2} height={Math.max(3, e.y(g.q.q1) - e.y(g.q.q3))} rx={5} fill={c} fillOpacity={i === 0 ? 0.25 : 0.12} stroke={c} strokeDasharray={i === 0 ? undefined : "4 3"} />
                <line x1={cx - demi - 4} x2={cx + demi + 4} y1={e.y(g.q.med)} y2={e.y(g.q.med)} stroke={c} strokeWidth={3} />
                <text x={cx + demi + 8} y={e.y(g.q.med) + 4} fontSize={11} fontWeight={700} fill="#0e0f12">{fmt(g.q.med, cle)}</text>
              </>
            ) : (
              <text x={cx} y={H_RANG / 2} fontSize={10.5} fill="#8b8e98" textAnchor="middle">{`${g?.nAvant ?? 0} / ${MINIMUM} posts`}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── LA RANGÉE D'UN FORMAT ET LA PAGE ────────────────────────────────────────

function Puce({ nom, g, annee, cle }: { nom: string; g?: FouleN; annee: FouleN; cle: string }) {
  if (!g?.q || !annee.q) return <span className="rounded-full bg-canvas px-2 py-0.5 text-faint">{nom} : {g?.nAvant ?? 0}/{MINIMUM} posts</span>;
  const d = annee.q.med > 0 ? ((g.q.med - annee.q.med) / annee.q.med) * 100 : null;
  // ±5 % : deux médianes de quelques posts ne disent pas un sens en deçà.
  const plat = d === null || Math.abs(d) < 5;
  return (
    <span className="rounded-full bg-canvas px-2 py-0.5 text-muted">
      {nom} <b style={{ color: plat ? "#5a5d66" : d! > 0 ? POS : NEG }}>{plat ? "≈" : `${d! > 0 ? "+" : "−"}${Math.abs(Math.round(d!))} %`}</b>{" "}
      <span className="text-faint">· {g.valeurs.length} posts</span>
    </span>
  );
}

function Rangee({ L, f }: { L: Lecture; f: FouleN }) {
  const cle = L.cle!;
  const r = L.recents.get(f.format) ?? {};
  const extras = [r.trois?.q ? tukey(r.trois).haut : null, r.un?.q ? tukey(r.un).haut : null];
  const e = echelle(f, extras);
  return (
    <div className="border-t border-line pt-4 first:border-0 first:pt-0">
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: COULEUR_FORMAT[f.format] }} /> {f.format}
        </span>
        <span className="text-muted">
          post type de l&apos;année <b className="font-mono text-ink">{f.q ? fmt(f.q.med, cle) : "–"}</b> <span className="text-faint">· {f.valeurs.length} posts</span>
        </span>
        <Puce nom="3 mois" g={r.trois} annee={f} cle={cle} />
        <Puce nom="1 mois" g={r.un} annee={f} cle={cle} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0"><NuagePeriode L={L} f={f} e={e} /></div>
        <div className="min-w-0"><MoustachesPesees L={L} f={f} e={e} /></div>
      </div>
    </div>
  );
}

function ColonnePosts({ L }: { L: Lecture }) {
  return (
    <aside className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white xl:sticky xl:top-4">
      <div className="border-b border-line px-4 py-3 text-[13.5px] font-semibold text-ink">
        Tes 5 meilleurs posts de la période en {L.metrique.nom.toLowerCase()}
      </div>
      <div className="grid max-h-[85vh] gap-2 overflow-y-auto bg-canvas p-2">
        {L.sel.map((l, i) => <CartePost key={l.post.id} L={L} l={l} n={i + 1} compacte />)}
      </div>
    </aside>
  );
}

function PageD({ L }: { L: Lecture }) {
  return (
    <section>
      <Titre titre="Tes posts face à ton année" />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 rounded-2xl border border-line bg-white p-5">
          <p className="mb-3 text-[12px] text-muted">
            Référence : <b className="text-ink">tes 12 derniers mois</b>, format par format — elle ne bouge pas avec la période.
            {L.metrique.definition && <> · <b className="text-ink">{L.metrique.nom}</b> = {L.metrique.definition}.</>}
          </p>
          <PhraseEcartes L={L} />
          <div className="grid gap-4">
            {L.fs.map((f) => <Rangee key={f.format} L={L} f={f} />)}
          </div>
        </div>
        <ColonnePosts L={L} />
      </div>
    </section>
  );
}
