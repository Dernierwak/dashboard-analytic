// PROTOTYPE JETABLE — ticket « La page entière, en maquette »
// (.scratch/instagram/issues/13-la-page-entiere-en-maquette.md). Ne part
// jamais sur `main` : il vit sur la branche `prototype/instagram-page`.
//
// Deuxième tour (2026-11-06). David a retenu la page « la foule en un module »
// — le nuage des posts et, à sa droite, les moustaches des formats — et
// demandé des versions bâties sur elle, basculées par `?pv=` :
//   A « Côte à côte »        — sa version corrigée : toute la largeur, les
//                              moustaches détaillées, les cartes des posts
//                              choisis dessous (mini-moustache, chiffres,
//                              légende, vidéo) ;
//   B « Un nuage par format » — une ligne par format, son nuage et sa
//                              moustache sur sa propre échelle ;
//   C « Les cartes à côté »  — le nuage à gauche, les posts choisis en
//                              colonne à droite.
// `?etat=neuf|jeton|gratuit` simule les états ; `?ex=0` retire la Tendance
// d'exemple ; `?pn=12|20|30` change le nombre de derniers posts d'une moustache.
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
  MODES,
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
import { SwitcherPage } from "./switcher";

type SP = DashParams & Record<string, string | string[] | undefined>;

const VARIANTES = [
  { cle: "D", nom: "Ton année, et la liste à droite" },
  { cle: "A", nom: "Côte à côte" },
  { cle: "B", nom: "Un nuage par format" },
  { cle: "C", nom: "Les cartes à côté" },
];

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
const ADDITIVES = new Set(["views", "likes", "comments", "saved"]);

// ── LA FOULE SUR LES N DERNIERS POSTS DU FORMAT (David, 2026-11-06) ─────────
// « Que ce soit un minimum de X derniers posts, et que ce soit bien expliqué » :
// la moustache d'un format se calcule sur ses N derniers posts de plus de 48 h,
// tout l'historique confondu — changer la période ne la fait plus bouger. La
// période ne choisit que les posts POSÉS dessus (nuage, cartes, Tableau).
// Cela remplace « parmi ceux de son format sur la période » du ticket 06.

const N_DEFAUT = 20;

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
  fs: FouleN[];
  n: number;
  sel: PostLu[];
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
  /** Tour 3 : la référence est l'année (12 mois glissants). */
  parAnnee: boolean;
  /** Les moustaches d'évolution : 3 derniers mois, dernier mois. */
  recents: Map<string, { trois?: FouleN; un?: FouleN }>;
};

/** Ce contre quoi un post est placé, en mots. */
function refTexte(L: Lecture, f: FouleN | undefined, format: string): string {
  const k = f?.valeurs.length ?? 0;
  return L.parAnnee ? `tes ${pluriel(format, 2)} des 12 derniers mois (${k})` : `tes ${k} derniers ${pluriel(format, 2)}`;
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
  const n = [12, 20, 30].includes(Number(sp.pn)) ? Number(sp.pn) : N_DEFAUT;

  const objectif = OBJECTIFS.find((o) => o.cle === sp.obj) ?? OBJECTIFS[0];
  const metrique =
    objectif.metriques.find((m) => m.cle !== null && m.cle === sp.pm) ??
    objectif.metriques.find((m) => m.cle !== null) ??
    objectif.metriques[0];
  const cle = metrique.cle;
  const mode = (MODES.some((m) => m.cle === sp.pmode) ? sp.pmode : "haut") as Mode;
  const sansHorsNorme = sp.phn === "1";
  const choisis = String(sp.ps ?? "").split(",").filter(Boolean).slice(0, 5);
  const variante = VARIANTES.some((v) => v.cle === sp.pv) ? String(sp.pv) : "D";
  const maintenant = Date.now();
  // Tour 3 (David) : la référence est l'année — 12 mois glissants, pas
  // l'année civile, pour que janvier ne remette pas tout à zéro.
  const parAnnee = variante === "D";
  const reference: Reference = parAnnee ? { jours: 365 } : { n };

  const fs = cle ? foulesN(historique, posts, cle, sansHorsNorme, reference, maintenant).filter((f) => f.lus.length > 0) : [];
  const sel = cle ? selection(fs, mode, choisis, 5) : [];
  const tousLus = foules(posts, "reach", false, maintenant).flatMap((f) => f.lus);
  const ouvert = sp.post ? (fs.flatMap((f) => f.lus).find((l) => l.post.id === sp.post) ?? tousLus.find((l) => l.post.id === sp.post)) : undefined;
  const places = ouvert
    ? METRIQUES.map((m) => {
        const f = foulesN(historique, posts, m.cle, sansHorsNorme, reference, maintenant).find((x) => x.format === ouvert.post.type);
        const l = f?.lus.find((x) => x.post.id === ouvert.post.id);
        return { nom: m.nom, valeur: fmt(l?.valeur ?? null, m.cle), texte: l ? placeN(l, f) : "–" };
      })
    : [];
  const liens = await lirePermaliens();
  const recents = new Map<string, { trois?: FouleN; un?: FouleN }>();
  if (parAnnee && cle) {
    const trois = foulesN(historique, posts, cle, sansHorsNorme, { jours: 90 }, maintenant);
    const un = foulesN(historique, posts, cle, sansHorsNorme, { jours: 30 }, maintenant);
    for (const f of fs) recents.set(f.format, { trois: trois.find((x) => x.format === f.format), un: un.find((x) => x.format === f.format) });
  }

  const L: Lecture = {
    sp, objectif, metrique, cle, fs, n, sel, mode, choisis, sansHorsNorme, posts, serie, debut, fin, ouvert, places, liens, parAnnee, recents,
    exemple: sp.ex !== "0" && etat !== "neuf",
    fige: etat === "jeton",
  };

  return (
    <section className="mt-4">
      <BandeauMaquette sp={sp} etat={etat} n={postsReels.length} />
      {L.fige && <JetonMort fin={fin} />}
      <div className={L.fige ? "pointer-events-none select-none opacity-60 grayscale-[35%]" : ""}>
        <div className="grid gap-8">
          <section>
            <Titre titre="Ta page" sous="Le compte jour par jour — pas une somme de posts." droite={L.fige ? <Fige fin={fin} /> : undefined} />
            <Tendance L={L} />
          </section>
          {L.posts.length === 0 ? (
            <CompteNeuf />
          ) : (
            <>
              <SelecteurObjectif L={L} />
              {!L.cle ? (
                <SansMetrique L={L} />
              ) : (
                <>
                  {variante === "D" && <PageD {...L} />}
                  {variante === "A" && <PageA {...L} />}
                  {variante === "B" && <PageB {...L} />}
                  {variante === "C" && <PageC {...L} />}
                </>
              )}
              <section>
                <Titre titre="Tous tes posts" sous="Ceux de la période choisie." />
                <Tableau L={L} />
              </section>
            </>
          )}
        </div>
      </div>
      {ouvert && <PanneauLateral L={L} />}
      <SwitcherPage variantes={VARIANTES} />
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
        <b className="text-ink">Prototype jetable</b> — {VARIANTES.length} versions de la page « nuage + moustaches » (← → ou la barre en bas),
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

function CourbeExemple({ nom, resume, courant, avant, jours, pubs, sp, posts, debut, barres, exemple }: {
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
}) {
  const W = 460;
  const H = barres ? 170 : 140;
  const bas = barres ? 110 : 118;
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
            <rect x={x(i) - 1.6} y={146 - (b.gagnes / maxBarre) * 22} width={3.2} height={(b.gagnes / maxBarre) * 22} fill={POS} opacity={0.7} />
            <rect x={x(i) - 1.6} y={146} width={3.2} height={(b.perdus / maxBarre) * 16} fill={NEG} opacity={0.7} />
          </g>
        ))}
        <line x1={10} x2={W - 10} y1={barres ? 146 : bas + 6} y2={barres ? 146 : bas + 6} stroke={NEUTRE.trait} strokeOpacity={0.4} />
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
      <p className="mt-1 text-[11px] leading-snug text-faint">
        {barres ? "Total d'abonnés ; dessous, gagnés (vert) et perdus (rouge) par jour." : "Trait plein : la période. Pointillé : la période d'avant. Points : tes publications, cliquables."}
        {pubs.size > 0 && toutes.length > 0 && " Un trou = un jour sans donnée."}
      </p>
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
      <div className="grid gap-3 lg:grid-cols-3">
        <CourbeExemple nom="Portée du compte" resume="–" courant={vide} avant={vide} {...commun} />
        <CourbeExemple nom="Interactions du compte" resume="–" courant={vide} avant={vide} {...commun} />
        <CourbeExemple nom="Abonnés" resume="–" courant={vide} avant={vide} {...commun} />
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
    <div className="grid gap-3 lg:grid-cols-3">
      <CourbeExemple nom="Portée du compte" resume={`${nf(moy)} / jour en moyenne`} courant={portee} avant={porteeAvant} {...commun} />
      <CourbeExemple nom="Interactions du compte" resume={`${nf(somme)} sur la période`} courant={inter} avant={interAvant} {...commun} />
      <CourbeExemple nom="Abonnés" resume={`${nf(abonnes[abonnes.length - 1])} · ${net >= 0 ? "+" : "−"}${nf(Math.abs(net))}`} courant={abonnes} avant={[]} barres={mouvements} {...commun} />
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

// ── LE « COMMENT ÇA SE LIT » (David : « bien expliquer sur combien de données ») ─

function SurQuoi({ L }: { L: Lecture }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-canvas px-4 py-3 text-[12.5px] text-muted">
      <span className="text-[16px]">◫</span>
      <span className="min-w-0 flex-1">
        <b className="text-ink">Chaque moustache se calcule sur les {L.n} derniers posts de son format</b> (de plus de 48 h), quelle que soit la
        période choisie. <b className="text-ink">Changer la date déplace les points, jamais les moustaches</b> : tes habitudes restent les mêmes
        d&apos;un écran à l&apos;autre.
      </span>
      <span className="flex items-center gap-1 text-[11px]">
        <span className="text-faint">maquette :</span>
        {[12, 20, 30].map((k) => (
          <Pastille key={k} href={lien(L.sp, { pn: k === N_DEFAUT ? undefined : String(k) })} actif={k === L.n}>{k} posts</Pastille>
        ))}
      </span>
    </div>
  );
}

/** La légende d'une moustache, dessinée : elle explique la forme par la forme. */
function LegendeMoustache({ L }: { L: Lecture }) {
  return (
    <div className="grid content-start gap-2 text-[11.5px] text-muted">
      <svg viewBox="0 0 200 132" width="200" className="block" aria-hidden>
        <line x1={30} x2={30} y1={8} y2={124} stroke="#8b8e98" />
        <rect x={18} y={38} width={24} height={52} rx={4} fill="rgba(123,79,255,0.14)" stroke="#7b4fff" />
        <line x1={14} x2={46} y1={60} y2={60} stroke="#7b4fff" strokeWidth={2.5} />
        <text x={54} y={12} fontSize={10} fill="#5a5d66">le plus haut, hors norme à part</text>
        <text x={54} y={42} fontSize={10} fill="#5a5d66">haut de tes habitudes</text>
        <text x={54} y={63} fontSize={10} fill="#0e0f12" fontWeight={600}>post type</text>
        <text x={54} y={90} fontSize={10} fill="#5a5d66">bas de tes habitudes</text>
        <text x={54} y={124} fontSize={10} fill="#5a5d66">le plus bas</text>
      </svg>
      <p><b className="text-ink">Post type</b> : la médiane — la moitié de tes {L.n} derniers posts fait plus, l&apos;autre moitié moins.</p>
      <p><b className="text-ink">La boîte</b> : tes habitudes, la moitié du milieu de tes posts.</p>
      <p><b className="text-ink">Les moustaches</b> : jusqu&apos;où vont les autres posts.</p>
      <p><b className="text-ink">Hors norme</b> : au-delà des moustaches — plus de 1,5 fois la hauteur de la boîte au-dessus ou en dessous d&apos;elle.</p>
    </div>
  );
}

// Un bloc par format (ticket 09) : post type ÉCRIT EN PHRASE, total pour ce qui
// se compte, sur combien de posts et de quand à quand.
function BlocsFormats({ L }: { L: Lecture }) {
  const cle = L.cle!;
  const m = L.metrique.nom.toLowerCase();
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {L.fs.map((f) => {
        const total = ADDITIVES.has(cle) ? f.valeurs.reduce((s, v) => s + v, 0) : null;
        return (
          <div key={f.format} className="min-w-0 rounded-xl border border-line bg-white p-3.5">
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COULEUR_FORMAT[f.format] }} /> {f.format}
              <span className="ml-auto font-normal text-faint">{f.lus.length} sur la période</span>
            </div>
            <div className="mt-1.5 font-mono text-[22px] text-ink">{f.q ? fmt(f.q.med, cle) : "–"}</div>
            <p className="text-[11.5px] leading-snug text-muted">
              {f.q
                ? <>post type en {m} : la moitié de tes {f.valeurs.length} derniers {pluriel(f.format, 2)} fait plus, l&apos;autre moins.</>
                : <>pas de moustache : {f.nAvant} {pluriel(f.format, f.nAvant)} lus en tout, il en faut {MINIMUM}.</>}
            </p>
            <p className="mt-1 text-[10.5px] text-faint">
              sur {f.valeurs.length} posts, du {dateCourte(f.refDe)} au {dateCourte(f.refA)}
              {total !== null && f.q && <> · total {fmt(total, cle)}</>}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Definition({ L }: { L: Lecture }) {
  if (!L.metrique.definition) return null;
  return <p className="mb-3 text-[12px] text-muted"><b className="text-ink">{L.metrique.nom}</b> = {L.metrique.definition}.</p>;
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

/** Le nuage date × métrique et, à droite, une moustache verticale détaillée
 *  par format sur le même axe. `formats` restreint le nuage (version B). */
function Nuage({ L, formats, haut = 380, numeros = true }: { L: Lecture; formats?: string[]; haut?: number; numeros?: boolean }) {
  const cle = L.cle!;
  const fs = formats ? L.fs.filter((f) => formats.includes(f.format)) : L.fs;
  const W = 1200;
  const H = haut;
  const colW = 150;
  const NX = W - colW * fs.length - 20;
  const t0 = new Date(L.debut).getTime();
  const t1 = Math.max(new Date(L.fin).getTime(), t0 + 86400_000);
  const lus = fs.flatMap((f) => f.lus.filter((l) => l.valeur !== null));
  const moustaches = new Map(
    fs.filter((f) => f.q).map((f) => {
      const e = 1.5 * (f.q!.q3 - f.q!.q1);
      const dedans = f.valeurs.filter((v) => v >= f.q!.q1 - e && v <= f.q!.q3 + e);
      return [f.format, { haut: Math.max(...dedans), bas: Math.min(...dedans) }];
    })
  );
  const hautMoustaches = [...moustaches.values()].map((m) => m.haut);
  const plafond = Math.max(...(hautMoustaches.length ? hautMoustaches : lus.map((l) => l.valeur!)), 1);
  const vmax = plafond * 1.1;
  const y = (v: number) => H - 30 - (Math.min(v, vmax) / vmax) * (H - 56);
  const x = (t: number) => 70 + ((t - t0) / (t1 - t0)) * (NX - 90);
  const numero = new Map(L.sel.map((l, i) => [l.post.id, i + 1]));
  const graduations = [0, 0.25, 0.5, 0.75, 1].map((k) => k * plafond);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="block" role="img" aria-label="Nuage des posts et moustaches par format">
      {graduations.map((g) => (
        <g key={g}>
          <line x1={64} x2={W - 6} y1={y(g)} y2={y(g)} stroke={NEUTRE.trait} strokeOpacity={0.22} />
          <text x={58} y={y(g) + 3.5} fontSize={11} fill="#8b8e98" textAnchor="end">{fmt(g, cle)}</text>
        </g>
      ))}
      <text x={70} y={H - 8} fontSize={11} fill="#8b8e98">{dateCourte(L.debut)}</text>
      <text x={NX - 20} y={H - 8} fontSize={11} fill="#8b8e98" textAnchor="end">{dateCourte(L.fin)}</text>
      <text x={(70 + NX) / 2} y={H - 8} fontSize={11} fill="#8b8e98" textAnchor="middle">tes posts de la période →</text>
      <line x1={NX} x2={NX} y1={10} y2={H - 24} stroke={NEUTRE.trait} strokeOpacity={0.45} strokeDasharray="3 3" />
      {lus.map((l) => {
        const cx = x(new Date(l.post.date).getTime());
        const dessus = l.valeur! > vmax;
        const c = COULEUR_FORMAT[l.post.type] ?? NEUTRE.trait;
        const creux = l.dehors !== null || l.recent || l.ecarte;
        const n = numeros ? numero.get(l.post.id) : undefined;
        return (
          <a key={l.post.id} href={lien(L.sp, { post: l.post.id })}>
            <title>{`${l.post.type} · ${fmt(l.valeur, cle)} · ${placeN(l, L.fs.find((f) => f.format === l.post.type))}`}</title>
            {dessus ? (
              <>
                <path d={`M${cx - 6},${y(vmax) + 7} L${cx + 6},${y(vmax) + 7} L${cx},${y(vmax) - 2} Z`} fill={c} />
                <text x={cx} y={y(vmax) - 6} fontSize={10} fill="#5a5d66" textAnchor="middle">{n ? `${n} · ` : ""}{fmt(l.valeur, cle)}</text>
              </>
            ) : (
              <circle cx={cx} cy={y(l.valeur!)} r={n ? 10 : 4.5} fill={creux && !n ? "#fff" : c} stroke={n ? "#fff" : c} strokeWidth={n ? 2.5 : 1.5} opacity={l.ecarte ? 0.4 : 1} />
            )}
            {n && !dessus && <text x={cx} y={y(l.valeur!) + 4} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle">{n}</text>}
          </a>
        );
      })}
      {fs.map((f, i) => {
        const cx = NX + 30 + colW * i;
        const c = COULEUR_FORMAT[f.format] ?? NEUTRE.trait;
        return (
          <g key={f.format}>
            <text x={cx} y={H - 8} fontSize={11.5} fontWeight={600} fill="#0e0f12" textAnchor="middle">{f.format}</text>
            {f.q ? (
              <>
                <line x1={cx} x2={cx} y1={y(moustaches.get(f.format)!.haut)} y2={y(moustaches.get(f.format)!.bas)} stroke={c} strokeOpacity={0.6} />
                <line x1={cx - 7} x2={cx + 7} y1={y(moustaches.get(f.format)!.haut)} y2={y(moustaches.get(f.format)!.haut)} stroke={c} strokeOpacity={0.6} />
                <line x1={cx - 7} x2={cx + 7} y1={y(moustaches.get(f.format)!.bas)} y2={y(moustaches.get(f.format)!.bas)} stroke={c} strokeOpacity={0.6} />
                {f.valeurs.some((v) => v > vmax) && (
                  <text x={cx} y={16} fontSize={9.5} fill="#5a5d66" textAnchor="middle">
                    {`▲ ${f.valeurs.filter((v) => v > vmax).length} hors norme plus haut`}
                  </text>
                )}
                <rect x={cx - 13} y={y(f.q.q3)} width={26} height={Math.max(3, y(f.q.q1) - y(f.q.q3))} rx={4} fill={c} fillOpacity={0.15} stroke={c} />
                <line x1={cx - 17} x2={cx + 17} y1={y(f.q.med)} y2={y(f.q.med)} stroke={c} strokeWidth={3} />
                {f.valeurs.filter((v) => v <= vmax).map((v, k) => <circle key={k} cx={cx - 24} cy={y(v)} r={1.8} fill={c} opacity={0.5} />)}
                <text x={cx + 20} y={y(f.q.q3) + 4} fontSize={10} fill="#5a5d66">{fmt(f.q.q3, cle)}</text>
                <text x={cx + 20} y={y(f.q.med) + 4} fontSize={10.5} fontWeight={700} fill="#0e0f12">{fmt(f.q.med, cle)}</text>
                <text x={cx + 20} y={y(f.q.q1) + 4} fontSize={10} fill="#5a5d66">{fmt(f.q.q1, cle)}</text>
                <text x={cx} y={H - 22} fontSize={9.5} fill="#8b8e98" textAnchor="middle">{f.valeurs.length} derniers</text>
              </>
            ) : (
              <text x={cx} y={H / 2} fontSize={10} fill="#8b8e98" textAnchor="middle">{f.nAvant} / {MINIMUM}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function LegendeNuage() {
  return (
    <p className="mt-2 text-[11px] text-faint">
      Couleur = format. Point creux = moins de 48 h, peut encore changer, ou écarté. Triangle = au-delà du haut de l&apos;axe, avec sa valeur.
      À droite, chaque moustache est dessinée avec ses petits points : les posts qui la font.
    </p>
  );
}

// ── LA SÉLECTION ────────────────────────────────────────────────────────────

function ChoixSelection({ L }: { L: Lecture }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-faint">Montrer</span>
      {MODES.map((m) => (
        <Pastille key={m.cle} href={lien(L.sp, { pmode: m.cle })} actif={m.cle === L.mode}>{m.nom}</Pastille>
      ))}
    </div>
  );
}

function intitule(L: Lecture): string {
  const m = L.metrique.nom.toLowerCase();
  const n = L.sel.length;
  if (L.mode === "haut") return `Tes ${n} meilleurs posts en ${m}`;
  if (L.mode === "bas") return `Tes ${n} posts les moins bons en ${m}`;
  if (L.mode === "recents") return `Tes ${n} posts les plus récents, lus en ${m}`;
  return `Ta sélection, lue en ${m}`;
}

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
  const f = L.fs.find((x) => x.format === l.post.type);
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

// ── PAGE A · CÔTE À CÔTE ────────────────────────────────────────────────────

function PageA(L: Lecture) {
  return (
    <>
      <section>
        <Titre titre="Tes posts face à tes habitudes" sous={`${intitule(L)}, numérotés dans le nuage — et la moustache de chaque format à droite, sur le même axe.`} droite={<ChoixSelection L={L} />} />
        <div className="rounded-2xl border border-line bg-white p-5">
          <SurQuoi L={L} />
          <Definition L={L} />
          <PhraseEcartes L={L} />
          <BlocsFormats L={L} />
          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_210px]">
            <div className="min-w-0">
              <Nuage L={L} />
              <LegendeNuage />
            </div>
            <LegendeMoustache L={L} />
          </div>
        </div>
      </section>
      <section>
        <Titre titre={intitule(L)} sous="Chacun sur la moustache de son format, avec ses chiffres et sa légende." />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {L.sel.map((l, i) => <CartePost key={l.post.id} L={L} l={l} n={i + 1} />)}
        </div>
      </section>
    </>
  );
}

// ── PAGE B · UN NUAGE PAR FORMAT ────────────────────────────────────────────

function PageB(L: Lecture) {
  return (
    <>
      <section>
        <Titre titre="Tes posts face à tes habitudes, format par format" sous="Chaque format sur sa propre échelle : un Reel se lit contre tes Reels." droite={<ChoixSelection L={L} />} />
        <div className="rounded-2xl border border-line bg-white p-5">
          <SurQuoi L={L} />
          <Definition L={L} />
          <PhraseEcartes L={L} />
          <div className="grid gap-5">
            {L.fs.map((f) => (
              <div key={f.format} className="grid items-center gap-4 border-t border-line pt-4 first:border-0 first:pt-0 lg:grid-cols-[230px_minmax(0,1fr)]">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COULEUR_FORMAT[f.format] }} /> {f.format}
                  </div>
                  <div className="mt-1 font-mono text-[24px] text-ink">{f.q ? fmt(f.q.med, L.cle!) : "–"}</div>
                  <p className="text-[11.5px] leading-snug text-muted">
                    {f.q
                      ? <>post type : la moitié de tes {f.valeurs.length} derniers {pluriel(f.format, 2)} fait plus, l&apos;autre moins.</>
                      : <>pas de moustache : {f.nAvant} {pluriel(f.format, f.nAvant)} lus en tout, il en faut {MINIMUM}.</>}
                  </p>
                  <p className="mt-1 text-[10.5px] text-faint">du {dateCourte(f.refDe)} au {dateCourte(f.refA)} · {f.lus.length} sur la période</p>
                </div>
                <div className="min-w-0"><Nuage L={L} formats={[f.format]} haut={200} /></div>
              </div>
            ))}
          </div>
          <LegendeNuage />
        </div>
      </section>
      <section>
        <Titre titre={intitule(L)} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {L.sel.map((l, i) => <CartePost key={l.post.id} L={L} l={l} n={i + 1} />)}
        </div>
      </section>
    </>
  );
}

// ── PAGE C · LES CARTES À CÔTÉ ──────────────────────────────────────────────

function PageC(L: Lecture) {
  return (
    <section>
      <Titre titre="Tes posts face à tes habitudes" sous={`${intitule(L)} à droite, numérotés dans le nuage.`} droite={<ChoixSelection L={L} />} />
      <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 rounded-2xl border border-line bg-white p-5">
          <SurQuoi L={L} />
          <Definition L={L} />
          <PhraseEcartes L={L} />
          <BlocsFormats L={L} />
          <div className="mt-4"><Nuage L={L} haut={420} /></div>
          <LegendeNuage />
        </div>
        <div className="grid min-w-0 gap-2 2xl:sticky 2xl:top-4">
          {L.sel.map((l, i) => <CartePost key={l.post.id} L={L} l={l} n={i + 1} compacte />)}
          <p className="px-1 text-[11px] text-faint">« Lire le post » ouvre le panneau : la vidéo, tous ses chiffres, sa place sur chaque métrique.</p>
        </div>
      </div>
    </section>
  );
}

// ── LE TABLEAU DES POSTS ────────────────────────────────────────────────────

function Tableau({ L }: { L: Lecture }) {
  const lus = L.cle ? L.fs.flatMap((f) => f.lus) : foules(L.posts, "reach", false, Date.now()).flatMap((f) => f.lus);
  const s = String(L.sp.s ?? "date");
  const v = (l: PostLu) => {
    const x = (l.post as unknown as Record<string, number | null>)[s];
    return x === null || (s !== "eng" && x === 0) ? -1 : x;
  };
  const rangs = s === "date" || !CHIFFRES.some((c) => c.cle === s) ? lus.sort((a, b) => b.post.date.localeCompare(a.post.date)) : lus.sort((a, b) => v(b) - v(a));
  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 text-[12px]">
        <span className="font-semibold text-ink">{rangs.length} posts</span>
        <span className="text-faint">· place lue en {L.metrique.nom.toLowerCase()}, contre {L.parAnnee ? "les posts du format des 12 derniers mois" : `les ${L.n} derniers posts du format`}</span>
        <span className="ml-auto rounded-full border border-line px-2.5 py-1 font-semibold text-muted" title="Maquette : exporte le Tableau tel que trié et filtré">Exporter vers Excel</span>
      </div>
      <div className="max-h-[460px] overflow-auto">
        <table className="w-full min-w-[760px] text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-faint">
              <th className="sticky top-0 bg-white px-3 py-2 text-left"><a href={lien(L.sp, { s: "date" })} className={s === "date" ? "text-ink" : ""}>Post</a></th>
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
                <td className="px-3 py-2">
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
                  {L.cle ? placeN(l, L.fs.find((f) => f.format === l.post.type)) : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2 text-[11px] text-faint">
        Chiffres au dernier relevé du post. Grisé = écarté par une règle de lecture. Un « – » n&apos;a pas été rendu par Instagram, ce n&apos;est pas un zéro.
      </p>
    </div>
  );
}

// ── LE PANNEAU LATÉRAL « LIRE UN POST » ─────────────────────────────────────

function PanneauLateral({ L }: { L: Lecture }) {
  const l = L.ouvert!;
  const p = l.post;
  const f = L.fs.find((x) => x.format === p.type);
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

// ── PAGE D · TON ANNÉE, ET LA LISTE À DROITE (tour 3) ───────────────────────
// David : la référence est l'année — « ça prend vraiment tous les posts », sans
// l'effet Noël puis janvier ; à côté, les derniers mois, pour voir « si
// généralement ils sont un peu plus haut » ; moitié nuage, moitié moustaches ;
// et la liste des posts qui défile à droite, tout dans un module (de la C).

function SurQuoiAnnee({ L }: { L: Lecture }) {
  return (
    <div className="mb-4 rounded-xl bg-canvas px-4 py-3 text-[12.5px] leading-relaxed text-muted">
      <b className="text-ink">Ta référence : tes posts des 12 derniers mois</b>, format par format — une année entière, Noël et janvier
      compris. C&apos;est contre elle que chaque post prend sa place, et{" "}
      <b className="text-ink">elle ne bouge pas quand tu changes la période</b> : seuls les points du nuage changent. À côté, tes{" "}
      <b className="text-ink">3 derniers mois</b> et ton <b className="text-ink">dernier mois</b> : si leur boîte est plus haute que celle de
      l&apos;année, tes posts montent en général, pas seulement un.
    </div>
  );
}

const AVANT = { annee: "12 mois", trois: "3 derniers mois", un: "dernier mois" };

function ecart(recent: FouleN | undefined, annee: FouleN, cle: string, nom: string) {
  if (!recent || !recent.q || !annee.q) {
    return <span className="text-faint">{nom} : {recent?.nAvant ?? 0} post{(recent?.nAvant ?? 0) > 1 ? "s" : ""}, il en faut {MINIMUM} pour une moustache</span>;
  }
  const d = annee.q.med > 0 ? ((recent.q.med - annee.q.med) / annee.q.med) * 100 : null;
  // ±5 % : en deçà, deux médianes de quelques posts ne disent pas un sens.
  const sens = d === null || Math.abs(d) < 5 ? "comme ton année" : `${d > 0 ? "+" : "−"}${Math.abs(Math.round(d))} % sur ton année`;
  const couleur = d === null || Math.abs(d) < 5 ? "#5a5d66" : d > 0 ? POS : NEG;
  return (
    <span>
      {nom} : post type <b className="font-mono text-ink">{fmt(recent.q.med, cle)}</b> sur {recent.valeurs.length} posts —{" "}
      <b style={{ color: couleur }}>{sens}</b>
    </span>
  );
}

function RangeeFormat({ L, f }: { L: Lecture; f: FouleN }) {
  const cle = L.cle!;
  const r = L.recents.get(f.format) ?? {};
  return (
    <div className="border-t border-line pt-5 first:border-0 first:pt-0">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: COULEUR_FORMAT[f.format] }} /> {f.format}
        </span>
        <span className="text-[12.5px] text-muted">
          {f.q ? (
            <>post type de l&apos;année <b className="font-mono text-ink">{fmt(f.q.med, cle)}</b> — la moitié de tes {f.valeurs.length} {pluriel(f.format, 2)} des 12 derniers mois fait plus, l&apos;autre moins</>
          ) : (
            <>{f.nAvant} {pluriel(f.format, f.nAvant)} en 12 mois : il en faut {MINIMUM} pour une moustache</>
          )}
        </span>
        <span className="text-[11px] text-faint">{f.lus.length} sur la période affichée</span>
      </div>
      <div className="mb-1 flex flex-wrap gap-x-5 gap-y-0.5 text-[12px] text-muted">
        {ecart(r.trois, f, cle, AVANT.trois)}
        {ecart(r.un, f, cle, AVANT.un)}
      </div>
      <NuageEvolution L={L} f={f} colonnes={[{ nom: AVANT.annee, f, ref: true }, { nom: AVANT.trois, f: r.trois }, { nom: AVANT.un, f: r.un }]} />
    </div>
  );
}

/** Moitié gauche : le nuage du format sur la période. Moitié droite : ses
 *  moustaches côte à côte (l'année, puis les derniers mois), même axe. */
function NuageEvolution({ L, f, colonnes }: { L: Lecture; f: FouleN; colonnes: { nom: string; f?: FouleN; ref?: boolean }[] }) {
  const cle = L.cle!;
  const W = 1100;
  const H = 250;
  const NX = 560;
  const t0 = new Date(L.debut).getTime();
  const t1 = Math.max(new Date(L.fin).getTime(), t0 + 86400_000);
  const tukey = (g: FouleN) => {
    const e = 1.5 * (g.q!.q3 - g.q!.q1);
    const dedans = g.valeurs.filter((v) => v >= g.q!.q1 - e && v <= g.q!.q3 + e);
    return { haut: Math.max(...dedans), bas: Math.min(...dedans) };
  };
  const avecBoite = colonnes.filter((c) => c.f?.q);
  const lus = f.lus.filter((l) => l.valeur !== null);
  const plafond = Math.max(...(avecBoite.length ? avecBoite.map((c) => tukey(c.f!).haut) : lus.map((l) => l.valeur!)), 1);
  const vmax = plafond * 1.1;
  const y = (v: number) => H - 30 - (Math.min(v, vmax) / vmax) * (H - 56);
  const x = (t: number) => 64 + ((t - t0) / (t1 - t0)) * (NX - 84);
  const tous = L.sp.pt === "1";
  const numero = new Map(L.sel.map((l, i) => [l.post.id, i + 1]));
  const c = COULEUR_FORMAT[f.format] ?? NEUTRE.trait;
  const colW = (W - NX - 30) / colonnes.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="block" role="img" aria-label={`Les ${f.format} de la période face à leur année`}>
      {[0, 0.5, 1].map((k) => (
        <g key={k}>
          <line x1={58} x2={W - 6} y1={y(k * plafond)} y2={y(k * plafond)} stroke={NEUTRE.trait} strokeOpacity={0.22} />
          <text x={52} y={y(k * plafond) + 3.5} fontSize={11} fill="#8b8e98" textAnchor="end">{fmt(k * plafond, cle)}</text>
        </g>
      ))}
      <text x={64} y={H - 8} fontSize={11} fill="#8b8e98">{dateCourte(L.debut)}</text>
      <text x={NX - 20} y={H - 8} fontSize={11} fill="#8b8e98" textAnchor="end">{dateCourte(L.fin)}</text>
      <line x1={NX} x2={NX} y1={8} y2={H - 22} stroke={NEUTRE.trait} strokeOpacity={0.45} strokeDasharray="3 3" />
      {lus.map((l) => {
        const cx = x(new Date(l.post.date).getTime());
        const dessus = l.valeur! > vmax;
        const n = tous ? undefined : numero.get(l.post.id);
        const creux = l.dehors !== null || l.recent || l.ecarte;
        return (
          <a key={l.post.id} href={lien(L.sp, { post: l.post.id })}>
            <title>{`${fmt(l.valeur, cle)} · ${placeN(l, f)}`}</title>
            {dessus ? (
              <>
                <path d={`M${cx - 6},${y(vmax) + 7} L${cx + 6},${y(vmax) + 7} L${cx},${y(vmax) - 2} Z`} fill={c} />
                <text x={cx} y={y(vmax) - 6} fontSize={10} fill="#5a5d66" textAnchor="middle">{n ? `${n} · ` : ""}{fmt(l.valeur, cle)}</text>
              </>
            ) : (
              <circle cx={cx} cy={y(l.valeur!)} r={n ? 10 : 5} fill={creux && !n ? "#fff" : c} stroke={n ? "#fff" : c} strokeWidth={n ? 2.5 : 1.5} opacity={l.ecarte ? 0.4 : 1} />
            )}
            {n && !dessus && <text x={cx} y={y(l.valeur!) + 4} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle">{n}</text>}
          </a>
        );
      })}
      {colonnes.map((col, i) => {
        const cx = NX + 30 + colW * i + colW / 2 - 20;
        const g = col.f;
        return (
          <g key={col.nom}>
            <text x={cx} y={H - 8} fontSize={11.5} fontWeight={col.ref ? 700 : 500} fill={col.ref ? "#0e0f12" : "#5a5d66"} textAnchor="middle">{col.nom}</text>
            {g?.q ? (
              <>
                <line x1={cx} x2={cx} y1={y(tukey(g).haut)} y2={y(tukey(g).bas)} stroke={c} strokeOpacity={0.6} />
                <line x1={cx - 9} x2={cx + 9} y1={y(tukey(g).haut)} y2={y(tukey(g).haut)} stroke={c} strokeOpacity={0.6} />
                <line x1={cx - 9} x2={cx + 9} y1={y(tukey(g).bas)} y2={y(tukey(g).bas)} stroke={c} strokeOpacity={0.6} />
                <rect x={cx - 22} y={y(g.q.q3)} width={44} height={Math.max(3, y(g.q.q1) - y(g.q.q3))} rx={5} fill={c} fillOpacity={col.ref ? 0.2 : 0.08} stroke={c} strokeDasharray={col.ref ? undefined : "4 3"} />
                <line x1={cx - 26} x2={cx + 26} y1={y(g.q.med)} y2={y(g.q.med)} stroke={c} strokeWidth={3} />
                {g.valeurs.filter((v) => v <= vmax).map((v, k) => <circle key={k} cx={cx - 34} cy={y(v)} r={1.8} fill={c} opacity={0.5} />)}
                <text x={cx + 30} y={y(g.q.q3) + 4} fontSize={10} fill="#5a5d66">{fmt(g.q.q3, cle)}</text>
                <text x={cx + 30} y={y(g.q.med) + 4} fontSize={11} fontWeight={700} fill="#0e0f12">{fmt(g.q.med, cle)}</text>
                <text x={cx + 30} y={y(g.q.q1) + 4} fontSize={10} fill="#5a5d66">{fmt(g.q.q1, cle)}</text>
                <text x={cx} y={H - 22} fontSize={9.5} fill="#8b8e98" textAnchor="middle">{g.valeurs.length} posts</text>
                {g.valeurs.some((v) => v > vmax) && (
                  <text x={cx} y={14} fontSize={9.5} fill="#5a5d66" textAnchor="middle">{`▲ ${g.valeurs.filter((v) => v > vmax).length} plus haut`}</text>
                )}
              </>
            ) : (
              <text x={cx} y={H / 2} fontSize={10.5} fill="#8b8e98" textAnchor="middle">{`${g?.nAvant ?? 0} / ${MINIMUM} posts`}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function ColonnePosts({ L }: { L: Lecture }) {
  const tous = L.sp.pt === "1";
  const liste = tous ? selection(L.fs, "haut", [], 999) : L.sel;
  return (
    <aside className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white xl:sticky xl:top-4">
      <div className="border-b border-line px-4 py-3">
        <div className="text-[13.5px] font-semibold text-ink">{tous ? `Tous tes posts, du meilleur au moins bon en ${L.metrique.nom.toLowerCase()}` : intitule(L)}</div>
        <div className="mt-0.5 text-[11px] text-faint">chacun placé contre ses pareils des 12 derniers mois</div>
        <div className="mt-2 flex gap-1">
          <Pastille href={lien(L.sp, { pt: undefined })} actif={!tous}>La sélection</Pastille>
          <Pastille href={lien(L.sp, { pt: "1" })} actif={tous}>Tous ({selection(L.fs, "haut", [], 999).length})</Pastille>
        </div>
      </div>
      <div className="grid max-h-[80vh] gap-2 overflow-y-auto bg-canvas p-2">
        {liste.map((l, i) => <CartePost key={l.post.id} L={L} l={l} n={i + 1} compacte />)}
      </div>
    </aside>
  );
}

function PageD(L: Lecture) {
  return (
    <section>
      <Titre titre="Tes posts face à ton année" sous="Format par format : le nuage de la période à gauche, tes moustaches à droite — l'année, puis tes derniers mois." droite={<ChoixSelection L={L} />} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 rounded-2xl border border-line bg-white p-5">
          <SurQuoiAnnee L={L} />
          <Definition L={L} />
          <PhraseEcartes L={L} />
          <div className="grid gap-5">
            {L.fs.map((f) => <RangeeFormat key={f.format} L={L} f={f} />)}
          </div>
          <p className="mt-3 text-[11px] text-faint">
            Point creux = moins de 48 h, peut encore changer, ou écarté. Triangle = au-delà du haut de l&apos;axe. Boîte pleine = l&apos;année, ta
            référence ; boîtes en pointillé = tes derniers mois. Les petits points à gauche d&apos;une boîte sont les posts qui la font.
          </p>
        </div>
        <ColonnePosts L={L} />
      </div>
    </section>
  );
}
