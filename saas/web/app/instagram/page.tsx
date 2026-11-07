// Dashboard Instagram organique :
// Bandeau (la période) · Ta page (abonnés, courbe, croissance 30 j) · Tes
// moyennes · le Sélecteur de vue · « Tes posts face à ton année » · Tous tes
// posts.
//
// LA PAGE SE RECONSTRUIT PAR TICKETS (`.scratch/instagram-construction/`) :
// le Bandeau, le Sélecteur, le module de l'année et le Tableau lisent
// `lib/instagram/` ; « Ta page » et « Tes moyennes » lisent encore
// `getInstaDash`, qui part avec les tickets 14 et 15. Elles lisent la MÊME
// période que le reste : celle de `periodeDe`, passée en `from`/`to`.
//
// « TES FORMATS » ET « QUAND PUBLIER ? » ONT ÉTÉ RETIRÉS LE 2026-09-12.
// Les deux répondaient à « qu'est-ce qui marche chez toi » en RECALCULANT la
// réponse ici, en TypeScript, sur la fenêtre affichée, pendant que deux autres
// moteurs la posaient ailleurs avec d'autres seuils — trois réponses possibles
// le même lundi. Les deux autres moteurs sont partis avec les recommandations
// le 2026-09-21 : **plus personne ne répond à cette question.** Le module
// « Tes posts face à ton année » ne la rouvre pas : il situe chaque post
// contre ses pareils, sans dire quel format choisir (spec, user story 4).
import { getInstaDash } from "@/lib/channels";
import { getDonneesInstagram } from "@/lib/instagram/donnees";
import { METRIQUES, metriqueDe, type CleMetrique } from "@/lib/instagram/lecture";
import { moduleAnneeDe, raisonIndisponible } from "@/lib/instagram/annee";
import { tableauDe } from "@/lib/instagram/tableau";
import type { Params } from "@/lib/instagram/liens";
import { BandeauInstagram } from "@/components/instagram/bandeau";
import { SelecteurObjectif } from "@/components/instagram/selecteur";
import { TesPostsFaceATonAnnee } from "@/components/instagram/annee/module";
import { TableauPosts } from "@/components/instagram/tableau";
import { fmtCHF } from "@/lib/report";
import { CourbeAbonnes, MoyennesInsta } from "@/components/channel-dash";
import { Triangle } from "@/components/pente";

export const dynamic = "force-dynamic";

const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Une publication sans portée relevée n'a pas d'engagement (ticket meta-ads 25).
const fmtEng = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)} %`);
const fmtCompte = (v: number | null) => (v === null ? "—" : fmtCHF(v));

export default async function InstagramPage({ searchParams }: { searchParams: Params }) {
  const { posts, ctx, periode, raccourcis, hier } = await getDonneesInstagram({
    from: un(searchParams.from),
    to: un(searchParams.to),
  });
  // `metrique` : la métrique choisie au Sélecteur ; le module et la Place du
  // Tableau la suivent (spec, « une place à la fois »).
  const metrique = metriqueDe(un(searchParams.metrique));
  const indisponibles = Object.fromEntries(
    (Object.keys(METRIQUES) as CleMetrique[]).flatMap((m) => {
      const raison = raisonIndisponible(posts, m);
      return raison ? [[m, raison]] : [];
    })
  ) as Partial<Record<CleMetrique, string>>;
  const annee = moduleAnneeDe(posts, metrique, { debut: periode.debut, fin: periode.fin }, ctx);
  const tableau = tableauDe(posts, metrique, ctx);

  // L'ancienne lecture, sur la période du Bandeau — d'ici son départ (14, 15).
  const d = await getInstaDash({ from: periode.debut, to: periode.fin });

  return (
    // Pas de `max-w-*` : voir la note dans `app/page.tsx`.
    <main className="px-4 pb-16 sm:px-6 lg:px-8">
      <BandeauInstagram params={searchParams} periode={periode} raccourcis={raccourcis} hier={hier} />

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

      <div className="mt-12 space-y-12">
        <SelecteurObjectif metrique={metrique} indisponibles={indisponibles} params={searchParams} />
        {/* Remplace « Tes posts, un par un » et le « Top 3 » : la même
            question — que valent mes posts ? — lue contre l'année du format
            plutôt qu'en barres sans repère (spec, § Ce qui part). */}
        <TesPostsFaceATonAnnee module={annee} />
        {/* ── TOUS TES POSTS — remplace « Posts de la période » et « Vue
            globale » (ticket 09) : tout l'historique, la place de chaque
            post face à ses pareils des 12 derniers mois. */}
        <TableauPosts tableau={tableau} />
      </div>
    </main>
  );
}
