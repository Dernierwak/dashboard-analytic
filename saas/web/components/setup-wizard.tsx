"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { OnboardingCard } from "@/components/onboarding-card";
import { CreateLabel } from "@/components/label-manager";
import { fmtCHF, type Couverture } from "@/components/labels-modele";
import { togglePriorityLabel } from "@/app/actions";
import { ChoixJour } from "@/components/choix-jour";
import { JOURS, delai, enFrancais, prochainPassage } from "@/lib/jour-de-travail";

// Parcours de démarrage — 3 étapes, quittable et reprenable :
//   1. Ton profil (questions au clic, puis ton site — OnboardingCard)
//   2. « Construis tes thèmes » — à la main ; l'IA complète à chaque récolte
//   3. Étoile tes thèmes — on travaille dessus, et l'IA rédige les 3 premiers
// puis LA CLÔTURE : le jour où tu veux être servi.
//
// L'ÉTAPE 2 A PERDU SON BOUTON IA, ET LE CLASSEMENT N'A PAS BOUGÉ. « ✨ Classer
// mes contenus » était l'un des quatre déclencheurs que le client avait en
// main ; les quatre sont sortis
// (`.scratch/construction/issues/15-le-client-ne-declenche-plus-rien.md`). Le
// classement IA tourne dans le même passage que la récolte, à chaque Jour de
// travail. L'étape dit donc ce qui se passe et quand, au lieu de proposer un
// geste qui n'existe plus — et elle continue de réclamer UN thème écrit à la
// main (ADR 0002) : c'est le seul moyen d'entrer un mot qui soit VRAIMENT
// celui du client.
//
// LA CLÔTURE PORTE LE JOUR DE TRAVAIL. « Le Jour de travail se choisit à la
// clôture du fil de démarrage » — la dernière chose qu'on demande, une fois
// qu'il y a quelque chose à servir. Elle ne se rejoue pas : `fetch_schedule`
// vaut « Monday » par défaut en base et rien ne distingue un défaut d'un choix,
// donc ce n'est pas une étape qu'on pourrait rouvrir plus tard sans mentir. Le
// réglage reste disponible en permanence sur la page Connexions.
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
  jourDeTravail,
  maintenantIso,
}: {
  onboarded: boolean;
  couverture: Couverture;
  themes: string[];
  priorities: string[];
  /** Le jour servi aujourd'hui (`profiles.fetch_schedule`), pour la clôture. */
  jourDeTravail: string;
  /** L'heure du serveur, figée au rendu : le calcul du prochain passage est
   *  donc le même des deux côtés de l'hydratation. */
  maintenantIso: string;
}) {
  const [snoozed, setSnoozed] = useState(true); // true au 1er rendu → pas de flash
  const [picked, setPicked] = useState<string[]>(priorities);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [jour, setJour] = useState(
    JOURS.some((j) => j.en === jourDeTravail) ? jourDeTravail : "Monday"
  );
  // La clôture ne s'ouvre QUE sur le clic de fin du fil, jamais au retour sur
  // la page : rien en base ne distingue « Monday choisi » de « Monday par
  // défaut », donc rejouer l'étape redemanderait un choix déjà fait.
  const [cloture, setCloture] = useState(false);

  useEffect(() => {
    setSnoozed(localStorage.getItem(SNOOZE_KEY) === "1");
  }, []);

  // Étape 1 — profil (le composant gère ses questions et sa sauvegarde)
  if (!onboarded) return <OnboardingCard />;

  const needLabels = couverture.total > 0 && couverture.sansTheme > 0;
  const needPriorities = themes.length > 0 && priorities.length === 0 && !done;

  // LA CLÔTURE — la dernière question du fil, et la seule qui porte sur le
  // RYTHME plutôt que sur le contenu. Elle passe avant les autres sorties :
  // une fois les priorités enregistrées, `needPriorities` tombe à faux et le
  // composant rendrait `null` au clic même qui vient de terminer le fil.
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
          Une fois par semaine, Pulse va chercher tes chiffres, les range par thème et
          réécrit tes conseils. Choisis le jour où tu veux les lire — c&apos;est le seul
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
          qui rapporte, et ce que ça coûte, thème par thème</span>. Écris les tiens :
          ce sont TES mots. À chaque récolte, l&apos;IA pose ensuite un thème sur tout ce
          qui n&apos;en a pas — elle complète sans jamais réécrire un choix que tu as fait.
        </p>
        <p className="text-[12px] text-warn font-semibold mb-3">
          {couverture.sansTheme} élément{couverture.sansTheme > 1 ? "s" : ""} sur{" "}
          {couverture.total} encore sans thème.
        </p>
        <div className="mb-3">
          <CreateLabel />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
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
          const horsConseils = rang >= 3;
          // `undefined` (thème jamais assigné) n'affiche rien — un « 0 CHF »
          // écrit là où rien n'a été mesuré serait un chiffre faux (§7, CLAUDE.md).
          const depense = depenseParTheme.get(t);
          return (
            <button
              key={t}
              disabled={pending}
              onClick={() => toggle(t)}
              className={`text-[13.5px] font-semibold rounded-full border px-4 py-2.5 transition-colors disabled:opacity-40 ${
                horsConseils
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
          Les {picked.length - 3} derniers cochés auront leur carte et leurs chiffres,
          mais aucun conseil — Pulse travaille sur les 3 premiers, et seulement eux.
        </p>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          disabled={picked.length === 0 || pending}
          onClick={() => {
            setDone(true);
            setCloture(true);
          }}
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
