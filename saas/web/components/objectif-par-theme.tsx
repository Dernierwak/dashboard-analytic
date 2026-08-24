"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { saveThemeObjectif, setThemeEvent } from "@/app/actions";
import type { ThemesObjectifsData, ThemeObjectifRow } from "@/lib/channels";

// L'OBJECTIF D'UN THÈME PRIORITAIRE.
//
// `profiles.objectif` fixe UN objectif pour tout le compte : il décide de
// l'indicateur suivi par la courbe d'un thème et de l'ordre de ses conseils.
// Un thème qui vise la notoriété et un autre les ventes ne se pilotent
// pourtant pas au même indicateur — c'est exactement la limite que
// `objectif-theme.tsx` (le module du rapport) écrivait en toutes lettres :
// « un seul objectif pour l'instant, partagé par tes N thèmes ». Ce module
// est le réglage qui la referme, UNIQUEMENT pour les thèmes que le client a
// étoilés — le reste du rapport continue de suivre l'objectif du compte, sans
// exception.
//
// POURQUOI SUR /labels ET PAS DANS LE RAPPORT : même raison que
// `theme-evenements.tsx`, son voisin juste en dessous sur cette page. Le
// rapport hebdomadaire est une LECTURE ; ceci est un RÉGLAGE, posé une fois
// et repris quand le thème change de vocation.
//
// L'OBJECTIF ET SES CONVERSIONS DANS LE MÊME BLOC, ET C'EST VOULU : un
// objectif « plus de ventes » sans savoir QUEL événement GA4 porte ce
// verdict ne dit encore rien. `theme-evenements.tsx` gère déjà ce choix pour
// TOUS les thèmes, plus bas sur cette page — il reste la seule source de
// vérité de `theme_ga4_events` et n'est pas modifié. Ce module compose par-
// dessus (`lib/channels.ts::getThemeObjectifs`) et redessine, pour le seul
// sous-ensemble étoilé, un sélecteur de conversions équivalent : un thème
// prioritaire reste donc éditable ici ET plus bas — même geste, même table,
// jamais deux vérités.
//
// L'HÉRITAGE EST SILENCIEUX ET C'EST UN CHOIX HUMAIN, PAS UN DÉFAUT TECHNIQUE :
// un thème sans réglage propre suit l'objectif du compte sans qu'on ait rien à
// faire pour ça — ce n'est donc PAS un manque à combler comme le sont les
// événements GA4 non choisis. Le rang 3/4 le dit sans ton d'alarme.

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

export function ObjectifParThemeModule({ d }: { d: ThemesObjectifsData }) {
  const avecPropre = d.themes.filter((t) => t.objectif !== null);
  const compteMot = d.accountObjectif ? OBJ_LABEL[d.accountObjectif] ?? "non défini" : "non défini";

  const verdict: { texte: string; couleur: string } = d.migrationManquante
    ? { texte: "la base n'est pas à jour", couleur: "#c0392b" }
    : d.themes.length === 0
    ? { texte: "aucun thème prioritaire", couleur: "#5a5d66" }
    : avecPropre.length === 0
    ? { texte: "tous suivent l'objectif du compte", couleur: "#5a5d66" }
    : avecPropre.length === d.themes.length
    ? { texte: "tous ont leur objectif propre", couleur: "#1a7a4a" }
    : { texte: `${avecPropre.length} avec leur objectif propre`, couleur: "#5a5d66" };

  return (
    <section className="bg-white border border-line rounded-2xl shadow-card px-4 sm:px-5 py-4 mb-5">
      {/* Rang 1 — le surtitre : une tuile qu'on scanne, comme sa voisine. */}
      <div className="text-[10px] uppercase tracking-widest text-faint font-bold mb-2">
        L&apos;objectif de tes thèmes prioritaires
      </div>

      {d.migrationManquante && (
        <p className="text-[12.5px] text-neg leading-relaxed mb-3 max-w-[70ch]">
          Le tableau des objectifs par thème n&apos;existe pas encore dans ta base —{" "}
          <span className="font-semibold">aucun réglage propre ne peut être enregistré</span>.
          Joue{" "}
          <code className="font-mono text-[11.5px]">supabase/migrations/000_run_me_all.sql</code>{" "}
          dans Supabase → SQL editor, puis recharge cette page. Ce fichier est rejouable sans
          risque.
        </p>
      )}

      {/* Rang 3 — LE chiffre : combien de thèmes prioritaires ce réglage concerne. */}
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <span className="font-mono text-[30px] sm:text-[34px] leading-none font-medium text-ink">
          {d.themes.length}
        </span>
        <span
          className="text-[10.5px] font-bold px-2 py-0.5 rounded-full"
          style={{ color: verdict.couleur, background: `${verdict.couleur}14` }}
        >
          {verdict.texte}
        </span>
      </div>
      <p className="text-[12px] text-muted mt-2 leading-snug">
        thème{d.themes.length > 1 ? "s" : ""} prioritaire{d.themes.length > 1 ? "s" : ""}
        {d.themes.length > 0 && " — chacun peut suivre son propre indicateur"}.
      </p>

      {/* La phrase qui fait comprendre le mécanisme, comme le module voisin. */}
      <p className="text-[12.5px] text-ink mt-2.5 leading-relaxed">
        Deux thèmes prioritaires n&apos;ont pas toujours la même vocation : l&apos;un vise des
        ventes, l&apos;autre de la notoriété. Un thème sans réglage propre suit
        SILENCIEUSEMENT l&apos;objectif du compte —{" "}
        <span className="font-semibold">{compteMot}</span>. Choisis-lui le sien seulement s&apos;il
        en a besoin.
      </p>

      {d.themes.length === 0 && !d.migrationManquante && (
        <p className="text-[12.5px] mt-3 leading-relaxed rounded-xl bg-black/[0.02] px-3 py-3 text-muted">
          Aucun thème étoilé pour l&apos;instant. Marque une priorité plus haut, dans « Tes
          thèmes » — elle apparaîtra ici avec son propre objectif à régler si tu le souhaites.
        </p>
      )}

      {/* Rang 7 — le détail : un thème prioritaire, son objectif, ses conversions. */}
      {d.themes.length > 0 && (
        <div className="mt-4 rounded-xl border border-line divide-y divide-line defile max-h-[70vh] overflow-y-auto">
          {d.themes.map((t) => (
            <LigneObjectifTheme key={t.label} t={t} d={d} compteMot={compteMot} />
          ))}
        </div>
      )}

      {/* Rang 9 — le pied : la limite qui rend ce réglage honnête. */}
      <p className="text-[10.5px] text-faint/90 mt-3 leading-relaxed">
        Pris en compte à la prochaine publication du rapport (↻ Recharger mes conseils). Pour
        changer l&apos;objectif du COMPTE lui-même (celui hérité par défaut), va sur{" "}
        <Link href="/" className="font-semibold text-brand hover:underline">
          ta boussole →
        </Link>
        .
      </p>
    </section>
  );
}

function LigneObjectifTheme({
  t,
  d,
  compteMot,
}: {
  t: ThemeObjectifRow;
  d: ThemesObjectifsData;
  compteMot: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choisi = (nom: string): "principal" | "secondaire" | null =>
    t.principaux.includes(nom) ? "principal" : t.secondaires.includes(nom) ? "secondaire" : null;

  const poserEvenement = (nom: string, rang: "principal" | "secondaire" | null) =>
    startTransition(async () => {
      const r = await setThemeEvent(t.label, nom, rang);
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

  const mot = t.objectif ? OBJ_LABEL[t.objectif] ?? t.objectif : null;
  const organique = !t.attribuable && t.posts > 0;

  return (
    <div className="px-3 sm:px-4 py-2.5">
      <button
        onClick={() => setOuvert((o) => !o)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="text-[11px] text-faint w-3 shrink-0">{ouvert ? "▾" : "▸"}</span>
        <span className="text-[14px] font-semibold text-ink truncate">
          <span className="text-warn">★ </span>
          {t.label}
        </span>
        <span className="ml-auto text-[11.5px] text-right min-w-0 truncate">
          {mot ? (
            <span className="font-semibold text-brand">{mot}</span>
          ) : (
            <span className="text-faint">hérite : {compteMot}</span>
          )}
        </span>
      </button>

      {ouvert && (
        <div className="mt-2.5 pl-5 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
              L&apos;objectif de « {t.label} »
            </div>
            <select
              value={t.objectif ?? ""}
              disabled={pending || !d.peutEditer}
              onChange={(e) => poserObjectif(e.target.value)}
              className="text-[11.5px] font-medium text-muted bg-white border border-line rounded-full px-3 py-1.5 outline-none cursor-pointer hover:bg-black/[0.02] disabled:opacity-50"
              title="Repondère l'indicateur et l'ordre des conseils de CE thème — pris en compte au prochain rapport"
            >
              {OBJ_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value === "" ? `Hérite du compte (${compteMot})` : o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
              Ses conversions GA4
            </div>
            {organique ? (
              <p className="text-[11.5px] text-muted leading-relaxed">
                Ce thème ne porte que des publications Instagram ({t.posts}) : une publication
                organique n&apos;a pas de lien tagué, aucune conversion ne peut lui être
                rattachée. Choisis-lui « Plus de notoriété » ou « Plus d&apos;engagement » — ce
                sont les seuls indicateurs qu&apos;il peut mesurer.
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
                    Aucun événement principal : ce thème se juge sur sa dépense en attendant,
                    faute de savoir ce qu&apos;elle doit produire.
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {d.catalogue.map((e) => {
                    const etat = choisi(e.nom);
                    return (
                      <div
                        key={e.nom}
                        className={`inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-1 ${
                          etat === "principal"
                            ? "border-brand bg-brand/[0.06]"
                            : etat === "secondaire"
                            ? "border-line bg-black/[0.03]"
                            : "border-line"
                        }`}
                      >
                        <button
                          disabled={pending || !d.peutEditer}
                          title={etat ? "Retirer de ce thème" : "Rattacher à ce thème (secondaire)"}
                          onClick={() => poserEvenement(e.nom, etat ? null : "secondaire")}
                          className="text-[11.5px] font-mono text-ink disabled:opacity-40"
                        >
                          {e.nom}
                          <span className="text-faint ml-1">{e.volume.toLocaleString("fr-CH")}</span>
                          {e.cle === true && (
                            <span className="text-brand ml-1" title="Événement clé dans GA4">
                              ◆
                            </span>
                          )}
                        </button>
                        {etat !== null && (
                          <button
                            disabled={pending || !d.peutEditer}
                            title={
                              etat === "principal"
                                ? "Repasser en secondaire"
                                : "Faire porter le verdict et la courbe par cet événement"
                            }
                            onClick={() =>
                              poserEvenement(e.nom, etat === "principal" ? "secondaire" : "principal")
                            }
                            className={`w-6 h-6 flex items-center justify-center rounded-full text-[13px] leading-none disabled:opacity-40 ${
                              etat === "principal" ? "text-warn" : "text-line hover:text-warn/60"
                            }`}
                          >
                            {etat === "principal" ? "★" : "☆"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {message && <p className="text-[11.5px] text-neg">{message}</p>}
        </div>
      )}
    </div>
  );
}
