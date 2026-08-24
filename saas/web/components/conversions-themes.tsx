"use client";

import { useState, useTransition } from "react";
import { saveThemeObjectif, setThemeEvent } from "@/app/actions";
import type { ThemesObjectifsData, ThemeObjectifRow, EvenementCatalogue } from "@/lib/channels";
import { ObjectifSelect } from "@/components/objectif-select";

// « NOS THÈMES PRINCIPAUX » — module 1 de /conversions.
//
// REPREND `objectif-par-theme.tsx` (ex-module de /labels), DÉPLACÉ ICI :
// même données (`getThemeObjectifs`), même sélecteur d'objectif, même server
// actions (`saveThemeObjectif`, `setThemeEvent`) — seule la FORME change :
//   · des cartes qui défilent horizontalement (`.defile-x`, même patron que
//     les conseils d'un thème sur `theme-card.tsx`) au lieu d'un accordéon
//     vertical — il n'y a que quelques thèmes prioritaires à la fois, une
//     rangée les montre tous sans repli ;
//   · UN CLIC SÉLECTIONNE OU DÉSÉLECTIONNE UNE CONVERSION, POINT. L'ancien
//     couple principal/secondaire (une étoile à retirer d'un événement pour
//     en étoiler un autre) devient un choix binaire : coché = suivi comme
//     conversion de ce thème, décoché = retiré. En base ça reste la même
//     ligne `theme_ga4_events` (rang 'principal' ou absence de ligne) — le
//     worker n'a jamais eu besoin d'exclusivité, `_theme_ga4` agrège déjà
//     TOUS les événements `rang='principal'` d'un thème ;
//   · les conversions disponibles se lisent PAR CATÉGORIE, en sections
//     repliables — retour direct de David après usage réel : catégoriser
//     n'a plus lieu ICI (voir `components/conversions-catalogue.tsx`, module
//     séparé qui couvre TOUT le catalogue, pas seulement ce qui est déjà
//     coché sur un thème), donc la catégorie n'est plus qu'une LECTURE dans
//     cette carte — un regroupement, pas un sélecteur. Chaque section porte
//     un bouton « tout sélectionner »/« tout désélectionner » qui coche ou
//     décoche toute la catégorie d'un coup ; les conversions sans catégorie
//     restent visibles dans leur propre section, jamais masquées.
//
// UNIQUEMENT LES THÈMES PRIORITAIRES (POUR L'INSTANT) : `getThemeObjectifs`
// ne renvoie que le sous-ensemble étoilé, comme avant. `getThemeEvenements`
// (dont `d` dépend indirectement) couvre déjà TOUS les thèmes — l'architecture
// n'a donc pas besoin de changer pour ouvrir un jour cette sélection aux
// thèmes non-prioritaires, seule l'UI reste volontairement restreinte en v1.

const OBJ_OPTIONS: { value: "" | "ventes" | "notoriete" | "engagement"; label: string }[] = [
  { value: "", label: "Hérite de l'objectif du compte" },
  { value: "ventes", label: "Plus de ventes / contacts" },
  { value: "notoriete", label: "Plus de notoriété / portée" },
  { value: "engagement", label: "Plus d'engagement" },
];

const OBJ_LABEL: Record<string, string> = {
  ventes: "Plus de ventes / contacts",
  notoriete: "Plus de notoriété / portée",
  engagement: "Plus d'engagement",
};

export function ConversionsThemesModule({
  d,
  categories,
  parEvenement,
}: {
  d: ThemesObjectifsData;
  categories: string[];
  /** { nom d'événement → catégorie }, tenu par le module 2 juste en dessous. */
  parEvenement: Record<string, string>;
}) {
  const compteMot = d.accountObjectif ? OBJ_LABEL[d.accountObjectif] ?? "non défini" : "non défini";
  // Rang 3 du module : combien de conversions sont suivies, tous thèmes
  // prioritaires confondus — le compteur que ce module alimente pour la page.
  const totalSelectionnees = d.themes.reduce((acc, t) => acc + t.principaux.length, 0);

  return (
    <section className="bg-white border border-line rounded-2xl shadow-card px-4 sm:px-5 py-4 mb-5">
      <div className="text-[10px] uppercase tracking-widest text-faint font-bold mb-2">
        Nos thèmes principaux
      </div>

      {d.migrationManquante && (
        <p className="text-[12.5px] text-neg leading-relaxed mb-3 max-w-[70ch]">
          Le tableau des objectifs et des conversions par thème n&apos;existe pas encore dans ta
          base — <span className="font-semibold">aucun réglage propre ne peut être enregistré</span>.
          Joue{" "}
          <code className="font-mono text-[11.5px]">supabase/migrations/000_run_me_all.sql</code>{" "}
          dans Supabase → SQL editor, puis recharge cette page. Ce fichier est rejouable sans
          risque.
        </p>
      )}

      {/* Rang 3 — le chiffre : combien de conversions sont suivies. */}
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
          {totalSelectionnees}
        </span>
        <span
          className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
          style={{
            color: totalSelectionnees > 0 ? "#1a7a4a" : "#5a5d66",
            background: totalSelectionnees > 0 ? "#1a7a4a14" : "#5a5d6614",
          }}
        >
          {totalSelectionnees > 0 ? "conversions sélectionnées" : "aucune sélectionnée"}
        </span>
      </div>
      <p className="text-[12px] text-muted mt-2 leading-snug">
        Vous avez {totalSelectionnees} conversion{totalSelectionnees > 1 ? "s" : ""} sélectionnée
        {totalSelectionnees > 1 ? "s" : ""}, sur tes {d.themes.length} thème
        {d.themes.length > 1 ? "s" : ""} principa{d.themes.length > 1 ? "ux" : "l"}.
      </p>

      {/* L'OBJECTIF DU COMPTE, À CÔTÉ DE CEUX PAR THÈME — UN SEUL ENDROIT POUR
          TOUS LES RÉGLAGES D'OBJECTIF. Il vivait dans le rapport hebdomadaire
          (`<ObjectifSelect>`, éditable, dans l'ancienne carte `ObjectifTheme`) ;
          le rapport est maintenant STRICTEMENT EN LECTURE (voir
          `theme-objectif-mini.tsx`), donc ce réglage devait déménager quelque
          part — ici, juste au-dessus des objectifs PAR THÈME qu'il sert de
          défaut : « Hérite du compte » (visible plus bas, dans chaque carte)
          n'a de sens que si on peut voir ET changer ce que « le compte » veut
          dire, au même endroit. */}
      <div className="mt-3 rounded-xl border border-line bg-black/[0.02] px-3.5 py-3 flex items-center gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
            L&apos;objectif du compte
          </div>
          <p className="text-[11px] text-faint leading-relaxed max-w-[46ch]">
            Le DÉFAUT hérité par tout thème sans réglage propre. Pris en compte à la prochaine
            publication du rapport.
          </p>
        </div>
        <div className="ml-auto shrink-0">
          <ObjectifSelect current={d.accountObjectif} />
        </div>
      </div>

      {d.themes.length === 0 && !d.migrationManquante && (
        <p className="text-[12.5px] mt-3 leading-relaxed rounded-xl bg-black/[0.02] px-3 py-3 text-muted">
          Aucun thème étoilé pour l&apos;instant. Marque une priorité sur{" "}
          <a href="/labels" className="text-brand font-semibold hover:underline">
            ◫ Thèmes
          </a>{" "}
          — il apparaîtra ici avec son propre objectif et ses conversions à choisir.
        </p>
      )}

      {/* Le défilement horizontal — même patron que les conseils d'un thème
          (`theme-card.tsx`) : `.defile-x`, `snap-x snap-mandatory`, une
          largeur fixe par carte. */}
      {d.themes.length > 0 && (
        <div className="defile-x -mx-1 px-1 pb-1.5 mt-4 snap-x snap-mandatory">
          <div className="flex gap-3 items-stretch w-max">
            {d.themes.map((t) => (
              <div key={t.label} className="w-[320px] sm:w-[360px] shrink-0 snap-start">
                <CarteTheme t={t} d={d} compteMot={compteMot} categories={categories} parEvenement={parEvenement} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CarteTheme({
  t,
  d,
  compteMot,
  categories,
  parEvenement,
}: {
  t: ThemeObjectifRow;
  d: ThemesObjectifsData;
  compteMot: string;
  categories: string[];
  parEvenement: Record<string, string>;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectionne = (nom: string) => t.principaux.includes(nom);

  const basculer = (nom: string) =>
    startTransition(async () => {
      const r = await setThemeEvent(t.label, nom, selectionne(nom) ? null : "principal");
      setMessage(r.ok ? null : r.message ?? null);
    });

  const poserObjectif = (v: string) =>
    startTransition(async () => {
      const r = await saveThemeObjectif(
        t.label,
        (v || null) as "ventes" | "notoriete" | "engagement" | null
      );
      setMessage(r.ok ? null : r.message ?? null);
    });

  // Coche ou décoche TOUTE une catégorie d'un coup — un clic plutôt qu'un par
  // conversion. Séquentiel (pas `Promise.all`) : plusieurs upserts concurrents
  // sur la même ligne `theme_ga4_events` n'ont aucune raison de mal se passer,
  // mais un échec au milieu doit s'arrêter net plutôt que de continuer à
  // écrire sur une erreur déjà signalée.
  const basculerGroupe = (noms: string[], cible: boolean) =>
    startTransition(async () => {
      for (const nom of noms) {
        if (selectionne(nom) === cible) continue;
        const r = await setThemeEvent(t.label, nom, cible ? "principal" : null);
        if (!r.ok) {
          setMessage(r.message ?? null);
          return;
        }
      }
      setMessage(null);
    });

  const mot = t.objectif ? OBJ_LABEL[t.objectif] ?? t.objectif : null;
  const organique = !t.attribuable && t.posts > 0;

  return (
    <div className="h-full flex flex-col rounded-xl border border-line px-3.5 py-3">
      <div className="text-[14px] font-semibold text-ink truncate mb-2.5">
        <span className="text-warn">★ </span>
        {t.label}
      </div>

      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
          L&apos;objectif de « {t.label} »
        </div>
        <select
          value={t.objectif ?? ""}
          disabled={pending || !d.peutEditer}
          onChange={(e) => poserObjectif(e.target.value)}
          className="w-full text-[11.5px] font-medium text-muted bg-white border border-line rounded-full px-3 py-1.5 outline-none cursor-pointer hover:bg-black/[0.02] disabled:opacity-50"
          title="Repondère l'indicateur et l'ordre des conseils de CE thème — pris en compte au prochain rapport"
        >
          {OBJ_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value === "" ? `Hérite du compte (${compteMot})` : o.label}
            </option>
          ))}
        </select>
        {mot && <p className="text-[10.5px] text-faint mt-1">Actuel : {mot}</p>}
      </div>

      <div className="min-h-0 flex-1 flex flex-col">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
          Ses conversions
        </div>
        {organique ? (
          <p className="text-[11.5px] text-muted leading-relaxed">
            Ce thème ne porte que des publications Instagram ({t.posts}) : une publication
            organique n&apos;a pas de lien tagué, aucune conversion ne peut lui être rattachée.
          </p>
        ) : !t.attribuable ? (
          <p className="text-[11.5px] text-muted leading-relaxed">
            Aucune campagne Meta ou Google ne porte ce thème pour l&apos;instant : pas de
            conversion possible tant qu&apos;il n&apos;en porte pas une.
          </p>
        ) : d.catalogue.length === 0 ? (
          <p className="text-[11.5px] text-muted leading-relaxed">
            {d.ga4Connecte
              ? "Aucun événement connu — lance ↻ Rafraîchir maintenant dans la barre latérale."
              : "Google Analytics n'est pas connecté — va dans Comptes → Connexions."}
          </p>
        ) : (
          <>
            {t.principaux.length === 0 && (
              <p className="text-[11.5px] text-muted mb-2 leading-relaxed">
                Aucune conversion sélectionnée : ce thème se juge sur sa dépense en attendant.
              </p>
            )}
            <div className="defile max-h-[220px] overflow-y-auto pr-1 -mr-1 space-y-2">
              {grouperParCategorie(d.catalogue, categories, parEvenement).map((g) => {
                const coches = g.items.filter((e) => selectionne(e.nom)).length;
                const toutCoche = coches === g.items.length;
                return (
                  <details key={g.nom} className="group" open={coches > 0}>
                    <summary className="cursor-pointer list-none flex items-center gap-1.5 py-1 select-none">
                      <span className="text-[9px] text-faint transition-transform group-open:rotate-90">
                        ▶
                      </span>
                      <span className="text-[10.5px] font-semibold text-ink truncate flex-1">
                        {g.nom}
                      </span>
                      <span className="text-[9.5px] text-faint shrink-0">
                        {coches}/{g.items.length}
                      </span>
                    </summary>
                    <div className="pl-3 space-y-1.5 mt-1">
                      <button
                        disabled={pending || !d.peutEditer}
                        onClick={() =>
                          basculerGroupe(
                            g.items.map((e) => e.nom),
                            !toutCoche
                          )
                        }
                        className="text-[10px] font-semibold text-brand disabled:opacity-40"
                      >
                        {toutCoche ? "Tout désélectionner" : `Tout sélectionner (${g.items.length})`}
                      </button>
                      {g.items.map((e) => (
                        <LigneConversion
                          key={e.nom}
                          e={e}
                          coche={selectionne(e.nom)}
                          pending={pending}
                          peutEditer={d.peutEditer}
                          onToggle={() => basculer(e.nom)}
                        />
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}
      </div>

      {message && <p className="text-[11px] text-neg mt-2">{message}</p>}
    </div>
  );
}

// Regroupe le catalogue d'un thème par catégorie — l'ORDRE des catégories est
// celui de `categories` (alphabétique, tel que rendu par `getConversionCategories`),
// et « Non catégorisé » ferme toujours la liste. Une catégorie sans aucune
// conversion dans CE catalogue n'apparaît pas : une section vide n'a rien à
// montrer ni à cocher.
type GroupeCategorie = { nom: string; items: EvenementCatalogue[] };

function grouperParCategorie(
  catalogue: EvenementCatalogue[],
  categories: string[],
  parEvenement: Record<string, string>
): GroupeCategorie[] {
  const parCat = new Map<string, EvenementCatalogue[]>();
  const sansCategorie: EvenementCatalogue[] = [];
  for (const e of catalogue) {
    const c = parEvenement[e.nom];
    if (c) {
      const arr = parCat.get(c) ?? [];
      arr.push(e);
      parCat.set(c, arr);
    } else {
      sansCategorie.push(e);
    }
  }
  const groupes: GroupeCategorie[] = categories
    .filter((c) => (parCat.get(c) ?? []).length > 0)
    .map((c) => ({ nom: c, items: parCat.get(c)! }));
  if (sansCategorie.length > 0) groupes.push({ nom: "Non catégorisé", items: sansCategorie });
  return groupes;
}

function LigneConversion({
  e,
  coche,
  pending,
  peutEditer,
  onToggle,
}: {
  e: EvenementCatalogue;
  coche: boolean;
  pending: boolean;
  peutEditer: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      disabled={pending || !peutEditer}
      title={coche ? "Retirer des conversions suivies" : "Suivre comme conversion de ce thème"}
      onClick={onToggle}
      className={`w-full flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[11.5px] font-mono text-ink disabled:opacity-40 truncate ${
        coche ? "border-brand bg-brand/[0.06]" : "border-line"
      }`}
    >
      {coche ? "☑" : "☐"} {e.nom}
      <span className="text-faint ml-1">{e.volume.toLocaleString("fr-CH")}</span>
      {e.cle === true && (
        <span className="text-brand ml-1" title="Événement clé dans GA4">
          ◆
        </span>
      )}
    </button>
  );
}
