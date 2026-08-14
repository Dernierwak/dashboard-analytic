// Comptes — brancher Meta et Google sur Pulse, sans jamais passer par l'ancienne app.
//
// La page suit une seule idée : une autorisation accordée n'est pas une source
// de données branchée. Entre « j'ai dit oui à Google » et « je vois enfin si ma
// pub rapporte », il reste deux choix que personne ne devine seul — le compte
// publicitaire et la propriété Analytics. Chacun a donc son étape, visible,
// nommée, et rattrapable si on l'a sautée.

import Link from "next/link";
import { getCompteActif } from "@/lib/account";
import { getConnexions, type EtatCanal } from "@/lib/connexions";
import { createClient } from "@/lib/supabase/server";
import { JETON_META, lireJetonTransit } from "@/lib/oauth";
import {
  accessTokenGoogle,
  comptesGoogleAds,
  pagesFacebook,
  proprietesGa4,
  type Resultat,
} from "@/lib/oauth-api";
import { ChoixCompte } from "@/components/choix-compte";
import { DeconnecterBouton } from "@/components/deconnecter-bouton";
import { FetchButton } from "@/components/fetch-button";
import { JourRecolte } from "@/components/jour-recolte";
import { connecterMeta, choisirCompteGoogle, choisirProprieteGa4 } from "./actions";

export const dynamic = "force-dynamic";

// ATTENTION en modifiant cette page : les actions ci-dessus se passent à
// `ChoixCompte` TELLES QUELLES, jamais enveloppées.
//
//   action={choisirCompteGoogle}        ✅
//   action={(id) => choisirCompteGoogle(id)}   ❌ plante la page
//
// `ChoixCompte` est un composant client ; une fonction ne franchit la frontière
// que si c'est une action serveur, reconnaissable comme telle. Une flèche créée
// ici est une fonction ordinaire — React ne peut pas la sérialiser et la page
// entière tombe en « server-side exception ». Le piège est que TypeScript
// l'accepte et que le build passe : ça ne se voit qu'à l'exécution, et
// seulement quand la liste de choix s'affiche.

// Une erreur OAuth brute ne dit rien à personne. Chaque code porte ici une
// phrase qui nomme la cause ET le geste qui la corrige.
const ERREURS: Record<string, string> = {
  session: "Ta session a expiré pendant la connexion. Reconnecte-toi, puis recommence.",
  state:
    "Le retour n'a pas pu être vérifié — le lien a expiré, ou il a été ouvert dans " +
    "un autre navigateur que celui où tu as commencé. Relance la connexion depuis cette page.",
  code_manquant: "Le fournisseur n'a renvoyé aucun code d'autorisation. Recommence.",
  refus_meta: "Tu as refusé l'autorisation sur Facebook. Rien n'a été enregistré.",
  refus_google: "Tu as refusé l'autorisation sur Google. Rien n'a été enregistré.",
  config_meta:
    "La connexion Meta n'est pas encore configurée côté serveur (identifiants de " +
    "l'application absents). Rien à faire de ton côté.",
  config_google:
    "La connexion Google n'est pas encore configurée côté serveur (identifiants de " +
    "l'application absents). Rien à faire de ton côté.",
  echange_meta:
    "Facebook a refusé l'échange du code. Le plus souvent, l'autorisation a expiré " +
    "entre-temps — relance-la.",
  long_token_meta:
    "Facebook a accordé l'accès mais refuse de le prolonger à 60 jours. Cause n°1 : " +
    "l'application Meta est en mode développement et ton compte n'y est pas déclaré " +
    "comme testeur (App Dashboard → Rôles).",
  pas_de_refresh:
    "Google n'a pas redélivré de jeton durable — ça arrive quand le compte a déjà " +
    "autorisé Pulse par le passé. Va sur myaccount.google.com → Sécurité → Accès des " +
    "applications tierces, retire Pulse, puis reconnecte ici.",
  sauvegarde_google:
    "La connexion Google a réussi mais l'enregistrement a échoué. Relance-la : rien " +
    "n'est perdu de ton côté.",
  reseau_meta: "Facebook est injoignable pour le moment. Réessaie dans un instant.",
  reseau_google: "Google est injoignable pour le moment. Réessaie dans un instant.",
};

function Pastille({ ok }: { ok: boolean }) {
  return (
    <span
      className={`h-2 w-2 rounded-full shrink-0 ${ok ? "bg-pos" : "bg-black/[0.15]"}`}
      aria-hidden
    />
  );
}

function LigneCanal({ c }: { c: EtatCanal }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-line last:border-b-0">
      <span className="mt-1.5">
        <Pastille ok={c.connecte} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13.5px] font-semibold text-ink">{c.nom}</span>
          {c.connecte ? (
            <span className="text-[11.5px] text-pos font-semibold">connecté</span>
          ) : (
            <span className="text-[11.5px] text-faint">à brancher</span>
          )}
          {c.connecte && c.detail && (
            <span className="font-mono text-[11px] text-faint truncate">{c.detail}</span>
          )}
        </div>
        <p className="text-[12px] text-muted leading-relaxed mt-0.5">
          {c.connecte ? c.apporte : (c.manque ?? c.apporte)}
        </p>
      </div>
    </div>
  );
}

export default async function ComptesPage({
  searchParams,
}: {
  searchParams: { erreur?: string; meta?: string; google?: string };
}) {
  const compte = await getCompteActif();

  // Les jetons d'accès sont la seule chose que le partage d'équipe n'expose
  // pas. L'interface tient la même ligne que la base : depuis le dashboard de
  // quelqu'un d'autre, cette page ne montre rien.
  if (compte.uid !== compte.moi) {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 lg:py-9">
        <h1 className="font-serif text-3xl leading-tight text-ink mb-3">Tes connexions.</h1>
        <div className="bg-white border border-line rounded-xl shadow-card p-6">
          <p className="text-[13.5px] text-ink font-medium">
            Tu regardes le compte de quelqu&apos;un d&apos;autre.
          </p>
          <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
            Les connexions publicitaires ne se gèrent que depuis son propre compte — c&apos;est
            ce qui garantit qu&apos;une personne invitée voit tes chiffres, jamais de quoi
            agir sur tes comptes. Repasse sur{" "}
            <span className="font-semibold text-ink">Mon compte</span> dans la colonne de
            gauche.
          </p>
        </div>
      </main>
    );
  }

  const cx = await getConnexions(compte.moi);
  const erreur = searchParams.erreur ? ERREURS[searchParams.erreur] ?? null : null;

  // Le jour de récolte vit sur le PROFIL (`profiles.fetch_schedule`) : c'est la
  // colonne que lit `_due_today` dans le worker. Une lecture ratée ne doit pas
  // emporter la page — on retombe sur le même défaut que lui, lundi, plutôt que
  // de faire disparaître le réglage.
  let jourRecolte = "Monday";
  try {
    const r = await createClient()
      .from("profiles")
      .select("fetch_schedule")
      .eq("id", compte.moi)
      .limit(1);
    jourRecolte = (r.data?.[0]?.fetch_schedule as string | null) || "Monday";
  } catch {
    jourRecolte = "Monday";
  }

  // ── Les étapes en attente ────────────────────────────────────────────────
  // On les déduit de l'état réel, pas seulement du paramètre d'URL : quelqu'un
  // qui a fermé l'onglet au milieu doit retrouver son étape en revenant ici.

  const jetonMeta = lireJetonTransit(JETON_META);
  const choixPages: Resultat | null =
    jetonMeta && !cx.canaux[0].connecte ? await pagesFacebook(jetonMeta) : null;

  let choixAds: Resultat | null = null;
  let choixGa4: Resultat | null = null;
  const besoinAds = cx.canaux[2].connecte === false;
  const besoinGa4 = cx.canaux[3].connecte === false;

  if (besoinAds || besoinGa4) {
    try {
      const supabase = createClient();
      const r = await supabase
        .from("connected_accounts")
        .select("google_refresh_token")
        .eq("user_id", compte.moi)
        .eq("provider", "google")
        .limit(1);
      const refresh = r.data?.[0]?.google_refresh_token as string | null | undefined;
      if (refresh) {
        const access = await accessTokenGoogle(refresh);
        if (access) {
          if (besoinAds) choixAds = await comptesGoogleAds(access);
          if (besoinGa4) choixGa4 = await proprietesGa4(access);
        }
      }
    } catch (e) {
      // Cette page est le SEUL endroit d'où l'on peut réparer une connexion.
      // Si elle tombe, il n'y a plus aucun chemin de sortie : ni reconnecter,
      // ni déconnecter, ni même lire l'état. Une étape qui échoue perd donc son
      // encadré, pas la page.
      const m = (e as Error)?.message ?? "cause inconnue";
      if (besoinAds) choixAds = { ok: false, erreur: `Impossible de lister tes comptes Google Ads (${m}).` };
      if (besoinGa4) choixGa4 = { ok: false, erreur: `Impossible de lister tes propriétés Analytics (${m}).` };
    }
  }

  const restants = cx.canaux.filter((c) => !c.connecte).length;

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-6 lg:py-9">
      <div className="mb-7">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          Sources de données
        </p>
        <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
          Tes connexions.
        </h1>
        <p className="text-[13px] text-muted mt-2 leading-relaxed max-w-[68ch]">
          Pulse ne récolte que ce que tu l&apos;autorises à lire, et seulement en
          lecture — il ne peut ni modifier ni lancer une campagne.{" "}
          {restants === 0 ? (
            <span className="font-semibold text-pos">Tout est branché.</span>
          ) : (
            <>
              Il reste{" "}
              <span className="font-semibold text-ink">
                {restants} source{restants > 1 ? "s" : ""}
              </span>{" "}
              à brancher.
            </>
          )}
        </p>
      </div>

      {erreur && (
        <div className="mb-5 rounded-xl border border-neg/25 bg-neg/[0.04] px-4 py-3">
          <div className="text-[10px] uppercase tracking-widest text-neg font-bold mb-1">
            La connexion s&apos;est arrêtée
          </div>
          <p className="text-[12.5px] text-ink leading-relaxed">{erreur}</p>
        </div>
      )}

      {/* ── Étape en cours, s'il y en a une ───────────────────────────────── */}

      {choixPages?.ok && choixPages.choix.length > 0 && (
        <ChoixCompte
          titre="Quelle Page Facebook ?"
          aide={
            "C'est elle qui porte ton compte Instagram professionnel — on en déduit " +
            "automatiquement les publications à suivre."
          }
          choix={choixPages.choix}
          action={connecterMeta}
          libelleBouton="Connecter cette Page"
        />
      )}

      {choixPages?.ok && choixPages.choix.length === 0 && (
        <div className="mb-5 rounded-xl border border-warn/25 bg-warn/[0.05] px-4 py-3">
          <p className="text-[12.5px] text-ink leading-relaxed">
            <span className="font-semibold">Aucune Page Facebook trouvée.</span> Deux causes
            possibles : ton compte Instagram professionnel n&apos;est pas relié à une Page,
            ou tu n&apos;es administrateur de cette Page que via un Business Manager sans
            accès direct.
          </p>
        </div>
      )}

      {besoinAds && choixAds && (
        choixAds.ok ? (
          <ChoixCompte
            titre="Quel compte Google Ads ?"
            aide="Celui qui porte les campagnes que tu veux suivre dans Pulse."
            choix={choixAds.choix}
            action={choisirCompteGoogle}
            libelleBouton="Suivre ce compte"
          />
        ) : (
          <div className="mb-5 rounded-xl border border-warn/25 bg-warn/[0.05] px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-warn font-bold mb-1">
              Google Ads
            </div>
            <p className="text-[12.5px] text-ink leading-relaxed">{choixAds.erreur}</p>
          </div>
        )
      )}

      {besoinGa4 && choixGa4 && (
        choixGa4.ok ? (
          <ChoixCompte
            titre="Quelle propriété Google Analytics ?"
            aide={
              "Celle de ton site. C'est la seule source qui sait ce que deviennent tes " +
              "visiteurs — sans elle, on voit ce que la pub coûte, jamais ce qu'elle rapporte."
            }
            choix={choixGa4.choix}
            action={choisirProprieteGa4}
            libelleBouton="Suivre cette propriété"
          />
        ) : (
          <div className="mb-5 rounded-xl border border-warn/25 bg-warn/[0.05] px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-warn font-bold mb-1">
              Google Analytics
            </div>
            <p className="text-[12.5px] text-ink leading-relaxed">{choixGa4.erreur}</p>
          </div>
        )
      )}

      {/* ── L'état des quatre sources ─────────────────────────────────────── */}

      <div className="bg-white border border-line rounded-xl shadow-card overflow-hidden mb-5">
        {cx.canaux.map((c) => (
          <LigneCanal key={c.cle} c={c} />
        ))}
      </div>

      {/* ── Les deux gestes ───────────────────────────────────────────────── */}

      <div className="grid gap-3 sm:grid-cols-2 mb-8">
        <div className="bg-white border border-line rounded-xl shadow-card p-4">
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <span className="text-[13px] font-semibold text-ink">Meta</span>
            {cx.canaux[0].connecte && <DeconnecterBouton canal="meta" nom="Meta" />}
          </div>
          <p className="text-[12px] text-muted leading-relaxed mb-3">
            Campagnes Facebook et Instagram, plus tes publications.
          </p>
          <a
            href="/api/oauth/meta/start"
            className={`inline-block text-[12.5px] font-semibold rounded-full px-4 py-2 transition-colors ${
              cx.canaux[0].connecte
                ? "text-brand border border-brand/30 hover:bg-brand/[0.06]"
                : "text-white bg-brand hover:bg-brand/90"
            }`}
          >
            {cx.canaux[0].connecte ? "Reconnecter" : "Connecter Meta"}
          </a>
        </div>

        <div className="bg-white border border-line rounded-xl shadow-card p-4">
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <span className="text-[13px] font-semibold text-ink">Google</span>
            {cx.canaux[2].connecte && <DeconnecterBouton canal="google" nom="Google" />}
          </div>
          <p className="text-[12px] text-muted leading-relaxed mb-3">
            Google Ads et Analytics — une seule autorisation pour les deux.
          </p>
          <a
            href="/api/oauth/google/start"
            className={`inline-block text-[12.5px] font-semibold rounded-full px-4 py-2 transition-colors ${
              cx.canaux[2].connecte
                ? "text-brand border border-brand/30 hover:bg-brand/[0.06]"
                : "text-white bg-brand hover:bg-brand/90"
            }`}
          >
            {cx.canaux[2].connecte ? "Reconnecter" : "Connecter Google"}
          </a>
        </div>
      </div>

      {/* ── Quand on va les lire ──────────────────────────────────────────── */}
      {/* Placé ICI, entre « branche tes sources » et « lance une récolte » :
          l'ordre de lecture de la page devient brancher → décider quand on lit
          → lire tout de suite si on ne veut pas attendre. La `key` force le
          remontage après `revalidatePath` : sans elle, l'état local du
          composant survivrait à la réécriture et les deux divergeraient. */}
      <JourRecolte
        key={jourRecolte}
        jour={jourRecolte}
        maintenantIso={new Date().toISOString()}
      />

      {/* ── La suite ──────────────────────────────────────────────────────── */}

      <div id="recolter" className="scroll-mt-16 rounded-xl border border-line bg-black/[0.015] p-4">
        <div className="text-[11px] uppercase tracking-wide text-faint font-bold mb-1.5">
          {restants === 0 ? "Et maintenant" : "Une fois tout branché"}
        </div>
        <p className="text-[12.5px] text-muted leading-relaxed mb-3">
          La récolte va chercher l&apos;historique de chaque source et écrit ton rapport.
          Compte 5 à 8 minutes ; tu peux fermer la page, elle continue de son côté.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <FetchButton />
          <Link href="/" className="text-[12.5px] font-semibold text-brand hover:underline">
            Voir mon rapport →
          </Link>
        </div>
      </div>

      <p className="text-[11px] text-faint mt-5 leading-relaxed">
        Tes jetons d&apos;accès ne sont jamais partagés, même avec une personne invitée sur
        ton dashboard — voir{" "}
        <Link href="/equipe" className="text-brand font-semibold hover:underline">
          Équipe
        </Link>
        .
      </p>
    </main>
  );
}
