// PROTOTYPE JETABLE — ticket « La page entière, en maquette »
// (.scratch/instagram/issues/13-la-page-entiere-en-maquette.md). Ne part
// jamais sur `main` : il vit sur la branche `prototype/instagram-page`.
//
// Trois pages entières sur les vrais posts du compte, dans `/instagram`
// derrière `?maquette=page`, basculées par `?pv=` :
//   A « Le squelette »        — l'ordre de « La structure de la page » au mot
//                                près : Tendance, objectif, Comparaison,
//                                Sélection, Tableau — un module par étage ;
//   B « La foule en un module » — le nuage date × métrique et les moustaches
//                                verticales sur le même axe, la Sélection
//                                numérotée dedans (la réserve de David :
//                                formats et posts dans un même module) ;
//   C « Le fil d'abord »      — la liste des posts est la colonne vertébrale,
//                                le Panneau latéral reste ouvert à droite.
// `?etat=neuf|jeton|gratuit` simule les états de la page.
//
// Le calcul de la foule vient du prototype du carré (`calcul.ts`, ticket 12) :
// une seule copie des règles tranchées.
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
  type PostLu,
} from "../_prototype-selection/calcul";
import { SwitcherPage } from "./switcher";

type SP = DashParams & Record<string, string | string[] | undefined>;

const VARIANTES = [
  { cle: "A", nom: "Le squelette" },
  { cle: "B", nom: "La foule en un module" },
  { cle: "C", nom: "Le fil d'abord" },
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

// ── L'OBJECTIF (ticket 01) ET SES MÉTRIQUES (tickets 09, 11) ────────────────
// Une métrique sans `cle` n'est pas en base : la maquette la montre grisée avec
// sa raison plutôt que de l'inventer (§7).

type Metrique = { cle: string | null; nom: string; pourquoi?: string };
const OBJECTIFS: { cle: string; nom: string; metriques: Metrique[] }[] = [
  {
    cle: "portee",
    nom: "Portée",
    metriques: [
      { cle: "reach", nom: "Portée" },
      { cle: "views", nom: "Vues" },
      { cle: null, nom: "Portée ÷ abonnés", pourquoi: "il faut les abonnés au jour du post : le relevé quotidien n'existe pas encore" },
    ],
  },
  {
    cle: "engagement",
    nom: "Engagement",
    metriques: [
      { cle: "eng", nom: "Engagement" },
      { cle: "likes", nom: "J'aime" },
      { cle: "comments", nom: "Commentaires" },
      { cle: "saved", nom: "Enregistrements" },
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
// Ce qui se compte s'additionne ; une portée ou un taux, jamais (map, Notes).
const ADDITIVES = new Set(["views", "likes", "comments", "saved"]);

type Lecture = {
  sp: SP;
  objectif: (typeof OBJECTIFS)[number];
  metrique: Metrique;
  cle: string | null;
  fs: Foule[];
  sel: PostLu[];
  mode: Mode;
  choisis: string[];
  sansHorsNorme: boolean;
  posts: InstaPost[];
  serie: FollowerPoint[];
  debut: string;
  fin: string;
  ouvert: PostLu | undefined;
  /** La place du post ouvert sur chaque métrique. */
  places: { nom: string; texte: string; valeur: string }[];
};

// ── L'ENTRÉE ────────────────────────────────────────────────────────────────

export function PrototypePage({
  posts: postsReels,
  serie: serieReelle,
  debut,
  fin,
  sp,
}: {
  posts: InstaPost[];
  serie: FollowerPoint[];
  debut: string;
  fin: string;
  sp: SP;
}) {
  const etat = String(sp.etat ?? "");
  // « gratuit » : le compte gratuit ne suit que les 10 derniers posts
  // (`sync.py:_a_relire`) — on coupe pour voir ce que la page en dit.
  const posts = etat === "neuf" ? [] : etat === "gratuit" ? postsReels.slice(0, 10) : postsReels;
  const serie = etat === "neuf" ? [] : serieReelle;

  const objectif = OBJECTIFS.find((o) => o.cle === sp.obj) ?? OBJECTIFS[0];
  const metrique =
    objectif.metriques.find((m) => m.cle !== null && m.cle === sp.pm) ??
    objectif.metriques.find((m) => m.cle !== null) ??
    objectif.metriques[0];
  const cle = metrique.cle;
  const mode = (MODES.some((m) => m.cle === sp.pmode) ? sp.pmode : "haut") as Mode;
  const sansHorsNorme = sp.phn === "1";
  const choisis = String(sp.ps ?? "").split(",").filter(Boolean).slice(0, 5);
  const variante = VARIANTES.some((v) => v.cle === sp.pv) ? String(sp.pv) : "A";
  const maintenant = Date.now();

  const fs = cle ? foules(posts, cle, sansHorsNorme, maintenant).filter((f) => f.lus.length > 0) : [];
  const sel = cle ? selection(fs, mode, choisis, 5) : [];
  const tousLus = foules(posts, "reach", false, maintenant).flatMap((f) => f.lus);
  const ouvert = sp.post ? (fs.flatMap((f) => f.lus).find((l) => l.post.id === sp.post) ?? tousLus.find((l) => l.post.id === sp.post)) : undefined;
  const places = ouvert
    ? METRIQUES.map((m) => {
        const f = foules(posts, m.cle, sansHorsNorme, maintenant).find((x) => x.format === ouvert.post.type);
        const l = f?.lus.find((x) => x.post.id === ouvert.post.id);
        return { nom: m.nom, valeur: fmt(l?.valeur ?? null, m.cle), texte: l ? placeEcrite(l, f) : "–" };
      })
    : [];

  const L: Lecture = { sp, objectif, metrique, cle, fs, sel, mode, choisis, sansHorsNorme, posts, serie, debut, fin, ouvert, places };

  return (
    <section className="mt-4">
      <BandeauMaquette sp={sp} etat={etat} n={postsReels.length} />
      {etat === "jeton" && <JetonMort />}
      {variante === "A" && <PageA {...L} />}
      {variante === "B" && <PageB {...L} />}
      {variante === "C" && <PageC {...L} />}
      {ouvert && variante !== "C" && <PanneauLateral L={L} flottant />}
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
    <div className="mb-5 rounded-lg border border-dashed border-[#7b4fff66] bg-[#7b4fff0d] px-3 py-2 text-[11.5px] text-muted">
      <b className="text-ink">Prototype jetable</b> — la page entière en {VARIANTES.length} variantes (← → ou la barre en bas),
      sur les {n} posts de la période. Les courbes du compte ne sont pas en base : leur cadre est vide, et le dit.
      <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
        {etats.map((e) => (
          <a key={e.nom} href={lien(sp, { etat: e.cle, post: undefined })} className={`rounded-full border px-2 py-0.5 ${(e.cle ?? "") === etat ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
            {e.nom}
          </a>
        ))}
      </span>
    </div>
  );
}

// ── LES ÉTATS ───────────────────────────────────────────────────────────────

function JetonMort() {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#b86b0055] bg-[#b86b000d] px-4 py-3 text-[13px]">
      <span className="font-semibold text-warn">La connexion Instagram a expiré.</span>
      <span className="text-muted">
        Les chiffres ci-dessous s&apos;arrêtent au dernier relevé ; aucun nouveau post n&apos;est lu. Une fois reconnecté, le prochain passage du
        worker (Jour de travail, 07:00 UTC) reprend là où il s&apos;est arrêté.
      </span>
      <a href="/comptes" className="ml-auto rounded-full bg-ink px-3 py-1 text-[12px] font-semibold text-white">Reconnecter</a>
    </div>
  );
}

function CompteNeuf() {
  return (
    <div className="rounded-2xl border border-line bg-white px-6 py-10 text-center">
      <p className="text-[15px] font-medium text-ink">Ton compte Instagram est branché. Aucun post n&apos;est encore lu.</p>
      <p className="mx-auto mt-2 max-w-[520px] text-[13px] text-muted">
        Le premier passage du worker (ton Jour de travail, 07:00 UTC) lira tes posts et les 90 jours de compte que Meta garde. La
        Comparaison et la Sélection apparaissent dès qu&apos;un format compte {MINIMUM} posts de plus de 48 h.
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

// La Tendance (ticket 10) : trois courbes de compte. Portée et Interactions
// n'ont aucune ligne en base — le cadre reste vide et le dit ; les jours de
// publication sont, eux, réels et ouvrent le Panneau latéral.
function Courbe({ nom, note, serie, posts, debut, fin, sp, haut = 120 }: {
  nom: string;
  note: string;
  serie: { t: number; v: number }[];
  posts: InstaPost[];
  debut: string;
  fin: string;
  sp: SP;
  haut?: number;
}) {
  const W = 420;
  const t0 = new Date(debut).getTime();
  const t1 = Math.max(new Date(fin).getTime(), t0 + 86400_000);
  const x = (t: number) => 8 + ((t - t0) / (t1 - t0)) * (W - 16);
  const dans = serie.filter((p) => p.t >= t0 && p.t <= t1);
  const min = Math.min(...dans.map((p) => p.v));
  const max = Math.max(...dans.map((p) => p.v));
  const y = (v: number) => haut - 22 - ((v - min) / (max - min || 1)) * (haut - 40);
  const dernier = dans[dans.length - 1];
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-faint">{nom}</div>
      <div className="font-mono text-[22px] font-medium text-ink">{dernier ? Math.round(dernier.v).toLocaleString("fr-CH") : "–"}</div>
      <svg viewBox={`0 0 ${W} ${haut}`} width="100%" className="block max-h-[140px]" role="img" aria-label={nom}>
        <line x1={8} x2={W - 8} y1={haut - 18} y2={haut - 18} stroke={NEUTRE.trait} strokeOpacity={0.5} />
        {dans.length >= 2 ? (
          <polyline fill="none" stroke="#7b4fff" strokeWidth={2} points={dans.map((p) => `${x(p.t)},${y(p.v)}`).join(" ")} />
        ) : (
          <text x={W / 2} y={(haut - 18) / 2 + 4} fontSize={11} fill="#8b8e98" textAnchor="middle">pas en base pour cette période</text>
        )}
        {posts.map((p) => {
          const t = new Date(p.date).getTime();
          if (t < t0 || t > t1) return null;
          return (
            <a key={p.id} href={lien(sp, { post: p.id })}>
              <circle cx={x(t)} cy={haut - 9} r={3} fill={COULEUR_FORMAT[p.type] ?? NEUTRE.trait} />
            </a>
          );
        })}
      </svg>
      <p className="mt-1 text-[11px] leading-snug text-faint">{note}</p>
    </div>
  );
}

function Tendance({ L, compacte }: { L: Lecture; compacte?: boolean }) {
  const ab = L.serie.map((p) => ({ t: new Date(p.date).getTime(), v: p.followers }));
  const derniere = L.serie.length ? L.serie[L.serie.length - 1].date.slice(0, 10) : null;
  const noteAb = derniere
    ? `Cumul. Dernier relevé le ${derniere} : \`followers_history\` n'a plus d'écrivain depuis septembre. Barres gagnés/perdus : selon l'essai réel.`
    : "Aucun relevé d'abonnés sur la période.";
  const commun = { posts: L.posts, debut: L.debut, fin: L.fin, sp: L.sp, haut: compacte ? 80 : 120 };
  return (
    <div className={`grid gap-3 ${compacte ? "sm:grid-cols-3" : "lg:grid-cols-3"}`}>
      <Courbe nom="Portée du compte" note="Par jour, jamais additionnée. Lue au premier passage (90 jours). Points = jours de publication." serie={[]} {...commun} />
      <Courbe nom="Interactions du compte" note="Par jour, boosts compris tant que l'essai réel n'a pas tranché l'interrupteur." serie={[]} {...commun} />
      <Courbe nom="Abonnés" note={noteAb} serie={ab} {...commun} />
    </div>
  );
}

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
            {m.nom}{!m.cle && " ·  pas en base"}
          </Pastille>
        ))}
      </div>
      <ReglesDeLecture L={L} />
    </div>
  );
}

// Simule le bouton « Règles de lecture » du Bandeau (ticket 11).
function ReglesDeLecture({ L }: { L: Lecture }) {
  return (
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
  );
}

function PhraseEcartes({ L }: { L: Lecture }) {
  if (!L.sansHorsNorme) return null;
  const parFormat = L.fs.map((f) => ({ f, n: f.lus.filter((l) => l.ecarte).length })).filter((x) => x.n > 0);
  const total = parFormat.reduce((s, x) => s + x.n, 0);
  return (
    <p className="mb-3 text-[12px] text-muted">
      {total === 0
        ? `Aucun post hors norme sur ${L.metrique.nom.toLowerCase()} : rien n'est écarté. `
        : `${total} post${total > 1 ? "s" : ""} hors norme écarté${total > 1 ? "s" : ""} — ${parFormat
            .map(({ f, n }) => `moustache sur ${f.valeurs.length} ${pluriel(f.format, f.valeurs.length)} au lieu de ${f.nAvant}`)
            .join(", ")}. `}
      <a href={lien(L.sp, { phn: undefined })} className="font-semibold text-ink underline decoration-line underline-offset-2">Revenir aux règles standard</a>
    </p>
  );
}

// Pas de métrique en base (objectif Abonnés) : une phrase à la place des
// moustaches, aucune valeur inventée (tickets 09, 13).
function SansMetrique({ L }: { L: Lecture }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-8 text-center text-[13px] text-muted">
      <b className="text-ink">{L.metrique.nom}</b> : Instagram le rend, Pulse ne le récolte pas encore — {L.metrique.pourquoi}.
      <br />Aucune moustache tant que la récolte ne le lit pas.
    </div>
  );
}

// Un bloc par format au-dessus des moustaches (ticket 09) : post type, total
// seulement pour ce qui se compte, n, et « x sur n » quand des posts manquent.
function BlocsFormats({ L, filtre }: { L: Lecture; filtre?: boolean }) {
  const cle = L.cle!;
  const actif = String(L.sp.pf ?? "");
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {L.fs.map((f) => {
        const mesures = f.lus.filter((l) => l.valeur !== null).length;
        const total = ADDITIVES.has(cle) ? f.valeurs.reduce((s, v) => s + v, 0) : null;
        const corps = (
          <>
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
              <span className="h-2 w-2 rounded-full" style={{ background: COULEUR_FORMAT[f.format] }} /> {f.format}
            </div>
            <div className="mt-1 font-mono text-[19px] text-ink">{f.q ? fmt(f.q.med, cle) : "–"}</div>
            <div className="text-[10.5px] text-faint">
              {f.q ? "post type" : `pas de moustache sous ${MINIMUM} posts`}
              {total !== null && <> · total {fmt(total, cle)}</>}
            </div>
            <div className="text-[10.5px] text-faint">
              {f.valeurs.length} post{f.valeurs.length > 1 ? "s" : ""}
              {mesures < f.lus.length && ` · ${mesures} sur ${f.lus.length} mesurés`}
            </div>
          </>
        );
        const cls = `min-w-0 rounded-xl border p-3 ${actif === f.format ? "border-ink bg-white" : "border-line bg-white"}`;
        return filtre ? (
          <a key={f.format} href={lien(L.sp, { pf: actif === f.format ? undefined : f.format })} className={`${cls} hover:shadow-md`}>{corps}</a>
        ) : (
          <div key={f.format} className={cls}>{corps}</div>
        );
      })}
    </div>
  );
}

function bornesCommunes(fs: Foule[]): { min: number; max: number } | undefined {
  const v = fs.flatMap((f) => f.lus.filter((l) => l.dehors === null).map((l) => l.valeur!));
  return v.length ? { min: Math.min(...v), max: Math.max(...v) } : undefined;
}

/** Moustache horizontale, une ligne par format, échelle commune. */
function MoustacheH({ f, cle, echelle, marques = [], haut = 46 }: {
  f: Foule;
  cle: string;
  echelle?: { min: number; max: number };
  marques?: { l: PostLu; n?: number }[];
  haut?: number;
}) {
  const W = 460;
  const M = 12;
  const Y = haut / 2 + 3;
  const tout = f.lus.filter((l) => l.dehors === null).map((l) => l.valeur!);
  const min = echelle?.min ?? Math.min(...tout);
  const max = echelle?.max ?? Math.max(...tout);
  const pad = (max - min) * 0.03 || 1;
  const x = (v: number) => M + ((v - (min - pad)) / (max - min + 2 * pad)) * (W - 2 * M);
  return (
    <svg viewBox={`0 0 ${W} ${haut}`} width="100%" className="block max-w-[640px]" role="img" aria-label={`Moustache des ${f.format}`}>
      {f.valeurs.length > 0 && <line x1={x(Math.min(...f.valeurs))} x2={x(Math.max(...f.valeurs))} y1={Y} y2={Y} stroke={NEUTRE.trait} strokeOpacity={0.5} strokeWidth={1.5} />}
      {f.q && (
        <>
          <rect x={x(f.q.q1)} y={Y - 9} width={Math.max(3, x(f.q.q3) - x(f.q.q1))} height={18} rx={5} fill={NEUTRE.aplat} />
          <line x1={x(f.q.med)} x2={x(f.q.med)} y1={Y - 12} y2={Y + 12} stroke="#5a5d66" strokeWidth={2} strokeLinecap="round" />
        </>
      )}
      {f.lus.filter((l) => l.dehors === null).map((l) => (
        <circle key={l.post.id} cx={x(l.valeur!)} cy={Y} r={2.4} fill={l.ecarte ? "none" : NEUTRE.trait} stroke={l.ecarte ? NEUTRE.trait : "none"} />
      ))}
      {marques.filter(({ l }) => l.dehors === null && l.valeur !== null).map(({ l, n }) => (
        <g key={l.post.id}>
          <circle cx={x(l.valeur!)} cy={Y} r={n ? 8.5 : 6.5} fill={teinte(l)} stroke="#fff" strokeWidth={2.5} />
          {n && <text x={x(l.valeur!)} y={Y + 3.5} fontSize={10} fontWeight={700} fill="#fff" textAnchor="middle">{n}</text>}
        </g>
      ))}
      {!f.q && <text x={W / 2} y={Y + 4} fontSize={10.5} fill="#8b8e98" textAnchor="middle">{f.valeurs.length} {pluriel(f.format, f.valeurs.length)} — il en faut {MINIMUM}</text>}
      {f.q && haut >= 46 && <text x={Math.min(W - 50, Math.max(50, x(f.q.med)))} y={8} fontSize={9} fill="#5a5d66" textAnchor="middle">post type {fmt(f.q.med, cle)}</text>}
    </svg>
  );
}

function Comparaison({ L }: { L: Lecture }) {
  const echelle = bornesCommunes(L.fs);
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <PhraseEcartes L={L} />
      <BlocsFormats L={L} />
      <div className="mt-4 grid gap-1">
        {L.fs.map((f) => (
          <div key={f.format} className="grid items-center gap-3 sm:grid-cols-[110px_minmax(0,1fr)]">
            <div className="text-[12px] font-semibold text-ink">{f.format}</div>
            <div className="min-w-0"><MoustacheH f={f} cle={L.cle!} echelle={echelle} /></div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-faint">Une échelle pour tous les formats. Points creux = écartés. Les posts de moins de 48 h n&apos;y sont pas.</p>
    </div>
  );
}

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

// ── LE TABLEAU DES POSTS ────────────────────────────────────────────────────

const COLONNES = [
  { cle: "reach", nom: "Portée" },
  { cle: "views", nom: "Vues" },
  { cle: "likes", nom: "J'aime" },
  { cle: "comments", nom: "Comm." },
  { cle: "saved", nom: "Enreg." },
  { cle: "eng", nom: "Eng." },
];

function lusDuTableau(L: Lecture): PostLu[] {
  const lus = L.cle ? L.fs.flatMap((f) => f.lus) : foules(L.posts, "reach", false, Date.now()).flatMap((f) => f.lus);
  const s = String(L.sp.s ?? "date");
  const filtre = String(L.sp.pf ?? "");
  const rangs = lus.filter((l) => !filtre || l.post.type === filtre);
  if (s === "date" || !COLONNES.some((c) => c.cle === s)) return rangs.sort((a, b) => b.post.date.localeCompare(a.post.date));
  const v = (l: PostLu) => {
    const x = (l.post as unknown as Record<string, number | null>)[s];
    return x === null || (s !== "eng" && x === 0) ? -1 : x;
  };
  return rangs.sort((a, b) => v(b) - v(a));
}

function valeurCellule(p: InstaPost, cle: string): string {
  const x = (p as unknown as Record<string, number | null>)[cle];
  if (x === null || ((cle === "views" || cle === "reach") && x === 0)) return "–";
  if (cle === "likes" && p.type === "Reel" && x === 0) return "–";
  return fmt(x, cle);
}

function Tableau({ L, coches, hauteur = "max-h-[460px]" }: { L: Lecture; coches?: boolean; hauteur?: string }) {
  const rangs = lusDuTableau(L);
  const s = String(L.sp.s ?? "date");
  const formats = L.cle ? new Map(L.fs.map((f) => [f.format, f])) : new Map<string, Foule>();
  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 text-[12px]">
        <span className="font-semibold text-ink">{rangs.length} posts</span>
        <span className="text-faint">· place lue en {L.metrique.nom.toLowerCase()}{L.cle ? "" : " (pas en base)"}</span>
        <span className="ml-auto rounded-full border border-line px-2.5 py-1 font-semibold text-muted" title="Maquette : exporte le Tableau tel que trié et filtré">
          Exporter vers Excel
        </span>
      </div>
      <div className={`${hauteur} overflow-auto`}>
        <table className="w-full min-w-[760px] text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-faint">
              {coches && <th className="sticky top-0 bg-white px-2 py-2" />}
              <th className="sticky top-0 bg-white px-3 py-2 text-left"><a href={lien(L.sp, { s: "date" })} className={s === "date" ? "text-ink" : ""}>Post</a></th>
              <th className="sticky top-0 bg-white px-2 py-2 text-left">Format · âge</th>
              {COLONNES.map((c) => (
                <th key={c.cle} className="sticky top-0 bg-white px-2 py-2 text-right">
                  <a href={lien(L.sp, { s: c.cle })} className={s === c.cle ? "text-ink" : ""}>{c.nom}{s === c.cle && " ↓"}</a>
                </th>
              ))}
              <th className="sticky top-0 bg-white px-3 py-2 text-left">Place</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rangs.map((l) => {
              const coche = L.choisis.includes(l.post.id);
              const suivant = coche ? L.choisis.filter((id) => id !== l.post.id) : [...L.choisis, l.post.id];
              const ouvert = L.ouvert?.post.id === l.post.id;
              return (
                <tr key={l.post.id} className={`${l.ecarte ? "opacity-45" : ""} ${ouvert ? "bg-[#7b4fff0d]" : ""}`}>
                  {coches && (
                    <td className="px-2">
                      <a href={!coche && L.choisis.length >= 5 ? undefined : lien(L.sp, { ps: suivant.join(",") || undefined, pmode: "main" })} className={`block h-3.5 w-3.5 rounded border ${coche ? "border-ig bg-ig" : "border-faint"}`} title="Ajouter à la Sélection (5 au plus)" />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <a href={lien(L.sp, { post: l.post.id })} className="flex items-center gap-2.5 hover:underline">
                      <Vignette p={l.post} taille="h-8 w-8" />
                      <span className="max-w-[200px] truncate text-ink">{l.post.caption || "(sans légende)"}</span>
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-2 text-muted">{l.post.type} · {age(l.ageH)} {l.recent && <span title="peut encore changer">◔</span>}</td>
                  {COLONNES.map((c) => (
                    <td key={c.cle} className={`whitespace-nowrap px-2 text-right font-mono ${c.cle === L.cle ? "text-ink" : "text-muted"}`}>{valeurCellule(l.post, c.cle)}</td>
                  ))}
                  <td className="whitespace-nowrap px-3 text-[11.5px]" style={{ color: L.cle ? teinte(l) : "#8b8e98" }}>
                    {L.cle ? placeEcrite(l, formats.get(l.post.type)) : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2 text-[11px] text-faint">
        Chiffres au dernier relevé du post. Grisé = écarté par une règle de lecture, avec sa raison. Un « – » n&apos;a pas été rendu par Instagram,
        ce n&apos;est pas un zéro.
      </p>
    </div>
  );
}

// ── LE PANNEAU LATÉRAL « LIRE UN POST » ─────────────────────────────────────

function PanneauLateral({ L, flottant }: { L: Lecture; flottant?: boolean }) {
  const l = L.ouvert!;
  const p = l.post;
  const f = L.fs.find((x) => x.format === p.type);
  const corps = (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[11px] text-faint">
          {p.type} · publié le {p.date.slice(0, 10)} · {age(l.ageH)} {l.recent && "◔ peut encore changer"}
        </span>
        <a href={lien(L.sp, { post: undefined })} className="text-[13px] text-muted hover:text-ink">Fermer ✕</a>
      </div>
      <Vignette p={p} taille="w-full h-64" />
      <p className="mt-3 line-clamp-6 whitespace-pre-line text-[13px] text-ink">{p.caption || "(sans légende)"}</p>
      <span className="mt-1 inline-block text-[11.5px] text-faint" title="`permalink` est en base, pas encore lu par la page">Voir sur Instagram ↗ <i>(lien à brancher)</i></span>
      {L.cle && (
        <div className="mt-4 rounded-xl border border-line p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-faint">{L.metrique.nom}</div>
          <div className="font-mono text-[24px] text-ink">{fmt(l.valeur, L.cle)}</div>
          <div className="mb-1 text-[12px] font-semibold" style={{ color: teinte(l) }}>{placeEcrite(l, f)}</div>
          {f?.q && l.dehors === null && <MoustacheH f={f} cle={L.cle} marques={[{ l }]} />}
        </div>
      )}
      <div className="mt-4">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-faint">Sa place sur chaque métrique, parmi les {pluriel(p.type, 2)}</div>
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
        À trancher : la vidéo du Reel, le carrousel entier, les commentaires, le temps de visionnage — rien de cela n&apos;est en base aujourd&apos;hui.
      </p>
    </>
  );
  if (!flottant) return <aside className="rounded-2xl border border-line bg-white p-4">{corps}</aside>;
  return (
    <>
      <a href={lien(L.sp, { post: undefined })} className="fixed inset-0 z-40 bg-black/20" aria-label="Fermer le panneau" />
      <aside className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-[420px] overflow-y-auto border-l border-line bg-white p-5 shadow-2xl">{corps}</aside>
    </>
  );
}

// ── PAGE A · LE SQUELETTE ───────────────────────────────────────────────────

function PageA(L: Lecture) {
  return (
    <div className="grid gap-9">
      <section>
        <Titre titre="Ta page" sous="Le compte jour par jour — pas une somme de posts." />
        <Tendance L={L} />
      </section>
      {L.posts.length === 0 ? (
        <CompteNeuf />
      ) : (
        <>
          <div className="sticky top-0 z-30 -mx-2 rounded-xl bg-canvas/95 px-2 py-2 backdrop-blur">
            <SelecteurObjectif L={L} />
          </div>
          <section>
            <Titre titre="Comparaison" sous={`Tes formats face à face, en ${L.metrique.nom.toLowerCase()}.`} />
            {L.cle ? <Comparaison L={L} /> : <SansMetrique L={L} />}
          </section>
          {L.cle && (
            <section>
              <Titre titre="Sélection" sous={`${intitule(L)} — chacun sur la moustache de son format.`} droite={<ChoixSelection L={L} />} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {L.sel.map((l) => {
                  const f = L.fs.find((x) => x.format === l.post.type);
                  return (
                    <a key={l.post.id} href={lien(L.sp, { post: l.post.id })} className="min-w-0 overflow-hidden rounded-xl border border-line bg-white hover:shadow-md">
                      <Vignette p={l.post} taille="h-36 w-full rounded-none border-0" />
                      <div className="p-3">
                        <div className="text-[10.5px] text-faint">{l.post.type} · {age(l.ageH)} {l.recent && "◔"}</div>
                        <div className="font-mono text-[19px] text-ink">{fmt(l.valeur, L.cle!)}</div>
                        <div className="text-[11.5px] font-semibold" style={{ color: teinte(l) }}>{placeEcrite(l, f)}</div>
                        {f?.q && l.dehors === null && <MoustacheH f={f} cle={L.cle!} marques={[{ l }]} haut={30} />}
                      </div>
                    </a>
                  );
                })}
                {L.sel.length === 0 && <p className="col-span-full py-6 text-center text-[13px] text-muted">Coche jusqu&apos;à 5 posts dans le Tableau.</p>}
              </div>
            </section>
          )}
          <section>
            <Titre titre="Tous tes posts" />
            <Tableau L={L} coches />
          </section>
        </>
      )}
    </div>
  );
}

// ── PAGE B · LA FOULE EN UN MODULE ──────────────────────────────────────────

/** Le nuage date × métrique, et à sa droite une moustache verticale par format
 *  sur le même axe. Le haut de l'axe s'arrête à la plus haute moustache : un
 *  hors norme au-delà se pose sur le bord, en triangle, avec sa valeur. */
function Nuage({ L }: { L: Lecture }) {
  const cle = L.cle!;
  const W = 760;
  const H = 300;
  const NX = 520; // largeur du nuage ; le reste porte les moustaches
  const t0 = new Date(L.debut).getTime();
  const t1 = Math.max(new Date(L.fin).getTime(), t0 + 86400_000);
  const lus = L.fs.flatMap((f) => f.lus.filter((l) => l.valeur !== null));
  const plafonds = L.fs.filter((f) => f.q).map((f) => f.q!.q3 + 1.5 * (f.q!.q3 - f.q!.q1));
  const vmax = Math.max(...(plafonds.length ? plafonds : lus.map((l) => l.valeur!)), 1) * 1.08;
  const y = (v: number) => H - 24 - (Math.min(v, vmax) / vmax) * (H - 44);
  const x = (t: number) => 62 + ((t - t0) / (t1 - t0)) * (NX - 72);
  const numero = new Map(L.sel.map((l, i) => [l.post.id, i + 1]));
  const colW = (W - NX - 10) / Math.max(1, L.fs.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="block max-w-[980px]" role="img" aria-label="Nuage des posts et moustaches par format">
      {[0, 0.5, 1].map((k) => (
        <g key={k}>
          <line x1={56} x2={W - 6} y1={y(vmax * k / 1.08)} y2={y(vmax * k / 1.08)} stroke={NEUTRE.trait} strokeOpacity={0.25} />
          <text x={52} y={y(vmax * k / 1.08) + 3} fontSize={9} fill="#8b8e98" textAnchor="end">{fmt(vmax * k / 1.08, cle)}</text>
        </g>
      ))}
      <line x1={NX} x2={NX} y1={10} y2={H - 20} stroke={NEUTRE.trait} strokeOpacity={0.4} strokeDasharray="3 3" />
      {lus.map((l) => {
        const cx = x(new Date(l.post.date).getTime());
        const haut = l.valeur! > vmax;
        const c = COULEUR_FORMAT[l.post.type] ?? NEUTRE.trait;
        const creux = l.dehors !== null || l.recent || l.ecarte;
        const n = numero.get(l.post.id);
        return (
          <a key={l.post.id} href={lien(L.sp, { post: l.post.id })}>
            <title>{`${l.post.type} · ${fmt(l.valeur, cle)} · ${l.dehors ?? (l.recent ? "peut encore changer" : "")}`}</title>
            {haut ? (
              <>
                <path d={`M${cx - 5},${y(vmax) + 6} L${cx + 5},${y(vmax) + 6} L${cx},${y(vmax) - 2} Z`} fill={c} />
                <text x={cx} y={y(vmax) - 5} fontSize={8.5} fill="#5a5d66" textAnchor="middle">{fmt(l.valeur, cle)}</text>
              </>
            ) : (
              <circle cx={cx} cy={y(l.valeur!)} r={n ? 8 : 3.4} fill={creux && !n ? "#fff" : c} stroke={c} strokeWidth={1.4} opacity={l.ecarte ? 0.4 : 1} />
            )}
            {n && !haut && <text x={cx} y={y(l.valeur!) + 3.5} fontSize={9.5} fontWeight={700} fill="#fff" textAnchor="middle">{n}</text>}
          </a>
        );
      })}
      {L.fs.map((f, i) => {
        const cx = NX + 10 + colW * i + colW / 2;
        const c = COULEUR_FORMAT[f.format] ?? NEUTRE.trait;
        return (
          <g key={f.format}>
            <text x={cx} y={H - 6} fontSize={9.5} fill="#5a5d66" textAnchor="middle">{f.format}</text>
            {f.q ? (
              <>
                <line x1={cx} x2={cx} y1={y(Math.max(...f.valeurs))} y2={y(Math.min(...f.valeurs))} stroke={c} strokeOpacity={0.5} />
                <rect x={cx - 11} y={y(f.q.q3)} width={22} height={Math.max(3, y(f.q.q1) - y(f.q.q3))} rx={4} fill={c} fillOpacity={0.16} stroke={c} />
                <line x1={cx - 14} x2={cx + 14} y1={y(f.q.med)} y2={y(f.q.med)} stroke={c} strokeWidth={2.5} />
              </>
            ) : (
              <text x={cx} y={H / 2} fontSize={9} fill="#8b8e98" textAnchor="middle">{f.valeurs.length}/{MINIMUM}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function PageB(L: Lecture) {
  return (
    <div className="grid gap-8">
      <section>
        <Titre titre="Ta page" />
        <Tendance L={L} compacte />
      </section>
      {L.posts.length === 0 ? (
        <CompteNeuf />
      ) : (
        <>
          <SelecteurObjectif L={L} />
          <section>
            <Titre titre="Tes posts dans la foule" sous={L.cle ? `${intitule(L)}, numérotés, parmi tous tes posts — et la moustache de chaque format sur le même axe.` : undefined} droite={L.cle ? <ChoixSelection L={L} /> : undefined} />
            {L.cle ? (
              <div className="rounded-2xl border border-line bg-white p-5">
                <PhraseEcartes L={L} />
                <BlocsFormats L={L} />
                <div className="mt-4"><Nuage L={L} /></div>
                <p className="mb-3 text-[11px] text-faint">Couleur = format. Point creux = trop jeune (moins de 48 h), peut encore changer, ou écarté. Triangle = au-delà de l&apos;axe.</p>
                <div className="flex gap-2 overflow-x-auto border-t border-line pt-3">
                  {L.sel.map((l, i) => (
                    <a key={l.post.id} href={lien(L.sp, { post: l.post.id })} className="flex min-w-[210px] flex-1 items-center gap-2.5 rounded-xl p-2 hover:bg-black/[0.03]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: COULEUR_FORMAT[l.post.type] }}>{i + 1}</span>
                      <Vignette p={l.post} taille="h-11 w-11" />
                      <span className="min-w-0">
                        <span className="block font-mono text-[14px] text-ink">{fmt(l.valeur, L.cle!)}</span>
                        <span className="block truncate text-[11px]" style={{ color: teinte(l) }}>{placeEcrite(l, L.fs.find((f) => f.format === l.post.type))}</span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <SansMetrique L={L} />
            )}
          </section>
          <section>
            <Titre titre="Tous tes posts" />
            <Tableau L={L} coches />
          </section>
        </>
      )}
    </div>
  );
}

// ── PAGE C · LE FIL D'ABORD ─────────────────────────────────────────────────

function PageC(L: Lecture) {
  const echelle = L.cle ? bornesCommunes(L.fs) : undefined;
  const numero = new Map(L.sel.map((l, i) => [l.post.id, i + 1]));
  return (
    <div className="grid gap-6">
      <Tendance L={L} compacte />
      {L.posts.length === 0 ? (
        <CompteNeuf />
      ) : (
        <>
          <SelecteurObjectif L={L} />
          {L.cle && <BlocsFormats L={L} filtre />}
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="min-w-0">
              {L.cle ? <Tableau L={L} coches hauteur="max-h-[720px]" /> : <SansMetrique L={L} />}
            </div>
            <div className="min-w-0 xl:sticky xl:top-4">
              {L.ouvert ? (
                <PanneauLateral L={L} />
              ) : L.cle ? (
                <aside className="rounded-2xl border border-line bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink">{L.mode === "main" ? "Ta sélection" : "Sélection"}</span>
                    <ChoixSelection L={L} />
                  </div>
                  <PhraseEcartes L={L} />
                  {L.fs.map((f) => (
                    <div key={f.format} className="mt-1">
                      <div className="text-[11px] font-semibold text-muted">{f.format}</div>
                      <MoustacheH f={f} cle={L.cle!} echelle={echelle} haut={34} marques={L.sel.filter((l) => l.post.type === f.format).map((l) => ({ l, n: numero.get(l.post.id) }))} />
                    </div>
                  ))}
                  <ol className="mt-3 grid gap-1 text-[12px]">
                    {L.sel.map((l, i) => (
                      <li key={l.post.id}>
                        <a href={lien(L.sp, { post: l.post.id })} className="flex items-center gap-2 hover:underline">
                          <span className="w-4 text-right font-bold text-faint">{i + 1}</span>
                          <Vignette p={l.post} taille="h-7 w-7" />
                          <span className="font-mono text-ink">{fmt(l.valeur, L.cle!)}</span>
                          <span className="min-w-0 truncate" style={{ color: teinte(l) }}>{placeEcrite(l, L.fs.find((f) => f.format === l.post.type))}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-[11px] text-faint">Coche des posts dans la liste pour composer ta Sélection ; clique un post pour le lire ici.</p>
                </aside>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
