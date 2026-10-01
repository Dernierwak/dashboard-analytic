"use client";

import Link from "next/link";
import { useState } from "react";
import { OnboardingCard } from "@/components/onboarding-card";
import { ChoixJour } from "@/components/choix-jour";
import { JOURS, delai, enFrancais, prochainPassage } from "@/lib/jour-de-travail";

// Parcours de démarrage — 2 étapes :
//   1. Ton profil (questions au clic, puis ton site — OnboardingCard)
//   2. LA CLÔTURE : le jour où tu veux être servi.
// Les étapes « construis tes thèmes » et « étoile tes priorités » sont parties
// avec le thème : rien ne les remplace.
//
// LA CLÔTURE PORTE LE JOUR DE TRAVAIL. « Le Jour de travail se choisit à la
// clôture du fil de démarrage » — la dernière chose qu'on demande. Elle ne se
// rejoue pas : `fetch_schedule` vaut « Monday » par défaut en base et rien ne
// distingue un défaut d'un choix, donc ce n'est pas une étape qu'on pourrait
// rouvrir plus tard sans mentir. Le réglage reste disponible en permanence sur
// la page Connexions.
//
// ELLE S'OUVRE SUR LA FIN DU PROFIL, ET SEULEMENT LÀ. `saveOnboarding`
// révalide « / » : le serveur rend à nouveau la page avec `onboarded` à vrai,
// et ce composant, resté monté au même endroit, garde son état. `profilEnCours`
// se fige au premier rendu — vrai seulement si le profil n'était pas encore
// rempli à l'arrivée — donc un retour sur la page d'un compte installé ne
// rouvre jamais la clôture.

export function SetupWizard({
  onboarded,
  jourDeTravail,
  maintenantIso,
}: {
  onboarded: boolean;
  /** Le jour servi aujourd'hui (`profiles.fetch_schedule`), pour la clôture. */
  jourDeTravail: string;
  /** L'heure du serveur, figée au rendu : le calcul du prochain passage est
   *  donc le même des deux côtés de l'hydratation. */
  maintenantIso: string;
}) {
  const [profilEnCours] = useState(!onboarded);
  const [jour, setJour] = useState(
    JOURS.some((j) => j.en === jourDeTravail) ? jourDeTravail : "Monday"
  );
  const [cloture, setCloture] = useState(true);

  // Étape 1 — profil (le composant gère ses questions et sa sauvegarde)
  if (!onboarded) return <OnboardingCard />;

  if (!profilEnCours) return null;

  if (cloture) {
    const { date, delta } = prochainPassage(jour, new Date(maintenantIso));
    return (
      <div className="bg-white border border-brand/20 rounded-xl shadow-card p-5 sm:p-6 mb-8">
        <span className="text-[10px] uppercase tracking-widest text-brand font-bold">
          Mise en place — terminé
        </span>
        <h2 className="font-serif text-[22px] text-ink leading-tight mb-2 mt-3">
          Quel jour veux-tu être servi ?
        </h2>
        <p className="text-[13px] text-muted leading-relaxed mb-4 max-w-[62ch]">
          Une fois par semaine, Pulse va chercher tes chiffres et
          réécrit ton rapport. Choisis le jour où tu veux le lire — c&apos;est le seul
          moment où quelque chose change, et tu peux en changer quand tu veux sur la page{" "}
          <Link href="/comptes" className="text-brand font-semibold hover:underline">
            ⚙ Connexions
          </Link>
          .
        </p>
        <div className="text-[22px] leading-none font-semibold tracking-tight text-ink mb-1">
          {enFrancais(date)}
        </div>
        <p className="text-[12.5px] text-muted mb-4">
          prochaine mise à jour · <span className="font-semibold text-ink">{delai(delta)}</span>
        </p>
        <ChoixJour valeur={jour} onValeur={setJour} titre="Ton jour" />
        <button
          onClick={() => setCloture(false)}
          className="mt-5 text-[12.5px] font-semibold text-white bg-brand rounded-full px-5 py-2.5 hover:bg-brand/90"
        >
          C&apos;est noté
        </button>
      </div>
    );
  }

  return null;
}
