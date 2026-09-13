"use client";

import { useState, useTransition } from "react";
import { choisirJourRecolte } from "@/app/actions-compte";
import { JOURS } from "@/lib/jour-de-travail";

// LES SEPT JOURS — l'unique écriture de `profiles.fetch_schedule` côté écran.
//
// Ce rang vivait dans `jour-recolte.tsx` et n'y servait qu'une fois. Il en a
// maintenant deux lecteurs : la page Connexions, où l'on change de jour, et la
// CLÔTURE DU FIL DE DÉMARRAGE, où on le choisit pour la première fois — « le
// Jour de travail se choisit à la clôture du fil de démarrage »
// (`.scratch/refonte/issues/10-l-entree-premier-ecran.md`, rappelé par le
// ticket 15 de la construction). Deux exemplaires du même geste auraient fini
// par écrire la colonne de deux façons.
//
// LE PARENT TIENT LA VALEUR, CE COMPOSANT TIENT L'ÉCRITURE. La page Connexions
// affiche la date du prochain passage à partir du jour choisi : elle a donc
// besoin de la valeur courante. L'aller-retour serveur, son échec et son repli
// n'intéressent personne d'autre et restent ici.

export function ChoixJour({
  valeur,
  onValeur,
  titre = "Changer de jour",
}: {
  /** Le jour actuellement choisi, en anglais comme en base. */
  valeur: string;
  /** Appelé tout de suite avec le nouveau jour, et de nouveau avec l'ANCIEN si
   *  l'enregistrement échoue : l'écran ne garde jamais un jour que la base n'a
   *  pas pris. */
  onValeur: (jourEn: string) => void;
  titre?: string;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, demarrer] = useTransition();

  const choisir = (en: string) => {
    if (en === valeur || pending) return;
    const avant = valeur;
    onValeur(en); // la réponse est immédiate : c'est ce que le clic promet
    setErreur(null);
    demarrer(async () => {
      // Une action serveur qui LÈVE (session expirée, réseau coupé) rejette la
      // promesse sans jamais passer par `r.ok` : sans ce `catch`, le jour
      // resterait affiché comme enregistré alors que rien ne l'est, et la seule
      // trace serait une « unhandled rejection » dans la console.
      try {
        const r = await choisirJourRecolte(en);
        if (!r.ok) {
          onValeur(avant);
          setErreur(r.message ?? "L'enregistrement a échoué.");
        }
      } catch {
        onValeur(avant);
        setErreur(
          "L'enregistrement n'est pas passé. Recharge la page — si ta session a expiré, " +
            "il faudra te reconnecter."
        );
      }
    });
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-widest text-faint font-bold">
          {titre}
        </span>
        {pending && <span className="text-[10.5px] text-faint">enregistrement…</span>}
      </div>
      <div className="flex gap-1.5">
        {JOURS.map((j) => {
          const on = j.en === valeur;
          return (
            <button
              key={j.en}
              type="button"
              onClick={() => choisir(j.en)}
              disabled={pending}
              aria-pressed={on}
              title={`Récolter le ${j.fr}`}
              className={`flex-1 rounded-lg border py-2 text-[12px] font-semibold transition-colors disabled:opacity-60 ${
                on
                  ? "bg-ink text-white border-ink"
                  : "border-line text-muted hover:bg-black/[0.04] hover:text-ink"
              }`}
            >
              {j.court}
            </button>
          );
        })}
      </div>
      {erreur && <p className="text-[12px] text-neg mt-2.5 leading-relaxed">{erreur}</p>}
    </div>
  );
}
