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
//   1. LA COUVERTURE — combien d'argent échappe à l'analyse, et pourquoi ça
//      compte. C'est le seul module de la page qui porte un rang 3.
//   2. LE GESTE DE MASSE — l'IA étiquette tout ce qui est vide, en un clic,
//      et se défait en un clic.
//   3. SANS THÈME — le travail restant, éditable sur place.
//   4. DÉJÀ ÉTIQUETÉ — la vérification, repliée.
//   5. TES THÈMES — le vocabulaire, qui n'est plus le sujet mais reste
//      nécessaire : c'est là qu'on crée, renomme, et marque les priorités.
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
import { ClassifyButton } from "@/components/classify-button";
import { ScrollList } from "@/components/scroll-list";
import { LabelsCouverture } from "@/components/labels-couverture";
import { ListeSansTheme, ListeDeja } from "@/components/labels-listes";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const [data, etiquetage] = await Promise.all([getLabelsData(), getEtiquetage()]);

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-9">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          Une liste, trois canaux
        </p>
        <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
          Tes thèmes.
        </h1>
        <p className="text-[13px] text-muted mt-2 leading-relaxed">
          Un thème regroupe campagnes Meta <span style={{ color: "#1a56ff" }}>▣</span>, Google{" "}
          <span style={{ color: "#1a7a4a" }}>◆</span> et posts Instagram{" "}
          <span style={{ color: "#7b4fff" }}>◎</span> — le rapport peut alors dire ce que
          chaque thème te rapporte. Renommer ou supprimer se propage partout.
        </p>
      </div>

      {/* 1 — LE MODULE QUI DIT POURQUOI ON EST LÀ. */}
      <LabelsCouverture c={etiquetage.couverture} />

      {/* 2 — LE GESTE DE MASSE, juste sous le chiffre qu'il fait baisser.
          Il n'est plus dans l'en-tête : une action qui répare ce qu'un module
          vient de mesurer se pose contre ce module, pas trois écrans plus haut.
          Le bloc n'est PAS une rangée flex — le pavé d'annulation qu'il déplie
          fait 320 px et ne tiendrait pas à côté d'un texte sur un téléphone. */}
      <div className="mb-5">
        <ClassifyButton libelle="✨ Étiqueter tout via l'IA" avecAnnulation />
        <p className="text-[11.5px] text-faint mt-2 leading-relaxed max-w-2xl">
          L&apos;IA lit tes légendes et tes noms de campagne, et pose un thème sur tout ce
          qui n&apos;en a pas. Elle applique directement — mais elle ne remplit que le
          vide : <span className="font-semibold text-muted">un thème que tu as choisi
          n&apos;est jamais réécrit</span>, et tout ce qu&apos;elle vient de poser
          s&apos;annule en bloc tant que tu es sur cette page.
        </p>
      </div>

      {/* 3 — LE TRAVAIL. */}
      <ListeSansTheme elements={etiquetage.sansTheme} labels={etiquetage.labels} />

      {/* 4 — LA VÉRIFICATION. */}
      <ListeDeja elements={etiquetage.deja} labels={etiquetage.labels} />

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
          et les conseils se concentrent dessus. Tu peux en marquer autant que tu
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
              Crée ton premier ci-dessus (ex. « e-bike », « promo été »), ou laisse
              l&apos;IA les proposer avec le bouton du haut.
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
                />
              );
            })}
          </ScrollList>
        )}
      </div>
    </main>
  );
}
