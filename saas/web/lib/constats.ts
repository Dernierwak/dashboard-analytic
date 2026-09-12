import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import type { VisionConstat } from "@/lib/report";

// ── CE QUI MARCHE POUR TOI — LA LECTURE, ET RIEN D'AUTRE ─────────────────────
//
// Les constats sont calculés une fois par semaine par `saas/recos_ia/insights.py`
// sur TOUT l'historique, et publiés dans `weekly_reports.payload.vision`. Ce
// module les lit. Il ne calcule rien, et c'est tout l'objet du ticket 09 : la
// même question se calculait ici, en TypeScript, sur la fenêtre affichée, avec
// d'autres seuils que le Python — deux réponses possibles au même « quel format
// marche chez toi », sur deux écrans du même produit.
//
// POURQUOI PAS `getWeeklyData` : elle lit dix tables pour bâtir le rapport
// hebdomadaire entier. Une page de plateforme n'a besoin que du bloc `vision`
// et des verdicts du client — deux lectures. `cache` les rend uniques par
// requête, comme `getCompteActif`.
//
// LE VERDICT SE LIT EN DIRECT, PAS DANS LE PAYLOAD. Le payload porte le statut
// du jour où le rapport a été publié ; un « ✗ pas d'accord » posé mardi doit
// être visible mardi, pas au prochain rapport. La table `insight_feedback` fait
// foi, le payload sert de repli quand elle ne répond pas (migration absente).

// LES PAYLOADS DÉJÀ PUBLIÉS N'ONT PAS DE `platform` — elle n'existe que depuis
// le 2026-09-12, et un rapport ne se régénère qu'à la demande. Sans repli, un
// constat d'avant se lirait « partout », donc le créneau Instagram apparaîtrait
// sous les campagnes Google : un chiffre juste au mauvais endroit, ce qui se lit
// comme un chiffre faux.
//
// Le repli se déduit du GENRE, qui lui n'a jamais changé, et il ne devine que ce
// qui est certain : un format et un créneau n'existent que sur Instagram, un
// coût par conversion est de la publicité. `campagne_locomotive` n'y est PAS —
// sa régie est justement ce que l'ancien payload ne dit pas, et « pub » la ferait
// apparaître sur les deux pages, dont une où cette campagne n'existe pas. Sans
// plateforme, elle se lit comme un constat de compte : moins précis, jamais faux.
const PLATEFORME_PAR_GENRE: Record<string, string> = {
  format_best: "instagram",
  slot_best: "instagram",
  cout_conversion: "pub",
};

export type ConstatAffiche = VisionConstat & {
  /** Le verdict LIVE du client. `null` = il ne s'est pas encore prononcé. */
  verdict: "agree" | "reject" | null;
};

export type VisionLue = {
  constats: ConstatAffiche[];
  /** « depuis le 1 jan » — la profondeur sur laquelle ces constats sont tirés.
   *  Vide quand le payload ne la porte pas ; jamais inventée. */
  periodLabel: string;
  /** Vrai quand un rapport existe mais ne porte aucun constat — un compte sans
   *  assez d'historique. Le distinguer de « aucun rapport » évite de promettre
   *  au client que quelque chose arrive quand rien n'arrivera. */
  rapportPublie: boolean;
};

export const getVision = cache(async function getVision(): Promise<VisionLue> {
  const supabase = createClient();
  const compte = await getCompteActif();

  const [reportRes, verdictRes] = await Promise.all([
    supabase
      .from("weekly_reports")
      .select("payload")
      .eq("user_id", compte.uid)
      .order("week_start", { ascending: false })
      .limit(1),
    supabase
      .from("insight_feedback")
      .select("insight_key, verdict")
      .eq("user_id", compte.uid),
  ]);

  const payload = reportRes.data?.[0]?.payload as
    | { vision?: { period_label?: string; constats?: VisionConstat[] } | null }
    | undefined;
  const vision = payload?.vision ?? null;

  // `insight_feedback` PORTE DEUX CHOSES SOUS LE MÊME VERDICT. Les thèmes
  // prioritaires y vivent aussi, sous la clé `priority_label:<nom>` et avec
  // « agree » comme valeur (`togglePriorityLabel`, `build_report.py` l. 906) :
  // une étoile n'est pas un avis sur un constat. Les clés de constat ne
  // commencent jamais par ce préfixe, mais les ranger ici ferait d'une étoile
  // un verdict le jour où un genre de constat s'en approcherait.
  const verdicts = new Map<string, "agree" | "reject">();
  for (const row of verdictRes.data ?? []) {
    const cle = String(row.insight_key ?? "");
    if (cle.startsWith("priority_label:")) continue;
    if (row.verdict === "agree" || row.verdict === "reject")
      verdicts.set(cle, row.verdict);
  }

  // LE REPLI SE DÉCIDE SUR LA PANNE, PAS SUR L'ABSENCE — et la nuance est tout
  // ce qui permet de RETIRER un verdict. `saveInsightFeedback` supprime la ligne
  // quand on re-clique le même bouton ; si l'absence de ligne faisait retomber
  // sur le statut du payload, un « ✗ pas d'accord » figé dans un rapport déjà
  // publié se réafficherait aussitôt, le bouton resterait allumé, et les clics
  // suivants ne feraient que re-supprimer une ligne déjà absente. Le client ne
  // pourrait plus se déjuger avant le rapport suivant. Le payload ne sert donc
  // de repli que quand la table N'A PAS RÉPONDU (migration absente) : là, aucune
  // ligne n'est lisible et son statut est la seule chose qu'on ait.
  const tableLisible = !verdictRes.error;
  const constats = (vision?.constats ?? []).map((c) => ({
    ...c,
    platform: c.platform ?? PLATEFORME_PAR_GENRE[c.kind] ?? null,
    verdict: tableLisible
      ? verdicts.get(c.key) ?? null
      : c.status === "new"
        ? null
        : c.status,
  })) as ConstatAffiche[];

  return {
    constats,
    periodLabel: vision?.period_label ?? "",
    rapportPublie: Boolean(reportRes.data?.length),
  };
});

// Quels constats concluent quelle page — le rang 4 du gabarit de plateforme
// (`.scratch/refonte/issues/07-gabarit-de-plateforme.md`).
//
// Un constat SANS plateforme parle d'un THÈME : il conclut partout, parce qu'un
// thème traverse les régies et l'organique — c'est très exactement ce
// qu'aucune régie ne sait dire, et donc ce que le rang 4 doit porter.
// « pub » désigne les deux régies à la fois.
//
// L'ANGLE MORT DE COUVERTURE NE CONCLUT AUCUNE PLATEFORME. Il dit ce qui n'est
// pas encore classé et renvoie à la page Thèmes : sa place est là où on le
// répare, pas sous les chiffres d'une régie.
export function constatsDeLaPage(
  constats: ConstatAffiche[],
  page: "meta" | "google" | "instagram" | "themes"
): ConstatAffiche[] {
  if (page === "themes") return constats;
  return constats.filter((c) => {
    if (c.kind === "angle_mort") return false;
    const p = c.platform ?? null;
    if (p === null) return true;
    if (p === "pub") return page === "meta" || page === "google";
    return p === page;
  });
}
