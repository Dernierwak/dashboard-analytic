"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { OnboardingCard } from "@/components/onboarding-card";
import { ClassifyButton } from "@/components/classify-button";
import { togglePriorityLabel } from "@/app/actions";

// Parcours de démarrage — 3 étapes, quittable et reprenable :
//   1. Ton profil (questions au clic, puis ton site — OnboardingCard)
//   2. « On classe tes contenus ? » — l'IA labellise selon le profil (ou Plus tard)
//   3. Étoile tes thèmes — on travaille dessus, et l'IA rédige les 3 premiers
// L'état vient des DONNÉES (profil rempli ? contenus classés ? priorités posées ?)
// → quitter et revenir reprend exactement où on en était. « Plus tard » se
// mémorise en local et laisse un rappel discret.

const SNOOZE_KEY = "pulse_setup_snooze";

function StepShell({
  step,
  title,
  children,
}: {
  step: 2 | 3;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-brand/20 rounded-xl shadow-card p-5 sm:p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] uppercase tracking-widest text-brand font-bold">
          Mise en place — encore {step === 2 ? "2 étapes" : "1 étape"}
        </span>
        <span className="font-mono text-[11px] text-faint">{step} / 3</span>
      </div>
      <div className="flex gap-1.5 mb-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= step ? "bg-brand" : "bg-black/[0.06]"}`}
          />
        ))}
      </div>
      <h2 className="font-serif text-[22px] text-ink leading-tight mb-2">{title}</h2>
      {children}
    </div>
  );
}

export function SetupWizard({
  onboarded,
  toLabel,
  themes,
  priorities,
}: {
  onboarded: boolean;
  // Items encore sans thème (null = pas encore mesurable : pas de rapport publié)
  toLabel: { posts: number; camps: number } | null;
  themes: string[];
  priorities: string[];
}) {
  const [snoozed, setSnoozed] = useState(true); // true au 1er rendu → pas de flash
  const [picked, setPicked] = useState<string[]>(priorities);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  useEffect(() => {
    setSnoozed(localStorage.getItem(SNOOZE_KEY) === "1");
  }, []);

  // Étape 1 — profil (le composant gère ses questions et sa sauvegarde)
  if (!onboarded) return <OnboardingCard />;

  const needLabels = toLabel !== null && toLabel.posts + toLabel.camps > 0;
  const needPriorities = themes.length > 0 && priorities.length === 0 && !done;

  if (!needLabels && !needPriorities) return null;

  if (snoozed) {
    return (
      <button
        onClick={() => {
          localStorage.removeItem(SNOOZE_KEY);
          setSnoozed(false);
        }}
        className="mb-8 text-[12px] font-semibold text-brand border border-brand/25 rounded-full px-4 py-2 hover:bg-brand/[0.05]"
      >
        ▸ Reprendre la mise en place ({needLabels ? "classement des contenus" : "tes priorités"})
      </button>
    );
  }

  const snooze = () => {
    localStorage.setItem(SNOOZE_KEY, "1");
    setSnoozed(true);
  };

  // Étape 2 — labellisation IA
  if (needLabels) {
    const parts = [
      toLabel!.posts > 0 ? `${toLabel!.posts} post${toLabel!.posts > 1 ? "s" : ""}` : null,
      toLabel!.camps > 0 ? `${toLabel!.camps} campagne${toLabel!.camps > 1 ? "s" : ""}` : null,
    ].filter(Boolean);
    return (
      <StepShell step={2} title="On classe tes contenus ?">
        <p className="text-[13px] text-muted leading-relaxed mb-4">
          L&apos;IA lit tes posts et tes campagnes et donne un thème à chacun
          (« e-bike », « promo été »…), en tenant compte de ton profil. C&apos;est la
          base de tes conseils : on saura enfin <span className="font-semibold text-ink">ce
          qui rapporte, thème par thème</span>. {parts.join(" et ")} à classer — environ
          une minute, et tu peux corriger chaque thème après.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <ClassifyButton />
          <button onClick={snooze} className="text-[12px] text-faint hover:text-muted px-2 py-2">
            Plus tard
          </button>
        </div>
      </StepShell>
    );
  }

  // Étape 3 — les priorités. TROIS N'EST PLUS UN PLAFOND : c'est le nombre de
  // thèmes que l'IA rédige. On peut en choisir plus — les suivants reçoivent
  // leur carte entière, avec les conseils calculés par les règles, sans pistes
  // rédigées. Le bouton n'est donc plus désactivé au quatrième clic ; l'ordre
  // des clics devient en revanche porteur de sens, et c'est ce que le rang
  // affiché sur chaque pastille rend visible.
  const toggle = (name: string) => {
    const active = picked.includes(name);
    setPicked(active ? picked.filter((p) => p !== name) : [...picked, name]);
    startTransition(async () => {
      await togglePriorityLabel(name, active);
    });
  };

  return (
    <StepShell step={3} title="Sur quoi veux-tu qu'on travaille ?">
      <p className="text-[13px] text-muted leading-relaxed mb-4">
        On ne peut pas tout améliorer à la fois. Choisis d&apos;abord{" "}
        <span className="font-semibold text-ink">tes 3 thèmes principaux</span> — ce sont
        eux que l&apos;IA rédige. Tu peux en cocher d&apos;autres : ils auront leur bilan
        et leurs conseils calculés, sans les pistes de l&apos;IA. Tu pourras en changer
        quand tu veux sur la page{" "}
        <Link href="/labels" className="text-brand font-semibold hover:underline">◫ Thèmes</Link>.
      </p>
      <div className="flex flex-wrap gap-2.5 mb-5">
        {themes.map((t) => {
          const rang = picked.indexOf(t);
          const active = rang >= 0;
          // Au-delà du troisième, la pastille reste cochable mais s'affiche en
          // creux : c'est le seul endroit où l'ordre des clics se voit.
          const horsIa = rang >= 3;
          return (
            <button
              key={t}
              disabled={pending}
              onClick={() => toggle(t)}
              className={`text-[13.5px] font-semibold rounded-full border px-4 py-2.5 transition-colors disabled:opacity-40 ${
                horsIa
                  ? "bg-white text-brand border-brand"
                  : active
                    ? "bg-brand text-white border-brand"
                    : "border-line text-ink bg-white hover:border-brand/50"
              }`}
            >
              {active ? `★${rang + 1} ` : ""}{t}
            </button>
          );
        })}
      </div>
      {picked.length > 3 && (
        <p className="text-[11.5px] text-muted leading-relaxed mb-4 max-w-[62ch]">
          Les {picked.length - 3} derniers cochés auront leur carte et leurs conseils
          calculés, mais pas de pistes rédigées par l&apos;IA — elle travaille les
          3 premiers.
        </p>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          disabled={picked.length === 0 || pending}
          onClick={() => setDone(true)}
          className="text-[12.5px] font-semibold text-white bg-brand rounded-full px-5 py-2.5 hover:bg-brand/90 disabled:opacity-40"
        >
          C&apos;est parti ({picked.length} thème{picked.length > 1 ? "s" : ""})
        </button>
        <button onClick={snooze} className="text-[12px] text-faint hover:text-muted px-2 py-2">
          Plus tard
        </button>
      </div>
    </StepShell>
  );
}
