"use client";

import { useState, useTransition } from "react";
import { saveBudget } from "@/app/actions";

// Édition d'un budget, mensuel ou annuel.
//
// Le mensuel se pose sur le mois en cours et se reporte ensuite (carry-forward)
// tant qu'on ne le change pas. L'annuel se pose sur le 1er janvier de l'année :
// c'est une enveloppe, pas une moyenne — on ne la déduit pas du mensuel, parce
// qu'un budget d'année (un salon, une saison) ne se répartit presque jamais en
// douze parts égales.

export function BudgetEditor({
  channel,
  current,
  periode = "mois",
  annee,
  libelle,
}: {
  channel: string;
  current: number;
  periode?: "mois" | "an";
  /** Année visée pour un budget annuel (défaut : l'année en cours). */
  annee?: number;
  /** Remplace le libellé par défaut (« Budget mensuel » / « Budget annuel »). */
  libelle?: string;
}) {
  const [value, setValue] = useState(current > 0 ? String(Math.round(current)) : "");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = Number(value || 0) !== Math.round(current);
  const y = annee ?? new Date().getFullYear();
  const cle = periode === "an" ? `an:${channel}` : channel;
  const mois = periode === "an" ? `${y}-01-01` : undefined;
  const titre = libelle ?? (periode === "an" ? `Budget ${y}` : "Budget mensuel");

  return (
    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
      <label className="text-[10.5px] text-faint font-semibold uppercase tracking-wide">
        {titre}
      </label>
      {/* UNE VALEUR ABSENTE NE S'ÉCRIT PAS « 0 ».
          Le champ reste vide quand rien n'est saisi (`value` ci-dessus), mais son
          placeholder affichait `0` — le nombre le plus facile à confondre avec une
          mesure, à deux lignes d'une carte qui écrit « Pas d'enveloppe pour ce
          thème ». Le tiret cadratin est le signe que le reste de la page emploie
          déjà pour « aucun montant » ; il ne se lit pas comme un montant et ne
          peut pas être pris pour une saisie.
          Il portait aussi, faute de `<label for>`, le NOM ACCESSIBLE du champ : un
          lecteur d'écran annonçait « 0 ». D'où l'`aria-label` explicite. */}
      <input
        type="number"
        min={0}
        step={periode === "an" ? 500 : 50}
        value={value}
        placeholder="—"
        aria-label={`${titre}, en CHF`}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        className="w-28 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px] font-mono text-ink outline-none focus:border-brand text-right"
      />
      <span className="text-[12px] text-faint">CHF</span>
      {dirty && (
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await saveBudget(cle, Number(value || 0), mois);
              setSaved(true);
            })
          }
          className="text-[11.5px] font-semibold text-white bg-brand rounded-full px-3 py-1.5 hover:bg-brand/90 disabled:opacity-50"
        >
          {pending ? "…" : "Enregistrer"}
        </button>
      )}
      {saved && !dirty && <span className="text-[11.5px] text-pos font-semibold">✓ enregistré</span>}
    </div>
  );
}
