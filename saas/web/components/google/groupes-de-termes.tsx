import Link from "next/link";
import { GrapheGroupes } from "@/components/google/groupes-graphe";
import { lienGoogle, type Params } from "@/lib/google/liens";
import { nombre, TIRET } from "@/lib/google/lecture";
import { chiffre, MODES, TAILLES, TAILLES_SANS_OBJET, TAILLE_PAR_DEFAUT, type Chiffres, type GroupesDeTermes, type ModeGroupes, type Taille } from "@/lib/google/termes";

// ── MODULE 6 · LES GROUPES DE TERMES ─────────────────────────────────────────
//
// Spec Google, § « Groupes de termes » ; user stories 69 à 82 ; décision :
// carte, issue 21 (le graphe en grappes de la maquette `87a4b5c`, validé par
// David). Ce que les gens ont tapé avant de voir une annonce Search, rangé en
// grappes. Le calcul vient de `lib/google/termes.ts` (testé) ; ce composant
// écrit les liens et les chiffres, le graphe est tenu par le navigateur
// (`groupes-graphe.tsx`, survol et fiche sans relire la page).
//
// L'état vit dans l'URL : `gm` (mode), `gc` (campagne), `gt` (taille). Chaque
// lien n'énumère que ce qu'il change (`CLAUDE.md` §8) et garde l'ancre du module.

const ANCRE = "#groupes";
const lien = (params: Params, patch: Record<string, string | null>) => `${lienGoogle(params, patch)}${ANCRE}`;

const pastille = (actif: boolean) =>
  `rounded-full border px-3 py-1 transition-colors motion-reduce:transition-none ${actif ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:bg-[#f6f7ff]"}`;

const SOUS_TITRES: Record<ModeGroupes, string> = {
  "mots-cles": "Les recherches qui ont affiché tes annonces Search, rangées sous le mot-clé qui les a déclenchées.",
  clusters: "Les mêmes recherches, rangées dans les groupes que Google forme lui-même. Google n'en donne pas le coût.",
};
const SANS_OBJET = "Google ne donne pas le coût d'un cluster : les ronds ne peuvent pas suivre le coût.";
const SANS_GRAPPE_CLUSTERS = "Aucun cluster de Google lu pour ce choix : ils arrivent au prochain passage de la récolte.";

const NOMS_TOTAUX: Record<Taille, string> = { clics: "clics", impressions: "impressions", conversions: "conversions", cout: "CHF de coût" };

function LigneChiffres({ chiffres, titre }: { chiffres: Chiffres; titre: string }) {
  return (
    <p className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
      <span className="text-muted">{titre}</span>
      {TAILLES.map((t) => (
        <span key={t.cle}>
          <b className="font-semibold tabular-nums text-ink">{chiffre(t.cle, chiffres[t.cle])}</b>{" "}
          <span className="text-muted">{NOMS_TOTAUX[t.cle]}</span>
        </span>
      ))}
    </p>
  );
}

export function GroupesDeTermes({ groupes, params }: { groupes: GroupesDeTermes; params: Params }) {
  return (
    <section id="groupes" aria-labelledby="titre-groupes" className="min-w-0 scroll-mt-24">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="titre-groupes" className="text-[22px] font-semibold tracking-tight text-ink">
            Ce que les gens ont cherché
          </h2>
          <p className="mt-1 text-[14px] text-muted">{SOUS_TITRES[groupes.etat === "sans-search" ? "mots-cles" : groupes.mode]}</p>
        </div>
        {/* Visible aussi quand un mode n'a pas pu être lu : on peut repasser à l'autre. */}
        {groupes.etat !== "sans-search" && MODES.length > 1 && (
          <nav aria-label="Ranger les termes par" className="flex gap-1 rounded-full border border-line bg-white p-1 text-[13.5px]">
            {MODES.map((m) => (
              <Link key={m.cle} href={lien(params, { gm: m.cle, gt: null })} scroll={false} className={pastille(groupes.mode === m.cle)}>
                {m.nom}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {groupes.etat !== "lu" ? (
        <p className="text-[14px] text-muted">{groupes.phrase}</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Campagne Search" className="flex min-w-0 flex-wrap gap-1.5 text-[12.5px]">
              <Link href={lien(params, { gc: groupes.gcToutes })} scroll={false} className={pastille(groupes.campagne === null && !groupes.campagneInconnue)}>
                Toutes les campagnes
              </Link>
              {groupes.campagnes.map((c) => (
                <Link key={c.cle} href={lien(params, { gc: c.cle })} scroll={false} className={pastille(groupes.campagne === c.cle)}>
                  {c.nom}
                </Link>
              ))}
            </nav>
            <nav aria-label="Taille des ronds" className="flex flex-wrap items-center gap-1 text-[12.5px]">
              <span className="mr-1 text-muted">Taille des ronds</span>
              {TAILLES.map((t) =>
                TAILLES_SANS_OBJET[groupes.mode].includes(t.cle) ? (
                  // Barré, pas caché : le client voit que le chiffre manque chez Google (user story 72).
                  <span key={t.cle} aria-disabled="true" title={SANS_OBJET} className="cursor-not-allowed rounded-full border border-line px-3 py-1 text-muted line-through">
                    {t.nom}
                  </span>
                ) : (
                  // Le défaut ne s'écrit pas : `/google#groupes` se partage.
                  <Link key={t.cle} href={lien(params, { gt: t.cle === TAILLE_PAR_DEFAUT ? null : t.cle })} scroll={false} className={pastille(groupes.taille === t.cle)}>
                    {t.nom}
                  </Link>
                )
              )}
            </nav>
          </div>

          {groupes.campagneInconnue ? (
            <p className="text-[14px] text-muted">
              La campagne demandée n&apos;est pas une campagne Search lue sur la période : aucun terme à montrer pour elle.
            </p>
          ) : groupes.grappes.length === 0 ? (
            <p className="text-[14px] text-muted">
              {groupes.mode === "clusters"
                ? SANS_GRAPPE_CLUSTERS
                : groupes.termesDepuis
                  ? "Aucun terme de recherche lu sur cette période."
                  : "Les termes de recherche n'ont pas encore été récoltés : ils arrivent au prochain passage de la récolte."}
            </p>
          ) : (
            <>
              <div className="mb-4 space-y-1">
                <LigneChiffres titre="Termes listés" chiffres={groupes.totaux} />
                {groupes.masques ? (
                  <p className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] italic text-muted">
                    <span>Masqués par Google</span>
                    {TAILLES.map((t) => (
                      <span key={t.cle}>
                        <span className="tabular-nums">{chiffre(t.cle, groupes.masques![t.cle])}</span> {NOMS_TOTAUX[t.cle]}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="text-[13px] text-muted">Masqués par Google : {TIRET} — {groupes.raisonMasques}</p>
                )}
                {groupes.partMasquee !== null && (
                  <p className="text-[12.5px] text-muted">
                    <b className="font-semibold text-ink">{nombre(groupes.partMasquee * 100)} %</b> des clics{" "}
                    {groupes.mode === "clusters" ? "des clusters" : "des campagnes"} viennent de
                    recherches que Google ne liste pas (seuil de confidentialité, non publié). La liste n&apos;est jamais le tout.
                  </p>
                )}
                {groupes.phrases.map((p) => (
                  <p key={p} className="text-[12.5px] text-muted">
                    {p}
                  </p>
                ))}
              </div>
              <GrapheGroupes
                // Remonté au changement de réglage : la disposition se recalcule
                // et la grappe ouverte repart de la plus grosse.
                key={`${groupes.mode}-${groupes.campagne ?? "toutes"}-${groupes.taille}`}
                grappes={groupes.grappes}
                taille={groupes.taille}
                mode={groupes.mode}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
