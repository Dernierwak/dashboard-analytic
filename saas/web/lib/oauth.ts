import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

// Le socle des deux parcours OAuth (Meta et Google), écrit une fois.
//
// Trois règles tiennent tout le reste :
//
//  1. RIEN DE SENSIBLE NE PASSE PAR L'URL. Un jeton dans une query string se
//     retrouve dans l'historique du navigateur, dans les journaux du serveur et
//     dans le Referer envoyé au site suivant. Les jetons en transit vivent donc
//     dans des cookies httpOnly de courte durée, que le navigateur renvoie mais
//     que le JavaScript de la page ne peut pas lire.
//
//  2. LE `state` EST UN NONCE À USAGE UNIQUE. On tire un nombre aléatoire, on le
//     pose en cookie ET on l'envoie au fournisseur ; au retour, les deux doivent
//     coïncider. Sans ça, n'importe qui peut fabriquer un lien de callback et
//     faire rattacher SES comptes publicitaires au dashboard de quelqu'un
//     d'autre. Pas besoin de signature HMAC ici : on ne transporte aucune donnée
//     dans le state, seulement une preuve que le retour vient bien du départ
//     qu'on a initié.
//
//  3. L'URL DE REDIRECTION EST FIXE. Meta et Google exigent qu'elle corresponde
//     au caractère près à celle déclarée dans leur console. La déduire de la
//     requête casserait dès le premier déploiement de préversion Vercel, dont le
//     domaine change à chaque commit.

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://dashboard-analytic-green.vercel.app"
).replace(/\/$/, "");

export type Fournisseur = "meta" | "google";

export function redirectUri(f: Fournisseur): string {
  return `${APP_URL}/api/oauth/${f}/callback`;
}

export function urlApp(chemin = "/"): string {
  return `${APP_URL}${chemin}`;
}

// ── Le state, aller et retour ───────────────────────────────────────────────

const cookieEtat = (f: Fournisseur) => `pulse_oauth_${f}`;

export function nouvelEtat(f: Fournisseur): string {
  const nonce = randomBytes(24).toString("base64url");
  cookies().set(cookieEtat(f), nonce, {
    httpOnly: true,
    secure: APP_URL.startsWith("https"),
    sameSite: "lax", // « lax » et pas « strict » : le cookie doit survivre au
    path: "/",       // retour depuis facebook.com ou accounts.google.com
    maxAge: 600,     // 10 minutes — le temps d'un consentement, pas plus
  });
  return nonce;
}

export function verifierEtat(f: Fournisseur, recu: string | null): boolean {
  const attendu = cookies().get(cookieEtat(f))?.value;
  cookies().delete(cookieEtat(f));
  if (!attendu || !recu) return false;
  return attendu === recu;
}

// ── Les jetons en transit ───────────────────────────────────────────────────
// Entre le callback (qui obtient le jeton) et le choix du compte (qui a besoin
// du jeton pour interroger l'API), il faut bien le garder quelque part. Un
// cookie httpOnly de 15 minutes est le moindre mal : jamais lisible par la
// page, jamais écrit en base tant que l'utilisateur n'a pas confirmé son choix.

export function poserJetonTransit(nom: string, valeur: string): void {
  cookies().set(nom, valeur, {
    httpOnly: true,
    secure: APP_URL.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 900,
  });
}

export function lireJetonTransit(nom: string): string | null {
  return cookies().get(nom)?.value ?? null;
}

export function effacerJetonTransit(nom: string): void {
  cookies().delete(nom);
}

export const JETON_META = "pulse_meta_transit";
export const JETON_GOOGLE = "pulse_google_transit";

// ── Retour vers /comptes avec un message lisible ────────────────────────────
// Une erreur OAuth brute (« error_description=invalid_grant ») ne dit rien à
// personne. On transporte un CODE court, et la page /comptes le traduit en une
// phrase qui dit quoi faire — c'est elle qui détient les explications.

export function retourComptes(params: Record<string, string>): string {
  const q = new URLSearchParams(params).toString();
  return urlApp(`/comptes${q ? `?${q}` : ""}`);
}

// ── Réglages lus dans l'environnement ───────────────────────────────────────
// Absents en développement local : on veut le dire clairement plutôt que de
// laisser partir une requête vers Meta avec un client_id vide.

export function reglagesMeta(): { appId: string; appSecret: string } | null {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export function reglagesGoogle(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export const META_API = "v24.0";
