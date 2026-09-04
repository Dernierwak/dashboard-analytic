import { META_API, reglagesGoogle } from "@/lib/oauth";

// Les appels aux API des fournisseurs pendant le parcours de connexion :
// « quelles Pages ? quels comptes publicitaires ? quelles propriétés
// Analytics ? ». Ils vivent ici, séparés des routes et des actions, parce
// qu'ils sont la partie qui échoue le plus souvent — et chaque échec a une
// cause précise qu'il faut savoir nommer.

export type Choix = { id: string; nom: string; sousTitre?: string };
export type Resultat = { ok: true; choix: Choix[] } | { ok: false; erreur: string };

// ── Meta : les Pages Facebook ───────────────────────────────────────────────

export async function pagesFacebook(token: string): Promise<Resultat> {
  const lire = async (url: string): Promise<{ id: string; name: string }[]> => {
    try {
      const r = await fetch(url, { cache: "no-store" });
      const d = await r.json();
      return Array.isArray(d.data) ? d.data : [];
    } catch {
      return [];
    }
  };

  let pages = await lire(
    `https://graph.facebook.com/${META_API}/me/accounts?fields=id,name&access_token=${token}`
  );

  // `me/accounts` revient vide quand les Pages sont détenues par un Business
  // Manager plutôt que par la personne. Ce n'est pas un cas rare : c'est le
  // montage normal dès qu'une agence est passée par là. On redescend donc par
  // les entreprises avant de conclure qu'il n'y a rien.
  if (pages.length === 0) {
    const biz = await lire(
      `https://graph.facebook.com/${META_API}/me/businesses?fields=id,name&access_token=${token}`
    );
    for (const b of biz) {
      for (const bout of ["owned_pages", "client_pages"]) {
        pages = pages.concat(
          await lire(
            `https://graph.facebook.com/${META_API}/${b.id}/${bout}?fields=id,name&access_token=${token}`
          )
        );
      }
    }
  }

  const vues = new Set<string>();
  const uniques = pages.filter((p) => {
    if (!p?.id || vues.has(p.id)) return false;
    vues.add(p.id);
    return true;
  });

  // On dit tout de suite quelle Page porte un compte Instagram. Sans ça, le
  // choix se fait à l'aveugle — et se tromper de Page donne un dashboard où la
  // partie Instagram reste vide sans que rien n'explique pourquoi.
  const choix = await Promise.all(
    uniques.map(async (p): Promise<Choix> => {
      const ig = await instagramDeLaPage(token, p.id);
      return {
        id: p.id,
        nom: p.name || p.id,
        sousTitre: ig ? `Instagram ${ig.nom}` : "aucun compte Instagram rattaché",
      };
    })
  );
  return { ok: true, choix };
}

/** L'identifiant du compte Instagram Business rattaché à une Page. */
export async function instagramDeLaPage(
  token: string,
  pageId: string
): Promise<{ id: string; nom: string } | null> {
  try {
    const r = await fetch(
      `https://graph.facebook.com/${META_API}/${pageId}` +
        `?fields=instagram_business_account{id,username}&access_token=${token}`,
      { cache: "no-store" }
    );
    const d = await r.json();
    const ig = d?.instagram_business_account;
    if (!ig?.id) return null;
    return { id: String(ig.id), nom: ig.username ? `@${ig.username}` : String(ig.id) };
  } catch {
    return null;
  }
}

// ── Google : le jeton d'accès court ─────────────────────────────────────────

export async function accessTokenGoogle(refreshToken: string): Promise<string | null> {
  const cfg = reglagesGoogle();
  if (!cfg) return null;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    const d = await r.json();
    return d.access_token ?? null;
  } catch {
    return null;
  }
}

// ── Google Ads : les comptes accessibles ────────────────────────────────────

const ADS_VERSION = "v21"; // aligné sur collecte/google/fetch_google_ads.py

function enTetesAds(accessToken: string): Record<string, string> | null {
  const dev = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!dev) return null;
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": dev,
    "Content-Type": "application/json",
  };
  const mcc = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (mcc) h["login-customer-id"] = String(mcc).replace(/-/g, "");
  return h;
}

export async function comptesGoogleAds(accessToken: string): Promise<Resultat> {
  const h = enTetesAds(accessToken);
  if (!h) {
    return {
      ok: false,
      erreur:
        "Le jeton développeur Google Ads n'est pas configuré côté serveur " +
        "(variable GOOGLE_ADS_DEVELOPER_TOKEN).",
    };
  }

  let ids: string[] = [];
  try {
    const r = await fetch(
      `https://googleads.googleapis.com/${ADS_VERSION}/customers:listAccessibleCustomers`,
      { headers: h, cache: "no-store" }
    );
    const d = await r.json();
    if (!r.ok) {
      // Les trois causes classiques, reprises de l'ancienne app : jeton
      // développeur absent, invalide, ou en accès « Basic » (test) — ce dernier
      // ne voit que les comptes de test et renvoie un refus qui n'explique rien.
      const msg = d?.error?.message || `HTTP ${r.status}`;
      return {
        ok: false,
        erreur:
          `Google Ads refuse la demande : ${msg}. ` +
          "Vérifie que le jeton développeur est valide et qu'il n'est pas resté " +
          "en accès Basic (il ne verrait alors que des comptes de test).",
      };
    }
    ids = (d.resourceNames ?? []).map((n: string) => n.replace("customers/", ""));
  } catch {
    return { ok: false, erreur: "Google Ads est injoignable pour le moment." };
  }

  if (ids.length === 0) {
    return {
      ok: false,
      erreur:
        "Aucun compte Google Ads accessible avec ce login. Vérifie que le compte " +
        "Google que tu viens d'autoriser a bien accès à un compte Google Ads.",
    };
  }

  // Le nom lisible se demande compte par compte. S'il ne vient pas — c'est
  // fréquent sous un compte administrateur — on garde l'identifiant plutôt que
  // de faire échouer toute la liste pour une question d'étiquette.
  const choix = await Promise.all(
    ids.map(async (id): Promise<Choix> => {
      try {
        const r = await fetch(
          `https://googleads.googleapis.com/${ADS_VERSION}/customers/${id}/googleAds:search`,
          {
            method: "POST",
            headers: h,
            body: JSON.stringify({
              query:
                "SELECT customer.descriptive_name, customer.currency_code FROM customer LIMIT 1",
            }),
            cache: "no-store",
          }
        );
        const d = await r.json();
        const c = d?.results?.[0]?.customer;
        return {
          id,
          nom: c?.descriptiveName || `Compte ${id}`,
          sousTitre: c?.currencyCode ? `${id} · ${c.currencyCode}` : id,
        };
      } catch {
        return { id, nom: `Compte ${id}`, sousTitre: id };
      }
    })
  );
  return { ok: true, choix };
}

// ── Google Analytics : les propriétés ───────────────────────────────────────

export async function proprietesGa4(accessToken: string): Promise<Resultat> {
  try {
    const r = await fetch(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
    );
    const d = await r.json();
    if (!r.ok) {
      return {
        ok: false,
        erreur: `Google Analytics refuse la demande : ${d?.error?.message || `HTTP ${r.status}`}.`,
      };
    }
    const choix: Choix[] = [];
    for (const compte of d.accountSummaries ?? []) {
      for (const p of compte.propertySummaries ?? []) {
        if (!p?.property) continue;
        choix.push({
          id: String(p.property), // « properties/254818606 », format attendu en base
          nom: p.displayName || String(p.property),
          sousTitre: compte.displayName || undefined,
        });
      }
    }
    if (choix.length === 0) {
      return {
        ok: false,
        erreur:
          "Aucune propriété Analytics visible avec ce compte Google. Vérifie que " +
          "tu as au moins un accès en lecture sur la propriété de ton site.",
      };
    }
    return { ok: true, choix };
  } catch {
    return { ok: false, erreur: "Google Analytics est injoignable pour le moment." };
  }
}
