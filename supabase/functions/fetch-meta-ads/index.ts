import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_VERSION = "v24.0";
const FIELDS = "campaign_name,adset_name,ad_name,impressions,clicks,reach,spend,actions,date_start";

async function getAdAccountId(metaToken: string): Promise<string | null> {
  const r = await fetch(
    `https://graph.facebook.com/${API_VERSION}/me/adaccounts?fields=id&access_token=${metaToken}`
  );
  const d = await r.json();
  return d?.data?.[0]?.id ?? null;
}

async function fetchAdsInsights(
  metaToken: string,
  adAccountId: string,
  since: string,
  until: string
): Promise<any[]> {
  const timeRange = JSON.stringify({ since, until });
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${adAccountId}/insights`);
  url.searchParams.set("access_token", metaToken);
  url.searchParams.set("level", "ad");
  url.searchParams.set("fields", FIELDS);
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("time_range", timeRange);

  let rows: any[] = [];
  let nextUrl: string | null = url.toString();

  while (nextUrl) {
    const r = await fetch(nextUrl);
    const d = await r.json();
    if (d.error) {
      console.error(`Meta API error:`, d.error);
      break;
    }
    rows = rows.concat(d.data ?? []);
    nextUrl = d.paging?.next ?? null;
  }
  return rows;
}

function getLatestDate(rows: any[]): string | null {
  if (!rows.length) return null;
  return rows
    .map((r) => r.date_start)
    .filter(Boolean)
    .sort()
    .reverse()[0];
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

  const today = new Date().toISOString().split("T")[0];

  for (const account of accounts) {
    try {
      console.log(`Processing user ${account.user_id}`);

      // Trouver la dernière date en Supabase pour cet user
      const { data: latestRow } = await supabase
        .from("meta_ads_insights")
        .select("date_start")
        .eq("user_id", account.user_id)
        .order("date_start", { ascending: false })
        .limit(1);

      let since: string;
      if (latestRow?.length) {
        const latestDate = new Date(latestRow[0].date_start);
        latestDate.setDate(latestDate.getDate() + 1);
        since = latestDate.toISOString().split("T")[0];
      } else {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        since = oneYearAgo.toISOString().split("T")[0];
      }

      if (since > today) {
        console.log(`User ${account.user_id}: already up to date`);
        continue;
      }

      console.log(`User ${account.user_id}: fetching from ${since} to ${today}`);

      const adAccountId = await getAdAccountId(account.meta_token);
      if (!adAccountId) {
        console.error(`No ad account found for user ${account.user_id}`);
        continue;
      }

      const rows = await fetchAdsInsights(account.meta_token, adAccountId, since, today);
      console.log(`Got ${rows.length} rows for user ${account.user_id}`);

      if (!rows.length) continue;

      // Dédupliquer et construire les records
      const seen = new Set<string>();
      const records = [];
      for (const row of rows) {
        const key = `${row.date_start}__${row.ad_name}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const linkClick = (row.actions ?? []).find(
          (a: any) => a.action_type === "link_click"
        );
        records.push({
          user_id: account.user_id,
          date_start: row.date_start,
          campaign_name: row.campaign_name ?? "",
          adset_name: row.adset_name ?? "",
          ad_name: row.ad_name ?? "",
          impressions: parseInt(row.impressions ?? "0"),
          clicks: parseInt(row.clicks ?? "0"),
          reach: row.reach ? parseInt(row.reach) : null,
          link_clicks: linkClick ? parseInt(linkClick.value) : 0,
          spend: parseFloat(row.spend ?? "0"),
        });
      }

      const { error } = await supabase
        .from("meta_ads_insights")
        .upsert(records, { onConflict: "user_id,date_start,ad_name" });

      if (error) console.error(`Upsert error for user ${account.user_id}:`, error);
      else console.log(`Upserted ${records.length} records for user ${account.user_id}`);

    } catch (e) {
      console.error(`Error for user ${account.user_id}:`, e);
    }
  }

  return new Response("done", { status: 200 });
});
