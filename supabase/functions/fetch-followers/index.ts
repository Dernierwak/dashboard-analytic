import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_VERSION = "v24.0";

async function getFollowers(metaToken: string, businessId: string): Promise<number> {
  const r = await fetch(`https://graph.facebook.com/${API_VERSION}/${businessId}?fields=followers_count&access_token=${metaToken}`);
  const d = await r.json();
  return d?.followers_count ?? 0;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // .not(meta_token, null) : ignore la ligne provider='google' (meta_token NULL)
  // ajoutée par la consolidation des tokens.
  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("user_id, meta_token, instagram_business_id")
    .not("meta_token", "is", null);

  console.log(`Found ${accounts?.length ?? 0} connected accounts`);
  if (!accounts?.length) return new Response("no accounts", { status: 200 });

  for (const account of accounts) {
    try {
      console.log(`Processing user ${account.user_id}`);
      // L'ID business se lit dans connected_accounts, JAMAIS re-dérivé via
      // /me/accounts : ce point d'entrée rend TOUTES les Pages Facebook liées
      // au token, dans un ordre qui n'a rien à voir avec la Page réellement
      // connectée à Instagram — prendre `data[0]` casse dès qu'une deuxième
      // Page (test, doublon…) apparaît devant la bonne dans cette liste.
      // Mesuré en conditions réelles (2026-08-25) sur un compte agence : deux
      // Pages liées au même token, la première sans compte Instagram associé
      // — `getBusinessId` rendait `null` à chaque passage depuis l'apparition
      // de cette deuxième Page, et `followers_history` s'était arrêté net ce
      // jour-là, sans qu'aucune erreur ne remonte nulle part. La récolte des
      // posts (`saas/worker/fetch_all.py` → `_fetch_instagram`) n'a jamais eu
      // ce problème : elle lit déjà `instagram_business_id` en base, jamais
      // via `/me/accounts`.
      const businessId = account.instagram_business_id;
      console.log(`Business ID: ${businessId}`);
      if (!businessId) continue;
      const followers = await getFollowers(account.meta_token, businessId);
      console.log(`Followers: ${followers}`);
      const { error } = await supabase.from("followers_history").insert({
        user_id: account.user_id,
        followers,
        fetched_at: new Date().toISOString(),
      });
      if (error) console.error(`Insert error:`, error);
    } catch (e) {
      console.error(`Error for user ${account.user_id}:`, e);
    }
  }

  return new Response("done", { status: 200 });
});
