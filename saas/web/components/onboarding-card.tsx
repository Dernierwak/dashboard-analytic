"use client";

import { useState, useTransition } from "react";
import { saveOnboarding } from "@/app/actions";

// Onboarding express — 4 questions, 30 secondes, tout au clic.
// Le profil calibre la mission, les repères des conseils et le persona IA.
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
];

export function OnboardingCard() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const current = STEPS[step];
  const pick = (value: string) => {
    const next = { ...answers, [current.key]: value };
    setAnswers(next);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      startTransition(async () => {
        await saveOnboarding(next as {
          objectif: string;
          business_type: string;
          budget_range: string;
          time_budget: string;
        });
      });
    }
  };

  return (
    <div className="bg-white border border-brand/20 rounded-xl shadow-card p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] uppercase tracking-widest text-brand font-bold">
          Bienvenue — 30 secondes pour calibrer tes conseils
        </span>
        <span className="font-mono text-[11px] text-faint">
          {step + 1} / {STEPS.length}
        </span>
      </div>
      {/* Progression */}
      <div className="flex gap-1.5 mb-5">
        {STEPS.map((_, i) => (
          <div
            key={i}
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
      {step > 0 && (
        <button
          onClick={() => setStep(step - 1)}
          className="mt-4 text-[11.5px] text-faint hover:text-muted"
        >
          ← question précédente
        </button>
      )}
      {pending && <p className="mt-3 text-[12px] text-brand font-medium">Ton profil se met en place…</p>}
    </div>
  );
}
