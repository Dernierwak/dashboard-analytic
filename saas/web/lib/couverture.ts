// CE QUI ÉCHAPPE AUX THÈMES — UNE SEULE ARITHMÉTIQUE, POUR DEUX PAGES.
//
// Ce fichier est un DÉPLACEMENT, pas une invention : tout ce qui suit vivait
// dans `getEtiquetage()`, au milieu de `app/labels/page.tsx`. Il en sort pour
// une raison de fond et une seule : le rapport hebdomadaire doit alerter avec
// LE MÊME NOMBRE que la page Thèmes, et deux nombres calculés à deux endroits
// finissent toujours par diverger — pas le jour où on les écrit, le jour où
// l'un des deux change de fenêtre, de limite de lecture ou de règle d'univers.
// Un écart de 300 CHF entre deux écrans du même produit ne se lit pas comme un
// bug, il se lit comme « Pulse ne sait pas compter ».
//
// LE CHIFFRE EST UN MONTANT, JAMAIS UN COMPTE. Voir le journal du 14 août 2026
// dans `docs/03-grammaire-des-modules.md` : « 12 campagnes sans thème » ne fait
// rien faire à personne — douze campagnes, c'est peut-être douze essais à 4 CHF
// arrêtés en mars. Ce qu'on perd quand une campagne n'a pas de thème, c'est de
// l'argent sorti du compte qu'aucun bilan ne sait rattacher.
//
// LA FENÊTRE : 90 jours PLEINS, ancrés sur le dernier jour de données, jamais
// sur aujourd'hui — même convention que tout le produit (« toute comparaison
// exclut le jour en cours »). Quatre-vingt-dix jours parce que c'est l'horizon
// des conseils : assez long pour qu'un montant soit parlant, assez court pour
// qu'il soit encore réparable.
//
// CE QUI RESTE À FAIRE, ET QUI N'EST PAS DE MON RESSORT.
// `app/labels/page.tsx` porte encore sa propre copie de `getEtiquetage` : tant
// qu'elle n'importe pas celle-ci, il y a bien deux arithmétiques dans le dépôt
// — exactement ce que ce fichier existe pour éviter. La bascule est un import
// et une suppression, aucune ligne à réécrire : la signature ci-dessous est
// celle qu'elle utilise déjà, champ pour champ.
import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import type { Couverture, ElementLabel } from "@/components/labels-modele";

const MOIS_FR = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
const JOURS_FENETRE = 90;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function ajoute(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
function jourCourt(d: Date): string {
  return `${d.getUTCDate()} ${MOIS_FR[d.getUTCMonth()]}`;
}

type Ligne = ElementLabel & { tri: number };

export type Etiquetage = {
  couverture: Couverture;
  sansTheme: ElementLabel[];
  deja: ElementLabel[];
  labels: string[];
};

export async function getEtiquetage(): Promise<Etiquetage> {
  const supabase = createClient();
  const compte = await getCompteActif();
  const uid = compte.uid;

  const [profRes, metaCfgRes, gooCfgRes, metaInsRes, gooInsRes, postsRes] = await Promise.all([
    supabase.from("profiles").select("labels").eq("id", uid).limit(1),
    // "*" : tolérant au schéma — `label_source`, `label_at` et `landing_url`
    // peuvent ne pas encore exister en base (migrations pas jouées).
    supabase.from("meta_campaign_config").select("*").eq("user_id", uid),
    supabase.from("google_campaign_config").select("*").eq("user_id", uid),
    supabase.from("meta_ads_insights")
      .select("date_start, campaign_name, spend")
      .eq("user_id", uid).order("date_start", { ascending: false }).limit(12000),
    supabase.from("google_ads_insights")
      .select("date_start, campaign_id, campaign_name, cost_micros")
      .eq("user_id", uid).order("date_start", { ascending: false }).limit(12000),
    supabase.from("instagram_organic_posts").select("*")
      .eq("user_id", uid).order("date", { ascending: false }).limit(5000),
  ]);

  const labels = ((profRes.data?.[0]?.labels as string[] | null) ?? []);
  const metaIns = metaInsRes.data ?? [];
  const gooIns = gooInsRes.data ?? [];
  const posts = postsRes.data ?? [];

  const hier = ajoute(new Date(), -1);
  let ancre = hier;
  const dernier = [
    String(metaIns[0]?.date_start ?? "").slice(0, 10),
    String(gooIns[0]?.date_start ?? "").slice(0, 10),
  ].filter(Boolean).sort().pop();
  if (dernier) {
    const d = new Date(dernier + "T00:00:00Z");
    if (!isNaN(d.getTime()) && d < hier) ancre = d;
  }
  const debut = ajoute(ancre, -(JOURS_FENETRE - 1));
  const dansFenetre = (v: unknown) => {
    const j = String(v ?? "").slice(0, 10);
    return j >= iso(debut) && j <= iso(ancre);
  };

  // ── Dépense par campagne, sur la fenêtre ──────────────────────────────────
  const depMeta = new Map<string, number>();
  for (const r of metaIns) {
    const k = String(r.campaign_name ?? "");
    if (!k || !dansFenetre(r.date_start)) continue;
    depMeta.set(k, (depMeta.get(k) ?? 0) + (Number(r.spend) || 0));
  }
  const depGoo = new Map<string, number>();
  const nomGoo = new Map<string, string>();
  for (const r of gooIns) {
    const k = String(r.campaign_id ?? "");
    if (!k) continue;
    if (r.campaign_name && !nomGoo.has(k)) nomGoo.set(k, String(r.campaign_name));
    if (!dansFenetre(r.date_start)) continue;
    depGoo.set(k, (depGoo.get(k) ?? 0) + (Number(r.cost_micros) || 0) / 1_000_000);
  }

  // ── L'univers des campagnes ───────────────────────────────────────────────
  // Insights ∪ configs : une campagne arrêtée l'an dernier n'apparaît plus
  // dans les insights récents mais garde sa ligne de config — la sortir de la
  // liste ferait disparaître son thème sans que personne puisse le corriger.
  type Cfg = Record<string, unknown>;
  const metaCfg = new Map<string, Cfg>(
    (metaCfgRes.data ?? []).map((c) => [String(c.campaign_name), c as Cfg])
  );
  const gooCfg = new Map<string, Cfg>(
    (gooCfgRes.data ?? []).map((c) => [String(c.campaign_id), c as Cfg])
  );

  const lignes: Ligne[] = [];

  const clesMeta = new Set<string>([
    ...metaIns.map((r) => String(r.campaign_name ?? "")).filter(Boolean),
    ...metaCfg.keys(),
  ]);
  for (const nom of clesMeta) {
    const c = metaCfg.get(nom) ?? {};
    const label = (c.label as string | null) || null;
    lignes.push({
      cle: nom,
      canal: "meta",
      nom,
      sous: (c.effective_status as string | null) || null,
      depense: depMeta.get(nom) ?? 0,
      label,
      source: (c.label_source as string | null) ?? null,
      landing: (c.landing_url as string | null) ?? null,
      tri: depMeta.get(nom) ?? 0,
    });
  }

  const clesGoo = new Set<string>([
    ...gooIns.map((r) => String(r.campaign_id ?? "")).filter(Boolean),
    ...gooCfg.keys(),
  ]);
  for (const id of clesGoo) {
    const c = gooCfg.get(id) ?? {};
    const nom = (c.campaign_name as string) || nomGoo.get(id) || `Campagne ${id}`;
    lignes.push({
      cle: id,
      canal: "google",
      nom,
      sous: (c.effective_status as string | null) || null,
      depense: depGoo.get(id) ?? 0,
      label: (c.label as string | null) || null,
      source: (c.label_source as string | null) ?? null,
      landing: (c.landing_url as string | null) ?? null,
      tri: depGoo.get(id) ?? 0,
    });
  }

  let postsSansTheme = 0;
  for (const p of posts) {
    const ls = ((p.labels as string[] | null) ?? []).filter(Boolean);
    const d = new Date(String(p.date ?? ""));
    const legende = String(p.caption ?? "").replace(/\s+/g, " ").trim();
    if (ls.length === 0 && dansFenetre(p.date)) postsSansTheme += 1;
    lignes.push({
      cle: String(p.id ?? ""),
      canal: "instagram",
      nom: legende ? legende.slice(0, 120) : "(publication sans légende)",
      sous: isNaN(d.getTime())
        ? String(p.type ?? "publication")
        : `${jourCourt(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())))} · ${p.type ?? "publication"}`,
      depense: 0,
      label: ls[0] ?? null,
      source: (p.label_source as string | null) ?? null,
      landing: null,
      tri: isNaN(d.getTime()) ? 0 : d.getTime() / 1e10, // toujours sous un montant
    });
  }

  // On étiquette dans l'ordre de ce que ça coûte : le tri met les campagnes
  // chères en tête, puis ce qui n'a pas de montant, du plus récent au plus vieux.
  const parPoids = (a: Ligne, b: Ligne) => b.tri - a.tri || a.nom.localeCompare(b.nom);
  const nu = ({ tri: _tri, ...reste }: Ligne): ElementLabel => reste;

  const sansTheme = lignes.filter((l) => !l.label).sort(parPoids).map(nu);
  const deja = lignes
    .filter((l) => l.label)
    .sort((a, b) => (a.label ?? "").localeCompare(b.label ?? "") || parPoids(a, b))
    .map(nu);

  let depenseTotale = 0;
  let metaSansTheme = 0;
  let googleSansTheme = 0;
  for (const l of lignes) {
    if (l.canal === "instagram") continue;
    depenseTotale += l.depense;
    if (l.label) continue;
    if (l.canal === "meta") metaSansTheme += l.depense;
    else googleSansTheme += l.depense;
  }

  return {
    labels,
    sansTheme,
    deja,
    couverture: {
      fenetreCourte: `${JOURS_FENETRE} derniers jours pleins`,
      fenetreLongue: `du ${jourCourt(debut)} au ${jourCourt(ancre)} ${ancre.getUTCFullYear()}`,
      depenseSansTheme: metaSansTheme + googleSansTheme,
      depenseTotale,
      metaSansTheme,
      googleSansTheme,
      postsSansTheme,
      sansTheme: sansTheme.length,
      total: lignes.length,
      mesurable: depenseTotale > 0,
    },
  };
}

/**
 * La couverture seule, pour un écran qui ALERTE sans faire étiqueter — le
 * rapport hebdomadaire. Les deux listes sont calculées puis jetées : c'est
 * volontaire. Les recalculer autrement (une fenêtre plus courte, une limite de
 * lecture plus basse) donnerait un montant proche mais différent de celui de la
 * page Thèmes, et deux nombres proches qui ne sont pas égaux sont pires qu'un
 * nombre absent — on ne saurait pas lequel croire.
 */
export async function getCouverture(): Promise<Couverture> {
  return (await getEtiquetage()).couverture;
}
