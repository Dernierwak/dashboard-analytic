import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { JOUR_DEFAUT, enFrancais, prochainPassage } from "@/lib/jour-de-travail";

// ── LE PROCHAIN JOUR DE TRAVAIL, POUR LES PAGES QUI NE LISENT PAS LE RAPPORT ──
//
// `lib/report.ts` rapporte déjà `fetch_schedule` avec le reste du payload, et
// les trois dates en tête du rapport s'en servent. Mais /labels, /conversions
// et les autres écrans de réglage ne lisent pas `weekly_reports` : ils ont
// besoin de la même date sans le rapport qui va avec.
//
// POURQUOI CETTE DATE EST DEVENUE NÉCESSAIRE PARTOUT. Le client ne déclenche
// plus rien ; trois réglages s'enregistrent tout de suite mais ne changent le
// rapport qu'au Jour de travail — les priorités de thèmes, l'objectif du
// compte, les catégories de conversions. « Le geste s'enregistre tout de suite,
// mais son effet est daté : un message dit qu'il sera pris en compte le
// <jour> » (`.scratch/refonte/issues/13-entre-deux-jours-de-travail.md` §2).
// Sans la date, le message serait « plus tard », ce qui ne répond à personne.
//
// LE COMPTE REGARDÉ, PAS LE MIEN. Un Membre invité lit les dates du compte dont
// il voit les chiffres — même règle que les trois dates du rapport. C'est
// `compte.uid`, jamais `compte.moi`.
//
// UNE LECTURE RATÉE NE MENT PAS : on retombe sur le défaut du worker lui-même
// (`_due_today` lit `fetch_schedule or "Monday"`), pas sur une invention.

/** Le Jour de travail du compte regardé, en anglais comme en base. */
export const jourDeTravailDuCompte = cache(async (): Promise<string> => {
  try {
    const compte = await getCompteActif();
    const r = await createClient()
      .from("profiles")
      .select("fetch_schedule")
      .eq("id", compte.uid)
      .limit(1);
    return (r.data?.[0]?.fetch_schedule as string | null) || JOUR_DEFAUT;
  } catch {
    return JOUR_DEFAUT;
  }
});

/**
 * « jeudi 17 septembre » — le prochain passage du worker pour ce compte, écrit
 * pour être lu. Calculé sur le serveur et passé en prop : un composant client
 * qui le recalculerait lirait l'horloge du navigateur, et deux rendus
 * différents pour la même date sont une erreur d'hydratation.
 */
export async function prochainJourDeTravailFr(): Promise<string> {
  const jour = await jourDeTravailDuCompte();
  return enFrancais(prochainPassage(jour, new Date()).date);
}
