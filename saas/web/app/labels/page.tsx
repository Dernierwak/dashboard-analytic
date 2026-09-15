// LE COPILOTE DES THÈMES.
//
// Les labels sont la clé de voûte de Pulse : sans eux, pas de bilan par thème,
// pas de budget par thème, pas de conseil par thème. Une campagne non étiquetée
// disparaît de presque toute l'analyse — elle dépense, et rien ne la regarde.
//
// La page ne faisait pourtant que gérer le VOCABULAIRE : créer, renommer,
// supprimer des thèmes, avec un compteur d'usage. Elle ne montrait nulle part
// ce qui n'en avait pas, donc elle ne pouvait pas être l'endroit où on répare.
// Elle est maintenant lue de haut en bas comme un parcours :
//
//   1. LA COUVERTURE — où va l'argent, thème par thème, et ce qui n'en a
//      aucun. Le seul module de la page qui porte un camembert (rang 6).
//   2. LE GESTE DE MASSE — l'IA étiquette tout ce qui est vide, en un clic,
//      et se défait en un clic.
//   3. SANS THÈME — le travail restant, éditable sur place.
//   4. DÉJÀ ÉTIQUETÉ — la vérification, repliée.
//   5. TES THÈMES — le vocabulaire, qui n'est plus le sujet mais reste
//      nécessaire : c'est là qu'on crée, renomme, et marque les priorités.
//   6. CE QUI MARCHE POUR TOI — ce que l'étoile a produit. La page PROMETTAIT
//      ces constats (« les constats… se concentrent dessus ») alors que
//      `vision.constats` n'était rendu par aucun composant : publié chaque
//      semaine par le worker, lu nulle part. Raccordé par le ticket 09
//      (`.scratch/construction/issues/09-trois-moteurs-un-seul.md`).
//
// « L'OBJECTIF PAR THÈME » ET « CE QUE CHAQUE THÈME COMPTE » (les blocs 5bis
// et 6 qui vivaient ici) SONT PARTIS SUR /conversions. Cette page ne doit
// porter que le VOCABULAIRE des thèmes (créer, renommer, étoiler) — la
// sélection et la catégorisation des conversions GA4 sont un sujet à part,
// qui a désormais sa propre page. Voir `app/conversions/page.tsx` et
// `components/conversions-themes.tsx`.
//
// LA PAGE COMPOSE, ELLE NE DESSINE PAS. Tout ce qui a une forme vit dans
// `components/labels-*.tsx` — même raison que `couts-modules` et `hors-theme` :
// un module écrit dans une page est derrière `middleware.ts` et lit un vrai
// compte Supabase, donc il n'est vérifiable qu'en production. On ne peut lui
// donner ni quarante lignes ni zéro pour voir ce que ça fait.
//
// LA LECTURE DES DONNÉES A QUITTÉ CETTE PAGE, et c'est le seul point où l'en-tête
// ci-dessus a changé d'avis. `getEtiquetage` vivait ici, au motif que c'était une
// lecture propre à cette page — l'univers COMPLET des campagnes, y compris celles
// qui n'ont pas dépensé un franc sur la fenêtre, là où `getMetaDash` ne connaît
// que ce qui a bougé. Le motif tenait tant qu'une seule page en avait besoin ;
// le rapport hebdomadaire alerte maintenant avec le même montant, et deux
// arithmétiques pour un seul chiffre finissent toujours par diverger. La
// fonction est donc dans `lib/couverture.ts`, à l'identique, et cette page
// l'importe. Voir l'en-tête de ce fichier-là pour le raisonnement complet.
import { getEtiquetage } from "@/lib/couverture";
import { getLabelsData } from "@/lib/channels";
import { CreateLabel, LabelRow } from "@/components/label-manager";
import { ScrollList } from "@/components/scroll-list";
import { LabelsCouverture } from "@/components/labels-couverture";
import { ListeSansTheme, ListeDeja } from "@/components/labels-listes";
import { BandeauCommandes } from "@/components/bandeau-commandes";
import { CeQuiMarche } from "@/components/ce-qui-marche";
import { Carnet } from "@/components/carnet";
import { themesChoisis, filtreParThemes } from "@/lib/commandes";
import { prochainJourDeTravailFr } from "@/lib/jour-compte";

export const dynamic = "force-dynamic";

export default async function LabelsPage({
  searchParams,
}: {
  searchParams?: { [k: string]: string | string[] | undefined };
}) {
  const [data, etiquetage, quand] = await Promise.all([
    getLabelsData(),
    getEtiquetage(),
    // La date que portent les messages d'étoilage : une priorité s'enregistre
    // tout de suite et ne change les conseils qu'au Jour de travail.
    prochainJourDeTravailFr(),
  ]);

  // LE BANDEAU NE PORTE QUE LES THÈMES ICI, et pas de période : cette page
  // règle le VOCABULAIRE, elle ne lit aucune fenêtre (ticket 12 §6). Le thème
  // choisi resserre « Déjà étiqueté » — le seul module de la page qui soit une
  // liste de travail à parcourir. La couverture, le geste de masse et le
  // vocabulaire restent ceux du compte entier, et on l'écrit plutôt que de
  // laisser croire à un filtre global.
  //
  // LE FILTRE NE S'ÉCRIT PAS ICI. Il s'écrivait, et il s'était aplati : une
  // publication porte plusieurs thèmes, `themes.includes(e.label)` n'en
  // regardait qu'un, et un post « Marque » + « Promo » disparaissait de
  // « Déjà étiqueté » sous « Promo » — pendant que `/instagram`, qui filtre
  // avec `some`, l'affichait. La règle vit donc dans `lib/commandes.ts`, où
  // les deux pages la lisent au lieu de la recopier (ticket 29).
  const themes = themesChoisis(searchParams);
  const deja = filtreParThemes(etiquetage.deja, themes);

  return (
    // Pas de `max-w-*` : voir la note dans `app/page.tsx`.
    <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-9">
      <BandeauCommandes
        titre="Tes thèmes."
        themes={etiquetage.labels}
        themesActifs={themes}
      />

      <div className="mb-6 mt-3">
        <p className="text-[13px] text-muted leading-relaxed">
          Un thème regroupe campagnes Meta <span style={{ color: "#1a56ff" }}>▣</span>, Google{" "}
          <span style={{ color: "#1a7a4a" }}>◆</span> et posts Instagram{" "}
          <span style={{ color: "#7b4fff" }}>◎</span> — le rapport peut alors dire ce que
          chaque thème te rapporte. Renommer ou supprimer se propage partout.
        </p>
      </div>

      {/* 1 — LE MODULE QUI DIT POURQUOI ON EST LÀ. */}
      <LabelsCouverture c={etiquetage.couverture} labels={etiquetage.labels} />

      {/* 2 — CE QUE L'IA FAIT, ET QUAND. Le bouton « ✨ Étiqueter tout via
          l'IA » était ici : il est sorti de l'app avec les trois autres
          déclencheurs
          (`.scratch/construction/issues/15-le-client-ne-declenche-plus-rien.md`).
          Le classement n'a pas disparu pour autant — il tourne à chaque Jour de
          travail, dans le même passage que la récolte. Ce qui reste à cette
          place est donc la PHRASE que le bouton portait : ce que l'IA remplit,
          ce qu'elle ne touche jamais, et le jour où elle repasse. */}
      <div className="mb-5">
        <p className="text-[11.5px] text-faint leading-relaxed max-w-2xl">
          À chaque récolte, l&apos;IA lit tes légendes et tes noms de campagne, et pose un
          thème sur tout ce qui n&apos;en a pas — la prochaine fois,{" "}
          <span className="font-semibold text-muted">{quand}</span>. Elle ne remplit que
          le vide : <span className="font-semibold text-muted">un thème que tu as choisi
          n&apos;est jamais réécrit</span>. Ce que tu étiquettes ici, toi, se voit tout de
          suite sur tes tableaux de bord.
        </p>
      </div>

      {/* 3 — LE TRAVAIL. Il ne se filtre pas : une campagne sans thème
          n'appartient à aucun des thèmes cochés, la masquer reviendrait à
          cacher le travail restant au moment où on le regarde. */}
      <ListeSansTheme elements={etiquetage.sansTheme} labels={etiquetage.labels} />

      {/* 4 — LA VÉRIFICATION, resserrée sur les thèmes cochés s'il y en a. */}
      {themes.length > 0 && deja.length === 0 ? (
        <p className="text-[12.5px] text-muted mb-5">
          Rien n&apos;est encore étiqueté « {themes.join(" » ni « ")} ».
        </p>
      ) : (
        <ListeDeja elements={deja} labels={etiquetage.labels} />
      )}

      {/* 5 — LE VOCABULAIRE, ET L'ORDRE DES ÉTOILES.
          « Marque jusqu'à 3 thèmes prioritaires » annonçait un plafond qui
          n'en était pas un : trois n'a jamais été le nombre de thèmes qu'on
          peut travailler, c'était le nombre que le worker envoie à Gemini. On
          dit donc ce que trois veut dire, et on montre le rang de chaque
          étoile — sans lui, « les 3 premières » désigne un trio que le client
          ne peut pas voir, donc une règle qu'il ne peut pas jouer. */}
      <div className="border-t border-line pt-5">
        <p className="text-[11.5px] text-faint mb-3 leading-relaxed max-w-3xl">
          ★ Étoile les thèmes sur lesquels tu veux qu&apos;on travaille — les constats
          (en bas de cette page) et les conseils se concentrent dessus. Tu peux en marquer autant que tu
          veux : chacun aura sa carte, ses chiffres et ses conseils calculés.{" "}
          <span className="font-semibold text-ink">L&apos;IA, elle, en rédige 3</span> —
          les 3 premières étoiles posées, numérotées ci-dessous. Pour faire monter un
          thème, retire une étoile plus ancienne.
          {data.priorities.length > 0 && (
            <span className="text-warn font-semibold">
              {" "}
              Priorités :{" "}
              {data.priorities.map((p, i) => `★${i + 1} ${p}`).join(" · ")}
            </span>
          )}
        </p>

        <CreateLabel />

        {data.rows.length === 0 ? (
          <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center">
            <p className="text-[14px] text-ink font-medium">Aucun thème pour l&apos;instant.</p>
            <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
              Crée ton premier ci-dessus (ex. « e-bike », « promo été ») — ou laisse
              l&apos;IA en proposer à la prochaine récolte.
            </p>
          </div>
        ) : (
          <ScrollList title="Tes thèmes" count={data.rows.length} maxH="max-h-[52vh]">
            {data.rows.map((row) => {
              // `priorities` arrive de `getLabelsData` dans l'ordre d'étoilage
              // (created_at croissant) : l'index EST le rang, il ne se recalcule
              // pas ici.
              const i = data.priorities.indexOf(row.name);
              return (
                <LabelRow
                  key={row.name}
                  row={row}
                  priority={i >= 0}
                  rang={i >= 0 ? i + 1 : null}
                  quand={quand}
                />
              );
            })}
          </ScrollList>
        )}
      </div>

      {/* 6 — CE QUE L'ÉTOILE A PRODUIT. Le bloc est le même que sur les pages
          de plateforme ; ici il les montre TOUS, angle mort de couverture
          compris — c'est la seule page où il se répare. */}
      <div className="border-t border-line pt-5 mt-6">
        <CeQuiMarche page="themes" />
      </div>

      {/* 7 — TON CARNET. Aucune campagne ici, aucune régie : cette page parle
          du VOCABULAIRE, et une note y tombe sur le thème coché au bandeau.
          C'est le même module que sur les trois dashboards. */}
      <Carnet themes={themes} />
    </main>
  );
}
