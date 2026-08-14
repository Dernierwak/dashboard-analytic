"use client";

import { useState, useTransition } from "react";
import { saveOnboarding, saveSiteClient } from "@/app/actions";

// Onboarding express — 5 questions au clic, puis une adresse, 30 secondes.
// Le profil calibre la mission, les repères des conseils et le persona IA.
//
// POURQUOI LE SITE ARRIVE EN DERNIER
// C'est la seule question qui réclame un clavier. Placée en tête, elle
// remplacerait « une réponse en un clic » par « un champ vide et un clavier qui
// monte » au moment précis où personne n'est encore engagé — le pire endroit du
// parcours pour demander un effort. Placée en fin, elle profite des cinq clics
// déjà donnés, et le prix d'un refus y est nul : la barre est à 6/6, l'écran
// suivant est le rapport, et « Je n'ai pas de site » termine aussi bien que
// « Terminer ». Elle gagne en plus le contexte des réponses précédentes —
// après avoir dit « e-commerce » et « plus de ventes », donner son domaine est
// la suite évidente, pas une question de plus.
//
// ELLE NE BLOQUE JAMAIS. Le bouton qui passe reste actif même quand le champ
// contient une adresse refusée : une saisie invalide ne doit pas pouvoir
// retenir quelqu'un dans un parcours dont ce champ n'est même pas l'objet.
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

// Le site occupe une étape de plus que les questions au clic.
const TOTAL = STEPS.length + 1;

// DEUX ERREURS QUI NE SE RESSEMBLENT PAS.
//
// `champ: true`  — l'adresse est refusée. Elle se dit SUR le champ (bordure
//                  rouge, `aria-invalid`), parce que c'est le champ qu'il faut
//                  corriger.
// `champ: false` — l'enregistrement du PROFIL a échoué. Le champ n'y est pour
//                  rien : le colorer accuserait la seule chose que la personne
//                  ne doit pas toucher. Elle se dit dans un encadré à part, qui
//                  porte en plus la seule information qui compte à cet
//                  instant — les réponses sont toujours là, il suffit de
//                  recliquer.
type Souci = { texte: string; champ: boolean };

export function OnboardingCard() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [site, setSite] = useState("");
  const [erreur, setErreur] = useState<Souci | null>(null);
  const [pending, startTransition] = useTransition();

  const surLeSite = step === STEPS.length;
  const current = STEPS[step];

  const pick = (value: string) => {
    setAnswers({ ...answers, [current.key]: value });
    setStep(step + 1); // rien n'est écrit avant la dernière étape
  };

  // Termine le parcours. `adresse` vide = on n'appelle même pas l'action du
  // site : le profil part seul, et rien ne peut échouer sur un champ facultatif.
  //
  // RIEN N'EST JAMAIS PERDU ICI. Les six réponses vivent dans l'état de ce
  // composant, et un échec ne le démonte pas : il pose une phrase et rend la
  // main. Recliquer « Terminer » rejoue exactement le même envoi — les deux
  // actions sont des `update`, les rejouer ne crée rien en double.
  const terminer = (adresse: string) => {
    setErreur(null);
    startTransition(async () => {
      try {
        if (adresse.trim()) {
          // Le site D'ABORD : s'il est refusé, le profil n'est pas encore écrit,
          // la personne reste sur l'étape et peut corriger — ou passer.
          const r = await saveSiteClient(adresse);
          if (!r.ok) {
            setErreur({
              texte: r.message ?? "Cette adresse n'a pas été acceptée.",
              // Une session expirée n'est pas un défaut de l'adresse : elle ne
              // colore pas le champ, sinon on envoie corriger ce qui est juste.
              champ: r.message !== "Ta session a expiré — reconnecte-toi.",
            });
            return;
          }
        }
        // `saveOnboarding` révalide « / » : quand elle passe, la carte
        // disparaît, on est arrivé. Quand elle refuse, elle le DIT — sans ce
        // retour lu, un refus (lecture seule, session expirée) laissait la
        // personne croire son profil enregistré.
        const p = await saveOnboarding(answers as {
          objectif: string;
          business_type: string;
          budget_range: string;
          time_budget: string;
          frustration: string;
        });
        if (!p.ok) {
          setErreur({
            texte: p.message ?? "Tes réponses n'ont pas pu être enregistrées.",
            champ: false,
          });
        }
      } catch {
        // Une action serveur peut encore rejeter sans passer par `ok`
        // (réseau coupé, déploiement en cours). Même traitement : une phrase,
        // et la carte reste debout avec ses réponses.
        setErreur({
          texte:
            "L'enregistrement n'est pas passé — vérifie ta connexion. Rien n'est perdu.",
          champ: false,
        });
      }
    });
  };

  return (
    <div className="bg-white border border-brand/20 rounded-xl shadow-card p-6 mb-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-[10px] uppercase tracking-widest text-brand font-bold">
          Bienvenue — 30 secondes pour calibrer tes conseils
        </span>
        <span className="font-mono text-[11px] text-faint shrink-0">
          {step + 1} / {TOTAL}
        </span>
      </div>
      {/* Progression */}
      <div className="flex gap-1.5 mb-5">
        {Array.from({ length: TOTAL }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= step ? "bg-brand" : "bg-black/[0.06]"}`}
          />
        ))}
      </div>

      {surLeSite ? (
        <>
          <h2 className="font-serif text-[22px] text-ink leading-tight mb-2">
            Ton site, si tu en as un ?
          </h2>
          <p className="text-[13px] text-muted leading-relaxed mb-4">
            Le domaine suffit. Il nous dit <span className="font-semibold text-ink">ce que tu
            vends et où ta pub atterrit</span> — c&apos;est ce qui sépare un conseil qui parle
            de tes produits d&apos;un conseil qui parle de chiffres. Pas de site, ou pas
            envie maintenant ? On continue sans, tu pourras l&apos;ajouter plus tard.
          </p>
          <input
            type="url"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            disabled={pending}
            value={site}
            onChange={(e) => {
              setSite(e.target.value);
              if (erreur) setErreur(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !pending) terminer(site);
            }}
            placeholder="boutique-du-velo.ch"
            aria-label="Adresse de ton site"
            aria-invalid={Boolean(erreur?.champ)}
            className={`w-full text-[14px] text-ink rounded-xl border px-4 py-3 outline-none transition-colors placeholder:text-faint disabled:opacity-50 ${
              erreur?.champ ? "border-red-400 focus:border-red-500" : "border-line focus:border-brand"
            }`}
          />
          {erreur?.champ && (
            <p role="alert" className="mt-2 text-[12px] text-red-600 leading-relaxed">
              {erreur.texte}
            </p>
          )}
          {/* L'échec du PROFIL — encadré à part, et il commence par ce qui
              rassure : les réponses n'ont pas bougé. Sans cette phrase, la
              seule conclusion raisonnable est « j'ai tout perdu ». */}
          {erreur && !erreur.champ && (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-neg/25 bg-neg/[0.04] px-4 py-3"
            >
              <div className="text-[10px] uppercase tracking-widest text-neg font-bold mb-1">
                Rien n&apos;a été enregistré
              </div>
              <p className="text-[12.5px] text-ink leading-relaxed">
                {erreur.texte}{" "}
                <span className="font-semibold">
                  Tes {STEPS.length} réponses sont toujours là
                </span>{" "}
                — reclique sur Terminer, il n&apos;y a rien à retaper.
              </p>
            </div>
          )}
          <div className="flex items-center gap-3 flex-wrap mt-4">
            <button
              disabled={pending}
              onClick={() => terminer(site)}
              className="text-[12.5px] font-semibold text-white bg-brand rounded-full px-5 py-2.5 hover:bg-brand/90 disabled:opacity-40"
            >
              Terminer
            </button>
            {/* Toujours actif, même sur une adresse refusée : un champ
                facultatif n'a pas le droit de retenir qui que ce soit. */}
            <button
              disabled={pending}
              onClick={() => terminer("")}
              className="text-[12px] text-faint hover:text-muted px-2 py-2 disabled:opacity-40"
            >
              Je n&apos;ai pas de site
            </button>
          </div>
        </>
      ) : (
        <>
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
        </>
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
