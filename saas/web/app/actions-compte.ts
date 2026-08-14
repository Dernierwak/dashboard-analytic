"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";

// Les écritures qui touchent le PROFIL, par opposition à `comptes/actions.ts`
// qui ne touche que `connected_accounts`. Un seul réglage pour l'instant : le
// jour de récolte.
//
// Un fichier « use server » ne peut exporter que des fonctions asynchrones —
// la liste des sept jours vit donc dans `components/jour-recolte.tsx`, et
// celle-ci en garde sa propre copie de contrôle. Ce n'est pas une duplication
// décorative : c'est la seule qui fasse foi, parce qu'un client peut envoyer
// n'importe quelle chaîne.
const JOURS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export type ReponseJour = { ok: boolean; message?: string };

/**
 * Enregistre le jour où le worker doit récolter ce compte
 * (`profiles.fetch_schedule`, lu par `_due_today` dans le worker, qui compare
 * au jour courant en anglais).
 *
 * Le jour se règle sur SON compte, jamais sur celui de quelqu'un d'autre :
 * changer la fréquence de récolte d'un compte qu'on visite reviendrait à agir
 * sur la facture de son propriétaire. La base refuserait de toute façon —
 * l'interface tient la même ligne, pour que le refus soit une phrase et pas
 * une erreur.
 */
export async function choisirJourRecolte(jour: string): Promise<ReponseJour> {
  if (!JOURS.includes(jour)) {
    return { ok: false, message: "Ce jour n'existe pas." };
  }

  const compte = await getCompteActif();
  if (compte.uid !== compte.moi) {
    return {
      ok: false,
      message:
        "Tu regardes le dashboard de quelqu'un d'autre. Le jour de récolte se " +
        "règle depuis son propre compte.",
    };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ fetch_schedule: jour })
    .eq("id", compte.moi);

  if (error) return { ok: false, message: `L'enregistrement a échoué : ${error.message}` };

  revalidatePath("/comptes");
  return { ok: true };
}
