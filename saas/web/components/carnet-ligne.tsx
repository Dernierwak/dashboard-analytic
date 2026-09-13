"use client";

import { useState, useTransition } from "react";
import { deleteNote, updateNote } from "@/app/actions";
import { Erreur } from "@/components/erreur";

// LES DEUX SEULS GESTES D'UNE NOTE : se corriger, disparaître.
//
// Elle n'a rien à valider et rien à juger — c'est un fait déclaré par une
// personne, pas une mesure (`CONTEXT.md`, entrée Note). **Aucun verdict, aucune
// flèche, aucune couleur d'état, aucun « +12 % depuis ta note »** : juger la
// note obligerait Pulse à choisir le chiffre à surveiller, donc à inventer une
// intention. Pulse marque, le client juge
// (`.scratch/refonte/issues/04-ce-qui-doit-etre-valide-en-premier.md`).
//
// LE JOUR NE SE CORRIGE PAS ICI, et c'est volontaire : il a été choisi, et il
// est la seule chose qui place la note dans le temps. Se tromper de texte se
// répare ; déplacer un fait d'un jour à l'autre change ce qu'il raconte. Pour
// dire autre chose, on écrit une autre note.
export function CarnetLigne({ id, titre }: { id: string; titre: string }) {
  const [pending, startTransition] = useTransition();
  const [edition, setEdition] = useState(false);
  const [texte, setTexte] = useState(titre);
  const [erreur, setErreur] = useState<string | null>(null);

  const bouton = "text-[10.5px] font-semibold text-faint hover:text-muted underline disabled:opacity-50";

  if (edition)
    return (
      <div className="mt-1">
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={2}
          autoFocus
          maxLength={180}
          className="w-full rounded-lg border border-line bg-white px-2.5 py-2 text-[12.5px] text-ink outline-none focus:border-brand resize-none"
        />
        <div className="flex items-center gap-2.5 mt-1.5">
          <button
            disabled={pending || !texte.trim()}
            onClick={() => {
              setErreur(null);
              startTransition(async () => {
                const r = await updateNote(id, texte);
                if (r.ok) setEdition(false);
                else setErreur(r.message ?? "Ta correction n'a pas pu être enregistrée.");
              });
            }}
            className="text-[11.5px] font-semibold text-white bg-ink rounded-full px-3 py-1 disabled:opacity-40"
          >
            {pending ? "…" : "Corriger"}
          </button>
          <button
            onClick={() => {
              setTexte(titre);
              setEdition(false);
              setErreur(null);
            }}
            className="text-[11px] font-semibold text-faint hover:text-muted"
          >
            annuler
          </button>
        </div>
        {erreur && <Erreur texte={erreur} onFermer={() => setErreur(null)} />}
      </div>
    );

  return (
    <>
      <span className="inline-flex items-center gap-2.5">
        <button onClick={() => setEdition(true)} className={bouton}>
          corriger
        </button>
        <button
          disabled={pending}
          onClick={() => {
            setErreur(null);
            startTransition(async () => {
              const r = await deleteNote(id);
              if (!r.ok) setErreur(r.message ?? "Impossible de retirer cette note.");
            });
          }}
          className={bouton}
        >
          effacer
        </button>
      </span>
      {erreur && <Erreur texte={erreur} onFermer={() => setErreur(null)} />}
    </>
  );
}
