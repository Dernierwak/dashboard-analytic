// LA PAGE CONVERSIONS.
//
// Avant cette page, la sélection et la catégorisation des conversions GA4
// vivaient éclatées à deux endroits : un module « objectif + conversions »
// pour les seuls thèmes étoilés, et un module « conversions » pour tous les
// thèmes, tous deux sur /labels — page qui ne devait porter QUE le vocabulaire
// des thèmes (créer, renommer, étoiler). Cette page réunit tout ce qui
// concerne les CONVERSIONS elles-mêmes : quels événements GA4 comptent pour
// quels thèmes, et de quel GENRE de conversion il s'agit.
//
//   1. LE CAMEMBERT — combien de conversions par catégorie, tout le compte
//      confondu (indépendant des thèmes : une catégorie est une propriété de
//      l'événement, pas du couple thème/événement — voir l'en-tête de
//      `conversion_categories.sql`). LIMITÉ AUX VRAIES CONVERSIONS (catégorisées
//      ou marquées « clé » par GA4) — jamais tout le catalogue, qui contient
//      aussi le bruit (page_view, scroll…) qu'aucun compte n'appelle une
//      conversion.
//   2. NOS THÈMES PRINCIPAUX — pour chaque thème prioritaire : son objectif
//      propre, et quels événements GA4 il suit comme conversions.
//   3. LES CATÉGORIES — créer, renommer, supprimer, classer via l'IA.
//
// LA PAGE COMPOSE, ELLE NE DESSINE PAS — même règle que /labels : tout ce qui
// a une forme vit dans `components/*.tsx`.
import { getThemeEvenements, getThemeObjectifs, getConversionCategories } from "@/lib/channels";
import { ThemeDonut } from "@/components/theme-donut";
import { ConversionsThemesModule } from "@/components/conversions-themes";
import { CreateCategory, CategoryRow } from "@/components/category-manager";
import { ClassifyConversionsButton } from "@/components/classify-conversions-button";
import { ScrollList } from "@/components/scroll-list";

export const dynamic = "force-dynamic";

export default async function ConversionsPage() {
  const evenements = await getThemeEvenements();
  // Dépend d'`evenements` (même raison que sur /labels) : posé après, pas
  // dans le même Promise.all.
  const [objectifs, cat] = await Promise.all([
    getThemeObjectifs(evenements),
    getConversionCategories(),
  ]);

  const nomsCategories = cat.categories.map((c) => c.name);

  // Le camembert compte le VOLUME (nombre d'événements mesurés sur la fenêtre
  // GA4) de chaque événement, groupé par catégorie — pas la sélection des
  // thèmes : c'est l'état du catalogue, pas ce que module 2 en a déjà fait
  // suivre à un thème.
  //
  // `evenements.catalogue` N'EST PAS FILTRÉ AUX CONVERSIONS — c'est TOUT ce
  // que la propriété GA4 émet (page_view, session_start, scroll compris). Le
  // sommer tel quel sous un titre « Tes conversions » aurait affiché un
  // anneau dominé à ~99 % par du bruit non catégorisable, présenté comme des
  // conversions : exactement le chiffre trompeur que CLAUDE.md §7 interdit.
  //
  // L'UNIVERS DU CAMEMBERT SE LIMITE DONC À DEUX SIGNAUX DE CONVERSION,
  // JAMAIS AU CATALOGUE ENTIER :
  //   · un événement CATÉGORISÉ (`ga4_event_categories`) — un humain ou l'IA
  //     a déjà dit « ça compte », quel que soit ce que GA4 en pense ;
  //   · un événement marqué « key event » PAR GA4 LUI-MÊME (`cle === true`,
  //     `properties.keyEvents` — voir `google_script/fetch_ga4.py`), même pas
  //     encore catégorisé : c'est le seul signal externe et vérifiable qu'un
  //     événement EST une conversion pour ce compte GA4.
  // Un `page_view` ni catégorisé ni marqué clé n'entre dans aucune des deux
  // colonnes — il n'apparaît donc nulle part dans cet anneau, comme il se doit.
  const parCategorie = new Map<string, number>();
  let nonCategorise = 0;
  for (const e of evenements.catalogue) {
    const c = cat.parEvenement[e.nom];
    if (c) parCategorie.set(c, (parCategorie.get(c) ?? 0) + e.volume);
    else if (e.cle === true) nonCategorise += e.volume;
  }
  const rowsCamembert = [
    ...nomsCategories.map((name) => ({ label: name, spend: parCategorie.get(name) ?? 0 })),
    ...(nonCategorise > 0 ? [{ label: "Non catégorisé", spend: nonCategorise }] : []),
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-9">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          Ce que Google Analytics compte pour toi
        </p>
        <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
          Tes conversions.
        </h1>
        <p className="text-[13px] text-muted mt-2 leading-relaxed max-w-[70ch]">
          Google Analytics compte tout ce que ton site déclenche — une vue produit, un
          formulaire, un achat. Cette page dit à Pulse lesquels comptent vraiment pour toi : pour
          chaque thème prioritaire, quels événements GA4 suivre comme conversions, et de quel
          genre elles sont (ventes, contacts…). Le rapport hebdomadaire montre juste le résultat
          — c&apos;est ici que ça se règle.
        </p>
      </div>

      {/* 1 — LE CAMEMBERT, tout en haut : même composant que les autres
          répartitions de l'app (`ThemeDonut`), réutilisé pour compter des
          événements plutôt qu'une dépense (`uniteValeur="conversions"`). */}
      {rowsCamembert.some((r) => r.spend > 0) ? (
        <div className="mb-5">
          <ThemeDonut
            rows={rowsCamembert}
            titre="Tes conversions par catégorie"
            unite="catégorie"
            uniteValeur="conversions"
            montants
            note="Volume mesuré par Google Analytics sur la fenêtre récoltée, groupé par catégorie — indépendant de ce qu'un thème suit ou non."
          />
        </div>
      ) : (
        !evenements.migrationManquante && (
          <div className="bg-white border border-line rounded-2xl shadow-card px-4 sm:px-5 py-4 mb-5">
            <p className="text-[12.5px] text-muted leading-relaxed">
              {evenements.catalogue.length === 0
                ? evenements.ga4Connecte
                  ? "Aucun événement connu — lance ↻ Rafraîchir maintenant dans la barre latérale."
                  : "Google Analytics n'est pas connecté — va dans Comptes → Connexions."
                : "Aucune conversion pour l'instant : ni événement marqué « clé » par Google Analytics, ni conversion catégorisée à la main. Choisis une catégorie sur une conversion plus bas pour voir ce camembert se remplir."}
            </p>
          </div>
        )
      )}

      {/* 2 — NOS THÈMES PRINCIPAUX. */}
      <ConversionsThemesModule d={objectifs} categories={nomsCategories} parEvenement={cat.parEvenement} />

      {/* 3 — LES CATÉGORIES. */}
      <div className="border-t border-line pt-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <p className="text-[11.5px] text-faint leading-relaxed max-w-2xl">
            Une catégorie regroupe des conversions de même nature (Ventes, Contacts,
            Engagement…). Crée-les à la main, ou laisse l&apos;IA proposer une catégorie pour
            chaque conversion qui n&apos;en a pas encore.
          </p>
          <ClassifyConversionsButton />
        </div>

        {cat.migrationManquante && (
          <p className="text-[12.5px] text-neg leading-relaxed mb-3 max-w-[70ch]">
            Le tableau des catégories n&apos;existe pas encore dans ta base —{" "}
            <span className="font-semibold">aucune catégorie ne peut être créée</span>. Joue{" "}
            <code className="font-mono text-[11.5px]">supabase/migrations/000_run_me_all.sql</code>{" "}
            dans Supabase → SQL editor, puis recharge cette page. Ce fichier est rejouable sans
            risque.
          </p>
        )}

        <CreateCategory />

        {cat.categories.length === 0 ? (
          <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center">
            <p className="text-[14px] text-ink font-medium">Aucune catégorie pour l&apos;instant.</p>
            <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
              Crée la première ci-dessus (ex. « Ventes », « Contacts »), ou laisse l&apos;IA les
              proposer avec le bouton ci-dessus.
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
