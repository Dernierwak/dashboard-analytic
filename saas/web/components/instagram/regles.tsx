"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { BoutonMenu, Menu, useFermeture } from "@/components/meta/bandeau";
import { Icone } from "@/components/meta/elements";
import { lienInstagram, type Params } from "@/lib/instagram/liens";
import { ALLUME, nombreDeRegles, PARAM_REGLE, SANS_REGLES, type Regles } from "@/lib/instagram/regles";
import { COEF_HORS_NORME } from "@/lib/instagram/lecture";

// ── LE BOUTON « RÈGLES DE LECTURE » DU BANDEAU ───────────────────────────────
//
// Spec `.scratch/instagram/spec.md`, § Bandeau (« le bouton discret Règles de
// lecture, compteur · n quand un filtre est coché ») et § L'état de la page
// vit dans l'URL. Chaque case est un LIEN qui ne change que son paramètre :
// rien n'est mémorisé, un lien partagé rouvre la même lecture (user story 5).
// Le menu est celui du Bandeau Meta (`Menu`, `useFermeture` : clic dehors,
// Échap).

const CASES: { cle: keyof Regles; nom: string; aide: string }[] = [
  {
    cle: "sansBoostes",
    nom: "Sans les boostés",
    aide: "Retire de toutes les foules les posts sur lesquels Instagram a listé une annonce.",
  },
  {
    cle: "sansHorsNorme",
    nom: "Sans les hors norme",
    aide: `Retire les posts au-delà de ${String(COEF_HORS_NORME).replace(".", ",")} × l'écart entre le bas et le haut de tes habitudes, sur la métrique affichée — calculé une fois.`,
  },
];

export function ReglesDeLecture({ params, regles }: { params: Params; regles: Regles }) {
  const id = useId();
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [fermer] = useState(() => () => setOuvert(false));
  const [zones] = useState(() => [bouton, menu]);
  useFermeture(ouvert, fermer, zones);
  const n = nombreDeRegles(regles);

  return (
    <>
      <BoutonMenu
        ouvert={ouvert}
        basculer={() => setOuvert((o) => !o)}
        controle={`${id}-menu`}
        bouton={bouton}
        etiquette={n ? `Règles de lecture : ${n} filtre${n > 1 ? "s" : ""}` : "Règles de lecture"}
        className="shrink-0"
      >
        <span>Règles de lecture</span>
        {n > 0 && <span className="tabular-nums text-muted">· {n}</span>}
      </BoutonMenu>
      <Menu ouvert={ouvert} ref_={menu} className="w-[min(340px,calc(100vw-32px))]">
        <div id={`${id}-menu`} className="p-2">
          <ul>
            {CASES.map((c) => {
              const coche = regles[c.cle];
              return (
                <li key={c.cle}>
                  <Link
                    href={lienInstagram(params, { [PARAM_REGLE[c.cle]]: coche ? null : ALLUME })}
                    scroll={false}
                    role="menuitemcheckbox"
                    aria-checked={coche}
                    onClick={fermer}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${coche ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
                      aria-hidden
                    >
                      {coche && <Icone nom="coche" className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-medium text-ink">{c.nom}</span>
                      <span className="block text-[12px] leading-snug text-muted">{c.aide}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-1 border-t border-line px-3 pt-2.5 text-[11.5px] leading-snug text-faint">
            Rien n&apos;est mémorisé : la page s&apos;ouvre toujours sur les règles standard. La Tendance n&apos;est pas filtrée.
          </p>
          {n > 0 && (
            <Link
              href={lienInstagram(params, SANS_REGLES)}
              scroll={false}
              onClick={fermer}
              className="mt-1 block rounded-xl px-3 py-2 text-[13px] font-medium text-ink underline-offset-2 hover:underline"
            >
              Revenir aux règles standard
            </Link>
          )}
        </div>
      </Menu>
    </>
  );
}
