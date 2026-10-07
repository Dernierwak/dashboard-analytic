import type { createClient } from "@/lib/supabase/server";

// PAS DE DIRECTIVE, ET C'EST VOULU. Cette fonction vivait dans
// `app/comptes/actions.ts`, qui porte `"use server"` : tout ce qu'un tel
// fichier exporte devient une action serveur que n'importe quel navigateur peut
// appeler avec les arguments de son choix — un `uid` compris. Elle a deux
// appelants serveur (`connecterMeta`, le retour OAuth Google) et aucun client.

/**
 * Une reconnexion lève l'état « à reconnecter » posé par le worker
 * (`connected_accounts.a_reconnecter_*`, section 4bis de `000_run_me_all.sql`).
 *
 * ÉCRITURE À PART, ET BEST-EFFORT. Glissées dans l'écriture du jeton, ces deux
 * colonnes feraient échouer la reconnexion entière sur une base où la 4bis
 * n'est pas encore jouée — on perdrait le jeton neuf pour une colonne
 * d'affichage. Ici, une colonne absente ne coûte que l'encart, qui n'existe
 * de toute façon pas sans elle.
 */
export async function leverReconnexion(
  supabase: ReturnType<typeof createClient>,
  uid: string,
  provider: "meta" | "google"
): Promise<void> {
  try {
    await supabase
      .from("connected_accounts")
      .update({ a_reconnecter_depuis: null, a_reconnecter_raison: null })
      .eq("user_id", uid)
      .eq("provider", provider);
  } catch {
    // voir ci-dessus
  }
}

