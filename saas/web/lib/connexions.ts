import { createClient } from "@/lib/supabase/server";

// L'état des quatre canaux, lu au même endroit par la page /comptes et par le
// parcours de démarrage.
//
// Pourquoi quatre lignes et pas deux : une autorisation accordée ne veut pas
// dire une source de données branchée. On peut très bien avoir dit oui à Meta
// sans qu'aucun compte Instagram ne soit résolu, ou avoir un jeton Google
// valide sans propriété Analytics choisie — et dans les deux cas le rapport
// reste vide sans que personne ne comprenne pourquoi. Chaque étape qui peut
// échouer seule mérite donc sa ligne et son état propre.

export type CleCanal = "meta" | "instagram" | "google_ads" | "ga4";

export type EtatCanal = {
  cle: CleCanal;
  nom: string;
  /** Ce que ce canal apporte, en une phrase — affiché quand il manque. */
  apporte: string;
  connecte: boolean;
  /** Le compte rattaché, quand il y en a un. */
  detail: string | null;
  /** Ce qu'il reste à faire, quand ce n'est pas connecté. */
  manque: string | null;
  /** Le jeton est mort : la récolte de ce canal est arrêtée jusqu'à la
   *  reconnexion. Posé par le worker (`saas/data/fetch_data/{meta,google}/auth/`). */
  aReconnecter: AReconnecter | null;
  /** Quand l'autorisation de ce canal arrive à échéance, si la plateforme le
   *  dit (`jeton_expire_le`). `null` = non communiquée, ou jamais lue. */
  expireLe: string | null;
  /** Ce qu'on écrit à la place d'une date quand la plateforme n'en donne pas. */
  sansEcheance: string | null;
};

export type AReconnecter = {
  /** ISO — le premier passage qui a trouvé le jeton mort. */
  depuis: string;
  raison: string | null;
};

export type Connexions = {
  canaux: EtatCanal[];
  /** L'identifiant de la ligne Meta, pour la déconnexion. */
  idMeta: number | null;
  idGoogle: number | null;
  /** Tout est branché → on peut lancer la première récolte. */
  pret: boolean;
  /** Par plateforme : le jeton Meta sert Meta + Instagram, le Google sert
   *  Google Ads + Analytics. */
  reconnecterMeta: AReconnecter | null;
  reconnecterGoogle: AReconnecter | null;
  /** L'échéance de l'autorisation Meta (elle sert aussi Instagram), `null` si
   *  elle n'est pas connue ou si le jeton est déjà mort. */
  echeanceMeta: string | null;
  /** Le compte publicitaire Meta que le client a désigné, `null` s'il n'en a
   *  désigné aucun — la récolte lit alors le premier que Meta rend. */
  comptePubMeta: ComptePubMeta | null;
  /** Meta est branché, la base sait porter le choix, et rien n'est choisi :
   *  la page Connexions peut proposer l'étape. */
  comptePubMetaAChoisir: boolean;
};

export type ComptePubMeta = { id: string; nom: string | null };

type LigneEcheance = {
  id: number;
  provider: string | null;
  jeton_expire_le: string | null;
  a_reconnecter_depuis: string | null;
};

// L'ÉCHÉANCE, LUE À PART ELLE AUSSI (section 27 du `000`) : une base où la
// section n'est pas jouée ne doit pas emporter la lecture des jetons.
async function lireEcheances(uid: string): Promise<LigneEcheance[]> {
  try {
    const r = await createClient()
      .from("connected_accounts")
      .select("id, provider, jeton_expire_le, a_reconnecter_depuis")
      .eq("user_id", uid);
    return r.error ? [] : ((r.data as unknown as LigneEcheance[]) ?? []);
  } catch {
    return [];
  }
}

/**
 * Les échéances connues, par plateforme — pour le rapport hebdo, qui n'a pas à
 * lire un seul jeton pour dire qu'une connexion arrive à son terme.
 *
 * Une connexion déjà marquée « à reconnecter » n'en a plus : le jeton est mort,
 * ce n'est plus un préavis, et la page le dit autrement. La ligne Google est
 * celle dont `provider` vaut `google` ; toute autre est Meta (les lignes
 * d'avant l'unification des jetons n'ont pas de `provider`).
 */
export async function getEcheances(uid: string): Promise<{ meta: string | null; google: string | null }> {
  const out: { meta: string | null; google: string | null } = { meta: null, google: null };
  for (const l of await lireEcheances(uid)) {
    if (!l.jeton_expire_le || l.a_reconnecter_depuis) continue;
    const cle = l.provider === "google" ? "google" : "meta";
    // Deux connexions sur une plateforme : la plus proche est celle qui presse.
    if (!out[cle] || l.jeton_expire_le < out[cle]!) out[cle] = l.jeton_expire_le;
  }
  return out;
}

type LigneComptePub = {
  id: number;
  meta_ad_account_id: string | null;
  meta_ad_account_name: string | null;
};

// LUES À PART, COMME LES RECONNEXIONS, ET POUR LA MÊME RAISON. Ces deux
// colonnes arrivent avec la section 26 de `000_run_me_all.sql`. Demandées dans
// le `select` des jetons, une base où elle n'est pas jouée ferait échouer toute
// la lecture. `null` = on ne sait pas (colonne absente ou lecture ratée) : la
// page ne propose alors pas un choix qu'elle ne pourrait pas enregistrer.
async function lireComptesPubMeta(uid: string): Promise<Map<number, ComptePubMeta | null> | null> {
  try {
    const r = await createClient()
      .from("connected_accounts")
      .select("id, meta_ad_account_id, meta_ad_account_name")
      .eq("user_id", uid);
    if (r.error) return null;
    const out = new Map<number, ComptePubMeta | null>();
    for (const l of (r.data as unknown as LigneComptePub[]) ?? []) {
      out.set(l.id, l.meta_ad_account_id ? { id: l.meta_ad_account_id, nom: l.meta_ad_account_name } : null);
    }
    return out;
  } catch {
    return null;
  }
}

type LigneReconnexion = {
  id: number;
  a_reconnecter_depuis: string | null;
  a_reconnecter_raison: string | null;
};

// LUES À PART, ET UN ÉCHEC NE COÛTE RIEN. Ces deux colonnes arrivent avec la
// section 4bis de `000_run_me_all.sql`. Demandées dans le même `select` que
// les jetons, une base où la migration n'est pas encore jouée ferait échouer
// TOUTE la lecture — et la page Comptes, seul endroit d'où l'on répare une
// connexion, afficherait les quatre canaux « à brancher ». Ici, une colonne
// absente veut dire « aucune reconnexion connue », rien de plus.
async function lireReconnexions(uid: string): Promise<Map<number, AReconnecter>> {
  const out = new Map<number, AReconnecter>();
  try {
    const r = await createClient()
      .from("connected_accounts")
      .select("id, a_reconnecter_depuis, a_reconnecter_raison")
      .eq("user_id", uid);
    for (const l of (r.data as unknown as LigneReconnexion[]) ?? []) {
      if (l.a_reconnecter_depuis) {
        out.set(l.id, { depuis: l.a_reconnecter_depuis, raison: l.a_reconnecter_raison });
      }
    }
  } catch {
    // voir le commentaire au-dessus
  }
  return out;
}

type Ligne = {
  id: number;
  provider: string | null;
  account_name: string | null;
  meta_token: string | null;
  instagram_business_id: string | null;
  google_refresh_token: string | null;
  google_customer_id: string | null;
  ga4_property_id: string | null;
};

export async function getConnexions(uid: string): Promise<Connexions> {
  const supabase = createClient();
  let lignes: Ligne[] = [];
  try {
    const r = await supabase
      .from("connected_accounts")
      .select(
        "id, provider, account_name, meta_token, instagram_business_id, " +
          "google_refresh_token, google_customer_id, ga4_property_id"
      )
      .eq("user_id", uid);
    lignes = (r.data as unknown as Ligne[]) ?? [];
  } catch {
    lignes = [];
  }

  const meta = lignes.find((l) => l.provider === "meta" || l.meta_token) ?? null;
  const google =
    lignes.find((l) => l.provider === "google" || l.google_refresh_token) ?? null;

  const reconnexions = await lireReconnexions(uid);
  const reconnecterMeta = meta?.meta_token ? reconnexions.get(meta.id) ?? null : null;
  const reconnecterGoogle = google?.google_refresh_token
    ? reconnexions.get(google.id) ?? null
    : null;

  const echeances = await lireEcheances(uid);
  const expireMeta = (meta && echeances.find((e) => e.id === meta.id)?.jeton_expire_le) || null;
  const expireGoogle = (google && echeances.find((e) => e.id === google.id)?.jeton_expire_le) || null;
  // Google ne date pas la fin d'un refresh token : il tient jusqu'à ce qu'il
  // soit révoqué ou reste six mois sans servir (`google/auth/token.py`).
  const SANS_ECHEANCE_GOOGLE = "Google ne donne pas de date d'échéance";

  const comptesPub = meta?.meta_token ? await lireComptesPubMeta(uid) : null;
  const comptePubMeta = (meta && comptesPub?.get(meta.id)) || null;

  const canaux: EtatCanal[] = [
    {
      cle: "meta",
      nom: "Meta",
      apporte: "Tes campagnes Facebook et Instagram : dépense, clics, portée.",
      connecte: Boolean(meta?.meta_token),
      // Le compte publicitaire se dit dès qu'il est choisi : c'est lui qui
      // répond à « quelles campagnes Pulse lit-il ? », pas la Page.
      detail: comptePubMeta
        ? [meta?.account_name, `compte publicitaire ${comptePubMeta.nom ?? comptePubMeta.id}`]
            .filter(Boolean)
            .join(" · ")
        : meta?.account_name ?? null,
      manque: meta?.meta_token ? null : "Autoriser Pulse sur ton compte Facebook.",
      aReconnecter: reconnecterMeta,
      expireLe: expireMeta,
      sansEcheance: null,
    },
    {
      cle: "instagram",
      nom: "Instagram",
      apporte: "Tes publications : vues, portée, engagement, meilleurs formats.",
      connecte: Boolean(meta?.instagram_business_id),
      detail: meta?.instagram_business_id ? meta.account_name : null,
      manque: meta?.meta_token
        ? meta?.instagram_business_id
          ? null
          : "Choisir la Page Facebook liée à ton compte Instagram."
        : "Connecte Meta d'abord — Instagram passe par la même autorisation.",
      aReconnecter: meta?.instagram_business_id ? reconnecterMeta : null,
      expireLe: meta?.instagram_business_id ? expireMeta : null,
      sansEcheance: null,
    },
    {
      cle: "google_ads",
      nom: "Google Ads",
      apporte: "Tes campagnes Google : dépense, impressions, clics, conversions.",
      connecte: Boolean(google?.google_refresh_token && google?.google_customer_id),
      detail: google?.google_customer_id ?? null,
      manque: google?.google_refresh_token
        ? google?.google_customer_id
          ? null
          : "Choisir le compte Google Ads à suivre."
        : "Autoriser Pulse sur ton compte Google.",
      aReconnecter: google?.google_customer_id ? reconnecterGoogle : null,
      expireLe: google?.google_customer_id ? expireGoogle : null,
      sansEcheance: SANS_ECHEANCE_GOOGLE,
    },
    {
      cle: "ga4",
      nom: "Google Analytics",
      apporte:
        "Ce que tes visiteurs font une fois sur ton site — le seul endroit où on voit si la pub rapporte.",
      connecte: Boolean(google?.ga4_property_id),
      detail: google?.ga4_property_id?.replace("properties/", "") ?? null,
      manque: google?.google_refresh_token
        ? google?.ga4_property_id
          ? null
          : "Choisir la propriété Analytics de ton site."
        : "Connecte Google d'abord — Analytics passe par la même autorisation.",
      aReconnecter: google?.ga4_property_id ? reconnecterGoogle : null,
      expireLe: google?.ga4_property_id ? expireGoogle : null,
      sansEcheance: SANS_ECHEANCE_GOOGLE,
    },
  ];

  return {
    canaux,
    idMeta: meta?.id ?? null,
    idGoogle: google?.id ?? null,
    // Un canal à reconnecter n'est pas prêt : il ne récolte plus rien.
    pret: canaux.every((c) => c.connecte && !c.aReconnecter),
    reconnecterMeta,
    reconnecterGoogle,
    comptePubMeta,
    echeanceMeta: reconnecterMeta ? null : expireMeta,
    comptePubMetaAChoisir: Boolean(meta?.meta_token) && comptesPub !== null && !comptePubMeta,
  };
}
