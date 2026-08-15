"use client";

import { Children, useEffect, useRef, useState } from "react";

// UNE CARTE DE THÈME À LA FOIS.
//
// Elles étaient empilées, et une carte fait 900 à 1 400 px : cinq thèmes
// donnaient un couloir de six mille pixels. La parade précédente était le PLI —
// au-delà de trois cartes, les suivantes arrivaient fermées — et elle ne
// répondait pas à la question posée : replier ne dit toujours pas qu'on lit le
// thème 2 sur 5, et une carte fermée quatre écrans plus bas reste une carte
// qu'on ne va pas chercher. Le pli est supprimé avec ce module (`replie`,
// `OUVERTES`, `estReplie`, et le `▾` du sommaire).
//
// ── LE SOMMAIRE DEVIENT L'ONGLET, ON N'AJOUTE PAS UN TROISIÈME DISPOSITIF ────
//
// La page portait déjà une bande de pastilles-liens au-dessus des cartes : les
// noms de tous les thèmes, avec leur étoile. C'est exactement la matière d'une
// barre d'onglets, et lui coller des flèches À CÔTÉ aurait fait deux navigations
// pour un seul objet. Les `<a href="#ancre">` deviennent donc des
// `<button role="tab">` : ils changent de carte au lieu de faire défiler vers
// un bloc qui n'est plus au même endroit.
//
// Ce qu'on perd en devenant des boutons — le clic droit « copier le lien », le
// glisser vers un onglet — est rendu par l'URL, qui suit ce qu'on lit
// (`replaceState`, plus bas). Rien de ce qui pointait vers `#theme-…` ne casse :
// le raccourci du hero, les trois liens de « Si tu ne fais que trois choses »,
// et les liens du rapport hebdomadaire par e-mail passent tous par le même
// écouteur `hashchange`.
//
// ── LA BANDE D'ONGLETS S'ENROULE, ELLE NE DÉFILE PAS ─────────────────────────
//
// Le projet a `.defile-x` pour les rangées trop larges, et c'est le mauvais
// outil ici. Le cas courant est de deux à six thèmes, soit une seule ligne ; le
// cas extrême (quinze étoiles) tient en trois lignes d'environ 100 px au total.
// Une bande qui défile les rangerait hors de vue — c'est précisément le défaut
// que le sommaire avait été créé pour corriger : un thème qu'on ne voit pas est
// un thème qu'on ne trouvera jamais.
//
// ── LA HAUTEUR SUIT CHAQUE CARTE ─────────────────────────────────────────────
//
// MESURÉ, pas supposé. Deux cartes voisines dans une fenêtre de 1 280 × 800 :
// une carte complète (courbe de 180 px, trois conseils, quatre campagnes)
// fait 894 px ; un thème sans courbe ni conseil en fait 296. Cinq cent
// quatre-vingt-dix-huit pixels d'écart, et les cartes réelles montent plus haut
// encore quand le rail d'actions se remplit.
//
// Or la fenêtre fait 800 px et la barre d'onglets en prend une centaine : tout
// ce qui dépasse ~700 px dans le panneau est DÉJÀ sous la ligne de flottaison.
// Caler le cadre sur la plus haute n'achèterait donc aucune stabilité visible,
// et ouvrirait jusqu'à 598 px de blanc au bas des cartes courtes — le trou au
// milieu d'un module que `hors-theme.tsx` a déjà eu à corriger.
//
// La raison habituelle de verrouiller une hauteur — que les commandes ne bougent
// pas sous le curseur — ne s'applique pas : la bande d'onglets et les flèches
// sont AU-DESSUS du panneau, à une position qui ne dépend pas de sa hauteur.
// Changer de carte ne déplace donc jamais le bouton qu'on vient de cliquer.
//
// Et se caler sur la plus haute demanderait de mesurer des cartes en
// `display: none`, donc de hauteur nulle : il faudrait toutes les rendre
// visibles pour les mesurer, c'est-à-dire remettre le couloir qu'on retire.
//
// ── TOUTES LES CARTES RESTENT DANS LE DOM ────────────────────────────────────
//
// Masquées par l'attribut `hidden`, pas démontées. Elles y étaient déjà toutes
// avant ce module : on ne régresse sur rien, et on garde deux choses qu'un
// rendu à la carte perdrait — une note à moitié tapée dans `NoteAjout` survit
// au changement d'onglet, et l'`id="theme-…"` de chaque carte reste résolvable
// par `getElementById`, ce dont dépend tout le lien profond.

/** Un chevron dessiné, pas tapé — même raison que `pente.tsx` : le caractère se
 *  cale mal sur la ligne de base selon la plateforme. */
function Chevron({ sens }: { sens: "gauche" | "droite" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="11"
      height="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <polyline points={sens === "gauche" ? "15 5 8 12 15 19" : "9 5 16 12 9 19"} />
    </svg>
  );
}

export function ThemesCarrousel({
  themes,
  children,
}: {
  /** Un descripteur par carte, DANS LE MÊME ORDRE que `children`. */
  themes: { label: string; ancre: string; etoile: boolean }[];
  /** Les cartes, rendues côté serveur : ce module ne les fabrique pas, il les
   *  montre une par une. */
  children: React.ReactNode;
}) {
  const cartes = Children.toArray(children);
  const n = themes.length;
  const [i, setI] = useState(0);
  const barreRef = useRef<HTMLDivElement>(null);
  const ongletsRef = useRef<(HTMLButtonElement | null)[]>([]);
  // L'ancre à rejoindre APRÈS que la carte soit devenue visible. Un
  // `scrollIntoView` posé dans la foulée du `setI` viserait un élément encore
  // en `display: none`, où il ne fait rien.
  const aRejoindre = useRef<string | null>(null);

  // Une chaîne plutôt que le tableau : `themes` est reconstruit à chaque rendu
  // du serveur, et une dépendance d'effet sur un tableau se déclencherait à
  // chaque fois.
  const clefAncres = themes.map((t) => t.ancre).join("|");

  // LE LIEN PROFOND. `#theme-xxx` arrive de trois endroits — le raccourci du
  // hero, « Si tu ne fais que trois choses », et le rapport hebdomadaire par
  // e-mail. Au chargement comme au clic, c'est la carte visée qui s'ouvre.
  useEffect(() => {
    const ancres = clefAncres ? clefAncres.split("|") : [];
    const viser = () => {
      const h = decodeURIComponent((window.location.hash || "").slice(1));
      const k = ancres.indexOf(h);
      if (k < 0) return;
      aRejoindre.current = ancres[k];
      setI(k);
    };
    viser();
    window.addEventListener("hashchange", viser);
    return () => window.removeEventListener("hashchange", viser);
  }, [clefAncres]);

  // Déclaré APRÈS l'effet ci-dessus : au montage les effets s'exécutent dans
  // l'ordre du fichier, donc celui-ci voit toujours le drapeau déjà posé.
  useEffect(() => {
    const cible = aRejoindre.current;
    if (!cible) return;
    aRejoindre.current = null;
    document.getElementById(cible)?.scrollIntoView({ block: "start" });
  }, [i]);

  if (n === 0) return null;
  // UN SEUL THÈME : LE DISPOSITIF SE RETIRE DE LUI-MÊME. Des flèches toutes deux
  // désactivées et un « 1 / 1 » sont deux commandes qui ne commandent rien.
  if (n === 1) return <>{children}</>;

  function aller(k: number) {
    if (k < 0 || k >= n || k === i) return;
    setI(k);
    // L'URL suit ce qu'on lit. Sans ça, recharger la page rouvrirait le premier
    // thème, et le lien qu'on copie ne désignerait pas la carte à l'écran.
    // `replaceState` et non `pushState` : cinq changements d'onglet ne doivent
    // pas coûter cinq retours en arrière pour sortir de la page. Supporté
    // nativement par le routeur depuis Next 14.1 — aucun re-rendu serveur, donc
    // aucune relecture Supabase sur une page `force-dynamic`.
    window.history.replaceState(null, "", `#${themes[k].ancre}`);
    // On ne ramène la page en haut QUE si la bande d'onglets est sortie de
    // l'écran par le haut. Elle est au-dessus des cartes : celui qui clique un
    // onglet l'a forcément sous les yeux, il est donc déjà en haut et un
    // défilement serait un mouvement gratuit. Celui qui arrive au clavier
    // depuis le pied d'une carte de 1 400 px, lui, ne verrait rien changer.
    const barre = barreRef.current;
    if (barre && barre.getBoundingClientRect().top < 0)
      barre.scrollIntoView({ block: "start" });
  }

  // PAS DE BOUCLAGE, ET C'EST UN CHOIX.
  //
  // La liste est courte (deux à six thèmes en pratique) et surtout ORDONNÉE :
  // les étoilés d'abord, dans l'ordre où ils ont été posés. Sur une liste
  // pareille, la seule chose qu'on veut savoir c'est « est-ce que j'ai tout
  // vu » — un anneau qui repart de la première carte sans le dire est
  // exactement la réponse qu'on ne veut pas. Les flèches désactivées et le
  // « 2 / 5 » le disent deux fois, à 20 px l'un de l'autre.
  //
  // Le clavier suit la même règle : le motif ARIA laisse le bouclage optionnel
  // sur les onglets, et deux règles opposées dans un même dispositif — la
  // souris s'arrête, le clavier tourne — seraient un piège.
  function surTouche(e: React.KeyboardEvent) {
    const vise =
      e.key === "ArrowRight" ? i + 1
      : e.key === "ArrowLeft" ? i - 1
      : e.key === "Home" ? 0
      : e.key === "End" ? n - 1
      : null;
    if (vise === null) return;
    e.preventDefault();
    const k = Math.min(Math.max(vise, 0), n - 1);
    if (k === i) return;
    aller(k);
    // Activation automatique : la sélection et le focus vont ensemble, comme le
    // veut le motif. On ne déplace le focus que s'il partait d'un onglet — le
    // voler à une flèche qu'on est en train d'utiliser serait déroutant.
    if ((e.target as HTMLElement).getAttribute("role") === "tab")
      ongletsRef.current[k]?.focus();
  }

  function surFleche(k: number) {
    aller(k);
    // Une flèche qui se désactive en bout de liste rend le focus au `<body>`,
    // et la touche suivante ne ferait plus rien. On le pose alors sur l'onglet
    // du thème qu'on vient d'ouvrir, d'où ← et → repartent.
    if (k === 0 || k === n - 1) ongletsRef.current[k]?.focus();
  }

  const Fleche = ({ sens }: { sens: "gauche" | "droite" }) => {
    const k = sens === "gauche" ? i - 1 : i + 1;
    const bloque = sens === "gauche" ? i === 0 : i === n - 1;
    return (
      <button
        type="button"
        onClick={() => surFleche(k)}
        disabled={bloque}
        // Jamais un caractère seul : « ‹ » lu à haute voix ne dit rien. Le nom
        // du thème visé plutôt qu'un « précédent » nu — c'est ce qui change.
        aria-label={
          bloque
            ? sens === "gauche"
              ? "Premier thème — pas de précédent"
              : "Dernier thème — pas de suivant"
            : `${sens === "gauche" ? "Thème précédent" : "Thème suivant"} : ${themes[k].label}`
        }
        className="grid place-items-center h-7 w-7 rounded-full border border-line text-muted transition-colors hover:text-ink hover:border-ink/25 disabled:opacity-30 disabled:hover:text-muted disabled:hover:border-line disabled:cursor-default"
      >
        <Chevron sens={sens} />
      </button>
    );
  };

  return (
    <div>
      {/* LA NAVIGATION — une seule barre, deux façons d'en changer.
          Le compteur de position est entre les deux flèches : c'est le seul
          endroit où il répond à la question que les flèches posent. */}
      <div
        ref={barreRef}
        onKeyDown={surTouche}
        className="mb-3 flex items-center gap-x-3 gap-y-2 flex-wrap scroll-mt-4"
      >
        <div
          role="tablist"
          aria-label="Tes thèmes"
          className="flex flex-wrap items-center gap-1.5 min-w-0"
        >
          {themes.map((t, k) => (
            /* C'est le NOM qui se coupe, jamais l'étoile qui le précède : un
               marqueur d'état posé dans la partie tronquée se fait effacer par
               l'`overflow-hidden` — la leçon du `▾` du sommaire, gardée. */
            <button
              key={t.ancre}
              ref={(el) => {
                ongletsRef.current[k] = el;
              }}
              type="button"
              role="tab"
              id={`onglet-${t.ancre}`}
              aria-selected={k === i}
              aria-controls={`panneau-${t.ancre}`}
              tabIndex={k === i ? 0 : -1}
              onClick={() => aller(k)}
              className={`inline-flex items-center gap-1 max-w-full min-w-0 text-[11.5px] rounded-full px-2.5 py-1 border transition-colors ${
                k === i
                  ? "border-brand/40 bg-brand/[0.07] text-ink font-semibold"
                  : "border-line text-muted hover:text-ink"
              }`}
            >
              {t.etoile && <span className="text-warn shrink-0">★</span>}
              <span className="truncate min-w-0">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto shrink-0 flex items-center gap-2">
          <Fleche sens="gauche" />
          <span className="font-mono text-[11.5px] text-faint tabular-nums">
            {i + 1} <span className="text-faint/60">/</span> {n}
          </span>
          <Fleche sens="droite" />
        </div>
      </div>

      {cartes.map((carte, k) => (
        <div
          key={themes[k]?.ancre ?? k}
          role="tabpanel"
          id={`panneau-${themes[k]?.ancre ?? k}`}
          aria-labelledby={`onglet-${themes[k]?.ancre ?? k}`}
          hidden={k !== i}
        >
          {carte}
        </div>
      ))}
    </div>
  );
}
