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
   *  reconnexion. Posé par le worker (`saas/collecte/{meta,google}/auth/`). */
  aReconnecter: AReconnecter | null;
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
};

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

  const canaux: EtatCanal[] = [
    {
      cle: "meta",
      nom: "Meta",
      apporte: "Tes campagnes Facebook et Instagram : dépense, clics, portée.",
      connecte: Boolean(meta?.meta_token),
      detail: meta?.account_name ?? null,
      manque: meta?.meta_token ? null : "Autoriser Pulse sur ton compte Facebook.",
      aReconnecter: reconnecterMeta,
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
  };
}
