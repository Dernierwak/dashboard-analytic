// Dashboard Instagram organique :
// Bandeau (la période) · Ta page (la Tendance du compte) · le Sélecteur de vue
// · « Tes posts face à ton année » et la liste des 5 meilleurs · Tous tes
// posts · le Panneau « lire un post » (`?post=`). Tout lit `lib/instagram/`.
//
// TROIS ÉTATS (spec, § Les états de la page ; `lib/instagram/etat.ts`) :
// compte neuf → un seul encart ; jeton mort → grand encart en tête, la page
// grisée dessous ; compte gratuit → aucun état à part.
//
// « TES FORMATS » ET « QUAND PUBLIER ? » ONT ÉTÉ RETIRÉS LE 2026-09-12.
// Les deux répondaient à « qu'est-ce qui marche chez toi » en RECALCULANT la
// réponse ici, en TypeScript, sur la fenêtre affichée, pendant que deux autres
// moteurs la posaient ailleurs avec d'autres seuils — trois réponses possibles
// le même lundi. Les deux autres moteurs sont partis avec les recommandations
// le 2026-09-21 : **plus personne ne répond à cette question.** Le module
// « Tes posts face à ton année » ne la rouvre pas : il situe chaque post
// contre ses pareils, sans dire quel format choisir (spec, user story 4).
//
// « TES MOYENNES » EST PARTI AU TICKET 15 avec l'ancienne lecture
// (`lib/channels.ts`) : il additionnait des zéros refaits d'absences
// (`Number(x) || 0`) et faisait d'une vidéo du fil un Reel (spec, § Ce qui part).
import { getDonneesInstagram, jourDuPremierRapportQuiListe } from "@/lib/instagram/donnees";
import { METRIQUES, metriqueDe, type CleMetrique } from "@/lib/instagram/lecture";
import { moduleAnneeDe, raisonIndisponible } from "@/lib/instagram/annee";
import { meilleursDe, rangsDe } from "@/lib/instagram/meilleurs";
import { lecturePostDe, phraseEcartHebdo } from "@/lib/instagram/panneau";
import { tableauDe } from "@/lib/instagram/tableau";
import { lienInstagram, type Params } from "@/lib/instagram/liens";
import { ecartesDe, ligneRegles, reglesDe, retenus, SANS_REGLES } from "@/lib/instagram/regles";
import { etatDeLaPage } from "@/lib/instagram/etat";
import { BandeauInstagram } from "@/components/instagram/bandeau";
import { ReglesDeLecture } from "@/components/instagram/regles";
import Link from "next/link";
import { SelecteurObjectif } from "@/components/instagram/selecteur";
import { TesPostsFaceATonAnnee } from "@/components/instagram/annee/module";
import { ListeMeilleurs } from "@/components/instagram/annee/meilleurs";
import { PanneauPost, PanneauPostIntrouvable } from "@/components/instagram/panneau-post";
import { TableauPosts } from "@/components/instagram/tableau";
import { getTendanceInstagram } from "@/lib/instagram/donnees-tendance";
import { TendanceTaPage } from "@/components/instagram/tendance";
import { BadgeFige, EncartCompteNeuf, EncartJetonMort } from "@/components/instagram/etats";

export const dynamic = "force-dynamic";

const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function InstagramPage({ searchParams }: { searchParams: Params }) {
  const { posts, ctx, periode, raccourcis, hier, progres } = await getDonneesInstagram({
    from: un(searchParams.from),
    to: un(searchParams.to),
  });
  const etat = etatDeLaPage({ posts, progres });
  // Les Règles de lecture (`?sansBoostes=1`, `?sansHorsNorme=1`) : les
  // écartés se décident UNE fois, sur la métrique affichée, puis le module,
  // la liste, le Tableau et le Panneau les reçoivent. La Tendance non.
  const regles = reglesDe(searchParams);
  const bandeau = (
    <BandeauInstagram
      params={searchParams}
      periode={periode}
      raccourcis={raccourcis}
      hier={hier}
      reglages={<ReglesDeLecture params={searchParams} regles={regles} />}
    />
  );

  // Compte neuf : un seul encart. Des modules vides ne diraient rien de plus,
  // et aucune lecture de plus n'est faite pour eux.
  if (etat.etat === "neuf") {
    return (
      // Pas de `max-w-*` : voir la note dans `app/page.tsx`.
      <main className="px-4 pb-16 sm:px-6 lg:px-8">
        {bandeau}
        <EncartCompteNeuf motDuWorker={etat.motDuWorker} />
      </main>
    );
  }

  // `metrique` : la métrique choisie au Sélecteur ; le module et la Place du
  // Tableau la suivent (spec, « une place à la fois »).
  const metrique = metriqueDe(un(searchParams.metrique));
  const indisponibles = Object.fromEntries(
    (Object.keys(METRIQUES) as CleMetrique[]).flatMap((m) => {
      const raison = raisonIndisponible(posts, m);
      return raison ? [[m, raison]] : [];
    })
  ) as Partial<Record<CleMetrique, string>>;
  const lue = { debut: periode.debut, fin: periode.fin };
  const ecartes = ecartesDe(posts, metrique, regles, ctx);
  const annee = moduleAnneeDe(posts, metrique, lue, ctx, ecartes);
  const meilleurs = meilleursDe(retenus(posts, ecartes), metrique, lue, ctx);
  const tableau = tableauDe(posts, metrique, ctx, ecartes);
  const lu = ligneRegles(regles, ecartes.total, metrique);

  // Le post ouvert (`?post=`, l'ID Graph). Le rapport hebdo n'est relu que
  // pour lui, et seulement s'il a un permalink — c'est par lui qu'on le
  // retrouve dans un payload (le rapport ne porte pas de `post_id`).
  const idOuvert = un(searchParams.post);
  const ouvert = idOuvert ? posts.find((p) => p.id === idOuvert) ?? null : null;
  const fermeture = lienInstagram(searchParams, { post: null });
  const [jourRapport, tendance] = await Promise.all([
    ouvert?.permalink ? jourDuPremierRapportQuiListe(ouvert.permalink) : Promise.resolve(null),
    getTendanceInstagram(posts, periode),
  ]);
  const fige = etat.etat === "jeton_mort";

  return (
    // Pas de `max-w-*` : voir la note dans `app/page.tsx`.
    <main className="px-4 pb-16 sm:px-6 lg:px-8">
      {bandeau}
      {fige && <EncartJetonMort figeAu={etat.figeAu} />}

      {/* Sous le jeton mort, la page grisée reste lisible et cliquable (le
          Panneau, l'export) : ce qu'elle montre est juste à sa date, l'encart
          et le badge disent laquelle. */}
      <div className={fige ? "mt-6 opacity-60 grayscale" : undefined}>
        {fige && <BadgeFige figeAu={etat.figeAu} />}

        {/* ── TA PAGE — le compte seul, jour par jour (ticket 14). Remplace les
            trois tuiles (Abonnés, Croissance 30 j, Engagement du compte) et la
            courbe des abonnés (spec § Tendance, « Retirés »). L'Objectif et
            les Règles de lecture ne lui sont pas passés : ils ne la
            gouvernent pas. */}
        <div className="mt-6">
          <TendanceTaPage tendance={tendance} params={searchParams} />
        </div>

        <div className="mt-12 space-y-12">
          <SelecteurObjectif metrique={metrique} indisponibles={indisponibles} params={searchParams} />
          {/* Remplace « Tes posts, un par un » et le « Top 3 » : la même
              question — que valent mes posts ? — lue contre l'année du format
              plutôt qu'en barres sans repère (spec, § Ce qui part). */}
          <TesPostsFaceATonAnnee
            module={annee}
            params={searchParams}
            rangs={rangsDe(meilleurs)}
            aside={<ListeMeilleurs liste={meilleurs} metrique={metrique} params={searchParams} />}
            regles={
              lu && (
                <p className="mt-1.5 text-[12.5px] text-ink">
                  {lu}{" "}
                  <Link href={lienInstagram(searchParams, SANS_REGLES)} scroll={false} className="font-medium underline underline-offset-2">
                    Revenir aux règles standard
                  </Link>
                </p>
              )
            }
          />
          {/* ── TOUS TES POSTS — remplace « Posts de la période » et « Vue
              globale » (ticket 09) : tout l'historique, la place de chaque
              post face à ses pareils des 12 derniers mois. */}
          <TableauPosts tableau={tableau} params={searchParams} />
        </div>
      </div>

      {idOuvert &&
        (ouvert ? (
          <PanneauPost
            lecture={lecturePostDe(ouvert, posts, metrique, ctx, regles)}
            metrique={metrique}
            phraseHebdo={phraseEcartHebdo(ouvert.releveA, jourRapport)}
            fermeture={fermeture}
          />
        ) : (
          <PanneauPostIntrouvable fermeture={fermeture} />
        ))}
    </main>
  );
}
