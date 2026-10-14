import type { createClient } from "@/lib/supabase/server";

// ── LE TROU DE RÉCOLTE, LU DEPUIS LE WEB ────────────────────────────────────
//
// POURQUOI CE MODULE EXISTE. Le ticket 20 a fait taire les mesures trouées
// DANS LE PAYLOAD — donc dans le rapport hebdo et dans l'email, qui le lisent
// tous les deux. Les pages de l'application, elles, ne lisent pas le payload :
// `lib/report.ts`, `lib/couts.ts` et `lib/channels.ts` interrogent
// `meta_ads_insights` et `google_ads_insights` eux-mêmes. Les mêmes lignes,
// donc le même trou, par un autre chemin — et aucune des protections du
// ticket 20 ne s'y appliquait. Ce module fait traverser le signal une seconde
// fois, vers ces trois-là.
//
// C'EST LE JUMEAU DE `fetch_canaux_muets` (`saas/data/storage/reader.py`), et il
// doit le rester : même table, même filtre sur le dernier passage, même
// restriction aux canaux payants. Deux lectures du même fait qui divergeraient
// produiraient deux vérités sur un seul écran — exactement le défaut que le
// ticket 48 vient corriger.
//
// LES TROIS ÉTATS QUI SE RESSEMBLENT (ADR 0005). `meta_ads_insights` rend le
// même nombre de lignes pour « jamais connecté », « la récolte a échoué » et
// « aucune campagne active ». Le web ne doit JAMAIS essayer de deviner lequel
// des trois : le signal n'est pas « il y a peu de lignes », c'est « une
// écriture a été tentée et elle a échoué », et seul le worker le sait. D'où
// `fetch_progress`, état `echec`, et rien d'autre.
//
// `saute` N'EST PAS `echec`. Un canal sauté n'a pas été appelé (aucune
// connexion) : il ne creuse aucun trou. Seul le canal appelé qui a refusé en
// creuse un.

/** Les seuls canaux dont le silence creuse un trou dans un CHIFFRE de ces
 *  pages. Instagram muet coûte des posts, pas une division fausse ; GA4 muet
 *  fait taire le revenu, qui se tait déjà tout seul quand il est absent. */
const CANAUX_PUB = ["meta", "google"] as const;

export type CanalPub = (typeof CANAUX_PUB)[number];

/** La table où chaque canal payant écrit ses lignes — c'est elle qui donne la
 *  date de bord du trou. */
const TABLE: Record<CanalPub, string> = {
  meta: "meta_ads_insights",
  google: "google_ads_insights",
};

/** Le nom porté devant le client, le même que celui du payload
 *  (`NOMS_CANAUX`, `build_report.py`) : « Meta Ads », jamais « meta ». */
const NOMS: Record<CanalPub, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
};

export type CanalMuetLive = {
  canal: CanalPub;
  nom: string;
  /** Le mot de la fin du worker (`fetch_progress.mot_de_fin`). Nomme la
   *  variable en cause, jamais sa valeur (`CLAUDE.md` §7). */
  mot: string;
  /** LE DERNIER JOUR QUE CE CANAL A RÉELLEMENT ÉCRIT — ce qui borne le trou.
   *  `null` quand il n'a jamais rien écrit : il est alors aveugle sur toute
   *  fenêtre, parce qu'on ne peut pas prouver qu'il n'a pas dépensé.
   *
   *  La date se DÉDUIT des lignes présentes, elle ne se stocke pas : même
   *  raisonnement que `_depart_recolte` côté récolte et que `_bord_muet` côté
   *  rapport — une date lue dans ce qui a réellement été écrit ne peut pas
   *  mentir sur ce qui a été fait. C'est aussi ce qui garde les semaines
   *  d'avant lisibles : un canal muet est aveugle APRÈS sa dernière date, et
   *  nulle part ailleurs. */
  depuis: string | null;
};

type Client = ReturnType<typeof createClient>;

/** Les canaux payants dont la récolte a ÉCHOUÉ au dernier passage, avec la
 *  date jusqu'à laquelle chacun a écrit.
 *
 *  Rend `[]` dès que `fetch_progress` est absente ou illisible (migration pas
 *  jouée, RLS, réseau) : un suivi qu'on ne sait pas lire ne doit pas faire
 *  taire les chiffres de tout le monde. Le risque est asymétrique et assumé
 *  dans ce sens-là, exactement comme côté Python. */
export async function fetchCanauxMuets(
  supabase: Client,
  uid: string
): Promise<CanalMuetLive[]> {
  let lignes: { canal: string; run_id: string; etat: string; mot_de_fin: string | null }[];
  try {
    const r = await supabase
      .from("fetch_progress")
      .select("canal, run_id, etat, mot_de_fin")
      .eq("user_id", uid);
    if (r.error) return [];
    lignes = (r.data ?? []) as typeof lignes;
  } catch {
    return [];
  }
  if (lignes.length === 0) return [];

  // ON NE LIT QUE LE PASSAGE LE PLUS RÉCENT. `run_id` est un horodatage ISO en
  // UTC écrit tel quel : le max lexicographique est le passage le plus récent.
  // Sans ce filtre, un échec d'il y a trois semaines tairait éternellement la
  // dépense d'un canal réparé depuis.
  const dernier = lignes.reduce((max, l) => (String(l.run_id) > max ? String(l.run_id) : max), "");
  const muets = lignes.filter(
    (l) =>
      String(l.run_id) === dernier &&
      l.etat === "echec" &&
      (CANAUX_PUB as readonly string[]).includes(l.canal)
  );
  if (muets.length === 0) return [];

  // Une requête d'une ligne par canal muet, et uniquement quand il y en a :
  // un compte en bonne santé ne paie rien pour cette protection.
  return Promise.all(
    muets.map(async (l) => {
      const canal = l.canal as CanalPub;
      let depuis: string | null = null;
      try {
        const bord = await supabase
          .from(TABLE[canal])
          .select("date_start")
          .eq("user_id", uid)
          .order("date_start", { ascending: false })
          .limit(1);
        const d = (bord.data as { date_start: string }[] | null)?.[0]?.date_start;
        depuis = d ? String(d).slice(0, 10) : null;
      } catch {
        // Bord inconnu → `null`, donc aveugle partout. C'est le sens prudent :
        // on ne sait pas jusqu'où ce canal a écrit, on ne prétend donc pas que
        // telle fenêtre est complète.
        depuis = null;
      }
      return {
        canal,
        nom: NOMS[canal],
        mot: l.mot_de_fin ?? `${NOMS[canal]} : échec de récolte`,
        depuis,
      };
    })
  );
}

/** Les canaux muets qui taisent une fenêtre finissant le jour `fin` (ISO).
 *
 *  Seule la borne de FIN compte, comme dans `_pub_aveugle` (`build_report.py`) :
 *  le trou est toujours à la fin de l'historique, donc une fenêtre est trouée
 *  dès qu'elle va au-delà du dernier jour écrit.
 *
 *  `depuis === null` REND LE CANAL AVEUGLE SUR TOUTE FENÊTRE, y compris des
 *  mois antérieurs à sa connexion, et c'est délibéré — mais la portée mérite
 *  d'être vue en face plutôt que redécouverte comme un défaut.
 *
 *  Ce que ça coûte : un compte qui ne faisait que du Meta depuis huit mois
 *  branche Google Ads aujourd'hui, et la première récolte échoue. La page
 *  Coûts passe entièrement en « — », janvier compris, alors qu'elle affichait
 *  des chiffres la veille.
 *
 *  Pourquoi on le garde quand même : ces chiffres de la veille ne comptaient
 *  pas Google, et ils n'avaient jamais prétendu le faire. À partir du moment
 *  où la régie est branchée, le cumul de l'année est censé porter son
 *  historique — que la récolte ramène, quand elle réussit. Tant qu'elle
 *  échoue, on ne peut pas prouver que ce compte publicitaire n'a rien dépensé
 *  avant : ce n'est pas un zéro, c'est une inconnue. Et c'est la règle exacte
 *  du worker (`_pub_aveugle`) — deux lectures du même fait qui divergeraient
 *  produiraient deux vérités, ce que le ticket 48 vient précisément défaire.
 *
 *  Ce qui rend la chose tenable : le bandeau écrit « aucune donnée reçue » en
 *  face du canal, avec le lien de reconnexion. Le client ne lit pas des tirets
 *  sans cause, il lit une connexion à refaire. */
export function aveuglesSur(muets: CanalMuetLive[], fin: string): CanalMuetLive[] {
  return muets.filter((m) => m.depuis === null || fin > m.depuis);
}

/** `true` dès qu'au moins un canal payant tait cette fenêtre — le test qu'on
 *  pose devant un TOTAL tous canaux confondus, qui n'a pas de moitié valide. */
export function fenetreTue(muets: CanalMuetLive[], fin: string): boolean {
  return aveuglesSur(muets, fin).length > 0;
}

/** `true` si CE canal-là tait cette fenêtre — le test qu'on pose devant une
 *  mesure propre à une régie (la dépense Meta, le CPC Google). */
export function canalTu(muets: CanalMuetLive[], canal: CanalPub, fin: string): boolean {
  return aveuglesSur(muets, fin).some((m) => m.canal === canal);
}
