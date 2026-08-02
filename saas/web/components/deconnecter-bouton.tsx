"use client";

import { useState, useTransition } from "react";
import { deconnecter } from "@/app/comptes/actions";

// Déconnecter est irréversible côté jeton : il faudra re-consentir chez le
// fournisseur. On demande donc confirmation sur place, et on dit ce qui est
// perdu — et surtout ce qui ne l'est pas : les données déjà récoltées restent.

export function DeconnecterBouton({ canal, nom }: { canal: "meta" | "google"; nom: string }) {
  const [confirme, setConfirme] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  if (!confirme) {
    return (
      <button
        onClick={() => setConfirme(true)}
        className="text-[11.5px] text-faint hover:text-neg underline decoration-dotted underline-offset-2"
      >
        Déconnecter
      </button>
    );
  }

  return (
    <div className="text-right">
      <p className="text-[11.5px] text-muted leading-snug mb-1.5 max-w-[34ch]">
        Déconnecter {nom} ? Il faudra réautoriser pour reprendre la récolte. Tes
        données déjà enregistrées restent.
      </p>
      <div className="flex gap-2 justify-end">
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await deconnecter(canal);
              if (!r.ok) setErreur(r.message ?? "Échec.");
              else setConfirme(false);
            })
          }
          className="text-[11.5px] font-semibold text-white bg-neg rounded-full px-3 py-1.5 disabled:opacity-50"
        >
          {pending ? "…" : "Oui, déconnecter"}
        </button>
        <button
          onClick={() => setConfirme(false)}
          className="text-[11.5px] text-muted px-2 py-1.5"
        >
          Annuler
        </button>
      </div>
      {erreur && <p className="text-[11.5px] text-neg mt-1">{erreur}</p>}
    </div>
  );
}
