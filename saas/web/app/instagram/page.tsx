// Dashboard Instagram organique :
// Ta page (abonnés, courbe, croissance 30 j) · Tes moyennes (une seule fois, et
// sur la période affichée) · Tes posts un par un · Top 3 posts ·
// Posts de la période vs ton post moyen · Vue globale.
//
// « TES FORMATS » ET « QUAND PUBLIER ? » ONT ÉTÉ RETIRÉS LE 2026-09-12.
// Les deux répondaient à « qu'est-ce qui marche chez toi » en RECALCULANT la
// réponse ici, en TypeScript, sur la fenêtre affichée, pendant que deux autres
// moteurs la posaient ailleurs avec d'autres seuils — trois réponses possibles
// le même lundi. Les deux autres moteurs sont partis avec les recommandations
// le 2026-09-21 : **plus personne ne répond à cette question.** La rouvrir
// demande de décider d'abord où elle se calcule, une seule fois.
import {
  getInstaDash,
  moyenneMesuree,
  trierDecroissant,
  valeurDe,
  porteeRelevee,
  type DashParams,
  type InstaPost,
} from "@/lib/channels";
import { fmtCHF } from "@/lib/report";
import { BandeauCommandes } from "@/components/bandeau-commandes";
import { ScrollList } from "@/components/scroll-list";
import { BarChart } from "@/components/bar-chart";
import { CourbeAbonnes, MoyennesInsta } from "@/components/channel-dash";
import { lienDash } from "@/lib/liens";

import { Triangle, sensPente } from "@/components/pente";

export const dynamic = "force-dynamic";

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
function fmtDate(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

const INSTA_METRICS: { key: string; label: string; unit: string }[] = [
  { key: "reach", label: "Portée", unit: "" },
  { key: "views", label: "Vues", unit: "" },
  { key: "likes", label: "J'aime", unit: "" },
  { key: "comments", label: "Comm.", unit: "" },
  { key: "saved", label: "Enreg.", unit: "" },
  { key: "eng", label: "Engagement", unit: "%" },
];

// Une publication sans portée relevée n'a pas d'engagement (ticket meta-ads 25).
const fmtEng = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)} %`);
const fmtCompte = (v: number | null) => (v === null ? "—" : fmtCHF(v));

// Évolution de tes posts — un bar par post, métrique au choix (comme Meta/Google).
function PostsMetricChart({
  posts,
  metric,
  params,
}: {
  posts: InstaPost[];
  metric: string;
  params: DashParams;
}) {
  const pts = [...posts].reverse(); // plus ancien → plus récent
  if (pts.length < 2) return null;
  const meta = INSTA_METRICS.find((m) => m.key === metric) ?? INSTA_METRICS[0];
  const vals = pts.map((p) => valeurDe(p, metric));
  const mesures = vals.filter((v): v is number => v !== null);
  const max = Math.max(...mesures, 0.001);
  const fmtV = (v: number) => (metric === "eng" ? v.toFixed(1) : fmtCHF(v));

  // Ce module ouvrait sur un surtitre et une rangée de boutons, puis un graphe :
  // aucun chiffre avant sa forme, et le sélecteur au-dessus de ce qu'il pilote.
  // Deux écarts à la grammaire (docs/03-grammaire-des-modules.md, rangs 3 et 8),
  // et surtout deux fois la MÊME question posée différemment de Meta et Google.
  // Il suit maintenant exactement la forme de `MetricChart`.
  const taux = metric === "eng";
  // Un engagement absent sort de la moyenne ; un 0 % mesuré (portée relevée,
  // aucune réaction) y reste — l'ancien filtre `v > 0` les jetait tous deux.
  const valeur = taux ? moyenneMesuree(vals) : mesures.reduce((a, b) => a + b, 0);

  const mi = Math.floor(vals.length / 2);
  const av = moyenneMesuree(vals.slice(0, mi));
  const ap = moyenneMesuree(vals.slice(mi));
  const ec = av !== null && ap !== null && av > 0 ? ((ap - av) / av) * 100 : null;
  const sp = sensPente(ec, false, 8);

  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-8">
      <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-2">
        Tes posts, un par un <span className="text-ink">· {meta.label}</span>
      </div>

      <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
        <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
          {valeur === null ? "—" : fmtV(valeur)}
          {valeur !== null && <span className="text-[15px] text-faint"> {meta.unit}</span>}
        </span>
        <span className="text-[11px] text-faint">{taux ? "en moyenne" : "au total"}</span>
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${sp.cls}`}
          style={{ background: sp.fond }}
          title="Seconde moitié de la période comparée à la première"
        >
          {sp.plat ? (
            "≈ stable"
          ) : (
            <>
              <Triangle sens={sp.monte ? "haut" : "bas"} /> {ec! > 0 ? "+" : ""}
              {Math.round(ec!)} % sur la période
            </>
          )}
        </span>
      </div>

      <BarChart
        items={pts.map((p) => ({
          label: fmtDate(p.date).slice(0, 6),
          name: p.caption || "(sans légende)",
          value: valeurDe(p, metric),
        }))}
        color="#7b4fff"
        fmt={fmtV}
        unit={meta.unit}
        ariaLabel={`${meta.label} par post`}
      />

      {/* Le sélecteur passe SOUS le graphe, comme sur Meta et Google : il pilote
          ce module, il ne le précède pas. */}
      <div className="flex items-center gap-1 overflow-x-auto pt-3 mt-1 border-t border-line">
        {INSTA_METRICS.map((m) => (
          <a
            key={m.key}
            href={lienDash("/instagram", params, { m: m.key }, "reach")}
            className={`shrink-0 text-[10.5px] font-semibold rounded-full px-2.5 py-1 border ${
              metric === m.key
                ? "bg-ink text-white border-ink"
                : "border-line text-muted hover:bg-black/[0.03] bg-white"
            }`}
          >
            {m.label}
          </a>
        ))}
        <span className="ml-auto shrink-0 text-[10.5px] text-faint pl-3">
          {mesures.length > 0 && <>max {fmtV(max)}{meta.unit} · </>}{pts.length} posts
        </span>
      </div>
    </div>
  );
}

// Tri des posts par métrique : clique un en-tête de colonne.
const SORTS: { key: string; label: string }[] = [
  { key: "date", label: "Post" },
  { key: "reach", label: "Portée" },
  { key: "views", label: "Vues" },
  { key: "likes", label: "J'aime" },
  { key: "comments", label: "Comm." },
  { key: "saved", label: "Enreg." },
  { key: "eng", label: "Engagement" },
];

function sortPosts(posts: InstaPost[], sort: string): InstaPost[] {
  if (sort === "date") return posts; // déjà du plus récent au plus ancien
  return trierDecroissant(posts, (p) => valeurDe(p, sort));
}

function PostsTable({
  posts,
  histReach,
  sort,
  params,
}: {
  posts: InstaPost[];
  histReach: number | null;
  sort: string;
  params: DashParams;
}) {
  const th = (s: { key: string; label: string }, align: string, px: string) => (
    <th
      key={s.key}
      className={`${align} font-semibold ${px} py-3 sticky top-0 bg-white z-10 border-b border-line`}
    >
      <a
        href={lienDash("/instagram", params, { s: s.key }, "reach")}
        className={sort === s.key ? "text-ink" : "hover:text-muted"}
        title={s.key === "date" ? "Trier par date" : `Trier par ${s.label}`}
      >
        {s.label}
        {sort === s.key && s.key !== "date" && " ↓"}
      </a>
    </th>
  );
  return (
    <div className="bg-white border border-line rounded-xl shadow-card overflow-x-auto">
      <div className="max-h-[440px] overflow-y-auto min-w-[680px]">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-faint">
            {th(SORTS[0], "text-left", "px-5")}
            <th className="text-left font-semibold px-2 py-3 sticky top-0 bg-white z-10 border-b border-line">Format</th>
            {th(SORTS[1], "text-right", "px-2")}
            {th(SORTS[2], "text-right", "px-2")}
            {th(SORTS[3], "text-right", "px-2")}
            {th(SORTS[4], "text-right", "px-2")}
            {th(SORTS[5], "text-right", "px-2")}
            {th(SORTS[6], "text-right", "px-5")}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {posts.map((p, i) => {
            const above = histReach !== null && p.reach >= histReach;
            return (
              <tr key={i}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {p.mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.mediaUrl}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover border border-line shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-black/[0.04] border border-line shrink-0" />
                    )}
                    <div>
                      <div className="text-ink font-medium leading-snug max-w-[220px] truncate">
                        {p.caption || "(sans légende)"}
                      </div>
                      <div className="text-[10.5px] text-faint mt-0.5">{fmtDate(p.date)}</div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-3 text-muted">{p.type}</td>
                <td className="px-2 py-3 text-right font-mono">
                  <span className={above ? "text-pos font-semibold" : "text-ink"}>
                    {fmtCompte(porteeRelevee(p))}
                  </span>
                </td>
                <td className="px-2 py-3 text-right font-mono text-muted">
                  {p.views > 0 ? fmtCHF(p.views) : "—"}
                </td>
                <td className="px-2 py-3 text-right font-mono text-muted">{fmtCHF(p.likes)}</td>
                <td className="px-2 py-3 text-right font-mono text-muted">{fmtCHF(p.comments)}</td>
                <td className="px-2 py-3 text-right font-mono text-muted">{fmtCHF(p.saved)}</td>
                <td className="px-5 py-3 text-right font-mono text-ink">{fmtEng(p.eng)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// Le libellé de la métrique qui pilote la page — évite d'écrire « portée » en
// dur alors que l'utilisateur a filtré sur les vues.
function metricLabel(key: string): string {
  return (INSTA_METRICS.find((m) => m.key === key) ?? INSTA_METRICS[0]).label.toLowerCase();
}

export default async function InstagramPage({
  searchParams,
}: {
  searchParams: DashParams;
}) {
  const d = await getInstaDash(searchParams);
  const metric = ["reach", "views", "likes", "comments", "saved", "eng"].includes(
    searchParams?.m ?? ""
  )
    ? (searchParams!.m as string)
    : "reach";
  // Graphe : posts de la fenêtre, sinon les 20 derniers (pour toujours voir la tendance)
  const chartPosts = d.posts.length >= 2 ? d.posts : d.allPosts.slice(0, 20);

  // Tri des tables (?s=) + query de base pour les liens d'en-tête
  const sort = ["date", "reach", "views", "likes", "comments", "saved", "eng"].includes(
    searchParams?.s ?? ""
  )
    ? (searchParams!.s as string)
    : "date";
  const sortedPosts = sortPosts(d.posts, sort);
  const sortedAll = sortPosts(d.allPosts, sort);

  const engDiff =
    d.postsEng !== null && d.avgEng !== null && d.avgEng > 0
      ? ((d.postsEng - d.avgEng) / d.avgEng) * 100
      : null;

  // La table des POSTS ne peut pas porter d'écart — voir son pied. On garde la
  // comparaison sous la main pour l'écrire, plutôt que de laisser un silence.
  const cmpPosts =
    d.comparaison.ventilations && d.comparaison.reference ? d.comparaison.reference.label : null;

  return (
    // Pas de `max-w-*` : voir la note dans `app/page.tsx`.
    <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-9">

      <BandeauCommandes
        titre="Instagram."
        glyphe="◎"
        couleur="#7b4fff"
        periode={{
          fenetre: d.periodLabel,
          jours: d.days,
          from: searchParams?.from,
          to: searchParams?.to,
        }}
      />


      {/* ── TA PAGE ── */}
      <div className="flex items-baseline gap-2 flex-wrap mb-3 mt-5">
        <h2 className="text-[14px] font-semibold text-ink">Ta page</h2>
      </div>
      <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 gap-3 mb-4 pb-1 sm:pb-0">
        <div className="bg-white border border-line rounded-xl p-4 min-w-[200px] shrink-0 sm:min-w-0 sm:shrink">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
            Abonnés
          </div>
          <div className="font-mono text-xl font-medium text-ink">{fmtCHF(d.followers)}</div>
          {d.followersDelta !== null && (
            <div
              className={`text-[11px] font-semibold mt-1.5 ${
                d.followersDelta >= 0 ? "text-pos" : "text-neg"
              }`}
            >
              <Triangle sens={d.followersDelta >= 0 ? "haut" : "bas"} />{" "}
              {d.followersDelta >= 0 ? "+" : "−"}
              {fmtCHF(Math.abs(d.followersDelta))}{" "}
              <span className="text-faint font-normal">sur la période</span>
            </div>
          )}
        </div>
        <div className="bg-white border border-line rounded-xl p-4 min-w-[200px] shrink-0 sm:min-w-0 sm:shrink">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
            Croissance 30 j
          </div>
          <div className="font-mono text-xl font-medium text-ink">
            {d.growth30 !== null ? `${d.growth30 >= 0 ? "+" : ""}${fmtCHF(d.growth30)}` : "—"}
          </div>
          <div className="text-[11px] text-faint mt-1">nouveaux abonnés</div>
        </div>
        <div className="bg-white border border-line rounded-xl p-4 min-w-[200px] shrink-0 sm:min-w-0 sm:shrink">
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
            Engagement du compte
          </div>
          <div className="font-mono text-xl font-medium text-ink">{fmtEng(d.avgEng)}</div>
          <div className="text-[11px] text-faint mt-1">
            portée moyenne {fmtCompte(d.histReach)} / post
          </div>
        </div>
      </div>
      <CourbeAbonnes series={d.followersSeries} />

      {/* ── TES MOYENNES — une seule fois, et sur la période affichée ──
          Il y avait ICI un second module de moyennes, « Tes moyennes par post ·
          tout l'historique » : six chiffres à plat, collés au-dessus de celui-ci
          qui portait presque le même titre. Deux boîtes « Tes moyennes » l'une
          sur l'autre ne se lisent pas comme deux questions, elles se lisent
          comme un doublon — et c'en était un : il ne se distinguait que par son
          DÉNOMINATEUR, jamais écrit ailleurs que dans son surtitre.
          Le module qui reste répond aux deux, parce que son unité suit
          maintenant la fenêtre (voir `Moyennes` dans channel-dash.tsx). */}
      <MoyennesInsta d={d} />

      {/* ── ÉVOLUTION DES POSTS (métrique au choix) ── */}
      <PostsMetricChart posts={chartPosts} metric={metric} params={d.params} />

      {/* ── TOP 3 POSTS — grandes images, scroll horizontal si besoin ── */}
      {d.topPosts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[14px] font-semibold text-ink mb-3">
            Top 3 posts{" "}
            <span className="text-faint font-normal">
              · par {metricLabel(d.topMetric)}
              {d.scope === "historique" ? " (tout l'historique)" : " (période filtrée)"}
            </span>
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {d.topPosts.map((p, i) => (
              <div
                key={i}
                className="bg-white border border-line rounded-xl shadow-card overflow-hidden shrink-0 w-[260px] sm:w-[300px]"
              >
                {p.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.mediaUrl} alt="" className="w-full h-52 object-cover" />
                ) : (
                  <div className="w-full h-52 bg-black/[0.04]" />
                )}
                <div className="p-4">
                  <div className="font-mono text-[11px] text-faint mb-1">
                    n°{i + 1} · {p.type} · {fmtDate(p.date)}
                  </div>
                  <div className="text-[13px] font-medium text-ink leading-snug line-clamp-2 mb-2.5">
                    {p.caption || "(sans légende)"}
                  </div>
                  {/* On montre d'abord la métrique sur laquelle ce top est classé */}
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className="font-mono text-ink font-semibold">
                      {d.topMetric === "eng"
                        ? `${fmtEng(p.eng)} eng.`
                        : `${fmtCompte(valeurDe(p, d.topMetric))} ${metricLabel(d.topMetric)}`}
                    </span>
                    <span className="font-mono text-muted">
                      {d.topMetric === "reach"
                        ? `${fmtEng(p.eng)} eng.`
                        : `${fmtCompte(porteeRelevee(p))} portée`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── POSTS DE LA PÉRIODE ── */}
      <h2 className="text-[14px] font-semibold text-ink mb-3">
        Posts de la période{" "}
        <span className="text-faint font-normal">· comparés à ton post moyen</span>
      </h2>
      {engDiff !== null && Math.abs(engDiff) >= 10 && (
        <p className={`text-[12px] font-semibold mb-3 ${engDiff > 0 ? "text-pos" : "text-warn"}`}>
          <Triangle sens={engDiff > 0 ? "haut" : "bas"} /> Tes posts de la période engagent{" "}
          {engDiff > 0 ? "+" : ""}
          {engDiff.toFixed(0)} % vs ton habitude ({fmtEng(d.postsEng)} contre{" "}
          {fmtEng(d.avgEng)}).
        </p>
      )}
      {d.posts.length === 0 ? (
        <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center mb-4">
          <p className="text-[13px] text-muted">
            Aucun post sur la période
            {d.histReach !== null && (
              <> — ton compte porte d&apos;habitude à {fmtCHF(d.histReach)} par post</>
            )}
            .
          </p>
        </div>
      ) : (
        <div className="mb-4">
          <PostsTable posts={sortedPosts} histReach={d.histReach} sort={sort} params={d.params} />
        </div>
      )}

      {/* ── VUE GLOBALE ── */}
      <details className="mb-4">
        <summary className="text-[12.5px] font-semibold text-muted cursor-pointer select-none hover:text-ink">
          ▸ Vue globale — tous tes posts ({d.allPosts.length})
        </summary>
        <div className="mt-3">
          <PostsTable posts={sortedAll} histReach={d.histReach} sort={sort} params={d.params} />
        </div>
      </details>

      {/* UN SEUL PIED pour les deux tables de posts, et il porte maintenant la
          limite qui compte quand une comparaison est posée : une publication
          appartient à UNE période, celle où elle a été publiée. Une colonne
          d'écart ici n'aurait donc que des naissances, ligne après ligne — un
          « nouveau » sur cent lignes n'est pas une comparaison, c'est du bruit
          présenté comme une mesure. */}
      <p className="text-[11.5px] text-faint leading-relaxed">
        {d.histReach !== null
          ? `Portée en vert = au-dessus de ton post moyen (${fmtCHF(d.histReach)}). `
          : "Aucune publication n'a de portée relevée : pas de post moyen, rien n'est en vert. "}
        Engagement =
        (j&apos;aime + commentaires + enregistrements) / portée.
        {cmpPosts && (
          <>
            {" "}
            Ces deux tables ne portent pas d&apos;écart contre {cmpPosts} : une publication
            appartient à UNE période, celle où elle a été publiée — elle n&apos;a pas d&apos;avant.
            Une colonne d&apos;écart n&apos;aurait donc que des naissances, ligne après ligne, et
            « nouveau » répété cent fois n&apos;est pas une comparaison.
          </>
        )}
      </p>

    </main>
  );
}
