import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_VERSION = "v24.0";

async function getBusinessId(metaToken: string): Promise<string | null> {
  const r1 = await fetch(`https://graph.facebook.com/${API_VERSION}/me/accounts?access_token=${metaToken}`);
  const d1 = await r1.json();
  const pageId = d1?.data?.[0]?.id;
  if (!pageId) return null;

  const r2 = await fetch(`https://graph.facebook.com/${API_VERSION}/${pageId}?fields=instagram_business_account&access_token=${metaToken}`);
  const d2 = await r2.json();
  return d2?.instagram_business_account?.id ?? null;
}

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

  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("user_id, meta_token");

  console.log(`Found ${accounts?.length ?? 0} connected accounts`);
  if (!accounts?.length) return new Response("no accounts", { status: 200 });

  for (const account of accounts) {
    try {
      console.log(`Processing user ${account.user_id}`);
      const businessId = await getBusinessId(account.meta_token);
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
