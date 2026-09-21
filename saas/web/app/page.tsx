// Le point de la semaine — données réelles, lues dans `weekly_reports`, publié
// en headless par `saas/traitement/build_report.py` (cron du Jour de travail).
//
// CETTE PAGE NE CONSEILLE RIEN, ELLE CONSTATE. Les conseils, le suivi des
// actions, le carnet et le module « À faire » ont été retirés du produit : ce
// qui reste est ce qui se mesure — le verdict, la boussole, l'anneau des
// thèmes, la frise, les cartes de thème et ce qui a bougé sur les plateformes.

import Link from "next/link";
import { getWeeklyData, type ReportPayload } from "@/lib/report";
import { getChangementsApi } from "@/lib/changements-api";
import { getCouverture } from "@/lib/couverture";
import { TroisDates } from "@/components/trois-dates";
import { getThemeEvenements } from "@/lib/channels";
import { AlerteThemes } from "@/components/alerte-themes";
import { CanalMuetAlerte } from "@/components/canal-muet";
// L'ÉTAT VIDE, et lui seul. Le bandeau du rapport reste `CanalMuetAlerte`, qui
// lit le payload : deux listes du même fait sur un écran finiraient par se
// contredire. Celui-ci prend le relais là où il n'y a PAS de payload.
import { TrouDeRecolte } from "@/components/trou-recolte";
import { SetupWizard } from "@/components/setup-wizard";
import { ThemeCard, ecartTheme, penteNeutre } from "@/components/theme-card";
import { ancreTheme } from "@/lib/liens";
import { ThemesCarrousel } from "@/components/themes-carrousel";
import { KpiFocusCard } from "@/components/kpi-focus";
import { Changements, trierChangements } from "@/components/changements";
import { ThemeDonut } from "@/components/theme-donut";
import { FriseSemaine } from "@/components/frise-semaine";
import { Triangle } from "@/components/pente";


export const dynamic = "force-dynamic";

// Le titre d'une section numérotée. Le second niveau (`tone="discret"`) a été
// retiré : son seul porteur était le bloc « hors de tes thèmes », qui est
// devenu un module à part entière avec son propre surtitre. Un habillage sans
// utilisateur n'est pas un niveau de hiérarchie, c'est du code mort.
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-[19px] sm:text-[21px] leading-tight text-ink mb-3.5 flex items-center gap-2.5">
      <span className="h-4 w-[3px] rounded-full bg-brand shrink-0" />
      {children}
    </h2>
  );
}

// Le verdict, en chiffre. Une page dont le niveau 1 est une phrase de 26 px
// alors qu'un module affiche 46 px plus bas n'a pas la hiérarchie qu'elle
// croit avoir : c'est la typographie qui classe, pas l'intention. L'écart
// passe donc en très grand, et la phrase entière reste juste dessous.
// Sans les nouvelles clés (rapports publiés avant), on retombe sur la phrase.
function Verdict({ report }: { report: ReportPayload }) {
  const pct = report.verdict_pct;
  const ton = report.verdict_tone ?? "stable";
  if (pct === null || pct === undefined || !report.verdict_metric) {
    return (
      <h1 className="font-serif text-[26px] sm:text-[32px] leading-[1.15] text-ink text-balance">
        {report.verdict}
      </h1>
    );
  }
  const cls = ton === "pos" ? "text-pos" : ton === "neg" ? "text-neg" : "text-muted";
  const plat = Math.abs(pct) <= 0.5;
  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className={`font-mono text-[52px] sm:text-[68px] leading-[0.9] font-medium ${cls}`}>
          {plat ? "≈" : <Triangle sens={pct > 0 ? "haut" : "bas"} />} {pct > 0 ? "+" : ""}
          {pct.toFixed(0)}
          <span className="text-[26px] sm:text-[32px]"> %</span>
        </span>
        <span className="font-serif text-[17px] sm:text-[19px] text-muted leading-tight">
          {report.verdict_metric}
        </span>
      </div>
      <h1 className="font-serif text-[17px] sm:text-[19px] leading-snug text-ink text-balance mt-2 max-w-[60ch]">
        {report.verdict}
      </h1>
    </div>
  );
}

export default async function Page() {
  // CE QUE LES PLATEFORMES DÉCLARENT ELLES-MÊMES. Nos cinq faits déduits de la
  // dépense sont aveugles à tout ce qui ne fait pas bouger le budget du jour —
  // un mot-clé en pause, un CPC cible relevé, une audience élargie. Quatre-vingt
  // -dix jours parce que Google Ads ne garde `change_event` que trente jours et
  // Meta un peu plus : demander plus large ne coûte rien, la couche de données
  // rend ce qu'elle a.
  const depuisChg = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  // QUATRE LECTURES QUI NE S'ATTENDENT PAS.
  //
  // Elles étaient en série — le rapport, puis les changements déclarés — et la
  // couverture des thèmes en aurait fait une troisième à la queue leu leu.
  // Aucune des quatre n'a besoin du résultat des autres, donc les enchaîner
  // revient à additionner des allers-retours Supabase sur la page la plus lue
  // du produit. La couverture est la plus chère des quatre (elle lit l'univers
  // complet des campagnes) : c'est justement celle qu'il ne faut pas mettre au
  // bout d'une file.
  //
  // `evenements` (`getThemeEvenements`) — AJOUTÉE ici, PAS relue depuis
  // `/conversions` : le mini-module objectif + conversions de chaque
  // `ThemeCard` (`theme-objectif-mini.tsx`, ci-dessous) a besoin de savoir
  // quels événements GA4 chaque thème suit comme conversions, en LECTURE
  // SEULE — la même fonction que `/conversions` utilise pour sa propre
  // édition, elle reste la seule source de vérité de `theme_ga4_events`.
  const [data, changementsApi, couverture, evenements] = await Promise.all([
    getWeeklyData(),
    getChangementsApi(depuisChg),
    getCouverture(),
    getThemeEvenements(),
  ]);
  const report = data.report;
  // LA FENÊTRE DU BILAN DES CARTES, EN DATES — celle que la porte vers la
  // plateforme emporte. C'est la période de la matrice, d'où sortent tous les
  // chiffres de `summary` ; `vision.period_label` n'en est que la version
  // française (« depuis le 1 jan »). Les deux bornes ou rien : une porte qui
  // n'emporte qu'une moitié de fenêtre ouvre sur une autre période que celle
  // affichée, et l'écart au clic se lit comme un bug (ticket 14).
  const periode = report?.matrice?.period ?? null;
  const fenetreBilan =
    periode?.since && periode?.until ? { from: periode.since, to: periode.until } : null;
  // « depuis le 1 jan » — la MÊME fenêtre, dite au lecteur. Elle voyageait dans
  // `vision.period_label`, publié en double du `since` de la matrice ; le bloc
  // `vision` est parti avec les constats, la phrase se refait ici sur la seule
  // source qui reste.
  const MOIS_FR = ["jan", "fév", "mar", "avr", "mai", "jun",
                   "jul", "aoû", "sep", "oct", "nov", "déc"];
  const fenetreTexte = periode?.since
    ? (() => {
        const d = new Date(periode.since + "T00:00:00");
        return isNaN(d.getTime())
          ? null
          : `depuis le ${d.getDate()} ${MOIS_FR[d.getMonth()]}`;
      })()
    : null;
  const conversionsParTheme = new Map(evenements.themes.map((t) => [t.label, t.principaux]));

  // Thèmes prioritaires — le fil qui relie la vision aux conseils. Plus de
  // plafond depuis le 14 août 2026 ; seules les trois premières étoiles ont des
  // conseils, et l'ordre est celui de l'étoilage.
  const priorities = Object.keys(data.insightFeedback)
    .filter((k) => k.startsWith("priority_label:"))
    .map((k) => k.split(":").slice(1).join(":"));

  const themesFocus = report?.themes_focus ?? [];
  // TOUS les thèmes ont désormais une carte, qu'ils aient une courbe ou non :
  // c'est la carte qui décide de montrer sa courbe. Deux cartes pour le même
  // thème — une pour le bilan, une pour les conseils — obligeaient le lecteur
  // à faire lui-même le lien entre « voilà la courbe » et « voilà quoi faire ».
  //
  // ── SOUS CE TITRE, IL N'Y A QUE CE QUE LE CLIENT A ÉTOILÉ ────────────────
  //
  // Deux étoiles posées, trois cartes à l'écran. La cause était dans le worker :
  // une campagne lancée depuis moins de quatorze jours ajoutait SON thème à
  // `theme_list`, même non étoilé (bloc `_neuf_ajoute`, `build_report.py`). Le
  // signal était réel, sa place ne l'était pas — il s'affichait sous un titre
  // qui affirme une priorité que le client n'a pas choisie. Corrigé à la source ;
  // le fait, lui, continue d'arriver par `report.changements` et tombe dans le
  // filet « Ce qu'aucun thème ne prend » (`chgOrphelins`, plus bas), par
  // construction, puisque ce filet est le complément exact des cartes.
  //
  // MAIS UN RAPPORT NE SE RÉÉCRIT QU'AU JOUR DE TRAVAIL : le payload déjà
  // publié porte le thème surnuméraire jusqu'à la prochaine publication.
  // On rattrape donc à l'affichage, avec la même règle — le procédé exact des
  // « est programmée » de `rail-actions.tsx`, et il se retire le jour où plus
  // aucun payload ancien ne circule.
  //
  // C'EST LA LISTE VIVANTE DES ÉTOILES QUI FAIT FOI, pas le `is_priority` figé
  // dans le payload : `priorities`, ci-dessus, est relu dans `insight_feedback`
  // à chaque rendu, et c'est CETTE liste qui décide des cartes affichées. Ce
  // choix couvre du même coup l'autre cas possible : un thème étoilé le jour de
  // la publication et désétoilé depuis.
  //
  // ET IL NE VIDE JAMAIS LA SECTION. Aucune étoile → le worker retient les trois
  // plus gros thèmes, c'est un défaut assumé et on les garde tous. Des étoiles
  // qui ne désignent aucune carte (thème renommé, rapport plus vieux que
  // l'étoilage) → on ne cache rien plutôt que de rendre une section vide.
  const etoiles = new Set(priorities);
  const etoilees = themesFocus.filter((t) => etoiles.has(t.label));
  const cartes = etoiles.size > 0 && etoilees.length > 0 ? etoilees : themesFocus;
  const themesRendus = new Set(cartes.map((t) => t.label));

  const avecCourbe = cartes.filter((t) => t.series && t.series.points.length > 1);
  // Le classement entre thèmes n'a de sens que s'ils suivent LE MÊME
  // indicateur : comparer une portée à une dépense ne veut rien dire.
  const memeMetrique =
    avecCourbe.length > 1 &&
    avecCourbe.every((t) => t.series!.metric_label === avecCourbe[0].series!.metric_label);
  // Le classement entre tes thèmes. Pas de verdict absolu possible — il n'y a
  // pas de seuil de référence par thème — mais une comparaison qui reste À
  // L'INTÉRIEUR du même compte est légitime, et elle répond à la seule question
  // que cette section doit servir : où je mets mes dix minutes cette semaine.
  // …sauf quand l'indicateur commun est la DÉPENSE : un thème dont la dépense
  // baisse n'est pas un thème qui décroche, c'est un thème qu'on a coupé.
  const pentes = memeMetrique && !penteNeutre(avecCourbe[0].series!.metric_label)
    ? avecCourbe.map((t) => ({
        label: t.label,
        ecart: ecartTheme(t.series!.points.map((p) => p.value)),
      }))
    : [];
  const pire = pentes
    .filter((x): x is { label: string; ecart: number } => x.ecart !== null && x.ecart < -8)
    .sort((a, b) => a.ecart - b.ecart)[0];

  const tousChangements = report?.changements ?? [];
  const chgParTheme = (label: string) => tousChangements.filter((c) => c.theme === label);
  const chgOrphelins = tousChangements.filter(
    (c) => !c.theme || !themesRendus.has(c.theme)
  );
  const apiParTheme = (label: string) => changementsApi.filter((c) => c.theme === label);
  const apiOrphelins = changementsApi.filter(
    (c) => !c.theme || !themesRendus.has(c.theme)
  );
  // CE QU'AUCUN THÈME NE PREND — le complément EXACT du filtre des cartes, donc
  // ni doublon ni trou par construction. Une campagne non étiquetée n'a pas de
  // thème : elle atterrit ici, et c'est bien là qu'on veut la voir — c'est le
  // signe qu'il faut la classer.
  const { survenus: survenusOrphelins } = trierChangements(chgOrphelins, apiOrphelins);

  // L'HEURE DU RENDU, LUE UNE FOIS. La troisième des trois dates (« mis à jour
  // le ») se calcule à partir d'elle ; la figer ici garantit que toute la ligne
  // parle du même instant.
  const maintenant = new Date();

  // Numérotation dynamique : « Ce que tu dois faire » et « Historique »
  // disparaissent quand ils sont vides. Numéroter en dur faisait commencer la
  // page à 2, et un lecteur qui voit un 2 cherche le 1.
  let _n = 0;
  const nSemaine = report?.kpi_focus || report?.themes ? ++_n : undefined;
  const nThemes = cartes.length > 0 ? ++_n : undefined;

  // ── L'ORDRE DES CARTES DE THÈME ──────────────────────────────────────────
  //
  // LE PLAFOND DE TROIS EST TOMBÉ le 14 août 2026, et il n'a jamais été écrit
  // ici : cette page rend TOUT ce que le worker a retenu, sans en couper un
  // seul, et c'était déjà vrai quand le plafond tenait. Ce qui a changé est en
  // amont — `togglePriorityLabel` AVERTIT au lieu de refuser la quatrième
  // étoile, et le worker construit la carte de tous les thèmes étoilés.
  //
  // MAIS SEULES LES TROIS PREMIÈRES ÉTOILES REÇOIVENT DES PISTES RÉDIGÉES PAR
  // L'IA (`_THEMES_IA`, `build_report.py`). La raison n'est pas graphique : un
  // thème coûte jusqu'à deux appels Gemini par rapport, et quinze thèmes
  // feraient trente appels par compte et par semaine. « Les trois premières »
  // se lit dans l'ORDRE D'ÉTOILAGE — le seul critère sur lequel le client peut
  // agir : sous le poids en dépense, la carte devrait conseiller « dépense plus
  // sur ce thème » pour mériter des pistes, ce qui est absurde et nous arrange.
  //
  // Une carte sans pistes IA porte `ia_redigee: false` et l'explique elle-même
  // (`theme-card.tsx`) : un vide non expliqué se lit comme une panne.
  //
  // L'ORDRE, ET IL PÈSE PLUS QU'AVANT. Les étoilés d'abord — ce sont eux qu'on
  // a désignés comme le travail du moment. Puis ceux qui portent une action en
  // cours : un thème sur lequel un verdict va tomber n'est pas un thème de fond
  // de liste. Le reste garde l'ordre du worker, qui les classe par poids (part
  // de dépense ou part de publications, la plus grande des deux). Depuis qu'une
  // seule carte est visible à la fois, ce classement ne décide plus seulement
  // de qui est en haut : il décide de la carte qu'on OUVRE en arrivant.
  //
  // LE PLI A DISPARU AVEC L'EMPILEMENT. Au-delà de trois cartes, les suivantes
  // arrivaient fermées (`OUVERTES`, `estReplie`, `replie` sur `ThemeCard`, et
  // le `▾` du sommaire) : c'était la parade à un couloir de six mille pixels.
  // Il n'y a plus de couloir — `ThemesCarrousel` n'en montre qu'une — et un
  // repli qui ne replie rien est un geste de plus à comprendre pour rien.
  const cartesOrdonnees = cartes
    .map((t, rangWorker) => ({ t, rangWorker }))
    .sort(
      (a, b) =>
        Number(b.t.is_priority) - Number(a.t.is_priority) || a.rangWorker - b.rangWorker
    )
    .map((x) => x.t);

  return (
    // PAS DE `max-w-*` SUR LE CONTENEUR — et c'est un changement, pas un
    // oubli. `<main>` vit déjà à côté de `<aside>` (la colonne latérale,
    // `app/layout.tsx`) : sa largeur RÉELLE n'est jamais celle de l'écran,
    // c'est déjà écran moins colonne. Un `max-w-7xl` fixe par-dessus ça
    // semblait donner de la marge, mais recréait le même défaut à une autre
    // taille d'écran — un plafond fixe est toujours trop bas pour un écran
    // encore plus large, et 7xl (1 280 px) ne changeait déjà plus rien sur un
    // portable de 1 280 px UNE FOIS LA COLONNE DÉCOMPTÉE (1 000 px de
    // contenu disponible, sous le plafond). Le principe, du coup, n'est plus
    // « choisir le bon plafond » mais ne PAS en poser : le conteneur prend
    // toute la largeur que la colonne laisse, à toute taille d'écran et à
    // toute largeur de colonne (la colonne est maintenant redimensionnable,
    // voir `components/side-nav.tsx`).
    // Ce qui NE bouge pas : les paragraphes de prose portent chacun leur
    // propre plafond en `ch` (`max-w-[68ch]`, `max-w-[60ch]`…) — un texte
    // long reste lisible indépendamment de la largeur du conteneur qui le
    // porte. Seuls les modules qui bénéficient réellement de l'espace
    // (tableaux, grilles de cartes, courbes) suivent la largeur complète.
    <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-9">

      {/* LA MISE EN PLACE EST REMONTÉE EN TÊTE, et c'est un défaut mesuré par
          `.scratch/refonte/issues/06-le-parcours-comment-les-pages-se-parlent.md`
          qu'on répare ici : le fil de démarrage était rendu tout en bas de la
          page, sous deux écrans de défilement, alors qu'il porte les seules
          actions qui débloquent tout le reste. La décision est au point 2 de
          `10-l-entree-premier-ecran.md` : tant qu'une étape est ouverte, le fil
          est le PREMIER bloc et le rapport passe dessous ; dès que tout est
          franchi il s'efface et le verdict reprend la tête. Ce composant décide
          lui-même s'il a quelque chose à dire — il rend `null` quand il n'y a
          plus d'étape — donc le déplacer ne change rien pour un compte installé.
          Ce qu'on ne fait PAS ici : le passage aux quatre étapes avec la
          connexion en gate (même ticket, point 1). C'est la brique « mise en
          place », hors v1 : elle ne sert qu'à un client qui n'est pas encore
          là (`plan-de-refonte.md` §3). */}
      <SetupWizard
        onboarded={data.onboarded}
        couverture={couverture}
        themes={data.labels}
        priorities={priorities}
        jourDeTravail={data.jourDeTravail}
        maintenantIso={maintenant.toISOString()}
      />

      {/* Hero — le verdict EST le titre : « ma semaine a été bonne ? » est la
          première question du lecteur, elle doit trouver sa réponse avant le
          premier scroll. Une phrase d'accroche à la place ne dit rien. */}
      <div className="mb-7">
        {/* Ce qui est CALCULÉ entre en carte ; ce qui est RÉDIGÉ reste nu.
            La ligne de partage n'est pas esthétique, c'est une convention de
            lecture : l'écart, la métrique et la phrase de verdict sont produits
            par des règles déterministes, le résumé est écrit par une IA. Un
            cadre autour du second lui donnerait l'autorité du premier. */}
        {/* CE QU'ON N'A PAS PU LIRE — AU-DESSUS DES CHIFFRES, PAS EN NOTE.
            Un canal dont la récolte a échoué laisse des « — » à la place d'une
            dépense, d'un CPC, d'un ROAS (ticket 20). Ces tirets se lisent comme
            un bug de Pulse tant que personne ne dit d'où ils viennent, et un
            produit qui a l'air cassé se ferme. Le module est donc AVANT le
            verdict qu'il conditionne, et il se vide de lui-même dès que la
            récolte a tout lu — voir `canal-muet.tsx`. */}
        <CanalMuetAlerte canaux={report?.canaux_muets} />
        <div className="rounded-2xl border border-line bg-white shadow-card px-5 py-5 sm:px-7 sm:py-6">
          {/* LES TROIS DATES PRENNENT LA PLACE DU LIBELLÉ DE SEMAINE, elles ne
              s'ajoutent pas à lui : `week_label` dit déjà « Semaine 37 · 7 → 13
              septembre · 7 jours pleins », donc la fenêtre mesurée se serait
              lue deux fois à trente pixels d'écart. La ligne des trois dates
              dit la même fenêtre et deux choses de plus — quand ce texte a été
              publié, et quand il changera. Le libellé reste le repli des
              payloads publiés avant que `since`/`until` existent. */}
          <div className="mb-2">
            {report?.since && report?.until ? (
              <TroisDates
                since={report.since}
                until={report.until}
                publieLe={data.publieLe}
                jourDeTravail={data.jourDeTravail}
                maintenant={maintenant}
              />
            ) : (
              <p className="text-[11px] uppercase tracking-widest text-faint font-semibold">
                {report?.week_label ?? data.weekLabel}
              </p>
            )}
          </div>
          {report ? (
            <Verdict report={report} />
          ) : (
            <h1 className="font-serif text-[26px] sm:text-[32px] leading-[1.15] text-ink text-balance">
              Ta semaine en bref.
            </h1>
          )}
        </div>
        {/* LE RÉSUMÉ IA N'EST PLUS ICI — il est descendu au dernier rang du
            premier écran, replié. Voir `ResumeSemaine` ci-dessus.
            L'OBJECTIF N'EST PLUS ICI non plus. Il flottait sous le résumé, à
            600 px des cartes qu'il pondère : on le lisait comme un réglage de
            compte, pas comme la cause de ce qu'on allait voir. Il est descendu
            au-dessus de la première carte de thème (section 2). */}
      </div>

      {/* 1 · LA SEMAINE, TOUS THÈMES CONFONDUS — la vue d'ensemble : un seul
             indicateur en grand, et où part l'argent. Rien de filtré ici. */}
      {(report?.kpi_focus || (report?.themes && report.themes.rows.length > 0)) && (
        <section className="mb-9">
          <SectionTitle>
            <span className="text-faint font-mono mr-1.5">{nSemaine}</span> Ta semaine, tous
            thèmes confondus
          </SectionTitle>
          <p className="text-[12.5px] text-muted leading-relaxed mb-3.5 -mt-1 max-w-[68ch]">
            La vue d&apos;ensemble du compte : tout ce que tu publies et achètes, sans
            filtre. Choisis l&apos;indicateur que tu veux suivre.
          </p>
          {report?.kpi_focus && <KpiFocusCard k={report.kpi_focus} />}
          {report?.themes && report.themes.rows.length > 0 && (
            <div className="mt-3">
              <ThemeDonut rows={report.themes.rows} orphan={report.themes.orphan} univers={data.labels} />
            </div>
          )}
          {/* Le temps, sous les chiffres : ce qui était en l'air pour les
              obtenir. Les couleurs sont celles de l'anneau juste au-dessus. */}
          {report?.frise && (
            <div className="mt-3">
              <FriseSemaine f={report.frise} univers={data.labels} />
            </div>
          )}
        </section>
      )}

      {/* « IL TE MANQUE DES THÈMES » — POSÉ EXACTEMENT ICI, ET PAS AILLEURS.
          C'est la charnière entre la section 1 et la section 2, et c'est le
          seul endroit de la page où l'alerte change une lecture au lieu de
          l'interrompre.

          En amont, la section 1 dit « tous thèmes confondus » : rien de filtré,
          donc rien qui manque — l'argent non étiqueté EST dans ces chiffres-là,
          l'alerte n'y aurait rien à corriger. Elle y aurait même nui : la
          section 1 porte déjà `HorsTheme`, dont le surtitre dit « Hors de tes
          thèmes ». Deux modules voisins avec le même mot pour deux objets
          différents — celui-ci compte des FRANCS non rattachés, l'autre des
          FAITS que personne ne prend — et on ne saurait plus lequel répond à
          quoi.

          En aval commence la section 2, où tous les chiffres sont filtrés PAR
          THÈME. C'est là, et seulement là, que ce qui n'a pas de thème devient
          un trou : les bilans, les courbes et les conseils qui suivent portent
          sur la part étiquetée du compte, et rien dans une carte de thème ne
          peut dire ce qu'elle ne voit pas. L'alerte est la seule phrase qui
          rende honnête tout ce qui vient après elle — d'où sa place juste
          avant, comme une convention de lecture.

          Elle est HORS de la section 2, volontairement : un compte qui n'a
          encore rien étiqueté n'a aucune carte, donc pas de section 2 — et
          c'est précisément le compte qui a le plus besoin de lire ça.

          Elle ne s'affiche pas quand rien n'échappe : voir `alerte-themes.tsx`.
          Le module se vide de lui-même, il ne félicite personne. */}
      <AlerteThemes c={couverture} />

      {/* 2 · TES THÈMES PRIORITAIRES — LA section du thème. Elle porte tout ce
             qui le concerne : son bilan, sa courbe, ses conseils, et ce qu'on a
             déjà tenté dessus. Il y avait deux sections pour ça, à 900 px
             d'écart, avec le même titre et la même étoile. */}
      {cartes.length > 0 && (
        <section id="conseils" className="mb-9 scroll-mt-4">
          {/* LE BOUTON « ↻ Recharger mes conseils » PARTAGEAIT CETTE LIGNE.
              Il est sorti de l'app avec les trois autres déclencheurs : les
              conseils se réécrivent au Jour de travail, et à ce moment-là
              seulement. La date de la prochaine réécriture est déjà en tête de
              page, dans les trois dates — c'est la réponse à la question que ce
              bouton posait, et elle n'oblige personne à attendre trente
              secondes devant un rond qui tourne
              (`.scratch/construction/issues/15-le-client-ne-declenche-plus-rien.md`). */}
          <div className="mb-1">
            <SectionTitle>
              <span className="text-faint font-mono mr-1.5">{nThemes}</span> Tes thèmes
              prioritaires
            </SectionTitle>
          </div>
          {/* L'objectif et les thèmes suivis étaient écrits ici ET dans le
              widget juste dessous : la même phrase à 40 px d'écart. Le texte
              d'introduction se borne à ce qu'il est seul à dire — ce que la
              section contient. */}
          <p className="text-[12.5px] text-muted leading-relaxed mb-3.5 max-w-[68ch]">
            Pour chaque thème : où il en est, comment il évolue, et ce qui a bougé
            sur ses campagnes.
          </p>
          {/* LE SOMMAIRE EST DEVENU LA BARRE D'ONGLETS — il vit maintenant dans
              `ThemesCarrousel`, plus bas, avec les flèches et le « 2 / 5 ».
              C'était déjà la liste des noms de tous les thèmes : en faire la
              navigation évitait d'ajouter un troisième dispositif à côté. */}


          {/* L'OBJECTIF DU COMPTE ET L'OBJECTIF PAR THÈME NE SE RÈGLENT PLUS ICI.
              La carte globale (`ObjectifTheme`) qui vivait à cet endroit — un
              sélecteur `<ObjectifSelect>` éditable + un résumé des thèmes
              prioritaires — est retirée : régler l'objectif du compte se fait
              maintenant sur `/conversions` (module dédié), et l'objectif de
              CHAQUE thème s'affiche désormais en lecture seule DANS sa propre
              carte (`theme-objectif-mini.tsx`, dans `ThemeCard`, juste sous
              son bilan chiffré) — plus juste qu'un résumé global qui ne disait
              jamais lequel des N thèmes affichés avait un « objectif propre »
              sans qu'on remonte les yeux le vérifier. */}
          <ThemesCarrousel
            themes={cartesOrdonnees.map((t) => ({
              label: t.label,
              ancre: ancreTheme(t.label),
              etoile: t.is_priority,
            }))}
          >
            {cartesOrdonnees.map((t) => (
              <ThemeCard
                key={t.label}
                theme={t}
                changements={chgParTheme(t.label)}
                changementsApi={apiParTheme(t.label)}
                rows={report?.themes?.rows ?? null}
                fenetre={fenetreTexte}
                fenetreDates={fenetreBilan}
                decroche={pire?.label === t.label}
                labels={data.labels}
                conversionsTheme={conversionsParTheme.get(t.label) ?? []}
                objectifEffectif={t.objectif ?? data.objectif ?? null}
              />
            ))}
          </ThemesCarrousel>
        </section>
      )}

      {/* LE FILET N'EST PLUS ICI — il est monté à gauche de « Ta boussole »,
          dans la section 1. Il occupait une bande pleine largeur en bas de
          page, après tout le reste, alors qu'il porte les seules actions
          qu'aucune carte de thème ne prend. */}

      {/* LE PARCOURS DE DÉMARRAGE N'EST PLUS ICI — il est remonté en tête de
          page, au-dessus du verdict. Il vivait sous deux écrans de défilement
          alors qu'il porte les seules actions qui débloquent le reste. */}

      {!data.hasData ? (
        // « BRANCHE UNE SOURCE » EST FAUX QUAND LA SOURCE EST DÉJÀ BRANCHÉE
        // (ticket 48). Un compte qui vient de connecter Meta et dont la
        // première récolte a échoué n'a ni ligne ni rapport : il tombe ici, et
        // s'entendait répondre de faire ce qu'il venait de faire. La panne a
        // un nom, une date et un geste — c'est ça qu'il doit lire.
        data.canauxMuets.length > 0 ? (
          <TrouDeRecolte
            muets={data.canauxMuets}
            taisent="Rien n'a encore pu être lu sur ce compte, donc aucun chiffre ne s'affiche ici"
          />
        ) : (
          <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center">
            <p className="text-[14px] text-ink font-medium">Pas encore de données ici.</p>
            <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
              Branche une source sur la page{" "}
              <Link href="/comptes" className="text-brand font-semibold hover:underline">
                ⚙ Connexions
              </Link>{" "}
              : sa récolte part tout de suite, et tes chiffres s&apos;afficheront ici.
            </p>
          </div>
        )
      ) : (
        <>


          {/* LA SECTION « TES CONSEILS » A DISPARU.
              Elle rendait une seconde carte par thème — même titre, même
              étoile, mêmes campagnes — à 900 px de la première. Ses conseils
              vivent maintenant dans la carte du thème, à gauche sous la
              courbe, en face de ce que les actions passées ont donné. C'est la
              boucle conseil → action → effet dans un seul écran, au lieu de
              trois sections qui ne se regardaient pas.
              Le seul cas qu'elle traitait encore seule : aucun thème classé. */}
          {themesFocus.length === 0 && (
            <div className="bg-brand/[0.04] border border-brand/[0.14] rounded-xl p-5 mb-8">
              <p className="text-[13px] text-ink leading-relaxed">
                <span className="font-semibold text-brand">Presque prêt — </span>
                classe tes contenus sur la page{" "}
                <Link href="/labels" className="text-brand font-semibold hover:underline">◫ Thèmes</Link>{" "}
                — tes chiffres s&apos;y regroupent par thème à la seconde, et le rapport
                se construit thème par thème au prochain jour de travail.
              </p>
            </div>
          )}

          {/* CE QU'AUCUN THÈME NE PREND — les faits de plateforme dont la
              campagne n'a pas d'étiquette, ou dont le thème n'a pas de carte.
              C'est le complément exact des cartes ci-dessus, donc rien ne se
              perd et rien ne se lit deux fois. Ici vivaient « Pour aller plus
              loin » (le savoir-faire rédigé par Gemini) et les « Réglages de
              base » : deux blocs de conseils, partis avec le moteur. */}
          {survenusOrphelins.length + apiOrphelins.length > 0 && (
            <section className="mb-9">
              <SectionTitle>Ce qu&apos;aucun thème ne prend</SectionTitle>
              <p className="text-[12.5px] text-muted leading-relaxed mb-3.5 -mt-1 max-w-[68ch]">
                Ce qui a bougé sur des campagnes qu&apos;aucun de tes thèmes ne
                couvre. Les classer sur la page{" "}
                <Link href="/labels" className="text-brand font-semibold hover:underline">◫ Thèmes</Link>{" "}
                les fera remonter dans la bonne carte.
              </p>
              <div className="bg-white border border-line rounded-xl shadow-card px-4 py-3.5">
                <Changements
                  changements={chgOrphelins}
                  changementsApi={apiOrphelins}
                  maxH="max-h-[320px]"
                />
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
