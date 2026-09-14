"use client";

// ── LE BANDEAU DE COMMANDES ──────────────────────────────────────────────────
//
// Un seul objet pour toute l'application : ce qui gouverne une page se lit
// avant elle, au même endroit, avec les mêmes gestes. Il remplace ce qui était
// écrit trois fois et dans trois vocabulaires — `PeriodPills` et `FilterBar`
// sur les pages payantes, `PeriodPillsInsta` sur Instagram, rien sur les
// autres. Forme et comportement tranchés par `.scratch/refonte/issues/12` puis
// `/15` ; ce fichier ne re-décide rien, il construit.
//
// LE BANDEAU EST LE TITRE DE LA PAGE. Il ne se pose pas AU-DESSUS du titre : il
// l'absorbe. C'est la seule réponse structurelle à la demande de David — « pas
// la sensation d'avoir une barre qui nous suit » : aucun objet neuf n'entre
// jamais à l'écran, c'est celui qui était déjà là qui maigrit. Georgia 34 px
// devient 17 px, la hauteur passe de ~78 px à ~44 px.
//
// LE REPLI NE FAIT RIEN TOMBER, IL FUSIONNE. Demande de David en retenant la
// forme : « les laisser aussi quand on scrolle, qu'ils soient toujours là, que
// je peux les utiliser après ». Un filtre qu'on ne peut plus toucher sans
// remonter en haut de page n'est pas replié, il est retiré — et c'est
// justement en bas de page, devant la table des campagnes, qu'on veut cocher
// un thème. Les deux lignes deviennent donc une seule, et tout y reste vivant.
//
// MÉCANIQUE DU REPLI : un seul conteneur `flex-wrap` et une COUPURE de largeur
// pleine (`basis-full`) insérée au repos, retirée au défilement. Rien ne se
// démonte ni ne se remonte — les contrôles gardent leur état et leur focus, ils
// changent seulement de gabarit. La période bascule en `order-last` pour rester
// à droite dans les deux dispositions ; sans ce basculement elle tomberait au
// bout de la SECONDE ligne au repos.
//
// UNE QUESTION, UN CONTRÔLE — ET RIEN QUI N'EST PAS POSÉ NE S'AFFICHE. Règle
// née du premier jet de 15, refusé par David : « c'est même pas bien ordonné,
// on voit pas les informations », « il y a deux fois le moyen de filtrer ». La
// période avait deux commandes qui ne se parlaient pas (les présélections d'un
// côté, la plage libre de l'autre) sans que rien ne dise qu'elles gouvernaient
// la même chose ni que poser l'une effaçait l'autre ; elles vivent maintenant
// sous un seul bouton. Un thème posé est un jeton qu'on retire, pas une
// pastille de plus dans une rangée de huit.
//
// LE MONO EST RÉSERVÉ AUX DONNÉES — les bornes de la fenêtre. « 30 derniers
// jours » et « Tout » sont des libellés : en chasse fixe ils prenaient le poids
// d'un chiffre et déséquilibraient la ligne.
//
// L'ÉTAT VIT DANS L'URL, jamais dans un `useState`. Les pages sont rendues côté
// serveur : c'est lui qui refiltre les chiffres, donc l'état doit voyager avec
// l'adresse. Effet de bord voulu — une vue filtrée se partage et se met en
// favori. Les liens se construisent sur `useSearchParams` : on énumère ce qu'on
// CHANGE, jamais ce qu'on garde (en-tête de `lib/liens.ts`).

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PRESETS, nomPeriode, nomStatut, type Commandes } from "@/lib/commandes";

function useEcriture() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const pousser = (q: URLSearchParams) => router.push(`${pathname}?${q.toString()}`);
  const depart = () => new URLSearchParams(sp.toString());

  return {
    periode: (v: number) => {
      const q = depart();
      // Poser une présélection efface la plage sur mesure, et inversement : les
      // laisser cohabiter rendrait l'une des deux inerte sans le dire —
      // `customWindow` prime sur `makeWindow` (`lib/channels.ts`), donc on
      // cliquerait « 7 j » et la plage libre continuerait de gouverner.
      q.delete("from");
      q.delete("to");
      if (v === 7) q.delete("d");
      else q.set("d", String(v));
      pousser(q);
    },
    plage: (de: string, a: string) => {
      const q = depart();
      q.set("from", de);
      q.set("to", a);
      q.delete("d");
      pousser(q);
    },
    theme: (t: string, actifs: string[]) => {
      const q = depart();
      q.delete("l");
      q.delete("label"); // l'ancien nom reste lu, plus jamais écrit (12 §5)
      const suivant = actifs.includes(t) ? actifs.filter((x) => x !== t) : [...actifs, t];
      for (const x of suivant) q.append("l", x);
      pousser(q);
    },
    simple: (cle: string, valeur: string) => {
      const q = depart();
      if (valeur) q.set(cle, valeur);
      else q.delete(cle);
      pousser(q);
    },
  };
}

/** Vrai dès qu'on a quitté le haut de la page. */
function useDefile(seuil = 24) {
  const [defile, setDefile] = useState(false);
  useEffect(() => {
    const sur = () => setDefile(window.scrollY > seuil);
    sur();
    window.addEventListener("scroll", sur, { passive: true });
    return () => window.removeEventListener("scroll", sur);
  }, [seuil]);
  return defile;
}

/** Un panneau ancré : clic dehors, Échap. Rien d'autre. */
function Flotte({
  ouvert,
  fermer,
  children,
  classe,
}: {
  ouvert: boolean;
  fermer: () => void;
  children: React.ReactNode;
  classe: string;
}) {
  const boite = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (!boite.current?.contains(e.target as Node)) fermer();
    };
    const echap = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    document.addEventListener("mousedown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("mousedown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert, fermer]);
  if (!ouvert) return null;
  return (
    <div ref={boite} className={classe}>
      {children}
    </div>
  );
}

const ANNEAU =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-1 focus-visible:ring-offset-canvas";
const PANNEAU =
  "absolute left-0 top-[calc(100%+8px)] z-40 rounded-2xl border border-line bg-white shadow-[0_12px_40px_-8px_rgba(14,15,18,0.18)]";

/** Présélections ET plage sur mesure, sous le même bouton : c'est le même
 *  réglage, il n'a donc qu'une commande. */
function MenuPeriode({
  p,
  fermer,
}: {
  p: NonNullable<Commandes["periode"]>;
  fermer: () => void;
}) {
  const ecrire = useEcriture();
  const [de, setDe] = useState(p.from ?? "");
  const [a, setA] = useState(p.to ?? "");
  const surMesure = Boolean(p.from && p.to);
  const valide = Boolean(de && a && de <= a);
  const champ = `rounded-lg border border-line bg-canvas px-2 py-1.5 text-[12px] font-mono text-ink ${ANNEAU}`;

  return (
    <div className="w-[292px] p-1.5">
      {PRESETS.map((x) => {
        const actif = !surMesure && p.jours === x.v;
        return (
          <button
            key={x.v}
            onClick={() => {
              ecrire.periode(x.v);
              fermer();
            }}
            className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-left transition-colors motion-reduce:transition-none ${ANNEAU} ${
              actif ? "bg-brand/[0.07] text-brand font-semibold" : "text-muted hover:bg-black/[0.04]"
            }`}
          >
            <span className={`w-3 text-[11px] ${actif ? "opacity-100" : "opacity-0"}`}>✓</span>
            {x.long}
          </button>
        );
      })}
      <div className="h-px bg-line my-1.5 mx-1" />
      <div className="px-2.5 pt-0.5 pb-1.5">
        <div className={`text-[12px] mb-2 ${surMesure ? "text-brand font-semibold" : "text-faint"}`}>
          {surMesure ? "✓ Période sur mesure" : "Période sur mesure"}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
            className={`${champ} flex-1 min-w-0`}
            aria-label="Premier jour"
          />
          <span className="text-faint text-[11px]">→</span>
          <input
            type="date"
            value={a}
            onChange={(e) => setA(e.target.value)}
            className={`${champ} flex-1 min-w-0`}
            aria-label="Dernier jour"
          />
        </div>
        <button
          onClick={() => {
            if (!valide) return;
            ecrire.plage(de, a);
            fermer();
          }}
          disabled={!valide}
          className={`mt-2 w-full rounded-lg bg-ink text-white text-[12.5px] font-semibold py-1.5 disabled:opacity-25 transition-opacity motion-reduce:transition-none ${ANNEAU}`}
        >
          Voir cette période
        </button>
      </div>
    </div>
  );
}

function MenuThemes({ themes, actifs }: { themes: string[]; actifs: string[] }) {
  const ecrire = useEcriture();
  return (
    <div className="w-[232px] p-1.5 max-h-[320px] overflow-y-auto defile">
      {themes.map((t) => {
        const on = actifs.includes(t);
        return (
          <button
            key={t}
            onClick={() => ecrire.theme(t, actifs)}
            className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-left transition-colors motion-reduce:transition-none ${ANNEAU} ${
              on ? "text-ink font-semibold" : "text-muted hover:bg-black/[0.04]"
            }`}
          >
            <span
              className={`h-[15px] w-[15px] rounded-[5px] border shrink-0 flex items-center justify-center text-[10px] leading-none ${
                on ? "bg-brand border-brand text-white" : "border-line bg-white"
              }`}
            >
              {on ? "✓" : ""}
            </span>
            <span className="truncate">{t}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Un choix unique — statut, campagne. Se cherche dès qu'il est long : une
 *  liste de quarante campagnes ne se parcourt pas à l'œil. */
function MenuChoix({
  options,
  valeur,
  vide,
  choisir,
  fermer,
}: {
  options: { cle: string; nom: string }[];
  valeur: string;
  vide: string;
  choisir: (v: string) => void;
  fermer: () => void;
}) {
  const [q, setQ] = useState("");
  const cherchable = options.length > 8;
  const vus = cherchable
    ? options.filter((o) => o.nom.toLowerCase().includes(q.toLowerCase()))
    : options;
  const ligne = (actif: boolean) =>
    `w-full rounded-lg px-2.5 py-2 text-[13px] text-left truncate transition-colors motion-reduce:transition-none ${ANNEAU} ${
      actif ? "bg-brand/[0.07] text-brand font-semibold" : "text-muted hover:bg-black/[0.04]"
    }`;
  return (
    <div className="w-[268px] p-1.5">
      {cherchable && (
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher…"
          className={`w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[12.5px] mb-1.5 ${ANNEAU}`}
        />
      )}
      <div className="max-h-[280px] overflow-y-auto defile">
        <button
          onClick={() => {
            choisir("");
            fermer();
          }}
          className={ligne(!valeur)}
        >
          {vide}
        </button>
        {vus.map((o) => (
          <button
            key={o.cle}
            onClick={() => {
              choisir(o.cle);
              fermer();
            }}
            className={ligne(valeur === o.cle)}
          >
            {o.nom}
          </button>
        ))}
        {vus.length === 0 && <p className="px-2.5 py-3 text-[12px] text-faint">Aucun résultat.</p>}
      </div>
    </div>
  );
}

/** Ce qu'un filtre posé devient : un jeton qu'on retire d'un geste. */
function Jeton({
  mot,
  retirer,
  petit,
}: {
  mot: string;
  retirer: () => void;
  petit: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-brand/[0.08] font-medium text-brand max-w-[180px] transition-all duration-300 motion-reduce:transition-none ${
        petit ? "h-6 gap-1 pl-2 pr-0.5 text-[11.5px]" : "h-7 gap-1.5 pl-2.5 pr-1 text-[12.5px]"
      }`}
    >
      <span className="truncate">{mot}</span>
      <button
        onClick={retirer}
        aria-label={`Retirer ${mot}`}
        className={`h-5 w-5 rounded-full flex items-center justify-center text-brand/60 hover:text-brand hover:bg-brand/10 shrink-0 ${ANNEAU} ${
          petit ? "text-[10px]" : "text-[11px]"
        }`}
      >
        ✕
      </button>
    </span>
  );
}

export function BandeauCommandes(c: Commandes) {
  const ecrire = useEcriture();
  const defile = useDefile();
  const [menu, setMenu] = useState<string | null>(null);

  const statuts = c.statuts ?? [];
  const campagnes = c.campagnes ?? [];
  const statutActif = c.statutActif ?? "";
  const campActive = c.campActive ?? "";
  const surMesure = Boolean(c.periode?.from && c.periode?.to);

  const puce = `rounded-full border border-line bg-white font-medium text-muted hover:border-ink/25 hover:text-ink transition-all duration-300 motion-reduce:transition-none ${ANNEAU} ${
    defile ? "h-6 px-2 text-[11.5px]" : "h-7 px-2.5 text-[12.5px]"
  }`;
  const segment = (actif: boolean) =>
    `rounded-md font-semibold transition-all duration-300 motion-reduce:transition-none ${ANNEAU} ${
      defile ? "h-6 px-2 text-[11.5px]" : "h-7 px-2.5 text-[12px]"
    } ${actif ? "bg-white text-ink shadow-[0_1px_2px_rgba(14,15,18,0.10)]" : "text-faint hover:text-muted"}`;

  const porte = (cle: string, mot: string, contenu: React.ReactNode) => (
    <div className="relative" key={cle}>
      <button
        onClick={() => setMenu(menu === cle ? null : cle)}
        aria-expanded={menu === cle}
        aria-haspopup="true"
        className={puce}
      >
        {mot}
      </button>
      <Flotte ouvert={menu === cle} fermer={() => setMenu(null)} classe={PANNEAU}>
        {contenu}
      </Flotte>
    </div>
  );

  return (
    <div
      className={`sticky top-[53px] lg:top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 bg-canvas/92 backdrop-blur transition-[padding,border-color] duration-300 motion-reduce:transition-none ${
        defile ? "py-2 border-b border-line" : "py-1 border-b border-transparent"
      }`}
    >
      <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
        <h1
          className={`font-serif text-ink leading-none whitespace-nowrap transition-all duration-300 motion-reduce:transition-none ${
            defile ? "text-[17px]" : "text-3xl sm:text-[34px]"
          }`}
        >
          {c.glyphe && <span style={{ color: c.couleur }}>{c.glyphe}</span>} {c.titre}
        </h1>

        {/* La période, toujours au bout de la ligne. Au repos elle est AVANT la
            coupure, donc au bout de la première ; fusionnée, `order-last` la
            renvoie au bout de la ligne unique. */}
        {c.periode && (
          <div className={`ml-auto flex items-center gap-2 shrink-0 ${defile ? "order-last" : ""}`}>
            <div
              className={`flex items-center gap-0.5 rounded-lg bg-black/[0.045] transition-all duration-300 motion-reduce:transition-none ${
                defile ? "p-0.5" : "p-1"
              }`}
            >
              {PRESETS.map((x) => (
                <button
                  key={x.v}
                  onClick={() => ecrire.periode(x.v)}
                  className={segment(!surMesure && c.periode!.jours === x.v)}
                >
                  {x.court}
                </button>
              ))}
            </div>
            <div className="relative">
              <button
                onClick={() => setMenu(menu === "d" ? null : "d")}
                aria-expanded={menu === "d"}
                aria-haspopup="true"
                title="Choisir une période sur mesure"
                className={`rounded-lg font-medium transition-all duration-300 motion-reduce:transition-none ${ANNEAU} ${
                  defile ? "h-6 px-2 text-[11.5px]" : "h-9 px-3 text-[12.5px]"
                } ${surMesure ? "bg-ink text-white" : "text-muted hover:bg-black/[0.05]"}`}
              >
                {surMesure ? nomPeriode(c.periode) : "Sur mesure"}
              </button>
              <Flotte
                ouvert={menu === "d"}
                fermer={() => setMenu(null)}
                classe={`${PANNEAU} left-auto right-0`}
              >
                <MenuPeriode p={c.periode} fermer={() => setMenu(null)} />
              </Flotte>
            </div>
          </div>
        )}

        {/* LA COUPURE. Présente, elle renvoie tout ce qui suit à la ligne ;
            retirée, la seconde ligne remonte dans la première. */}
        {!defile && <div className="basis-full h-0" aria-hidden />}

        {c.periode && (
          <>
            <span
              className={`font-mono text-faint whitespace-nowrap transition-all duration-300 motion-reduce:transition-none ${
                defile ? "text-[11px]" : "text-[12px]"
              }`}
            >
              {c.periode.fenetre}
            </span>
            <span className="h-3 w-px bg-line shrink-0" />
          </>
        )}

        {c.themesActifs.map((t) => (
          <Jeton
            key={t}
            mot={t}
            petit={defile}
            retirer={() => ecrire.theme(t, c.themesActifs)}
          />
        ))}
        {statutActif && (
          <Jeton
            mot={nomStatut(statutActif)}
            petit={defile}
            retirer={() => ecrire.simple("status", "")}
          />
        )}
        {campActive && (
          <Jeton
            mot={campagnes.find((x) => x.key === campActive)?.name ?? campActive}
            petit={defile}
            retirer={() => ecrire.simple("camp", "")}
          />
        )}

        {c.themes.length > 0 &&
          porte(
            "t",
            c.themesActifs.length === 0 ? "Filtrer par thème" : "+ Thème",
            <MenuThemes themes={c.themes} actifs={c.themesActifs} />
          )}
        {statuts.length > 1 &&
          porte(
            "s",
            "Statut",
            <MenuChoix
              options={statuts.map((x) => ({ cle: x, nom: nomStatut(x) }))}
              valeur={statutActif}
              vide="Tous les statuts"
              choisir={(v) => ecrire.simple("status", v)}
              fermer={() => setMenu(null)}
            />
          )}
        {campagnes.length > 1 &&
          porte(
            "c",
            "Campagne",
            <MenuChoix
              options={campagnes.map((x) => ({ cle: x.key, nom: x.name }))}
              valeur={campActive}
              vide="Toutes les campagnes"
              choisir={(v) => ecrire.simple("camp", v)}
              fermer={() => setMenu(null)}
            />
          )}
      </div>
    </div>
  );
}
