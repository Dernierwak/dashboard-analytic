import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_VERSION = "v24.0";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function getBusinessId(metaToken: string): Promise<{ pageId: string; businessId: string; accountName: string } | null> {
  const r1 = await fetch(`https://graph.facebook.com/${API_VERSION}/me/accounts?access_token=${metaToken}`);
  const d1 = await r1.json();
  const page = d1?.data?.[0];
  if (!page) return null;

  const r2 = await fetch(`https://graph.facebook.com/${API_VERSION}/${page.id}?fields=instagram_business_account&access_token=${metaToken}`);
  const d2 = await r2.json();
  const businessId = d2?.instagram_business_account?.id;
  if (!businessId) return null;

  return { pageId: page.id, businessId, accountName: page.name };
}

async function getPostIds(metaToken: string, businessId: string, limit: number): Promise<string[]> {
  const r = await fetch(`https://graph.facebook.com/${API_VERSION}/${businessId}/media?fields=id,timestamp&access_token=${metaToken}`);
  const d = await r.json();
  const posts: { id: string; timestamp: string }[] = d?.data ?? [];
  return posts
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit)
    .map((p) => p.id);
}

async function getPostInfo(metaToken: string, postId: string): Promise<Record<string, string>> {
  const r = await fetch(`https://graph.facebook.com/${API_VERSION}/${postId}?fields=caption,media_type,media_url,thumbnail_url,timestamp&access_token=${metaToken}`);
  return await r.json();
}

async function getPostMetrics(metaToken: string, postId: string, mediaType: string): Promise<Record<string, number>> {
  const metricList = mediaType === "VIDEO" || mediaType === "REEL"
    ? "reach,saved,comments,views"
    : "likes,comments,saved,reach,views";

  const r = await fetch(`https://graph.facebook.com/${API_VERSION}/${postId}/insights?metric=${metricList}&access_token=${metaToken}`);
  const d = await r.json();
  const metrics: Record<string, number> = {};
  for (const item of d?.data ?? []) {
    metrics[item.name] = item.value ?? item.values?.[0]?.value ?? 0;
  }

  // follows séparé
  try {
    const r2 = await fetch(`https://graph.facebook.com/${API_VERSION}/${postId}/insights?metric=follows&access_token=${metaToken}`);
    const d2 = await r2.json();
    metrics["follows"] = d2?.data?.[0]?.value ?? d2?.data?.[0]?.values?.[0]?.value ?? 0;
  } catch {
    metrics["follows"] = 0;
  }

  return metrics;
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const today = DAYS[new Date().getDay()];
  console.log(`Running fetch for day: ${today}`);

  // Récupérer les users dont le fetch_schedule correspond à aujourd'hui
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, is_paid, fetch_schedule")
    .eq("fetch_schedule", today);

  console.log(`Found ${profiles?.length ?? 0} users to fetch`);
  if (!profiles?.length) return new Response("no users scheduled today", { status: 200 });

  for (const profile of profiles) {
    try {
      // Récupérer le token depuis connected_accounts
      const { data: accounts } = await supabase
        .from("connected_accounts")
        .select("meta_token")
        .eq("user_id", profile.id)
        .limit(1);

      const metaToken = accounts?.[0]?.meta_token;
      if (!metaToken) { console.log(`No token for user ${profile.id}`); continue; }

      const ids = await getBusinessId(metaToken);
      if (!ids) { console.log(`No business ID for user ${profile.id}`); continue; }

      const limit = profile.is_paid ? 50 : 10;
      const allPostIds = await getPostIds(metaToken, ids.businessId, limit);

      // Posts déjà en base
      const { data: existing } = await supabase
        .from("instagram_organic_posts")
        .select("post_id")
        .eq("user_id", profile.id);
      const existingIds = new Set((existing ?? []).map((r: { post_id: string }) => r.post_id));
      const alwaysRefresh = new Set(allPostIds.slice(0, 5));
      const toFetch = allPostIds.filter((id) => !existingIds.has(id) || alwaysRefresh.has(id));

      console.log(`User ${profile.id}: ${toFetch.length} posts to fetch`);

      for (const postId of toFetch) {
        const info = await getPostInfo(metaToken, postId);
        const mediaType = info.media_type ?? "IMAGE";
        const metrics = await getPostMetrics(metaToken, postId, mediaType);

        await supabase.from("instagram_organic_posts").upsert({
          post_id: postId,
          user_id: profile.id,
          type: mediaType,
          caption: (info.caption ?? "").slice(0, 80),
          date: (info.timestamp ?? "").slice(0, 10),
          media_url: info.thumbnail_url ?? info.media_url ?? "",
          likes: metrics.likes ?? 0,
          comments: metrics.comments ?? 0,
          saved: metrics.saved ?? 0,
          reach: metrics.reach ?? 0,
          views: metrics.views ?? 0,
          follows: metrics.follows ?? 0,
        }, { onConflict: "post_id" });
      }

      console.log(`Done for user ${profile.id}`);
    } catch (e) {
      console.error(`Error for user ${profile.id}:`, e);
    }
  }

  return new Response("done", { status: 200 });
});
