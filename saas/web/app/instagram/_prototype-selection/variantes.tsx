// PROTOTYPE JETABLE — ticket « Le carré de sélection, en maquette ».
//
// Trois variantes de la Sélection, sur les vrais posts du compte, montées dans
// `/instagram` et basculées par `?variant=` :
//   A « Deux modules »  — la Comparaison (une moustache par format) puis la
//                         Sélection en cartes, chacune avec la moustache de
//                         son format ;
//   B « Un seul module » — les posts choisis posés, numérotés, sur les
//                         moustaches des formats ; une bande de vignettes ;
//   C « Les bandes »     — la phrase de David (« 2 dans la moyenne, 2 sur les
//                         50-75 %, 1 hors norme ») prise au mot : une colonne
//                         par place, les posts rangés dedans.
// Tout passe par l'URL (pm, pmode, ps, phn, post) : un lien partagé rouvre la
// même Sélection (ticket 01, « un lien qui garde la sélection »).
import { lienDash } from "@/lib/liens";
import type { DashParams, InstaPost } from "@/lib/channels";
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
} from "./calcul";
import { PrototypeSwitcher } from "./switcher";

type SP = DashParams & Record<string, string | string[] | undefined>;

const VARIANTES = [
  { cle: "A", nom: "Deux modules, cartes" },
  { cle: "B", nom: "Un seul module, points numérotés" },
  { cle: "C", nom: "Les bandes" },
];

const VIOLET = "#7b4fff";
const POS = "#1a7a4a";
const NEG = "#c0392b";

const lien = (sp: SP, patch: Record<string, string | undefined>) =>
  lienDash("/instagram", sp, patch as Partial<DashParams>, "reach");

const pluriel = (format: string, n: number) => (n > 1 && !format.endsWith("fil") ? `${format}s` : format);

function teinte(l: PostLu): string {
  if (l.ecarte) return "#c9c9cf";
  if (l.horsNorme === "haut" || l.place === "au-dessus") return POS;
  if (l.horsNorme === "bas" || l.place === "en dessous") return NEG;
  return "#5a5d66";
}

// ── L'ENTRÉE ────────────────────────────────────────────────────────────────

export function PrototypeSelection({ posts, sp }: { posts: InstaPost[]; sp: SP }) {
  const cle = METRIQUES.some((m) => m.cle === sp.pm) ? String(sp.pm) : "likes";
  const metrique = METRIQUES.find((m) => m.cle === cle)!;
  const mode = (MODES.some((m) => m.cle === sp.pmode) ? sp.pmode : "haut") as Mode;
  const sansHorsNorme = sp.phn === "1";
  const choisis = String(sp.ps ?? "").split(",").filter(Boolean).slice(0, 5);
  const variante = VARIANTES.some((v) => v.cle === sp.variant) ? String(sp.variant) : "A";

  const fs = foules(posts, cle, sansHorsNorme, Date.now());
  const visibles = fs.filter((f) => f.lus.length > 0);
  const sel = selection(fs, mode, choisis, 5);
  const ouvert = sp.post ? fs.flatMap((f) => f.lus).find((l) => l.post.id === sp.post) : undefined;

  const props: VarianteProps = { fs: visibles, sel, cle, nom: metrique.nom, mode, choisis, sp, sansHorsNorme };

  return (
    <section className="mb-10 mt-6">
      <div className="mb-3 rounded-lg border border-dashed border-[#7b4fff66] bg-[#7b4fff0d] px-3 py-2 text-[11.5px] text-muted">
        <b className="text-ink">Prototype jetable</b> — la Sélection en {VARIANTES.length} variantes (← → ou la barre en bas).
        Sur les {posts.length} posts de la période affichée : élargis-la (90 j, Tout) pour que les formats atteignent {MINIMUM} posts.
        « Sans les boostés » n&apos;est pas branché : rien ne dit encore qu&apos;un post est boosté.
      </div>
      {variante === "A" && <VarianteA {...props} />}
      {variante === "B" && <VarianteB {...props} />}
      {variante === "C" && <VarianteC {...props} />}
      {ouvert && <Apercu l={ouvert} f={fs.find((f) => f.format === ouvert.post.type)} cle={cle} nom={metrique.nom} sp={sp} />}
      <PrototypeSwitcher variantes={VARIANTES} />
    </section>
  );
}

type VarianteProps = {
  fs: Foule[];
  sel: PostLu[];
  cle: string;
  nom: string;
  mode: Mode;
  choisis: string[];
  sp: SP;
  sansHorsNorme: boolean;
};

// ── LES RÉGLAGES, COMMUNS AUX TROIS ─────────────────────────────────────────

function Pastille({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        actif ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:bg-black/[0.03]"
      }`}
    >
      {children}
    </a>
  );
}

function Reglages({ cle, mode, sp, sansHorsNorme }: VarianteProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-faint">Métrique</span>
        {METRIQUES.map((m) => (
          <Pastille key={m.cle} href={lien(sp, { pm: m.cle })} actif={m.cle === cle}>{m.nom}</Pastille>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-faint">Montrer</span>
        {MODES.map((m) => (
          <Pastille key={m.cle} href={lien(sp, { pmode: m.cle })} actif={m.cle === mode}>{m.nom}</Pastille>
        ))}
      </div>
      {/* Simule le bouton « Règles de lecture » du Bandeau (ticket 11). */}
      <details className="relative ml-auto">
        <summary className="cursor-pointer list-none rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-muted">
          Règles de lecture{sansHorsNorme && <span className="text-ink"> · 1</span>}
        </summary>
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-line bg-white p-3 text-[12px] shadow-lg">
          <a href={lien(sp, { phn: sansHorsNorme ? undefined : "1" })} className="flex items-center gap-2 py-1 text-ink">
            <span className={`h-3.5 w-3.5 rounded border ${sansHorsNorme ? "border-ink bg-ink" : "border-faint"}`} /> Sans les hors norme
          </a>
          <span className="flex items-center gap-2 py-1 text-faint">
            <span className="h-3.5 w-3.5 rounded border border-line" /> Sans les boostés <i>(pas branché)</i>
          </span>
        </div>
      </details>
    </div>
  );
}

// « 1 post hors norme écarté — moustache sur 18 Reels au lieu de 19 » (ticket 08),
// au-dessus des moustaches, avec le retour aux règles standard (ticket 11).
function PhraseEcartes({ fs, nom, sp, sansHorsNorme }: VarianteProps) {
  if (!sansHorsNorme) return null;
  const parFormat = fs
    .map((f) => ({ f, n: f.lus.filter((l) => l.ecarte).length }))
    .filter((x) => x.n > 0);
  const total = parFormat.reduce((s, x) => s + x.n, 0);
  return (
    <p className="mb-3 text-[12px] text-muted">
      {total === 0 ? (
        <>Aucun post hors norme sur {nom.toLowerCase()} : rien n&apos;est écarté.</>
      ) : (
        <>
          {total} post{total > 1 ? "s" : ""} hors norme écarté{total > 1 ? "s" : ""} sur {nom.toLowerCase()} —{" "}
          {parFormat
            .map(({ f, n }) => `moustache sur ${f.valeurs.length} ${pluriel(f.format, f.valeurs.length)} au lieu de ${f.nAvant}`)
            .join(", ")}
          .
        </>
      )}{" "}
      <a href={lien(sp, { phn: undefined })} className="font-semibold text-ink underline decoration-line underline-offset-2">
        Revenir aux règles standard
      </a>
    </p>
  );
}

// La liste à cocher du mode « À la main » : 5 au plus, comme la Comparaison de
// Meta en coche 4.
function ListeAcocher({ fs, cle, choisis, sp }: VarianteProps) {
  const tous = fs.flatMap((f) => f.lus).sort((a, b) => b.post.date.localeCompare(a.post.date));
  return (
    <div className="max-h-[300px] overflow-y-auto rounded-xl border border-line">
      {tous.map((l) => {
        const coche = choisis.includes(l.post.id);
        const plein = !coche && choisis.length >= 5;
        const suivant = coche ? choisis.filter((id) => id !== l.post.id) : [...choisis, l.post.id];
        return (
          <a
            key={l.post.id}
            href={plein ? undefined : lien(sp, { ps: suivant.join(",") || undefined })}
            className={`flex items-center gap-3 border-b border-line px-3 py-2 text-[12px] last:border-0 ${plein ? "opacity-40" : "hover:bg-black/[0.02]"}`}
            title={plein ? "5 posts au plus" : undefined}
          >
            <span className={`h-3.5 w-3.5 shrink-0 rounded border ${coche ? "border-ig bg-ig" : "border-faint"}`} />
            <Vignette p={l.post} taille="w-8 h-8" />
            <span className="min-w-0 flex-1 truncate text-ink">{l.post.caption || "(sans légende)"}</span>
            <span className="shrink-0 text-faint">{l.post.type} · {age(l.ageH)}</span>
            <span className="w-16 shrink-0 text-right font-mono text-ink">{fmt(l.valeur, cle)}</span>
          </a>
        );
      })}
    </div>
  );
}

// ── LES PIÈCES ──────────────────────────────────────────────────────────────

function Vignette({ p, taille }: { p: InstaPost; taille: string }) {
  return p.mediaUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.mediaUrl} alt="" className={`${taille} shrink-0 rounded-lg border border-line object-cover`} />
  ) : (
    <div className={`${taille} shrink-0 rounded-lg border border-line bg-black/[0.04]`} />
  );
}

/** Une moustache : la foule du format en petits points, la boîte « tes
 *  habitudes », le post type, et les posts mis en avant (numérotés). */
function MoustacheFormat({
  f,
  marques,
  echelle,
  cle,
  haut = 56,
}: {
  f: Foule;
  marques: { l: PostLu; n?: number }[];
  echelle?: { min: number; max: number };
  cle: string;
  haut?: number;
}) {
  const L = 460;
  const M = 14;
  const Y = haut / 2 + 2;
  const tout = [...f.valeurs, ...f.lus.filter((l) => l.ecarte).map((l) => l.valeur!)];
  const min = echelle?.min ?? Math.min(...tout);
  const max = echelle?.max ?? Math.max(...tout);
  const pad = (max - min) * 0.04 || 1;
  const x = (v: number) => M + ((v - (min - pad)) / (max - min + 2 * pad)) * (L - 2 * M);
  return (
    <svg viewBox={`0 0 ${L} ${haut}`} width="100%" className="block max-w-[680px]" role="img" aria-label={`Moustache des ${f.format}`}>
      {f.valeurs.length > 0 && (
        <line x1={x(Math.min(...f.valeurs))} x2={x(Math.max(...f.valeurs))} y1={Y} y2={Y} stroke={NEUTRE.trait} strokeOpacity={0.5} strokeWidth={1.5} />
      )}
      {f.q && (
        <>
          <rect x={x(f.q.q1)} y={Y - 10} width={Math.max(3, x(f.q.q3) - x(f.q.q1))} height={20} rx={6} fill={NEUTRE.aplat} />
          <line x1={x(f.q.med)} x2={x(f.q.med)} y1={Y - 13} y2={Y + 13} stroke="#5a5d66" strokeWidth={2} strokeLinecap="round" />
          {haut >= 50 && <text x={Math.min(L - 60, Math.max(60, x(f.q.med)))} y={9} fontSize={9.5} fill="#5a5d66" textAnchor="middle">
            post type {fmt(f.q.med, cle)}
          </text>}
        </>
      )}
      {f.lus
        .filter((l) => l.dehors === null)
        .map((l) => (
          <circle key={l.post.id} cx={x(l.valeur!)} cy={Y} r={2.6} fill={l.ecarte ? "none" : NEUTRE.trait} stroke={l.ecarte ? NEUTRE.trait : "none"} />
        ))}
      {marques
        .filter(({ l }) => l.valeur !== null && l.dehors === null)
        .map(({ l, n }) => (
          <g key={l.post.id}>
            <circle cx={x(l.valeur!)} cy={Y} r={n ? 9 : 7} fill={teinte(l)} stroke="#fff" strokeWidth={2.5} />
            {n && (
              <text x={x(l.valeur!)} y={Y + 3.5} fontSize={10} fontWeight={700} fill="#fff" textAnchor="middle">{n}</text>
            )}
          </g>
        ))}
    </svg>
  );
}

function ModuleTete({ titre, sousTitre }: { titre: string; sousTitre: string }) {
  return (
    <div className="mb-4 min-w-0">
      <h2 className="text-[22px] font-semibold tracking-tight text-ink">{titre}</h2>
      <p className="mt-1 text-[14px] text-muted">{sousTitre}</p>
    </div>
  );
}

function SansPlace({ f }: { f: Foule }) {
  return (
    <p className="py-3 text-[12px] text-faint">
      {f.valeurs.length} {pluriel(f.format, f.valeurs.length)} mesuré{f.valeurs.length > 1 ? "s" : ""} sur la période — il en faut {MINIMUM} pour une moustache.
    </p>
  );
}

function intitule(mode: Mode, nom: string, n: number): string {
  const m = nom.toLowerCase();
  if (mode === "haut") return `Tes ${n} meilleurs posts en ${m}`;
  if (mode === "bas") return `Tes ${n} posts les moins bons en ${m}`;
  if (mode === "recents") return `Tes ${n} posts les plus récents, lus en ${m}`;
  return `Ta sélection, lue en ${m}`;
}

// ── VARIANTE A · DEUX MODULES, CARTES ───────────────────────────────────────

function VarianteA(p: VarianteProps) {
  const { fs, sel, cle, nom, mode, sp } = p;
  return (
    <>
      <ModuleTete titre="Comparaison" sousTitre={`Tes formats face à face, en ${nom.toLowerCase()}.`} />
      <div className="mb-8 rounded-2xl border border-line bg-white p-5">
        <PhraseEcartes {...p} />
        <div className="grid gap-4">
          {fs.map((f) => (
            <div key={f.format} className="grid items-center gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
              <div className="text-[12.5px]">
                <div className="font-semibold text-ink">{f.format}</div>
                <div className="text-faint">
                  {f.q ? `post type ${fmt(f.q.med, cle)}` : "–"} · {f.valeurs.length} post{f.valeurs.length > 1 ? "s" : ""}
                </div>
              </div>
              <div className="min-w-0">{f.q ? <MoustacheFormat f={f} marques={[]} cle={cle} /> : <SansPlace f={f} />}</div>
            </div>
          ))}
        </div>
      </div>

      <ModuleTete titre="Sélection" sousTitre={intitule(mode, nom, sel.length) + " — chacun sur la moustache de son format."} />
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="mb-4"><Reglages {...p} /></div>
        {mode === "main" && <div className="mb-4"><ListeAcocher {...p} /></div>}
        {sel.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-muted">Coche jusqu&apos;à 5 posts dans la liste.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {sel.map((l) => {
              const f = fs.find((x) => x.format === l.post.type);
              return (
                <a key={l.post.id} href={lien(sp, { post: l.post.id })} className="min-w-0 overflow-hidden rounded-xl border border-line hover:shadow-md">
                  {l.post.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.post.mediaUrl} alt="" className={`h-40 w-full object-cover ${l.ecarte ? "opacity-40" : ""}`} />
                  ) : (
                    <div className="h-40 w-full bg-black/[0.04]" />
                  )}
                  <div className="p-3">
                    <div className="text-[10.5px] text-faint">
                      {l.post.type} · {age(l.ageH)} {l.recent && <span title="peut encore changer">◔</span>}
                    </div>
                    <div className="font-mono text-[20px] font-medium text-ink">{fmt(l.valeur, cle)}</div>
                    <div className="mb-1 text-[11.5px] font-semibold" style={{ color: teinte(l) }}>{placeEcrite(l, f)}</div>
                    {f?.q && l.dehors === null && <MoustacheFormat f={f} marques={[{ l }]} cle={cle} haut={40} />}
                    <div className="mt-1 line-clamp-2 text-[11.5px] text-muted">{l.post.caption || "(sans légende)"}</div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
        <PiedLien />
      </div>
    </>
  );
}

// ── VARIANTE B · UN SEUL MODULE, POINTS NUMÉROTÉS ───────────────────────────

function VarianteB(p: VarianteProps) {
  const { fs, sel, cle, nom, mode, sp } = p;
  // Une seule échelle pour tous les formats : c'est une Comparaison, les
  // moustaches se lisent l'une contre l'autre.
  const toutes = fs.flatMap((f) => f.lus.filter((l) => l.dehors === null).map((l) => l.valeur!));
  const echelle = toutes.length ? { min: Math.min(...toutes), max: Math.max(...toutes) } : undefined;
  const numero = new Map(sel.map((l, i) => [l.post.id, i + 1]));
  return (
    <>
      <ModuleTete titre="Comparaison" sousTitre={`Tes formats face à face en ${nom.toLowerCase()}, et ${intitule(mode, nom, sel.length).toLowerCase()} posés dessus.`} />
      <div className="rounded-2xl border border-line bg-white">
        <div className="border-b border-line p-5"><Reglages {...p} /></div>
        <div className="p-5">
          <PhraseEcartes {...p} />
          <div className="grid gap-3">
            {fs.map((f) => (
              <div key={f.format} className="grid items-center gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
                <div className="text-[12.5px]">
                  <div className="font-semibold text-ink">{f.format}</div>
                  <div className="text-faint">
                    {f.q ? `post type ${fmt(f.q.med, cle)}` : "–"} · {f.valeurs.length} post{f.valeurs.length > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="min-w-0">
                  {f.q ? (
                    <MoustacheFormat
                      f={f}
                      cle={cle}
                      echelle={echelle}
                      marques={sel.filter((l) => l.post.type === f.format).map((l) => ({ l, n: numero.get(l.post.id) }))}
                    />
                  ) : (
                    <SansPlace f={f} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {mode === "main" && <div className="border-t border-line p-5"><ListeAcocher {...p} /></div>}
        <div className="flex gap-2 overflow-x-auto border-t border-line p-3">
          {sel.map((l, i) => {
            const f = fs.find((x) => x.format === l.post.type);
            return (
              <a key={l.post.id} href={lien(sp, { post: l.post.id })} className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-xl p-2 hover:bg-black/[0.03]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: teinte(l) }}>{i + 1}</span>
                <Vignette p={l.post} taille="w-11 h-11" />
                <span className="min-w-0">
                  <span className="block font-mono text-[14px] text-ink">{fmt(l.valeur, cle)}</span>
                  <span className="block truncate text-[11px]" style={{ color: teinte(l) }}>{placeEcrite(l, f)}</span>
                  <span className="block text-[10.5px] text-faint">{l.post.type} · {age(l.ageH)} {l.recent && "◔"}</span>
                </span>
              </a>
            );
          })}
        </div>
        <div className="px-5 pb-4"><PiedLien /></div>
      </div>
    </>
  );
}

// ── VARIANTE C · LES BANDES ─────────────────────────────────────────────────

const BANDES = [
  { cle: "hn-bas", nom: "Hors norme, en dessous" },
  { cle: "en dessous", nom: "En dessous" },
  { cle: "bas de tes habitudes", nom: "Bas de tes habitudes" },
  { cle: "haut de tes habitudes", nom: "Haut de tes habitudes" },
  { cle: "au-dessus", nom: "Au-dessus" },
  { cle: "hn-haut", nom: "Hors norme, au-dessus" },
];

function bandeDe(l: PostLu, f: Foule | undefined): string | null {
  if (l.dehors || !f?.q) return null;
  if (l.horsNorme) return l.horsNorme === "haut" ? "hn-haut" : "hn-bas";
  return l.place;
}

function VarianteC(p: VarianteProps) {
  const { fs, sel, cle, nom, mode, sp } = p;
  const rangs = sel.map((l) => ({ l, f: fs.find((x) => x.format === l.post.type) })).map((x) => ({ ...x, b: bandeDe(x.l, x.f) }));
  const compte = BANDES.map((b) => ({ ...b, n: rangs.filter((r) => r.b === b.cle).length })).filter((b) => b.n > 0);
  const sansPlace = rangs.filter((r) => r.b === null);
  return (
    <>
      <ModuleTete titre="Sélection" sousTitre={`${intitule(mode, nom, sel.length)}, rangés par leur place dans leur format.`} />
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="mb-4"><Reglages {...p} /></div>
        <PhraseEcartes {...p} />
        {mode === "main" && <div className="mb-4"><ListeAcocher {...p} /></div>}
        {/* La phrase de David, mot pour mot dans sa forme. */}
        <p className="mb-4 text-[17px] font-medium leading-snug text-ink">
          {compte.map((b) => `${b.n} ${b.nom.toLowerCase()}`).join(", ") || "Aucun post placé"}
          {sansPlace.length > 0 && `, ${sansPlace.length} sans place`}.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {BANDES.map((b) => {
            const ici = rangs.filter((r) => r.b === b.cle);
            const bord = b.cle.startsWith("hn") ? "border-dashed" : "";
            return (
              <div key={b.cle} className={`min-w-0 rounded-xl border border-line ${bord} bg-canvas p-2`}>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-faint">{b.nom}</div>
                <div className="grid gap-2">
                  {ici.map(({ l }) => (
                    <a key={l.post.id} href={lien(sp, { post: l.post.id })} className={`block rounded-lg bg-white p-1.5 shadow-card hover:shadow-md ${l.ecarte ? "opacity-50" : ""}`}>
                      <Vignette p={l.post} taille="w-full h-24" />
                      <div className="mt-1 font-mono text-[13px] text-ink">{fmt(l.valeur, cle)}</div>
                      <div className="text-[10.5px] text-faint">{l.post.type} · {age(l.ageH)} {l.recent && "◔"}</div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {sansPlace.length > 0 && (
          <div className="mt-3 text-[12px] text-faint">
            Sans place :{" "}
            {sansPlace.map(({ l, f }) => (
              <a key={l.post.id} href={lien(sp, { post: l.post.id })} className="mr-3 underline decoration-line">
                {(l.post.caption || "(sans légende)").slice(0, 24)}… — {placeEcrite(l, f)}
              </a>
            ))}
          </div>
        )}
        <PiedLien />
      </div>
    </>
  );
}

function PiedLien() {
  return (
    <p className="mt-4 text-[11px] text-faint">
      Le lien de cette page garde la métrique, le choix et les posts cochés : celui qui l&apos;ouvre voit la même Sélection.
    </p>
  );
}

// ── L'APERÇU D'UN POST (?post=) ─────────────────────────────────────────────

function Apercu({ l, f, cle, nom, sp }: { l: PostLu; f: Foule | undefined; cle: string; nom: string; sp: SP }) {
  const p = l.post;
  return (
    <>
      <a href={lien(sp, { post: undefined })} className="fixed inset-0 z-40 bg-black/20" aria-label="Fermer l'aperçu" />
      <aside className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-[420px] overflow-y-auto border-l border-line bg-white p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] text-faint">{p.type} · publié il y a {age(l.ageH)} {l.recent && "◔ peut encore changer"}</span>
          <a href={lien(sp, { post: undefined })} className="text-[13px] text-muted hover:text-ink">Fermer ✕</a>
        </div>
        <Vignette p={p} taille="w-full h-72" />
        <p className="mt-3 whitespace-pre-line text-[13px] text-ink">{p.caption || "(sans légende)"}</p>
        <div className="mt-4 rounded-xl border border-line p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-faint">{nom}</div>
          <div className="font-mono text-[24px] text-ink">{fmt(l.valeur, cle)}</div>
          <div className="mb-1 text-[12px] font-semibold" style={{ color: teinte(l) }}>{placeEcrite(l, f)}</div>
          {f?.q && l.dehors === null && <MoustacheFormat f={f} marques={[{ l }]} cle={cle} />}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
          {METRIQUES.map((m) => (
            <div key={m.cle} className="rounded-lg bg-canvas px-3 py-2">
              <dt className="text-faint">{m.nom}</dt>
              <dd className="font-mono text-ink">{fmt(m.cle === "views" && p.views === 0 ? null : (m.cle === "reach" && p.reach === 0 ? null : (p as unknown as Record<string, number | null>)[m.cle]), m.cle)}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </>
  );
}

