"use client";

import { useState, useTransition } from "react";
import type { Choix } from "@/lib/oauth-api";

// L'écran « lequel ? » du parcours de connexion — Page Facebook, compte Google
// Ads, propriété Analytics. Le même composant les sert tous les trois : c'est
// exactement la même décision, elle mérite exactement la même forme.
//
// Deux partis pris :
//  · quand il n'y a qu'un seul choix, on ne fait pas choisir. Une liste d'un
//    élément est une question rhétorique ; on préselectionne et il reste à
//    confirmer d'un clic.
//  · le bouton porte le nom de ce qu'on choisit, pas « Valider ». On doit
//    pouvoir relire le bouton et savoir ce qui va se passer.

export function ChoixCompte({
  titre,
  aide,
  choix,
  action,
  libelleBouton = "Connecter",
}: {
  titre: string;
  aide: string;
  choix: Choix[];
  action: (id: string, nom: string) => Promise<{ ok: boolean; message?: string }>;
  libelleBouton?: string;
}) {
  const [choisi, setChoisi] = useState<string>(choix.length === 1 ? choix[0].id : "");
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [avis, setAvis] = useState<string | null>(null);

  const valider = () => {
    const c = choix.find((x) => x.id === choisi);
    if (!c) return;
    setErreur(null);
    setAvis(null);
    startTransition(async () => {
      const r = await action(c.id, c.nom);
      if (!r.ok) setErreur(r.message ?? "Ça n'a pas marché.");
      else if (r.message) setAvis(r.message);
    });
  };

  return (
    <div className="bg-white border border-brand/25 rounded-xl shadow-card p-5 mb-5">
      <h3 className="font-serif text-[19px] text-ink leading-tight mb-1.5">{titre}</h3>
      <p className="text-[12.5px] text-muted leading-relaxed mb-4 max-w-[64ch]">{aide}</p>

      <div className="max-h-[42vh] overflow-y-auto -mx-1 px-1 space-y-2 mb-4">
        {choix.map((c) => {
          const on = c.id === choisi;
          return (
            <button
              key={c.id}
              onClick={() => setChoisi(c.id)}
              disabled={pending}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-colors disabled:opacity-50 ${
                on
                  ? "border-brand bg-brand/[0.05]"
                  : "border-line bg-white hover:border-brand/50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-3.5 w-3.5 rounded-full border-2 shrink-0 ${
                    on ? "border-brand bg-brand" : "border-line"
                  }`}
                />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink truncate">
                    {c.nom}
                  </span>
                  {c.sousTitre && (
                    <span className="block font-mono text-[11px] text-faint truncate">
                      {c.sousTitre}
                    </span>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={valider}
          disabled={!choisi || pending}
          className="text-[12.5px] font-semibold text-white bg-brand rounded-full px-5 py-2.5 hover:bg-brand/90 disabled:opacity-40"
        >
          {pending ? "…" : libelleBouton}
        </button>
        <span className="text-[11.5px] text-faint">
          {choix.length} disponible{choix.length > 1 ? "s" : ""}
        </span>
      </div>

      {erreur && (
        <p className="mt-3 text-[12.5px] text-neg leading-relaxed border border-neg/25 bg-neg/[0.04] rounded-lg px-3 py-2">
          {erreur}
        </p>
      )}
      {avis && (
        <p className="mt-3 text-[12.5px] text-warn leading-relaxed border border-warn/25 bg-warn/[0.05] rounded-lg px-3 py-2">
          {avis}
        </p>
      )}
    </div>
  );
}
