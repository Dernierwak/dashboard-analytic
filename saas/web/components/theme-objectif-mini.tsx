import Link from "next/link";

// LE MINI-MODULE OBJECTIF + CONVERSIONS, PAR CARTE DE THÈME.
//
// REMPLACE `objectif-theme.tsx` (la carte globale, unique, posée au-dessus du
// carrousel) — retirée du rapport. Cette carte globale montrait deux choses
// mélangées : l'objectif du COMPTE (éditable — `<ObjectifSelect>`) et un
// résumé des thèmes prioritaires. Les deux posent problème une fois que
// `/conversions` existe : l'objectif du compte s'y règle maintenant (module
// dédié), et un résumé global ne dit RIEN du thème qu'on est en train de
// lire — il fallait déjà remonter les yeux pour vérifier lequel a un
// « objectif propre » avant de comprendre une carte donnée.
//
// UNE INSTANCE PAR CARTE, DONC PAS UN DOUBLON DE MODULE : chaque
// `<ThemeObjectifMini>` affiche les données d'UN thème différent — c'est
// l'inverse du problème que `app/page.tsx:550/581` évite (le même contenu
// rendu deux fois). Posée ENTRE le bilan chiffré (« Ce bilan couvre tout… »)
// et la courbe : c'est l'endroit exact où on vient de lire CE QUE ce thème a
// rapporté, juste avant de voir COMMENT ça évolue — la place naturelle pour
// dire SUR QUOI il est jugé.
//
// STRICTEMENT EN LECTURE : aucun sélecteur, aucune action, un seul lien vers
// `/conversions` pour changer quoi que ce soit — même règle que la carte
// qu'elle remplace, mais sans l'erreur de la passe précédente qui laissait
// `<ObjectifSelect>` éditable dans le rapport.

const OBJ_MOT: Record<string, string> = {
  ventes: "Plus de ventes",
  notoriete: "Être plus connu",
  engagement: "Une communauté qui réagit",
};

export function ThemeObjectifMini({
  objectifEffectif,
  objectifPropre,
  conversions,
}: {
  /** L'objectif EFFECTIF de CE thème — le sien s'il en a un, sinon celui du compte. */
  objectifEffectif: string | null;
  /** Ce thème a-t-il un réglage propre (vs hérité du compte) ? */
  objectifPropre: boolean;
  /** Les événements GA4 que ce thème suit comme conversions — vide = aucun. */
  conversions: string[];
}) {
  const mot = objectifEffectif ? OBJ_MOT[objectifEffectif] ?? "à définir" : "à définir";

  return (
    <div className="px-5 py-2.5 border-b border-line bg-black/[0.015] flex items-center gap-2 flex-wrap text-[11.5px]">
      <span className="text-faint">Objectif :</span>
      <span className="font-semibold text-ink">{mot}</span>
      <span className="text-faint">{objectifPropre ? "(objectif propre)" : "(hérite du compte)"}</span>
      <span className="text-line">·</span>
      <span className="text-faint">Conversions :</span>
      {conversions.length > 0 ? (
        <span className="font-mono text-ink truncate max-w-[40ch]">{conversions.join(", ")}</span>
      ) : (
        <span className="text-faint">aucune sélectionnée</span>
      )}
      <Link href="/conversions" className="ml-auto font-semibold text-brand hover:underline shrink-0">
        ◈ Conversions →
      </Link>
    </div>
  );
}
