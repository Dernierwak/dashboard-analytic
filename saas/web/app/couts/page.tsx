// Coûts — UN horizon qui se pilote, L'ANNÉE. Le reste s'y rattache.
//
// La page a d'abord porté trois horizons de même poids (jour, mois, année) et
// demandait le même montant par quatre portes différentes. On l'a ramenée au
// mois ; elle se range aujourd'hui sur l'ANNÉE, et c'est le bon niveau : une
// enveloppe publicitaire se décide une fois — un exercice, une saison, un salon
// — puis on passe l'année à vérifier qu'on la tient. Le mois n'est pas une
// saisie de plus, c'est une lecture de l'année ; le jour non plus.
//
// Ce que ça change concrètement : le mois se DÉDUIT de l'annuel (÷ 12), et
// c'est sa SEULE source depuis la suppression du dépliant de réglages. Un seul
// nombre à taper — l'enveloppe de l'année — fait vivre le mois, le jour, les
// alertes et toutes les barres de la page.
//
// LES COMMANDES NE SONT PLUS SUR LA PAGE, ELLES SONT DANS LE BANDEAU — et il
// faut savoir ce que ça change, parce que ce n'est pas un déménagement neutre.
// La période ne gouverne PAS toute la page : l'enveloppe de l'année ne la lit
// pas. Tant que le filtre était posé DANS la section 2,
// sa portée se lisait à sa position ; en haut de page, elle doit s'écrire —
// c'est le rôle de la phrase qui ouvre cette section. Ticket 28.
//
// Deux lectures, dans cet ordre, et pas une de plus :
//   1 · TENIR L'ANNÉE — trois chiffres de cadrage, puis DEUX modules côte à
//       côte : l'enveloppe fixée à gauche (1/3, aucune forme), la dépense avec
//       sa barre et le trait du calendrier à droite (2/3). Décider une
//       enveloppe et surveiller une dépense ne se font ni au même rythme ni
//       dans le même état d'esprit.
//   2 · OÙ ÇA PART — la SEULE que le bandeau commande : l'anneau par
//       plateforme dit la répartition, la courbe dit le rythme.
//
// La section « Par thème » et l'anneau par thème sont partis avec le thème
// (2026-09-30, `.scratch/meta-ads/map.md`) : rien ne les remplace.
//
// IL N'Y A PLUS DE SECTION « RÉGLAGES ». Ce qui s'y saisissait — l'enveloppe du
// mois, les budgets mensuels, la table mois par mois — demandait douze
// nombres pour en produire un seul, et le premier de ces nombres primait
// silencieusement sur l'enveloppe d'année. Tout se règle maintenant à l'endroit
// où le chiffre se lit. Les modules vivent dans
// `components/couts-modules.tsx` : cette page les compose, elle n'en dessine
// aucun.

import { getCoutsData } from "@/lib/couts";
import { getBudgetPlanifie } from "@/lib/budgets";
import { fmtCHF } from "@/lib/report";
import {
  AlerteDepassement,
  CourbeDepense,
  DepenseAnnee,
  EnveloppeAnnee,
} from "@/components/couts-modules";
import { BandeauCommandes } from "@/components/bandeau-commandes";
import { TrouDeRecolte } from "@/components/trou-recolte";
import { aveuglesSur } from "@/lib/canaux-muets";
import { Anneau } from "@/components/anneau";
import { Chiffre } from "@/components/chiffre";
import { type Teinte } from "@/lib/palette";

export const dynamic = "force-dynamic";

function Titre({ children, sur }: { children: React.ReactNode; sur?: string }) {
  return (
    <div className="mb-3">
      {sur && (
        <div className="text-[10px] uppercase tracking-widest text-faint font-bold mb-1">{sur}</div>
      )}
      <h2 className="font-serif text-[19px] sm:text-[21px] leading-tight text-ink flex items-center gap-2.5">
        <span className="h-4 w-[3px] rounded-full bg-brand shrink-0" />
        {children}
      </h2>
    </div>
  );
}

// Le mois n'a plus qu'une provenance possible, et il continue de l'écrire là
// où le nombre s'affiche : c'est la règle qui a fait naître cette page, un
// client lisait « enveloppe : 3 000 CHF » sans l'avoir jamais tapée.
const SOURCE_MOIS: Record<string, string> = {
  annuel: "ton enveloppe d'année ÷ 12",
  aucun: "fixe ton enveloppe d'année, le mois en découle",
};

// « À FIXER » ET « ON NE SAIT PAS » NE SONT PAS LA MÊME ABSENCE (ticket 48).
// Les deux font tomber le ratio à `null`, et les deux tombaient sur le même
// texte : un compte qui a bel et bien posé son enveloppe de 60 000 CHF se
// voyait répondre « à fixer juste en dessous » le jour où une régie ne
// répondait pas. On lui demandait de refaire ce qu'il avait déjà fait, au lieu
// de lui dire que c'est la CONSOMMATION qu'on ignore.
function sousBudget(
  ratio: number | null,
  dejaFixe: boolean,
  consomme: string,
  aFixer: string
): string {
  if (ratio !== null) return consomme;
  return dejaFixe ? "consommation inconnue — une régie n'a pas répondu" : aFixer;
}

// Les couleurs de canal, forcées sur l'anneau par plateforme. Sans elles
// l'anneau teinte ses parts par rang : Google pourrait sortir en bleu — la
// couleur de Meta dans dix-huit autres endroits de l'application.
const TEINTE_CANAL: Record<string, Teinte> = {
  Meta: { nom: "meta", trait: "#1a56ff", aplat: "rgba(26, 86, 255, 0.14)" },
  Google: { nom: "google", trait: "#1a7a4a", aplat: "rgba(26, 122, 74, 0.14)" },
};

/** « a », « a et b », « a, b et c » — une énumération qui se lit à voix haute. */
function joindre(noms: string[]): string {
  if (noms.length <= 1) return noms[0] ?? "";
  return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

function unSeul(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function CoutsPage({
  searchParams,
}: {
  searchParams?: { [k: string]: string | string[] | undefined };
}) {
  const sp = searchParams ?? {};
  // `d` absent vaut 7 : le bandeau n'écrit pas sa présélection par défaut. La
  // page ne décide donc pas de la fenêtre, elle passe ce qui a été demandé —
  // `resoudrePeriode` tranche, et lit encore l'ancien `p` des favoris.
  const d = unSeul(sp.d);
  const data = await getCoutsData({
    jours: d !== undefined && /^\d+$/.test(d) ? Number(d) : undefined,
    p: unSeul(sp.p),
    from: unSeul(sp.from),
    to: unSeul(sp.to),
  });

  const annee = data.annee;
  // Le budget POSÉ sur les campagnes, sur l'année entière — pas sur la période
  // filtrée : c'est l'enveloppe de l'année qu'il vient compléter, et un budget
  // planifié restreint à « 30 derniers jours » ne voudrait rien dire (une photo
  // hebdomadaire n'a pas de fenêtre).
  const planifie = await getBudgetPlanifie(`${annee}-01-01`, `${annee}-12-31`);
  // LES DEUX RATIOS SE DÉSARMENT AVEC LEUR NUMÉRATEUR (ticket 48). Ils portent
  // le verdict de la page — « X % consommé » — et une dépense amputée les fait
  // tomber du bon côté sans que personne ne l'ait décidé.
  const ratioMois =
    data.totalBudget > 0 && data.totalSpent !== null ? data.totalSpent / data.totalBudget : null;
  const ratioAn =
    data.budgetAnnuel > 0 && data.spentYear !== null ? data.spentYear / data.budgetAnnuel : null;
  // La sparkline du mois : un jour dont une régie manque vaut `null`, pas 0 —
  // sinon il dessine un creux qui se lit comme une journée sans dépense.
  const jours = data.daily.map((j) =>
    j.meta === null || j.google === null ? null : j.meta + j.google
  );
  // Les régies qui taisent la PÉRIODE FILTRÉE — un sous-ensemble de celles qui
  // taisent l'année, et le seul dont la section « Où ça part » puisse parler.
  const muetsPeriode = aveuglesSur(data.muets, data.periode.to);

  // Le budget de référence de la courbe : par jour, ou par semaine selon le pas.
  const repereCourbe = data.budgetJour * (data.periode.pas === "semaine" ? 7 : 1);

  return (
    // Pas de `max-w-*` : voir la note dans `app/page.tsx`. Les grilles de cette
    // page sont déjà en fractions (`minmax(...)`, jamais un pixel fixe), donc
    // gagner de la largeur profite à l'anneau et à la courbe au lieu d'être
    // plafonné avant qu'ils n'en aient besoin.
    <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-9">
      {/* LE TITRE EST LE BANDEAU. Il ne se pose pas au-dessus, il l'absorbe —
          la page n'a donc plus de `<h1>` à elle. Le sur-titre du mois est parti
          avec : il annonçait un horizon que la page ne pilote plus. */}
      <BandeauCommandes
        titre="Où part ton budget."
        periode={{
          fenetre: data.periode.bornes,
          jours: data.periode.presetJours,
          from: data.periode.preset === "custom" ? data.periode.from : undefined,
          to: data.periode.preset === "custom" ? data.periode.to : undefined,
          max: data.periode.max,
        }}
      />

      <div className="mb-7 mt-3">
        <p className="text-[13px] text-muted leading-relaxed max-w-[68ch]">
          Une seule enveloppe publicitaire, fixée pour l&apos;année. Le mois et le jour en
          découlent.
        </p>
      </div>

      {/* ══ 1 · TENIR L'ANNÉE ═══════════════════════════════════════════════ */}
      <section className="mb-9">
        <Titre sur="Fixer le cap">L&apos;année {annee}</Titre>

        {/* CE QU'ON N'A PAS PU LIRE, AVANT LES CHIFFRES QU'IL EXPLIQUE (ticket
            48). Il est au-dessus de l'alerte de dépassement, et pas sous elle :
            quand une régie est muette, l'absence d'alerte ne vaut pas « tout va
            bien » — c'est justement ce silence-là qu'il faut lire en premier. */}
        <TrouDeRecolte
          muets={data.muets}
          taisent="Ta dépense, ton rythme et le verdict de ton enveloppe restent inconnus tant qu'elle n'a pas répondu"
        />

        <AlerteDepassement alertes={data.alertes} budgetJour={data.budgetJour} />

        <div className="flex overflow-x-auto sm:grid sm:grid-cols-3 gap-3 mb-4 pb-1 sm:pb-0">
          <Chiffre
            titre="Budget annuel"
            valeur={data.budgetAnnuel > 0 ? `${fmtCHF(data.budgetAnnuel)} CHF` : "—"}
            sous={sousBudget(
              ratioAn,
              data.budgetAnnuel > 0,
              `${Math.round((ratioAn ?? 0) * 100)} % consommé · repère ${Math.round(data.elapsedAn * 100)} % de l'année`,
              "à fixer juste en dessous"
            )}
            ton={ratioAn !== null && ratioAn > 1 ? "neg" : "ink"}
            serie={data.parMois}
          />
          <Chiffre
            titre="Budget mensuel"
            valeur={data.totalBudget > 0 ? `${fmtCHF(data.totalBudget)} CHF` : "—"}
            sous={sousBudget(
              ratioMois,
              data.totalBudget > 0,
              `${SOURCE_MOIS[data.sourceBudgetMois]} · ${Math.round((ratioMois ?? 0) * 100)} % consommé ce mois`,
              SOURCE_MOIS.aucun
            )}
            // Un mois ne se saisit plus : il n'y a plus qu'une source, et c'est
            // pour ça que la phrase ci-dessus a cessé de varier.
            ton={ratioMois !== null && ratioMois > 1 ? "neg" : "ink"}
            serie={jours}
            serieLabels={data.daily.map((j) => j.label)}
          />
          <Chiffre
            titre="Moyenne quotidienne"
            valeur={data.moyenneJour === null ? "—" : `${fmtCHF(data.moyenneJour)} CHF`}
            sous={
              data.moyenneJour === null
                ? "une régie n'a pas répondu — le rythme de l'année n'est pas mesurable"
                : data.repereJour !== null && data.repereJour > 0
                  ? `depuis janvier · tiens ${fmtCHF(data.repereJour)} CHF par jour pour finir l'année dans l'enveloppe`
                  : "depuis janvier, tous canaux confondus"
            }
            // Le repère n'est pas budget ÷ 365 mais « ce qui reste ÷ les jours
            // qui restent » : sinon un début d'année calme se lit comme un
            // dérapage, et une fin d'année emballée passe inaperçue.
            ton={
              data.repereJour !== null &&
              data.moyenneJour !== null &&
              data.repereJour > 0 &&
              data.moyenneJour > data.repereJour * 1.05
                ? "warn"
                : "ink"
            }
            serie={jours}
            serieLabels={data.daily.map((j) => j.label)}
          />
        </div>

        {/* L'ENVELOPPE À GAUCHE SUR 1/3, LA DÉPENSE À DROITE SUR 2/3.
            Un seul module pleine largeur portait les deux, et il mélangeait
            deux gestes de fréquence opposée : décider l'enveloppe (une fois par
            an) et surveiller la dépense (chaque semaine). Le champ de saisie
            finissait sous une barre, trois chiffres de bilan et deux
            plateformes — soit tout en bas de ce qu'il commande.

            `minmax(0, …)` sur les deux colonnes, et `min-w-0` sur chaque
            module : un élément de grille vaut `min-width: auto` par défaut, un
            nombre en mono qui ne se coupe pas l'empêche alors de rétrécir, et
            c'est la PAGE ENTIÈRE qui se met à défiler horizontalement.
            Sur téléphone ils s'empilent dans l'ordre du DOM — l'enveloppe
            d'abord, parce qu'on ne surveille pas un budget avant de l'avoir
            fixé. */}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 mb-4 items-stretch">
          <EnveloppeAnnee
            annee={annee}
            budgetAnnuel={data.budgetAnnuel}
            budgetAnnuelHerite={data.budgetAnnuelHerite}
          />
          <DepenseAnnee
            annee={annee}
            spentYear={data.spentYear}
            budgetAnnuel={data.budgetAnnuel}
            elapsedAn={data.elapsedAn}
            planifie={planifie}
          />
        </div>
      </section>

      {/* ══ 2 · OÙ ÇA PART ══════════════════════════════════════════════════ */}
      <section className="mb-9">
        <Titre sur="Regarder de près">Où ça part</Titre>
        {/* LA PHRASE DE PORTÉE. La période vit maintenant en haut de page, et un
            contrôle posé là annonce qu'il gouverne tout ce qui suit : ici il n'en
            gouverne qu'un tiers. Ce qui se lisait à la POSITION du filtre doit
            donc s'écrire — une fois, ici, et pas sous chaque module. */}
        <p className="text-[12.5px] text-muted leading-relaxed mb-3.5 -mt-1 max-w-[68ch]">
          Le bandeau, en haut de page, commande cette section : l&apos;anneau dit la
          répartition par plateforme, et la courbe dit le rythme. Les chiffres de
          l&apos;année, plus haut, ne bougent pas : ils restent sur l&apos;année entière.
        </p>

        {/* AUCUN ANNEAU SUR UNE RÉPARTITION TROUÉE (ticket 48). Un camembert est
            une affirmation sur des PARTS : « 71 % chez Google ». Quand une des
            deux régies n'a pas répondu sur la période, la part de l'autre est
            mécaniquement gonflée — l'anneau ne serait pas imprécis, il serait
            faux, et il est d'autant plus convaincant qu'il est dessiné. Le
            `null` de `totalPeriode` sort la section entière plutôt que de
            laisser une moitié se faire passer pour un tout. */}
        {data.totalPeriode === null ? (
          <p className="text-[12.5px] text-muted leading-relaxed mb-4 max-w-[68ch]">
            {/* ON NE NOMME QUE LES RÉGIES QUI TAISENT CETTE PÉRIODE-CI.
                `data.muets` couvre la fenêtre la plus large de la page,
                l'année : une régie tombée après la fin de la période y figure
                sans rien y cacher, et la citer ici contredisait la phrase qui
                suit — « une seule des deux » alors qu'on venait d'en nommer
                deux. */}
            Pas de répartition sur cette période : {joindre(muetsPeriode.map((c) => c.nom))}{" "}
            {muetsPeriode.length > 1 ? "n'ont" : "n'a"} pas répondu au dernier passage, et
            une répartition à laquelle il manque une régie gonflerait la part de celles qui
            restent. Elle revient d&apos;elle-même au prochain passage réussi.
          </p>
        ) : data.totalPeriode > 0 ? (
          <div className="mb-4 max-w-[560px]">
            <Anneau
              rows={[
                { nom: "Meta", spend: data.parCanalPeriode.meta ?? 0 },
                { nom: "Google", spend: data.parCanalPeriode.google ?? 0 },
              ]}
              teintes={TEINTE_CANAL}
              titre="Dépensé par plateforme"
              sousTitre={data.periode.titre}
              unite="plateforme"
              montants
              note="Tout le compte sur la période. Un déséquilibre n'est pas un défaut en soi : c'est une question à se poser quand il n'a jamais été décidé."
            />
          </div>
        ) : (
          <p className="text-[12.5px] text-muted leading-relaxed mb-4">
            Aucune dépense sur cette période.
          </p>
        )}

        <CourbeDepense
          serie={data.serie}
          pas={data.periode.pas}
          titre={data.periode.titre}
          repere={repereCourbe}
          dernierePartielle={data.dernierePartielle}
        />
      </section>

      {/* IL N'Y A PLUS QU'UN SEUL CHAMP D'ENVELOPPE SUR CETTE PAGE, ET C'EST LE
          FIL À PLOMB DE TOUT LE RESTE. Trois suppressions successives y mènent,
          et elles obéissent toutes à la même règle : un montant qui gouverne un
          écran et qu'aucun écran ne permet plus de corriger est pire qu'un
          montant faux.

          · le dépliant « ⚙ Réglages du budget » (enveloppe du mois, budgets
            mensuels par thème, table mois par mois) — douze nombres pour en
            produire un. Le mois vient depuis TOUJOURS de l'annuel ÷ 12 ;
          · les deux enveloppes par PLATEFORME dans le module de l'année. Leur
            somme primait sur l'annuel quand il était vide ; l'éditeur parti, la
            branche de préséance part avec lui. `lib/couts.ts` n'a donc plus
            aucune règle de préséance sur l'année : `budgetAnnuel` vaut ce qui a
            été tapé, ou zéro ;
          · l'enveloppe PAR THÈME, partie avec le thème (2026-09-30).

          Ce qui est en base n'est pas détruit et l'écran le DIT :
          `budgetAnnuelHerite` ne sert qu'à écrire « ces montants ne comptent
          plus », là où le nombre a disparu. Un réglage qu'on abandonne se
          raconte, il ne s'efface pas en silence. */}
    </main>
  );
}
