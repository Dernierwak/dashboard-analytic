// LA PAGE CONVERSIONS — ce qui concerne les CONVERSIONS GA4 elles-mêmes : de
// quel GENRE de conversion chaque événement relève.
//
//   1. LE CAMEMBERT — combien de GENRES de conversions par catégorie, tout le
//      compte confondu (une catégorie est une propriété de l'événement — voir
//      l'en-tête de `conversion_categories.sql`). Compte des TYPES d'événements
//      distincts, jamais leur volume — voir le calcul plus bas pour pourquoi.
//      LIMITÉ AUX VRAIES CONVERSIONS (catégorisées ou marquées « clé » par
//      GA4) — jamais tout le catalogue, qui contient aussi le bruit
//      (page_view, scroll…) qu'aucun compte n'appelle une conversion.
//   2. TOUTES TES CONVERSIONS — le catalogue GA4 complet, pour assigner ou
//      changer la catégorie de n'importe quel événement.
//   3. LES CATÉGORIES — créer, renommer, supprimer.
//
// LA PAGE COMPOSE, ELLE NE DESSINE PAS : tout ce qui a une forme vit dans
// `components/*.tsx`.
import { getCatalogueGa4, getConversionCategories } from "@/lib/channels";
import { Anneau } from "@/components/anneau";
import { ConversionsCatalogueModule } from "@/components/conversions-catalogue";
import { CreateCategory, CategoryRow } from "@/components/category-manager";
import { ScrollList } from "@/components/scroll-list";
import { BandeauCommandes } from "@/components/bandeau-commandes";
import { prochainJourDeTravailFr } from "@/lib/jour-compte";

export const dynamic = "force-dynamic";

export default async function ConversionsPage() {
  const [evenements, cat, quand] = await Promise.all([
    getCatalogueGa4(),
    getConversionCategories(),
    // Catégoriser s'enregistre tout de suite ; le rapport n'en tient compte
    // qu'au Jour de travail, et on le date plutôt que de dire « plus tard ».
    prochainJourDeTravailFr(),
  ]);

  const nomsCategories = cat.categories.map((c) => c.name);

  // Le camembert compte le NOMBRE DE GENRES DE CONVERSIONS (des noms
  // d'événements distincts) par catégorie — jamais leur VOLUME (le nombre de
  // fois qu'ils se sont déclenchés). Retour direct de David après usage réel :
  // sommer le volume faisait qu'une catégorie portant une seule conversion
  // très fréquente (ex. « page_view » catégorisé à la main, déclenché 10 000
  // fois) écrasait une catégorie portant trois conversions rares — l'anneau
  // répondait alors à « qu'est-ce qui se déclenche le plus », jamais à la
  // question posée par le titre « Tes conversions par catégorie », qui porte
  // sur le NOMBRE DE SORTES de conversions que chaque catégorie regroupe.
  // Exemple : un catalogue de 20 conversions dont 3 catégorisées « Ventes »
  // → « Ventes » vaut 3/20 = 15 %, que l'une des trois pèse 1 déclenchement ou
  // 10 000 ne change rien à ce pourcentage.
  //
  // `evenements.catalogue` N'EST PAS FILTRÉ AUX CONVERSIONS — c'est TOUT ce
  // que la propriété GA4 émet (page_view, session_start, scroll compris). Le
  // compter tel quel sous un titre « Tes conversions » aurait affiché un
  // anneau dominé par du bruit non catégorisable, présenté comme des
  // conversions : exactement le chiffre trompeur que CLAUDE.md §7 interdit.
  //
  // L'UNIVERS DU CAMEMBERT SE LIMITE DONC À DEUX SIGNAUX DE CONVERSION,
  // JAMAIS AU CATALOGUE ENTIER — MÊME DÉFINITION QU'AVANT, SEUL LE COMPTAGE
  // CHANGE :
  //   · un événement CATÉGORISÉ (`ga4_event_categories`) — un humain ou l'IA
  //     a déjà dit « ça compte », quel que soit ce que GA4 en pense ;
  //   · un événement marqué « key event » PAR GA4 LUI-MÊME (`cle === true`,
  //     `properties.keyEvents` — voir `ingestion/ga4/fetch_ga4.py`), même pas
  //     encore catégorisé : c'est le seul signal externe et vérifiable qu'un
  //     événement EST une conversion pour ce compte GA4.
  // Un `page_view` ni catégorisé ni marqué clé n'entre dans aucune des deux
  // colonnes — il n'apparaît donc nulle part dans cet anneau, comme il se doit.
  const parCategorie = new Map<string, number>();
  let nonCategorise = 0;
  for (const e of evenements.catalogue) {
    const c = cat.parEvenement[e.nom];
    if (c) parCategorie.set(c, (parCategorie.get(c) ?? 0) + 1);
    else if (e.cle === true) nonCategorise += 1;
  }
  const rowsCamembert = [
    ...nomsCategories.map((name) => ({ nom: name, spend: parCategorie.get(name) ?? 0 })),
    ...(nonCategorise > 0 ? [{ nom: "Non catégorisé", spend: nonCategorise }] : []),
  ];

  return (
    // Pas de `max-w-*` : voir la note dans `app/page.tsx`.
    <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-9">
      <BandeauCommandes titre="Tes conversions." />

      <div className="mb-6 mt-3">
        <p className="text-[13px] text-muted leading-relaxed max-w-[70ch]">
          Google Analytics compte tout ce que ton site déclenche — une vue produit, un
          formulaire, un achat. Cette page dit à Pulse de quel genre chacun relève (ventes,
          contacts…) — c&apos;est ici que ça se règle.
        </p>
      </div>

      {/* 1 — LE CAMEMBERT, tout en haut : même anneau que la page Coûts,
          réutilisé pour compter des événements plutôt qu'une dépense
          (`uniteValeur="conversions"`). */}
      {rowsCamembert.some((r) => r.spend > 0) ? (
        <div className="mb-5">
          <Anneau
            rows={rowsCamembert}
            titre="Tes conversions par catégorie"
            unite="catégorie"
            uniteValeur="conversions"
            montants
            note="Nombre de conversions différentes par catégorie (pas leur fréquence de déclenchement)."
          />
        </div>
      ) : (
        !evenements.migrationManquante && (
          <div className="bg-white border border-line rounded-2xl shadow-card px-4 sm:px-5 py-4 mb-5">
            <p className="text-[12.5px] text-muted leading-relaxed">
              {evenements.catalogue.length === 0
                ? evenements.ga4Connecte
                  ? "Aucun événement connu — la prochaine récolte ira les chercher."
                  : "Google Analytics n'est pas connecté — va dans Comptes → Connexions."
                : "Aucune conversion pour l'instant : ni événement marqué « clé » par Google Analytics, ni conversion catégorisée à la main. Choisis une catégorie sur une conversion plus bas, dans « Toutes tes conversions », pour voir ce camembert se remplir."}
            </p>
          </div>
        )
      )}

      {/* 2 — TOUTES TES CONVERSIONS : catégoriser n'importe quel événement du
          catalogue GA4. Voir l'en-tête de `conversions-catalogue.tsx`. */}
      <div className="border-t border-line pt-5">
        {/* LE BOUTON « ✨ Classer mes conversions » ÉTAIT ICI. Il est sorti
            avec les trois autres déclencheurs
            (`.scratch/construction/issues/15-le-client-ne-declenche-plus-rien.md`) :
            la catégorisation IA tourne au Jour de travail, dans le même
            passage que la récolte. Ce qui reste est la phrase qu'il portait,
            et la DATE de son prochain passage — sans elle, « plus tard » ne
            répond à personne. */}
        <p className="text-[11.5px] text-faint leading-relaxed max-w-2xl mb-3">
          Chaque événement que Google Analytics connaît sur ton site — assigne-lui une
          catégorie à la main. L&apos;IA en propose une pour tout ce qui n&apos;en a pas
          encore, au prochain passage :{" "}
          <span className="font-semibold text-muted">{quand}</span>. Elle ne touche jamais
          une catégorie que tu as choisie.
        </p>

        {cat.migrationManquante && (
          <p className="text-[12.5px] text-neg leading-relaxed mb-3 max-w-[70ch]">
            Le tableau des catégories n&apos;existe pas encore dans ta base —{" "}
            <span className="font-semibold">aucune conversion ne peut être catégorisée</span>.
            Joue{" "}
            <code className="font-mono text-[11.5px]">saas/data/supabase/migrations/000_run_me_all.sql</code>{" "}
            dans Supabase → SQL editor, puis recharge cette page. Ce fichier est rejouable sans
            risque.
          </p>
        )}

        <ConversionsCatalogueModule
          catalogue={evenements.catalogue}
          categories={nomsCategories}
          parEvenement={cat.parEvenement}
        />
      </div>

      {/* 3 — LES CATÉGORIES : le vocabulaire (créer, renommer, supprimer). */}
      <div className="border-t border-line pt-5">
        <p className="text-[11.5px] text-faint leading-relaxed max-w-2xl mb-3">
          Une catégorie regroupe des conversions de même nature (Ventes, Contacts,
          Engagement…). Crée-la, renomme-la ou supprime-la ici — assigne-la à une conversion
          plus haut, dans « Toutes tes conversions ».
        </p>

        {cat.migrationManquante && (
          <p className="text-[12.5px] text-neg leading-relaxed mb-3 max-w-[70ch]">
            Le tableau des catégories n&apos;existe pas encore dans ta base —{" "}
            <span className="font-semibold">aucune catégorie ne peut être créée</span>. Joue{" "}
            <code className="font-mono text-[11.5px]">saas/data/supabase/migrations/000_run_me_all.sql</code>{" "}
            dans Supabase → SQL editor, puis recharge cette page. Ce fichier est rejouable sans
            risque.
          </p>
        )}

        <CreateCategory />

        {cat.categories.length === 0 ? (
          <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center">
            <p className="text-[14px] text-ink font-medium">Aucune catégorie pour l&apos;instant.</p>
            <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
              Crée la première ci-dessus (ex. « Ventes », « Contacts ») — ou laisse
              l&apos;IA en proposer au prochain passage.
            </p>
          </div>
        ) : (
          <ScrollList title="Tes catégories" count={cat.categories.length} maxH="max-h-[52vh]">
            {cat.categories.map((row) => (
              <CategoryRow key={row.name} row={row} />
            ))}
          </ScrollList>
        )}
      </div>
    </main>
  );
}
