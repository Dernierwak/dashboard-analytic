"use client";

import { useState, useTransition } from "react";
import { saveNote } from "@/app/actions";
import { Erreur } from "@/components/erreur";

// « ✎ J'ai fait quelque chose » — la troisième voix du fil.
//
// Pulse sait ce qu'il a conseillé, et il voit ce que les plateformes ont fait.
// Il ne sait pas que tu as refait tous les visuels un mardi, ni qu'un
// concurrent a lancé une promo. Sans cette voix-là, une courbe qui bondit reste
// sans explication trois semaines plus tard.
//
// CE N'EST PAS UN JOURNAL. Un journal, on le tient trois semaines. Ce qui sert,
// c'est qu'une note se plante à SA DATE sur la même frise que le reste : quand
// la portée a doublé, tu lis « 12 aoû · changé les visuels » juste à côté.
//
// Replié par défaut : on ne vient pas sur cette page pour écrire.
export function NoteAjout({ theme = null }: { theme?: string | null }) {
  const [pending, startTransition] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const [jour, setJour] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  if (!ouvert) {
    return (
      <button
        onClick={() => setOuvert(true)}
        className="mt-2 text-[11.5px] font-semibold text-brand hover:underline"
      >
        ✎ Noter quelque chose que tu as fait
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-line bg-black/[0.015] p-2.5">
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        rows={2}
        autoFocus
        maxLength={180}
        placeholder="Ce que tu as fait — « refait les visuels », « changé le ciblage à la main »…"
        className="w-full rounded-lg border border-line bg-white px-2.5 py-2 text-[12.5px] text-ink outline-none focus:border-brand resize-none"
      />
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {/* Le jour est libre : on note souvent le lendemain ce qu'on a fait la
            veille. Jamais dans le futur — une note est un fait, pas un projet. */}
        <input
          type="date"
          value={jour}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setJour(e.target.value)}
          className="rounded-lg border border-line bg-white px-2 py-1.5 text-[11.5px] text-muted outline-none focus:border-brand"
        />
        <button
          disabled={pending || !texte.trim()}
          onClick={() => {
            setErreur(null);
            startTransition(async () => {
              const r = await saveNote(texte, theme, jour || undefined);
              if (r.ok) {
                setTexte("");
                setJour("");
                setOuvert(false);
              } else {
                setErreur(r.message ?? "Ta note n'a pas pu être enregistrée.");
              }
            });
          }}
          className="text-[12px] font-semibold text-white bg-ink rounded-full px-3.5 py-1.5 disabled:opacity-40"
        >
          {pending ? "…" : "Noter"}
        </button>
        <button
          onClick={() => {
            setOuvert(false);
            setErreur(null);
          }}
          className="text-[11.5px] font-semibold text-faint hover:text-muted"
        >
          annuler
        </button>
      </div>
      {erreur && <Erreur texte={erreur} onFermer={() => setErreur(null)} />}
    </div>
  );
}
