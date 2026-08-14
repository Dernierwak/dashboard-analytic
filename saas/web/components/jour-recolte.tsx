"use client";

import { useState, useTransition } from "react";
import { choisirJourRecolte } from "@/app/actions-compte";

// LE JOUR DE LA RÉCOLTE — `profiles.fetch_schedule`, lu par le worker
// (`saas/worker/fetch_all.py`, `_due_today`) qui compare au jour courant en
// anglais et retombe sur lundi quand rien n'est réglé.
//
// Le module suit la grammaire (docs/03-grammaire-des-modules.md) :
//
//   rang 1  titre de lecture — c'est un module qu'on LIT, pas une tuile qu'on
//           scanne : il porte une décision et deux phrases d'honnêteté ;
//   rang 2  la sortie, à droite du titre — le lien vers la récolte immédiate.
//           Sans lui, régler « vendredi » un mardi se lit « j'attends trois
//           jours », alors qu'un bouton force la récolte tout de suite ;
//   rang 3  LE chiffre. Il n'est pas un nombre ici, et c'est voulu : « Monday »
//           ne se lit pas, « lundi 17 août » se comprend. Le mono, qui sert à
//           aligner des chiffres entre eux, n'alignerait rien — le reste de la
//           règle tient : premier élément, le plus gros, aucune forme avant lui ;
//   rang 5  le délai, immédiatement sous le chiffre, avec son mot ;
//   rang 8  le pilotage, EN BAS — les sept jours. C'est la seule forme du
//           module : une semaine dessinée en sept unités qu'on peut cliquer.
//           En faire aussi un rang 6 décoratif au-dessus donnerait deux fois le
//           même objet ;
//   rang 9  un seul pied, et il dit la limite réelle : la récolte tourne à
//           heure fixe, le jour choisi n'est pas une heure garantie.

// L'ordre est celui de la semaine, pas celui de `getUTCDay()` (qui commence le
// dimanche). L'anglais est la valeur écrite en base ; le français ne sert qu'à
// l'écran.
const JOURS = [
  { en: "Monday", fr: "lundi", court: "lun" },
  { en: "Tuesday", fr: "mardi", court: "mar" },
  { en: "Wednesday", fr: "mercredi", court: "mer" },
  { en: "Thursday", fr: "jeudi", court: "jeu" },
  { en: "Friday", fr: "vendredi", court: "ven" },
  { en: "Saturday", fr: "samedi", court: "sam" },
  { en: "Sunday", fr: "dimanche", court: "dim" },
];

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// `.github/workflows/weekly-fetch.yml` : cron « 0 7 * * * ». Le worker compare
// ensuite `datetime.utcnow().strftime("%A")` — tout se joue donc en UTC, et
// c'est en UTC qu'on calcule le prochain passage.
const HEURE_UTC = 7;

/** 0 = lundi (getUTCDay met dimanche en 0). */
function indexSemaine(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

function prochainPassage(jourEn: string, maintenant: Date): { date: Date; delta: number } {
  const i = JOURS.findIndex((j) => j.en === jourEn);
  const cible = i < 0 ? 0 : i;
  let delta = (cible - indexSemaine(maintenant) + 7) % 7;
  // Le passage du jour est déjà parti : le prochain est dans une semaine.
  if (delta === 0 && maintenant.getUTCHours() >= HEURE_UTC) delta = 7;
  const date = new Date(
    Date.UTC(
      maintenant.getUTCFullYear(),
      maintenant.getUTCMonth(),
      maintenant.getUTCDate() + delta,
      HEURE_UTC
    )
  );
  return { date, delta };
}

// Les noms sont écrits à la main plutôt que confiés à `Intl` : le serveur (Node)
// et le navigateur ne portent pas toujours les mêmes données de locale, et deux
// rendus différents pour la même date, c'est une erreur d'hydratation.
function enFrancais(d: Date): string {
  return `${JOURS[indexSemaine(d)].fr} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}

function delai(delta: number): string {
  if (delta === 0) return "aujourd'hui";
  if (delta === 1) return "demain";
  return `dans ${delta} jours`;
}

export function JourRecolte({
  jour,
  maintenantIso,
  ancre = "#recolter",
}: {
  /** Valeur en base (`Monday`, …). Défaut lundi, comme le worker. */
  jour: string;
  /** L'heure du serveur, figée au rendu : le calcul est donc le même des deux
   *  côtés de l'hydratation. */
  maintenantIso: string;
  ancre?: string;
}) {
  const [choisi, setChoisi] = useState(JOURS.some((j) => j.en === jour) ? jour : "Monday");
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, demarrer] = useTransition();

  const maintenant = new Date(maintenantIso);
  const { date, delta } = prochainPassage(choisi, maintenant);

  const choisir = (en: string) => {
    if (en === choisi || pending) return;
    const avant = choisi;
    setChoisi(en); // la date de tête bouge tout de suite : c'est la réponse
    setErreur(null);
    demarrer(async () => {
      // Une action serveur qui LÈVE (session expirée, réseau coupé) rejette la
      // promesse sans jamais passer par `r.ok` : sans ce `catch`, le jour
      // resterait affiché comme enregistré alors que rien ne l'est, et la seule
      // trace serait une « unhandled rejection » dans la console.
      try {
        const r = await choisirJourRecolte(en);
        if (!r.ok) {
          setChoisi(avant);
          setErreur(r.message ?? "L'enregistrement a échoué.");
        }
      } catch {
        setChoisi(avant);
        setErreur(
          "L'enregistrement n'est pas passé. Recharge la page — si ta session a expiré, " +
            "il faudra te reconnecter."
        );
      }
    });
  };

  return (
    <section className="bg-white border border-line rounded-xl shadow-card p-5 mb-5">
      {/* rang 1 · rang 2 */}
      {/* Sur téléphone le titre prend sa ligne entière et la sortie passe
          dessous : à 375 px, « Le jour de ta / récolte. » se coupait en deux et
          le lien flottait au bout de la seconde ligne. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5 mb-4">
        <h2 className="w-full sm:w-auto font-serif text-[19px] sm:text-[21px] leading-tight text-ink flex items-center gap-2.5">
          <span className="inline-block h-[18px] w-[3px] rounded-full bg-brand shrink-0" aria-hidden />
          Le jour de ta récolte.
        </h2>
        <a
          href={ancre}
          className="text-[12px] font-semibold text-brand hover:underline whitespace-nowrap shrink-0"
        >
          récolter maintenant ↓
        </a>
      </div>

      {/* rang 3 — le jour servi, écrit pour être lu */}
      <div className="text-[30px] sm:text-[34px] leading-none font-semibold tracking-tight text-ink">
        {enFrancais(date)}
      </div>

      {/* rang 5 — le délai, immédiatement sous lui */}
      <p className="text-[12.5px] text-muted mt-2.5">
        prochaine récolte · <span className="font-semibold text-ink">{delai(delta)}</span>
      </p>

      {/* rang 8 — le pilotage, en bas */}
      <div className="mt-5 pt-4 border-t border-line">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-widest text-faint font-bold">
            Changer de jour
          </span>
          {pending && <span className="text-[10.5px] text-faint">enregistrement…</span>}
        </div>
        <div className="flex gap-1.5">
          {JOURS.map((j) => {
            const on = j.en === choisi;
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

      {/* rang 9 — un seul pied, et il dit la limite */}
      <p className="text-[11px] text-faint mt-4 leading-relaxed">
        La récolte est lancée une fois par jour à heure fixe (07:00 UTC) et ne traite que
        les comptes dont c&apos;est le jour : tu choisis le jour où tu es servi, pas la
        minute.
      </p>
    </section>
  );
}
