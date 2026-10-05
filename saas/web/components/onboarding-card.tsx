"use client";

import { useState, useTransition } from "react";
import { saveOnboarding } from "@/app/actions";

// Onboarding express — 5 questions au clic, 30 secondes. La dernière réponse
// enregistre le profil : aucun bouton « Terminer » à chercher.
//
// Le site du client, qui fermait le parcours, est parti le 2026-10-05
// (`.scratch/meta-ads/tickets/34-…`) : il ne servait qu'aux conseils, et Pulse
// n'en donne plus.
const STEPS: { key: string; question: string; options: { value: string; label: string; sub?: string }[] }[] = [
  {
    key: "objectif",
    question: "Ta mission n°1 en ce moment ?",
    options: [
      { value: "ventes", label: "Plus de ventes", sub: "contacts, commandes, devis" },
      { value: "notoriete", label: "Être plus connu", sub: "portée, nouveaux abonnés" },
      { value: "engagement", label: "Une communauté qui réagit", sub: "j'aime, commentaires" },
    ],
  },
  {
    key: "business_type",
    question: "Ton activité ?",
    options: [
      { value: "ecommerce", label: "E-commerce" },
      { value: "local", label: "Commerce local" },
      { value: "services", label: "Services / B2B" },
      { value: "createur", label: "Créateur / média" },
    ],
  },
  {
    key: "budget_range",
    question: "Ton budget pub mensuel ?",
    options: [
      { value: "0-500", label: "moins de 500 CHF" },
      { value: "500-2000", label: "500 – 2 000 CHF" },
      { value: "2000-10000", label: "2 000 – 10 000 CHF" },
      { value: "10000+", label: "plus de 10 000 CHF" },
    ],
  },
  {
    key: "time_budget",
    question: "Ton temps marketing par semaine ?",
    options: [
      { value: "30min", label: "30 minutes max", sub: "je veux l'essentiel" },
      { value: "1-2h", label: "1 à 2 heures" },
      { value: "3h+", label: "3 heures ou plus", sub: "je veux creuser" },
    ],
  },
  {
    key: "frustration",
    question: "Et aujourd'hui, qu'est-ce qui te frustre le plus ?",
    options: [
      { value: "comprendre", label: "Je ne sais pas quoi faire de mes chiffres", sub: "des données, oui — des décisions, non" },
      { value: "temps", label: "Pas le temps de m'en occuper", sub: "le marketing passe toujours après" },
      { value: "rentabilite", label: "Je dépense sans savoir si ça rapporte", sub: "la pub part, le retour est flou" },
      { value: "stagnation", label: "Je stagne", sub: "je publie, mais rien ne décolle" },
    ],
  },
];

export function OnboardingCard() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = STEPS[step];
  const derniere = step === STEPS.length - 1;

  // RIEN N'EST JAMAIS PERDU ICI. Les réponses vivent dans l'état de ce
  // composant, et un échec ne le démonte pas : il pose une phrase et rend la
  // main. Recliquer rejoue exactement le même envoi — `saveOnboarding` est un
  // `update`, le rejouer ne crée rien en double.
  const terminer = (reponses: Record<string, string>) => {
    setErreur(null);
    startTransition(async () => {
      try {
        // `saveOnboarding` révalide « / » : quand elle passe, la carte
        // disparaît, on est arrivé. Quand elle refuse, elle le DIT — sans ce
        // retour lu, un refus (lecture seule, session expirée) laissait la
        // personne croire son profil enregistré.
        const p = await saveOnboarding(reponses as {
          objectif: string;
          business_type: string;
          budget_range: string;
          time_budget: string;
          frustration: string;
        });
        if (!p.ok) setErreur(p.message ?? "Tes réponses n'ont pas pu être enregistrées.");
      } catch {
        // Une action serveur peut encore rejeter sans passer par `ok`
        // (réseau coupé, déploiement en cours). Même traitement : une phrase,
        // et la carte reste debout avec ses réponses.
        setErreur("L'enregistrement n'est pas passé — vérifie ta connexion. Rien n'est perdu.");
      }
    });
  };

  const pick = (value: string) => {
    const suivantes = { ...answers, [current.key]: value };
    setAnswers(suivantes);
    if (derniere) terminer(suivantes); // rien n'est écrit avant la dernière réponse
    else setStep(step + 1);
  };

  return (
    <div className="bg-white border border-brand/20 rounded-xl shadow-card p-6 mb-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-[10px] uppercase tracking-widest text-brand font-bold">
          Bienvenue — 30 secondes pour calibrer tes conseils
        </span>
        <span className="font-mono text-[11px] text-faint shrink-0">
          {step + 1} / {STEPS.length}
        </span>
      </div>
      {/* Progression */}
      <div className="flex gap-1.5 mb-5">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`h-1 flex-1 rounded-full ${i <= step ? "bg-brand" : "bg-black/[0.06]"}`}
          />
        ))}
      </div>

      <h2 className="font-serif text-[22px] text-ink leading-tight mb-4">{current.question}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {current.options.map((o) => (
          <button
            key={o.value}
            disabled={pending}
            onClick={() => pick(o.value)}
            className="text-left border border-line rounded-xl px-4 py-3 hover:border-brand hover:bg-brand/[0.03] transition-colors disabled:opacity-50"
          >
            <div className="text-[13.5px] font-semibold text-ink">{o.label}</div>
            {o.sub && <div className="text-[11.5px] text-faint mt-0.5">{o.sub}</div>}
          </button>
        ))}
      </div>
      {/* Il commence par ce qui rassure : les réponses n'ont pas bougé. Sans
          cette phrase, la seule conclusion raisonnable est « j'ai tout perdu ». */}
      {erreur && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-neg/25 bg-neg/[0.04] px-4 py-3"
        >
          <div className="text-[10px] uppercase tracking-widest text-neg font-bold mb-1">
            Rien n&apos;a été enregistré
          </div>
          <p className="text-[12.5px] text-ink leading-relaxed">
            {erreur}{" "}
            <span className="font-semibold">
              Tes {STEPS.length} réponses sont toujours là
            </span>{" "}
            — reclique sur ta dernière réponse, il n&apos;y a rien à refaire.
          </p>
        </div>
      )}
      {step > 0 && (
        <button
          disabled={pending}
          onClick={() => {
            setErreur(null);
            setStep(step - 1);
          }}
          className="mt-4 text-[11.5px] text-faint hover:text-muted disabled:opacity-40"
        >
          ← question précédente
        </button>
      )}
      {pending && <p className="mt-3 text-[12px] text-brand font-medium">Ton profil se met en place…</p>}
    </div>
  );
}
