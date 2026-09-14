"use client";

import { useState, useTransition } from "react";
import { saveObjectif } from "@/app/actions";
import { prisEnCompteLe } from "@/lib/jour-de-travail";

const OBJECTIFS = [
  { value: "", label: "Objectif : non défini" },
  { value: "ventes", label: "Objectif : plus de ventes / contacts" },
  { value: "notoriete", label: "Objectif : plus de notoriété / portée" },
  { value: "engagement", label: "Objectif : plus d'engagement" },
];

// L'objectif re-pondère les conseils. Il s'enregistre tout de suite et son
// effet est DATÉ : c'est de la rédaction, pas du regroupement, donc il attend
// le Jour de travail (`.scratch/refonte/issues/13-entre-deux-jours-de-travail.md`
// §2). Le client n'a plus de bouton pour avancer ce moment — le message le dit
// avec la date, au lieu de le laisser deviner.
export function ObjectifSelect({
  current,
  quand,
}: {
  current: string | null;
  /** « jeudi 17 septembre », calculé par le serveur (`lib/jour-compte.ts`). */
  quand?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [echec, setEchec] = useState(false);
  return (
    <div className="text-right">
      <select
        value={current ?? ""}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            // LA DATE DE PRISE EN COMPTE NE S'ÉCRIT QUE SI L'ÉCRITURE A EU
            // LIEU. Elle s'affichait sans rien vérifier : sur un compte partagé
            // dont la RLS refuse le profil, le client lisait « pris en compte
            // jeudi » pour un objectif que la base n'avait jamais accepté.
            const r = await saveObjectif(e.target.value || null);
            setEchec(!r.ok);
            setMessage(r.ok ? (quand ? prisEnCompteLe(quand) : null) : (r.message ?? null));
          })
        }
        className="text-[11.5px] font-medium text-muted bg-white border border-line rounded-full px-3 py-1.5 outline-none cursor-pointer hover:bg-black/[0.02] disabled:opacity-50"
        title={quand ? `Re-pondère tes conseils — pris en compte le ${quand}` : "Re-pondère tes conseils"}
      >
        {OBJECTIFS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {message && (
        <p
          className={`text-[10.5px] mt-1.5 leading-relaxed max-w-[34ch] ml-auto ${
            echec ? "text-neg" : "text-muted"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
