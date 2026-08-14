// LE COPILOTE DES THÈMES.
//
// Les labels sont la clé de voûte de Pulse : sans eux, pas de bilan par thème,
// pas de budget par thème, pas de conseil par thème. Une campagne non étiquetée
// disparaît de presque toute l'analyse — elle dépense, et rien ne la regarde.
//
// La page ne faisait pourtant que gérer le VOCABULAIRE : créer, renommer,
// supprimer des thèmes, avec un compteur d'usage. Elle ne montrait nulle part
// ce qui n'en avait pas, donc elle ne pouvait pas être l'endroit où on répare.
// Elle est maintenant lue de haut en bas comme un parcours :
//
//   1. LA COUVERTURE — combien d'argent échappe à l'analyse, et pourquoi ça
//      compte. C'est le seul module de la page qui porte un rang 3.
//   2. LE GESTE DE MASSE — l'IA étiquette tout ce qui est vide, en un clic,
//      et se défait en un clic.
//   3. SANS THÈME — le travail restant, éditable sur place.
//   4. DÉJÀ ÉTIQUETÉ — la vérification, repliée.
//   5. TES THÈMES — le vocabulaire, qui n'est plus le sujet mais reste
//      nécessaire : c'est là qu'on crée, renomme, et marque les priorités.
//
// LA PAGE COMPOSE, ELLE NE DESSINE PAS. Tout ce qui a une forme vit dans
// `components/labels-*.tsx` — même raison que `couts-modules` et `hors-theme` :
// un module écrit dans une page est derrière `middleware.ts` et lit un vrai
// compte Supabase, donc il n'est vérifiable qu'en production. On ne peut lui
// donner ni quarante lignes ni zéro pour voir ce que ça fait.
//
// LA LECTURE DES DONNÉES RESTE ICI, en revanche, et pas dans `lib/channels.ts` :
// c'est une lecture propre à cette page (l'univers COMPLET des campagnes, y
// compris celles qui n'ont pas dépensé un franc sur la fenêtre), là où
// `getMetaDash` ne connaît que ce qui a bougé sur la période demandée.
import { createClient } from "@/lib/supabase/server";
import { getCompteActif } from "@/lib/account";
import { getLabelsData } from "@/lib/channels";
import { CreateLabel, LabelRow } from "@/components/label-manager";
import { ClassifyButton } from "@/components/classify-button";
import { ScrollList } from "@/components/scroll-list";
import { LabelsCouverture } from "@/components/labels-couverture";
import { ListeSansTheme, ListeDeja } from "@/components/labels-listes";
import type { Couverture, ElementLabel } from "@/components/labels-modele";

export const dynamic = "force-dynamic";

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

// LA FENÊTRE : 90 jours PLEINS, ancrés sur le dernier jour de données, jamais
// sur aujourd'hui — même convention que tout le reste du produit (« toute
// comparaison exclut le jour en cours »). Quatre-vingt-dix jours parce que
// c'est l'horizon des conseils : assez long pour qu'un montant soit parlant,
// assez court pour qu'il soit encore réparable.
async function getEtiquetage(): Promise<{
  couverture: Couverture;
  sansTheme: ElementLabel[];
  deja: ElementLabel[];
  labels: string[];
}> {
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

export default async function LabelsPage() {
  const [data, etiquetage] = await Promise.all([getLabelsData(), getEtiquetage()]);

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-9">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          Une liste, trois canaux
        </p>
        <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
          Tes thèmes.
        </h1>
        <p className="text-[13px] text-muted mt-2 leading-relaxed">
          Un thème regroupe campagnes Meta <span style={{ color: "#1a56ff" }}>▣</span>, Google{" "}
          <span style={{ color: "#1a7a4a" }}>◆</span> et posts Instagram{" "}
          <span style={{ color: "#7b4fff" }}>◎</span> — le rapport peut alors dire ce que
          chaque thème te rapporte. Renommer ou supprimer se propage partout.
        </p>
      </div>

      {/* 1 — LE MODULE QUI DIT POURQUOI ON EST LÀ. */}
      <LabelsCouverture c={etiquetage.couverture} />

      {/* 2 — LE GESTE DE MASSE, juste sous le chiffre qu'il fait baisser.
          Il n'est plus dans l'en-tête : une action qui répare ce qu'un module
          vient de mesurer se pose contre ce module, pas trois écrans plus haut.
          Le bloc n'est PAS une rangée flex — le pavé d'annulation qu'il déplie
          fait 320 px et ne tiendrait pas à côté d'un texte sur un téléphone. */}
      <div className="mb-5">
        <ClassifyButton libelle="✨ Étiqueter tout via l'IA" avecAnnulation />
        <p className="text-[11.5px] text-faint mt-2 leading-relaxed max-w-2xl">
          L&apos;IA lit tes légendes et tes noms de campagne, et pose un thème sur tout ce
          qui n&apos;en a pas. Elle applique directement — mais elle ne remplit que le
          vide : <span className="font-semibold text-muted">un thème que tu as choisi
          n&apos;est jamais réécrit</span>, et tout ce qu&apos;elle vient de poser
          s&apos;annule en bloc tant que tu es sur cette page.
        </p>
      </div>

      {/* 3 — LE TRAVAIL. */}
      <ListeSansTheme elements={etiquetage.sansTheme} labels={etiquetage.labels} />

      {/* 4 — LA VÉRIFICATION. */}
      <ListeDeja elements={etiquetage.deja} labels={etiquetage.labels} />

      {/* 5 — LE VOCABULAIRE. */}
      <div className="border-t border-line pt-5">
        <p className="text-[11.5px] text-faint mb-3 leading-relaxed">
          ★ Marque jusqu&apos;à <span className="font-semibold text-ink">3 thèmes
          prioritaires</span> — on ne peut pas tout travailler : les constats et les
          conseils se concentrent dessus. Tu peux en changer quand tu veux.
          {data.priorities.length > 0 && (
            <span className="text-warn font-semibold"> Priorités : {data.priorities.join(" · ")}</span>
          )}
        </p>

        <CreateLabel />

        {data.rows.length === 0 ? (
          <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center">
            <p className="text-[14px] text-ink font-medium">Aucun thème pour l&apos;instant.</p>
            <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
              Crée ton premier ci-dessus (ex. « e-bike », « promo été »), ou laisse
              l&apos;IA les proposer avec le bouton du haut.
            </p>
          </div>
        ) : (
          <ScrollList title="Tes thèmes" count={data.rows.length} maxH="max-h-[52vh]">
            {data.rows.map((row) => (
              <LabelRow key={row.name} row={row} priority={data.priorities.includes(row.name)} />
            ))}
          </ScrollList>
        )}
      </div>
    </main>
  );
}
