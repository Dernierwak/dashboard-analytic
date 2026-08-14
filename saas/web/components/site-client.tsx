"use client";

import { useState, useTransition } from "react";
import { saveSiteClient } from "@/app/actions";

// LE SITE DU CLIENT — `profiles.site_url`, écrit par `saveSiteClient`
// (`app/actions.ts`), qui porte à lui seul la validation de l'adresse.
//
// POURQUOI CE MODULE EXISTE. L'onboarding demande le site à sa dernière étape,
// et c'était jusqu'ici le SEUL endroit du produit où l'on pouvait le donner :
// un réglage qu'on ne pose qu'une fois, à l'inscription, devient faux le jour
// où le client change de domaine — et quelqu'un qui a sauté l'étape n'avait
// aucun chemin de retour. Un réglage sans écran est un réglage qui pourrit.
//
// Le module suit la grammaire (docs/03-grammaire-des-modules.md) :
//
//   rang 1  titre de lecture — on le LIT : il porte une décision et deux
//           phrases qui expliquent pourquoi on la demande ;
//   rang 2  la sortie, à droite du titre — le lien qui ouvre le site. Il ne
//           paraît que si une adresse est enregistrée, et c'est la seule
//           vérification possible depuis Pulse : le serveur, lui, ne visite
//           jamais cette page (voir le rang 9) ;
//   rang 3  LE chiffre. Il n'est pas un nombre ici, et c'est voulu — c'est le
//           DOMAINE lui-même, la seule chose que le module a à dire. Le mono,
//           qui sert à aligner des chiffres entre eux, n'alignerait rien.
//           Le reste de la règle tient : premier élément, le plus gros, aucune
//           forme avant lui. Sans adresse, le vide se dit en toutes lettres —
//           jamais un tiret, jamais un champ seul qui laisse deviner ;
//   rang 7  le détail — À QUOI ÇA SERT. Au milieu d'une page de connexions, un
//           champ « ton site » sans cette phrase ressemble à un réglage
//           administratif sans objet, et personne ne remplit ça. Elle est
//           APRÈS le chiffre, pas avant : l'ordre des rangs ne se négocie pas ;
//   rang 8  le pilotage, EN BAS — le champ, qui change ce que le module montre ;
//   rang 9  un seul pied, et il dit la limite réelle : on stocke l'adresse, on
//           ne la visite pas. C'est ce qui rend le module honnête — sans ça, on
//           laisse croire que Pulse va lire la page et en tirer des conseils.
//
// CE QUI EST AFFICHÉ AU RANG 3 VIENT DU SERVEUR, JAMAIS DU CHAMP.
// `jour-recolte` bouge sa date d'abord et revient en arrière si l'action
// refuse : il peut se le permettre, ses sept valeurs sont un ensemble fermé et
// l'affichage ne peut pas mentir. Ici la saisie est libre — « boutique.ch » est
// stocké « https://boutique.ch/ ». L'afficher tel que tapé montrerait une
// valeur que la base ne contient pas. On attend donc le `valeur` que renvoie
// l'action : le rang 3 ne dit que ce qui est écrit.

/** Ce qu'on montre d'une adresse : le domaine, et de quoi l'ouvrir. */
function lire(u: string | null): { hote: string; href: string | null; reste: string | null } {
  if (!u) return { hote: "", href: null, reste: null };
  try {
    const x = new URL(u);
    // `urlPropre` n'accepte que http/https — mais une valeur arrivée en base
    // autrement ne doit pas devenir un lien cliquable pour autant.
    if (x.protocol !== "http:" && x.protocol !== "https:")
      return { hote: u, href: null, reste: null };
    const reste = (x.pathname === "/" ? "" : x.pathname) + x.search;
    return { hote: x.hostname.replace(/^www\./, ""), href: x.toString(), reste: reste || null };
  } catch {
    return { hote: u, href: null, reste: null };
  }
}

export function SiteClient({
  url,
}: {
  /** Valeur en base (`profiles.site_url`), ou null si le client n'en a pas. */
  url: string | null;
}) {
  const [enregistre, setEnregistre] = useState<string | null>(url);
  const [valeur, setValeur] = useState(url ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, demarrer] = useTransition();

  const vu = lire(enregistre);
  const inchange = valeur.trim() === (enregistre ?? "");

  const soumettre = () => {
    if (pending || inchange) return;
    setErreur(null);
    demarrer(async () => {
      // Une action serveur qui LÈVE (session expirée, réseau coupé) rejette la
      // promesse sans jamais passer par `r.ok` : sans ce `catch`, le module
      // resterait muet et la seule trace serait une « unhandled rejection »
      // dans la console.
      try {
        const r = await saveSiteClient(valeur);
        if (!r.ok) {
          setErreur(r.message ?? "L'enregistrement a échoué.");
          return;
        }
        const propre = r.valeur ?? null;
        setEnregistre(propre);
        setValeur(propre ?? "");
      } catch {
        setErreur(
          "L'enregistrement n'est pas passé. Recharge la page — si ta session a expiré, " +
            "il faudra te reconnecter."
        );
      }
    });
  };

  return (
    <section className="bg-white border border-line rounded-xl shadow-card p-5 mb-5">
      {/* rang 1 · rang 2 */}
      {/* Sur téléphone le titre prend sa ligne entière et la sortie passe
          dessous — même contrainte que `jour-recolte` à 375 px. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5 mb-4">
        <h2 className="w-full sm:w-auto font-serif text-[19px] sm:text-[21px] leading-tight text-ink flex items-center gap-2.5">
          <span className="inline-block h-[18px] w-[3px] rounded-full bg-brand shrink-0" aria-hidden />
          Ton site.
        </h2>
        {vu.href && (
          <a
            href={vu.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-semibold text-brand hover:underline whitespace-nowrap shrink-0"
          >
            ouvrir ↗
          </a>
        )}
      </div>

      {/* rang 3 — le domaine, ou le vide écrit en toutes lettres */}
      {enregistre ? (
        <div className="text-[26px] sm:text-[32px] leading-none font-semibold tracking-tight text-ink break-all">
          {vu.hote}
        </div>
      ) : (
        <div className="text-[22px] sm:text-[26px] leading-none font-semibold tracking-tight text-faint">
          Aucun site enregistré
        </div>
      )}
      {enregistre && vu.reste && (
        <p className="font-mono text-[11.5px] text-faint mt-2 break-all">{vu.reste}</p>
      )}

      {/* rang 7 — à quoi il sert */}
      <p className="text-[12.5px] text-muted leading-relaxed mt-3 max-w-[62ch]">
        {enregistre ? (
          <>
            C&apos;est ce qui donne un sens à tes chiffres :{" "}
            <span className="font-semibold text-ink">ce que tu vends, à quel prix, dans quelle
            langue</span> — tout ce que le nom d&apos;une campagne ne dit pas. Sans lui, un conseil
            parle de CPC ; avec lui, il parle de tes produits.
          </>
        ) : (
          <>
            Le domaine suffit. Il dit{" "}
            <span className="font-semibold text-ink">ce que tu vends, à quel prix, dans quelle
            langue</span> — tout ce que le nom d&apos;une campagne ne dit pas. C&apos;est ce qui
            sépare un conseil qui parle de CPC d&apos;un conseil qui parle de tes produits. Pas de
            site ? Laisse vide, rien ne s&apos;en trouve cassé.
          </>
        )}
      </p>

      {/* rang 8 — le pilotage, en bas */}
      <div className="mt-5 pt-4 border-t border-line">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-widest text-faint font-bold">
            {enregistre ? "Changer d'adresse" : "Ajouter ton adresse"}
          </span>
          {pending && <span className="text-[10.5px] text-faint">enregistrement…</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="url"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            disabled={pending}
            value={valeur}
            onChange={(e) => {
              setValeur(e.target.value);
              if (erreur) setErreur(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") soumettre();
            }}
            placeholder="boutique-du-velo.ch"
            aria-label="Adresse de ton site"
            aria-invalid={Boolean(erreur)}
            className={`min-w-0 flex-1 text-[13.5px] text-ink rounded-lg border px-3 py-2 outline-none transition-colors placeholder:text-faint disabled:opacity-60 ${
              erreur ? "border-neg focus:border-neg" : "border-line focus:border-brand"
            }`}
          />
          <button
            type="button"
            onClick={soumettre}
            disabled={pending || inchange}
            className="shrink-0 rounded-lg bg-ink text-white text-[12.5px] font-semibold px-4 py-2 transition-colors hover:bg-ink/90 disabled:opacity-40"
          >
            Enregistrer
          </button>
        </div>
        {/* Le champ vidé n'est pas une erreur : c'est le geste qui retire le
            site. On le dit, sinon il ressemble à une saisie qu'on a oublié de
            finir et le bouton actif fait peur. */}
        {!erreur && enregistre && !valeur.trim() && (
          <p className="text-[11.5px] text-muted mt-2.5 leading-relaxed">
            Champ vide — enregistrer retirera ton site.
          </p>
        )}
        {erreur && (
          <p role="alert" className="text-[12px] text-neg mt-2.5 leading-relaxed">
            {erreur}
          </p>
        )}
      </div>

      {/* rang 9 — un seul pied, et il dit la limite */}
      <p className="text-[11px] text-faint mt-4 leading-relaxed">
        Pulse enregistre cette adresse, il ne la visite pas : aucune page de ton site n&apos;est
        lue, ni maintenant ni pendant la récolte. Elle sert de contexte à tes conseils, rien de
        plus.
      </p>
    </section>
  );
}
