// ── LE DASHBOARD META ADS ────────────────────────────────────────────────────
//
// Spec `.scratch/meta-ads/spec.md` ; ADR 0011 (les cinq modules nommés, dans
// l'ordre du brief). Cette page REMPLACE l'ancienne (héritée du Streamlit) :
// elle lit l'identité par ID, pagine au-delà de 1 000 lignes, recalcule ses
// ratios total ÷ total et dit à quelle date Pulse a lu Meta.
//
// L'état vit dans l'URL : `vue`, `campagne` et `groupe` (par ID), `from`/`to`,
// et pour la Comparaison `niveau`, `m1`/`m2` et `comparer` (répété). Le
// Panneau latéral montre UNE chose (`lib/meta/liens.ts`, `SANS_PANNEAU`) : le
// jour ouvert (`jour`, et `element` depuis un point de la Comparaison), un
// onglet du bord droit (`panneau=changements` ou `apercus`) ou l'annonce lue
// (`annonce`). Le calcul est dans `lib/meta/lecture.ts` et
// `lib/meta/changements.ts`, la lecture de la base dans `lib/meta/donnees.ts`.
import { ApercusAnnonces } from "@/components/meta/apercus";
import { BandeauMeta } from "@/components/meta/bandeau";
import { Comparaison } from "@/components/meta/comparaison";
import { JournalChangements } from "@/components/meta/journal-du-jour";
import { LectureAnnonce } from "@/components/meta/lecture-annonce";
import { Onglets, type Onglet } from "@/components/meta/onglets";
import { PanneauLateral } from "@/components/meta/panneau";
import { SelecteurVue } from "@/components/meta/selecteur-vue";
import { TableauDetaille } from "@/components/meta/tableau";
import { Tendance } from "@/components/meta/tendance";
import { TrouDeRecolte } from "@/components/trou-recolte";
import { enFrancais } from "@/lib/jour-de-travail";
import { getDonneesMeta } from "@/lib/meta/donnees";
import {
  elementOuvertDe,
  jourOuvertDe,
  joursMarques,
  marquesElement,
  panneauDe,
  type Portee,
} from "@/lib/meta/changements";
import { bornes } from "@/lib/meta/lecture";
import { lienMeta, SANS_PANNEAU, type Params } from "@/lib/meta/liens";

export const dynamic = "force-dynamic";

const un = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
/** `comparer` se répète : une valeur par place cochée. */
const tous = (v: string | string[] | undefined) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);
const changements = (n: number) => (n === 0 ? "Aucun changement" : `${n} changement${n > 1 ? "s" : ""}`);

export default async function MetaPage({ searchParams }: { searchParams: Params }) {
  // Plusieurs panneaux à la fois n'arrivent que par une URL tapée à la main
  // (chaque lien retire les autres) : le jour l'emporte, puis l'onglet, et ce
  // qui ne s'ouvrira pas n'est pas lu pour rien.
  const jourDemande = un(searchParams.jour);
  const ongletDemande = un(searchParams.panneau);
  const onglet: Onglet | null =
    !jourDemande && (ongletDemande === "changements" || ongletDemande === "apercus") ? ongletDemande : null;
  const meta = await getDonneesMeta(
    {
      vue: un(searchParams.vue),
      campagne: un(searchParams.campagne),
      groupe: un(searchParams.groupe),
      from: un(searchParams.from),
      to: un(searchParams.to),
      niveau: un(searchParams.niveau),
      m1: un(searchParams.m1),
      m2: un(searchParams.m2),
      comparer: tous(searchParams.comparer),
    },
    { annonce: jourDemande || onglet ? undefined : un(searchParams.annonce), apercus: onglet === "apercus" }
  );
  const choisie = meta.campagneChoisie;
  const groupe = meta.groupeChoisi;
  const sujet = groupe
    ? groupe.connue ? `« ${groupe.nom} »` : "le groupe d'annonces demandé"
    : choisie ? (choisie.connue ? `« ${choisie.nom} »` : "la campagne demandée") : "toutes tes campagnes";

  // Le journal suit les filtres du Bandeau, par l'ID (`lib/meta/changements.ts`).
  const portee: Portee = { campagne: choisie?.cle ?? null, groupe: groupe?.cle ?? null };
  const { journal, comparaison, dates, periode } = meta;
  const marques = journal && joursMarques(journal, portee, dates);
  const marquesComparaison =
    journal &&
    Object.fromEntries(comparaison.coches.map((s) => [s.cle, marquesElement(journal, { niveau: comparaison.niveau, cle: s.cle }, dates)]));
  const contexte = { campagnes: meta.campagnes, noms: meta.noms };
  const periodeEntiere = journal && panneauDe(journal, { debut: periode.debut, fin: periode.fin }, portee, contexte);

  const jour = journal && jourOuvertDe(jourDemande, periode);
  const element = elementOuvertDe(un(searchParams.element));
  // L'élément d'un point de la Comparaison : son nom et la couleur de sa ligne.
  const ligne = element && comparaison.niveau === element.niveau ? comparaison.elements.find((e) => e.cle === element.cle) : undefined;
  const couleur = element ? comparaison.coches.find((s) => s.cle === element.cle)?.couleur : undefined;
  const sujetJour = element ? `« ${ligne?.nom || meta.noms[element.cle] || element.cle} »` : sujet;
  const fermeture = lienMeta(searchParams, SANS_PANNEAU);

  return (
    // Pas de `max-w-*` : le conteneur prend toute la largeur laissée par la
    // colonne latérale ; un plafond fixe finit toujours par redevenir trop
    // étroit dès que l'écran ou la colonne change.
    <main className="px-4 pb-16 sm:px-6 lg:px-8">
      {/* Jamais remonté par une `key` : la pilule se rattacherait en haut à
          chaque période choisie en plein défilement. */}
      <BandeauMeta
        lecture={meta.lecture}
        params={searchParams}
        vue={meta.vue}
        campagnes={meta.campagnes}
        campagneChoisie={choisie}
        groupes={meta.groupes}
        groupeChoisi={groupe}
        periode={periode}
        raccourcis={meta.raccourcis}
        hier={meta.hier}
      />

      {/* Ce qu'on n'a pas pu lire, AVANT les chiffres qu'il explique (ticket
          48) : sans lui, une récolte en échec se lirait comme une chute. */}
      {meta.muet && (
        <div className="mt-2">
          <TrouDeRecolte muets={[meta.muet]} taisent="La période affichée s'arrête au dernier jour lu, elle ne couvre pas les jours suivants" />
        </div>
      )}

      <div className="mt-6 space-y-12">
        <SelecteurVue cartes={meta.cartes} vue={meta.vue} params={searchParams} />
        <Tendance
          metriques={meta.tendance}
          dates={dates}
          datesAvant={meta.datesAvant}
          sujet={sujet}
          marques={marques}
          params={searchParams}
        />
        <Comparaison
          comparaison={comparaison}
          vue={meta.vue}
          dates={dates}
          params={searchParams}
          sujet={sujet}
          vignettes={meta.vignettes}
          marques={marquesComparaison}
        />
        <TableauDetaille tableau={meta.tableau} />
      </div>

      <Onglets
        params={searchParams}
        actif={jour ? "changements" : onglet}
        ouvert={!!(jour || onglet || meta.annonce)}
        changements={periodeEntiere ? periodeEntiere.total : null}
        annonces={meta.annonces.length}
      />

      {/* Un jour hors de la période, ou un journal illisible, n'ouvre rien :
          le paramètre reste dans l'URL sans effet, et le prochain lien qui
          touche `jour` le remplace. */}
      {journal && jour && (() => {
        const panneau = panneauDe(journal, { debut: jour, fin: jour }, { ...portee, element }, contexte);
        return (
          <JournalChangements
            panneau={panneau}
            titre={enFrancais(new Date(`${jour}T00:00:00Z`))}
            sousTitre={
              <>
                {couleur && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: couleur }} aria-hidden />}
                <span className="min-w-0 truncate">
                  {changements(panneau.total)} sur {sujetJour}
                </span>
              </>
            }
            vide={`Meta ne déclare aucun changement sur ${sujetJour} ce jour-là.`}
            parJour={false}
            fermeture={fermeture}
          />
        );
      })()}

      {onglet === "changements" &&
        (periodeEntiere ? (
          <JournalChangements
            panneau={periodeEntiere}
            titre="Tous les changements"
            sousTitre={`${changements(periodeEntiere.total)} sur ${sujet} · ${bornes(periode.debut, periode.fin)}`}
            vide={`Meta ne déclare aucun changement sur ${sujet} sur cette période.`}
            parJour
            fermeture={fermeture}
          />
        ) : (
          <PanneauLateral titre="Tous les changements" fermeture={fermeture}>
            <p className="mt-2 rounded-xl bg-canvas px-4 py-3 text-[14px] text-muted">
              Le journal des changements n&apos;a pas pu être lu. Les chiffres de la page, eux, ne sont pas touchés.
            </p>
          </PanneauLateral>
        ))}

      {onglet === "apercus" && (
        <ApercusAnnonces annonces={meta.annonces} apercus={meta.apercus} params={searchParams} fermeture={fermeture} />
      )}

      {/* Une annonce sans chiffres sur la période et la sélection choisies
          n'ouvre rien, comme un jour hors de la période. */}
      {meta.annonce && <LectureAnnonce annonce={meta.annonce} fermeture={fermeture} />}
    </main>
  );
}
