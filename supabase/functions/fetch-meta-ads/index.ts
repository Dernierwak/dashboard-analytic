import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── TASK-018 — pourquoi ad_id, et pourquoi le DELETE avant l'upsert ─────────
//
// STATUT DE CETTE FONCTION AU MOMENT DE CE CORRECTIF : aucune trace, dans ce
// dépôt, d'un déclencheur qui l'appelle — ni cron pg_cron (aucune migration
// n'en pose), ni step `supabase functions deploy` dans un workflow GitHub, ni
// aucune référence ailleurs dans le code ou la doc. Son dernier commit
// (6722f2f, 15/07/2026) précède immédiatement celui qui a introduit le worker
// Python (`saas/worker/fetch_all.py` + `.github/workflows/weekly-fetch.yml`,
// même journée) — tout indique qu'elle a été remplacée par ce worker et
// jamais retouchée depuis. Mais un Cron Job Supabase se configure depuis le
// dashboard, hors de ce dépôt : on ne peut pas l'exclure avec certitude
// depuis le code seul. Elle est donc mise à jour PAR PRÉCAUTION plutôt que
// supprimée — si elle est bien morte, ce correctif est inerte ; si elle est
// encore invoquée quelque part, il évite l'échec silencieux (`42P10 — no
// unique or exclusion constraint matching ON CONFLICT`) qu'elle aurait sinon
// subi dès que `meta_ads_insights_uq` (basée sur ad_name) est droppée par la
// migration `meta_ads_ad_id.sql`. À CONFIRMER : vérifier dans le dashboard
// Supabase (Database → Cron Jobs, et Edge Functions → Logs d'invocation) si
// cette fonction tourne réellement ; si non, elle peut être supprimée.
//
// Le reste du fichier reprend, en TypeScript, exactement la même logique que
// `scripts/insert_data.upsert_meta_ads` (Python) — même clé, même DELETE, même
// garde-fou. Les deux DOIVENT rester synchronisés : une divergence future
// entre les deux écrivains de `meta_ads_insights` reproduirait ce bug.

const API_VERSION = "v24.0";
// `ad_id` — l'identifiant Meta VRAIMENT unique d'une annonce. `ad_name` ne
// l'est pas : deux annonces distinctes peuvent porter le même nom dans une
// même campagne (voir scripts/insert_data.upsert_meta_ads pour le détail).
const FIELDS = "campaign_name,adset_name,ad_name,ad_id,impressions,clicks,reach,spend,actions,date_start";

async function getAdAccountId(metaToken: string): Promise<string | null> {
  const r = await fetch(
    `https://graph.facebook.com/${API_VERSION}/me/adaccounts?fields=id&access_token=${metaToken}`
  );
  const d = await r.json();
  return d?.data?.[0]?.id ?? null;
}

// Retourne { rows, complete } — `complete=false` signale une pagination
// interrompue avant la fin (erreur réseau, ou Meta qui répond un JSON
// d'erreur au lieu d'une page — dans ce dernier cas `d.data` est absent et
// `d.paging.next` aussi, ce qui ressemblerait sinon à une fin de pagination
// NORMALE). Miroir exact de `_meta_chunk` (saas/worker/fetch_all.py) : c'est
// ce booléen qui décide plus bas si le DELETE de nettoyage peut avoir lieu
// sans risque de supprimer des lignes qu'on n'a pas fini de réinsérer.
async function fetchAdsInsights(
  metaToken: string,
  adAccountId: string,
  since: string,
  until: string
): Promise<{ rows: any[]; complete: boolean }> {
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
    let d: any;
    try {
      const r = await fetch(nextUrl);
      d = await r.json();
    } catch (e) {
      console.error(`Meta API network error:`, e);
      return { rows, complete: false };
    }
    if (d.error) {
      console.error(`Meta API error:`, d.error);
      return { rows, complete: false };
    }
    rows = rows.concat(d.data ?? []);
    nextUrl = d.paging?.next ?? null;
  }
  return { rows, complete: true };
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

  // .not(meta_token, null) : ignore la ligne provider='google' (meta_token NULL)
  // ajoutée par la consolidation des tokens.
  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("user_id, meta_token")
    .not("meta_token", "is", null);

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

      const { rows, complete } = await fetchAdsInsights(account.meta_token, adAccountId, since, today);
      console.log(`Got ${rows.length} rows for user ${account.user_id}${complete ? "" : " (TRONQUÉ)"}`);

      if (!rows.length) continue;

      // Dédupliquer et construire les records — sur ad_id, PAS ad_name (voir
      // le bloc de commentaires TASK-018 en tête de fichier et
      // scripts/insert_data.upsert_meta_ads, la source de vérité Python).
      const seen = new Set<string>();
      const records: any[] = [];
      let orphelins = 0;
      for (const row of rows) {
        const brut = row.ad_id;
        const adId = brut === null || brut === undefined || brut === "" ? "" : String(brut).trim();

        const linkClick = (row.actions ?? []).find(
          (a: any) => a.action_type === "link_click"
        );
        const base = {
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
        };

        if (!adId) {
          // Pas de clé fiable pour dédupliquer : on GARDE la ligne quand
          // même (jamais de perte silencieuse), ad_id reste null.
          orphelins++;
          records.push({ ...base, ad_id: null });
          continue;
        }

        const key = `${row.date_start}__${adId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        records.push({ ...base, ad_id: adId });
      }

      if (orphelins) {
        console.error(
          `User ${account.user_id}: ${orphelins} ligne(s) sans ad_id reçues de l'API — écrites quand même (ad_id null).`
        );
      }

      if (!records.length) continue;

      // Voir le commentaire TASK-018 en tête de fichier : sans ce DELETE,
      // réécrire une fenêtre déjà connue avec des ad_id RÉELS compterait la
      // dépense en double — la vieille ligne (ad_id null, laissée par la
      // migration meta_ads_ad_id.sql) et la nouvelle ne sont jamais en
      // conflit l'une avec l'autre pour Postgres. Portée strictement bornée à
      // cet utilisateur et aux dates de ce lot.
      //
      // `complete` est le garde-fou : si `fetchAdsInsights` a été tronquée en
      // cours de pagination, `rows`/`records` ne couvre peut-être pas toute
      // la dépense de ces dates — écrire quoi que ce soit maintenant
      // risquerait soit de purger une dépense qu'on ne réinsère que
      // partiellement (DELETE), soit d'empiler les lignes reçues (ad_id
      // réel) À CÔTÉ des lignes héritées ad_id NULL non supprimées (upsert
      // sans DELETE) : double comptage permanent sur cette fenêtre. Donc :
      // si `complete` est faux, on n'écrit RIEN pour cet utilisateur — `since`
      // ne bouge pas côté source (pas de champ `latest` stocké ici, il est
      // recalculé à chaque invocation depuis `meta_ads_insights`), et
      // l'invocation suivante retentera naturellement la même plage.
      if (!complete) {
        console.error(
          `User ${account.user_id}: récolte tronquée — aucune écriture ce passage, la plage sera retentée à la prochaine invocation.`
        );
        continue;
      }

      const dates = [...new Set(records.map((r) => r.date_start).filter(Boolean))];
      if (dates.length) {
        const { error: delError } = await supabase
          .from("meta_ads_insights")
          .delete()
          .eq("user_id", account.user_id)
          .in("date_start", dates)
          .is("ad_id", null);
        if (delError) console.error(`Nettoyage ad_id NULL échoué pour ${account.user_id}:`, delError);
      }

      const { error } = await supabase
        .from("meta_ads_insights")
        .upsert(records, { onConflict: "user_id,date_start,ad_id" });

      if (error) console.error(`Upsert error for user ${account.user_id}:`, error);
      else console.log(`Upserted ${records.length} records for user ${account.user_id}`);

    } catch (e) {
      console.error(`Error for user ${account.user_id}:`, e);
    }
  }

  return new Response("done", { status: 200 });
});
