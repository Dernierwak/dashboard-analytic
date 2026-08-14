"use client";

import { useState, useTransition } from "react";
import { ScrollList } from "@/components/scroll-list";
import { CampaignLabelSelect } from "@/components/campaign-label-select";
import { PostLabelSelect } from "@/components/post-label-select";
import { setCampaignLanding } from "@/app/actions";
import { fmtCHF, GLYPHE, type ElementLabel } from "@/components/labels-modele";

// LES DEUX LISTES DE LA PAGE THÈMES — ce qui n'a pas d'étiquette, et ce qui en
// a une. Éditables toutes les deux, sur place.
//
// POURQUOI DEUX LISTES ET PAS UNE AVEC UN FILTRE.
// Elles ne répondent pas à la même question. La première est un TRAVAIL À
// FAIRE : elle s'ouvre, elle se vide, elle disparaît. La seconde est une
// VÉRIFICATION : on y va quand on doute d'un classement, c'est-à-dire rarement.
// Un filtre les aurait mises au même rang et aurait obligé à choisir avant de
// savoir — d'où le second bloc replié, qui ne coûte qu'une ligne tant qu'on ne
// l'ouvre pas.
//
// LE DÉFILEMENT VIENT DE `ScrollList` / `.defile`, JAMAIS D'UN SECOND
// MÉCANISME. `.defile` (app/globals.css) pose deux ombres qui S'ÉTEIGNENT
// SEULES quand le contenu ne déborde pas, et rend la barre permanente sur
// macOS où elle est invisible au repos. Une `overflow-y-auto` écrite à la main
// ici aurait tout perdu, et la liste courte aurait porté des ombres mensongères.
//
// LA `key` DÉPEND DE L'ÉTAT, ET C'EST OBLIGATOIRE.
// Poser un thème fait passer une ligne de la première liste à la seconde après
// `revalidatePath`. Sans une clé qui contient le thème et la page d'arrivée,
// React réutilise l'instance du composant client — et l'état local du champ
// « page d'arrivée » (ouvert, à moitié tapé) survit sur une AUTRE campagne.
// C'est le corollaire technique écrit noir sur blanc dans la grammaire.
function cleLigne(e: ElementLabel): string {
  return `${e.canal}:${e.cle}:${e.label ?? ""}:${e.landing ?? ""}`;
}

// LA PAGE D'ARRIVÉE D'UNE CAMPAGNE — deuxième ligne de la rangée, jamais une
// colonne. Une colonne de plus, c'est 150 px pris au nom de la campagne sur un
// écran qui en a 319 ; et l'adresse n'est pas ce qu'on vient chercher, elle se
// pose une fois puis ne bouge plus.
//
// Le lien s'ouvre dans un onglet neuf avec `noopener noreferrer` — c'est la
// page de l'utilisateur, mais on ne lui donne pas la main sur l'onglet Pulse
// pour autant. Le serveur, lui, ne la visite jamais : voir `setCampaignLanding`.
function LandingChamp({ el }: { el: ElementLabel }) {
  const [mode, setMode] = useState<"vue" | "edition">("vue");
  const [valeur, setValeur] = useState(el.landing ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canal = el.canal === "meta" ? "meta" : "google";

  const enregistrer = (brut: string) =>
    startTransition(async () => {
      const r = await setCampaignLanding(canal, el.cle, el.nom, brut);
      if (!r.ok) {
        setMessage(r.message ?? "Enregistrement impossible.");
        return;
      }
      setMessage(null);
      setValeur(r.valeur ?? "");
      setMode("vue");
    });

  if (mode === "edition") {
    return (
      <div className="mt-1.5 pl-[22px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            value={valeur}
            autoFocus
            inputMode="url"
            onChange={(e) => setValeur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") enregistrer(valeur);
              if (e.key === "Escape") {
                setMode("vue");
                setValeur(el.landing ?? "");
                setMessage(null);
              }
            }}
            placeholder="boutique.ch/velos-electriques"
            className="min-w-0 flex-1 basis-[180px] rounded-lg border border-brand bg-canvas px-2.5 py-1.5 text-[12px] text-ink outline-none"
          />
          <button
            disabled={pending}
            onClick={() => enregistrer(valeur)}
            className="shrink-0 text-[11px] font-semibold text-white bg-brand rounded-full px-3 py-1.5 disabled:opacity-40"
          >
            {pending ? "…" : "OK"}
          </button>
          <button
            onClick={() => {
              setMode("vue");
              setValeur(el.landing ?? "");
              setMessage(null);
            }}
            className="shrink-0 text-[11px] text-faint px-1.5 py-1.5"
          >
            annuler
          </button>
        </div>
        {message && <p className="text-[10.5px] text-neg mt-1">{message}</p>}
        <p className="text-[10.5px] text-faint mt-1 leading-relaxed">
          L&apos;adresse où la campagne envoie les gens. Elle sert aux conseils — elle
          est stockée, jamais visitée par Pulse.
        </p>
      </div>
    );
  }

  if (!el.landing) {
    return (
      <div className="mt-1 pl-[22px]">
        <button
          onClick={() => setMode("edition")}
          className="text-[10.5px] font-semibold text-faint hover:text-brand"
        >
          + page d&apos;arrivée
        </button>
      </div>
    );
  }

  let court = el.landing;
  try {
    const u = new URL(el.landing);
    court = `${u.host}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    /* stockée telle quelle : on l'affiche telle quelle */
  }

  return (
    <div className="mt-1 pl-[22px] flex items-baseline gap-2 min-w-0">
      <a
        href={el.landing}
        target="_blank"
        rel="noopener noreferrer nofollow"
        title={el.landing}
        className="min-w-0 truncate text-[10.5px] text-brand hover:underline"
      >
        ↗ {court}
      </a>
      <button
        onClick={() => setMode("edition")}
        className="shrink-0 text-[10.5px] text-faint hover:text-muted"
      >
        modifier
      </button>
    </div>
  );
}

// UNE LIGNE. Deux hauteurs de texte, un sélecteur, et rien d'autre : c'est un
// poste de travail, pas un tableau de bord. Le montant est là pour trancher
// l'ordre dans lequel on étiquette — on commence par ce qui coûte.
//
// `min-w-0` sur la colonne du nom, `break-words` sur le nom lui-même : un nom
// de campagne comme « CH_DE_Prospection_Q3_2026_Broad_Lookalike_1pct_v4 » est
// un seul mot pour le navigateur. Sans les deux, l'élément flex refuse de
// descendre sous la largeur de ce mot (`min-width: auto`) et c'est la PAGE qui
// se met à défiler horizontalement. C'est le bug récurrent de ce projet.
function LigneElement({ el, labels }: { el: ElementLabel; labels: string[] }) {
  const g = GLYPHE[el.canal];
  return (
    <div className="px-3 sm:px-4 py-2.5">
      <div className="flex items-start gap-2">
        <span
          className="shrink-0 text-[13px] leading-5"
          style={{ color: g.couleur }}
          title={g.nom}
        >
          {g.signe}
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink leading-snug break-words">
            {el.nom}
          </div>
          <div className="text-[10.5px] text-faint mt-0.5">
            {el.canal === "instagram" ? (
              el.sous ?? "publication"
            ) : (
              <>
                {el.depense > 0 ? (
                  <span className="font-mono">{fmtCHF(el.depense)} CHF</span>
                ) : (
                  "aucune dépense sur la fenêtre"
                )}
                {el.sous && <> · {el.sous}</>}
              </>
            )}
          </div>
        </div>

        <div className="shrink-0">
          {el.canal === "instagram" ? (
            <PostLabelSelect
              postId={el.cle}
              current={el.label}
              labels={labels}
              source={el.source}
            />
          ) : (
            <CampaignLabelSelect
              channel={el.canal}
              campaignKey={el.cle}
              campaignName={el.nom}
              current={el.label}
              labels={labels}
              source={el.source}
            />
          )}
        </div>
      </div>

      {el.canal !== "instagram" && <LandingChamp el={el} />}
    </div>
  );
}

// LA LISTE DE CE QU'IL RESTE À FAIRE.
//
// Le vide n'est pas une liste vide : c'est un état, et il porte une bonne
// nouvelle. On ne rend donc pas une boîte défilante à zéro ligne pour dire
// qu'elle est à zéro ligne — on écrit ce qui est vrai, et ce que ça permet.
export function ListeSansTheme({
  elements,
  labels,
  maxH = "max-h-[46vh]",
}: {
  elements: ElementLabel[];
  labels: string[];
  maxH?: string;
}) {
  if (elements.length === 0) {
    return (
      <div className="bg-white border border-pos/25 rounded-xl shadow-card p-5 mb-5">
        <p className="text-[14px] text-ink font-medium">
          Tout est étiqueté. <span className="text-pos">✓</span>
        </p>
        <p className="text-[12.5px] text-muted mt-1.5 leading-relaxed">
          Chaque campagne et chaque publication porte un thème : tes bilans par thème,
          tes budgets par thème et tes conseils voient l&apos;intégralité de ce que tu
          fais. Reviens ici quand tu lances quelque chose de nouveau.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <ScrollList title="Sans thème — à étiqueter" count={elements.length} maxH={maxH}>
        {elements.map((e) => (
          <LigneElement key={cleLigne(e)} el={e} labels={labels} />
        ))}
      </ScrollList>
      {labels.length === 0 && (
        <p className="text-[10.5px] text-warn mt-1.5 leading-relaxed">
          Tu n&apos;as encore aucun thème à poser — crée-en un plus bas, ou laisse
          l&apos;IA les proposer.
        </p>
      )}
    </div>
  );
}

// CE QUI EST DÉJÀ ÉTIQUETÉ — replié par défaut.
//
// Rendu `null` quand il n'y a rien : un dépliant vide n'apprend rien et fait
// croire à un chargement raté. Le cas « rien n'est encore étiqueté » se lit
// tout seul — la liste du dessus contient alors tout.
export function ListeDeja({
  elements,
  labels,
  ouvert = false,
  maxH = "max-h-[46vh]",
}: {
  elements: ElementLabel[];
  labels: string[];
  /** ouvert d'emblée — l'écran de contrôle s'en sert pour vérifier que les
   *  ombres de `.defile` s'éteignent sur une liste courte. */
  ouvert?: boolean;
  maxH?: string;
}) {
  if (elements.length === 0) return null;

  return (
    <details className="group mb-5" open={ouvert}>
      <summary className="cursor-pointer list-none flex items-center gap-2 py-1 select-none">
        <span className="text-[10px] text-faint transition-transform group-open:rotate-90">
          ▶
        </span>
        <h3 className="text-[11px] uppercase tracking-wide text-faint font-bold group-hover:text-muted">
          Déjà étiqueté <span className="text-faint/70">({elements.length})</span>
        </h3>
        <span className="ml-auto text-[10.5px] text-faint/80 group-open:hidden">
          ouvrir pour corriger
        </span>
      </summary>
      <div className="mt-2">
        <ScrollList title="" maxH={maxH}>
          {elements.map((e) => (
            <LigneElement key={cleLigne(e)} el={e} labels={labels} />
          ))}
        </ScrollList>
      </div>
    </details>
  );
}
