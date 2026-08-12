"use client";

import { useState, useTransition } from "react";
import { deleteNote } from "@/app/actions";
import { Erreur } from "@/components/erreur";

// Le seul geste qu'une note accepte : disparaître. Elle n'a rien à valider,
// rien à juger — on l'a écrite à la main, on peut l'effacer à la main.
export function NoteLigne({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <>
      <button
        disabled={pending}
        onClick={() => {
          setErreur(null);
          startTransition(async () => {
            const r = await deleteNote(id);
            if (!r.ok) setErreur(r.message ?? "Impossible de retirer cette note.");
          });
        }}
        className="text-[10.5px] font-semibold text-faint hover:text-muted underline disabled:opacity-50"
      >
        effacer
      </button>
      {erreur && <Erreur texte={erreur} onFermer={() => setErreur(null)} />}
    </>
  );
}
