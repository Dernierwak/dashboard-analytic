// Dashboard Instagram organique :
// Ta page (abonnés, courbe, croissance 30 j) · Tes moyennes (une seule fois, et
// sur la période affichée) · Tes posts un par un · Top 3 posts ·
// Tous tes posts (le Tableau neuf, `lib/instagram/`).
//
// LA PAGE SE RECONSTRUIT PAR TICKETS (`.scratch/instagram-construction/`) :
// le bas lit déjà `lib/instagram/` ; le haut lit encore `getInstaDash`, qui
// part avec le ticket 15.
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
  valeurDe,
  porteeRelevee,
  type DashParams,
  type InstaPost,
} from "@/lib/channels";
import { getDonneesInstagram } from "@/lib/instagram/donnees";
import { metriqueDe } from "@/lib/instagram/lecture";
import { tableauDe } from "@/lib/instagram/tableau";
import { TableauPosts } from "@/components/instagram/tableau";
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

// Le libellé de la métrique qui pilote la page — évite d'écrire « portée » en
// dur alors que l'utilisateur a filtré sur les vues.
function metricLabel(key: string): string {
  return (INSTA_METRICS.find((m) => m.key === key) ?? INSTA_METRICS[0]).label.toLowerCase();
}

export default async function InstagramPage({
  searchParams,
}: {
  // `metrique` : la métrique choisie, que la Place du Tableau suit (spec,
  // Sélecteur de vue) — le Sélecteur qui l'écrit vient au ticket 10.
  searchParams: DashParams & { metrique?: string };
}) {
  const d = await getInstaDash(searchParams);
  const metric = ["reach", "views", "likes", "comments", "saved", "eng"].includes(
    searchParams?.m ?? ""
  )
    ? (searchParams!.m as string)
    : "reach";
  // Graphe : posts de la fenêtre, sinon les 20 derniers (pour toujours voir la tendance)
  const chartPosts = d.posts.length >= 2 ? d.posts : d.allPosts.slice(0, 20);

  const { posts, ctx } = await getDonneesInstagram();
  const tableau = tableauDe(posts, metriqueDe(searchParams?.metrique), ctx);

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

      {/* ── TOUS TES POSTS — remplace « Posts de la période » et « Vue globale »
          (ticket 09 de .scratch/instagram-construction/) : tout l'historique,
          la place de chaque post face à ses pareils des 12 derniers mois. */}
      <div className="mt-12">
        <TableauPosts tableau={tableau} />
      </div>

    </main>
  );
}
