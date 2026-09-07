"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { OnboardingCard } from "@/components/onboarding-card";
import { ClassifyButton } from "@/components/classify-button";
import { CreateLabel } from "@/components/label-manager";
import { fmtCHF, type Couverture } from "@/components/labels-modele";
import { togglePriorityLabel } from "@/app/actions";

// Parcours de démarrage — 3 étapes, quittable et reprenable :
//   1. Ton profil (questions au clic, puis ton site — OnboardingCard)
//   2. « Construis tes thèmes » — à la main, via l'IA, ou les deux
//   3. Étoile tes thèmes — on travaille dessus, et l'IA rédige les 3 premiers
// L'état vient des DONNÉES (profil rempli ? contenus classés ? priorités posées ?)
// → quitter et revenir reprend exactement où on en était. « Plus tard » se
// mémorise en local et laisse un rappel discret.
//
// L'ÉTAPE 2 SE PILOTE SUR `couverture` (`lib/couverture.ts`), PAS SUR
// `report.matrice.coverage`. La première version lisait le rapport hebdo déjà
// publié — donc `null`, et l'étape invisible, sur tout compte assez récent
// pour n'avoir encore AUCUN rapport. `couverture` est une lecture live des
// tables, disponible dès la première campagne récoltée ; c'est aussi le
// chiffre qu'utilisent déjà `labels-couverture.tsx` (page Thèmes) et
// `AlerteThemes` (juste au-dessus, sur cette même page) — un seul compteur
// « combien il en reste », jamais deux qui pourraient diverger.

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
  couverture,
  themes,
  priorities,
}: {
  onboarded: boolean;
  couverture: Couverture;
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

  const needLabels = couverture.total > 0 && couverture.sansTheme > 0;
  const needPriorities = themes.length > 0 && priorities.length === 0 && !done;

  if (!needLabels && !needPriorities) return null;

  // Gate dur — voir `docs/adr/0002-onboarding-gate-theme-minimum.md` : on ne
  // sort de l'étape 2 (ni par « Plus tard », ni par un `snoozed` déjà posé en
  // localStorage avant l'ADR) tant qu'aucun thème n'existe. Un seul thème,
  // même large, suffit à débloquer — c'est l'exception « offre unique »
  // décrite dans l'ADR, pas un cas à coder à part.
  const gateThemeManquant = needLabels && themes.length === 0;

  if (snoozed && !gateThemeManquant) {
    return (
      <button
        onClick={() => {
          localStorage.removeItem(SNOOZE_KEY);
          setSnoozed(false);
        }}
        className="mb-8 text-[12px] font-semibold text-brand border border-brand/25 rounded-full px-4 py-2 hover:bg-brand/[0.05]"
      >
        ▸ Reprendre la mise en place ({needLabels ? "tes thèmes" : "tes priorités"})
      </button>
    );
  }

  const snooze = () => {
    localStorage.setItem(SNOOZE_KEY, "1");
    setSnoozed(true);
  };

  // Étape 2 — construire le vocabulaire, à la main ET/OU via l'IA. Les deux
  // écritures cohabitent volontairement au lieu de se succéder : taper un
  // premier thème donne la sensation de le construire soi-même (le mot est le
  // sien), le bouton IA à côté complète sans imposer d'ordre. Le compteur
  // vient de `couverture` — le MÊME nombre qu'affichera la page Thèmes une
  // fois qu'on y sera, jamais un calcul à part qui pourrait diverger.
  if (needLabels) {
    return (
      <StepShell step={2} title="Construis tes thèmes">
        <p className="text-[13px] text-muted leading-relaxed mb-1">
          Un thème regroupe tes campagnes et tes posts par sujet (« e-bike », « promo
          été »…) — c&apos;est ce qui permet de savoir <span className="font-semibold text-ink">ce
          qui rapporte, et ce que ça coûte, thème par thème</span>. Écris les tiens, ou
          laisse l&apos;IA proposer à partir de ton profil et de tes légendes — elle
          complète sans jamais réécrire un choix que tu as fait.
        </p>
        <p className="text-[12px] text-warn font-semibold mb-3">
          {couverture.sansTheme} élément{couverture.sansTheme > 1 ? "s" : ""} sur{" "}
          {couverture.total} encore sans thème.
        </p>
        <div className="mb-3">
          <CreateLabel />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ClassifyButton themes={themes} />
          {gateThemeManquant ? (
            <span className="text-[11.5px] text-faint max-w-[38ch] leading-relaxed">
              Crée au moins un thème pour continuer — même un seul, large, si
              ton offre est homogène.
            </span>
          ) : (
            <button onClick={snooze} className="text-[12px] text-faint hover:text-muted px-2 py-2">
              Plus tard
            </button>
          )}
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

  // La récompense de l'étape 2 s'affiche ICI, pas à part : `depenseParTheme`
  // vient du MÊME `couverture.parTheme` que le camembert de la page Thèmes
  // (`labels-couverture.tsx`) — aucune requête de plus, et le moment où on
  // choisit ses priorités est exactement celui où voir ce que chacune a déjà
  // coûté est utile, pas un aparté sans rapport avec la décision en cours.
  const depenseParTheme = new Map(couverture.parTheme.map((t) => [t.label, t.depense]));
  const aDesMontants = couverture.parTheme.some((t) => t.depense > 0);

  return (
    <StepShell step={3} title="Sur quoi veux-tu qu'on travaille ?">
      <p className="text-[13px] text-muted leading-relaxed mb-4">
        On ne peut pas tout améliorer à la fois. Choisis d&apos;abord{" "}
        <span className="font-semibold text-ink">tes 3 thèmes principaux</span> — ce sont
        eux que l&apos;IA rédige. Tu peux en cocher d&apos;autres : ils auront leur bilan
        et leurs conseils calculés, sans les pistes de l&apos;IA.{" "}
        {aDesMontants && (
          <>Voilà déjà <span className="font-semibold text-ink">ce que chacun t&apos;a coûté</span> sur
          {" "}{couverture.fenetreLongue} — de quoi choisir en connaissance de cause. </>
        )}
        Tu pourras en changer quand tu veux sur la page{" "}
        <Link href="/labels" className="text-brand font-semibold hover:underline">◫ Thèmes</Link>.
      </p>
      <div className="flex flex-wrap gap-2.5 mb-5">
        {themes.map((t) => {
          const rang = picked.indexOf(t);
          const active = rang >= 0;
          // Au-delà du troisième, la pastille reste cochable mais s'affiche en
          // creux : c'est le seul endroit où l'ordre des clics se voit.
          const horsIa = rang >= 3;
          // `undefined` (thème jamais assigné) n'affiche rien — un « 0 CHF »
          // écrit là où rien n'a été mesuré serait un chiffre faux (§7, CLAUDE.md).
          const depense = depenseParTheme.get(t);
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
              {depense !== undefined && (
                <span className={`ml-1.5 font-mono text-[11.5px] font-normal ${active ? "text-white/75" : "text-faint"}`}>
                  {fmtCHF(depense)} CHF
                </span>
              )}
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
