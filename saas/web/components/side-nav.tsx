"use client";

import { useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { FetchButton } from "@/components/fetch-button";
import { CompteSwitch } from "@/components/compte-switch";
import { COOKIE_NAV, NAV_DEPLIEE, NAV_REPLIEE } from "@/lib/nav-cookie";
import {
  LS_NAV_LARGEUR,
  NAV_LARGEUR_DEFAUT,
  NAV_LARGEUR_MAX,
  NAV_LARGEUR_MIN,
} from "@/lib/nav-largeur";
import type { CompteActif } from "@/lib/account";

// La navigation passe sur le côté. Trois raisons, dans l'ordre d'importance :
//  · six onglets alignés en haut se lisent comme une frise indistincte ; en
//    colonne, chacun a sa ligne et se repère du premier coup ;
//  · la place ainsi libérée en haut revient au contenu (le verdict de la
//    semaine gagne un écran entier sur mobile) ;
//  · une colonne fixe peut porter en permanence ce qu'on doit savoir sans
//    chercher : le compte regardé, ce qu'on doit faire, la fraîcheur des
//    données. Une barre horizontale n'a jamais la place pour ça.
//
// ── CE QUI A CHANGÉ, ET POURQUOI ─────────────────────────────────────────────
//
// 1. HUIT ENTRÉES À PLAT NE SONT PAS UNE HIÉRARCHIE. Le rapport hebdomadaire,
//    la page qu'on ouvre le lundi matin, était la première d'une liste de huit
//    où « Équipe » avait exactement le même poids. Il sort donc de la liste :
//    il est seul en tête, sans en-tête de groupe — ce qui est seul n'a pas
//    besoin d'être nommé, et l'isoler dit sa primauté mieux qu'un titre. Les
//    sept autres se rangent en trois groupes qui répondent chacun à une
//    question différente :
//      · « Où va l'argent » (Thèmes, Coûts) — les deux lectures TRANSVERSALES,
//        celles qui additionnent les trois canaux ;
//      · « Tes canaux » (Meta, Google, Instagram) — le détail par plateforme,
//        où l'on ne descend qu'une fois qu'une lecture transversale a désigné
//        un coupable ;
//      · « Réglages » (Connexions, Équipe) — ce qu'on touche une fois puis
//        plus jamais. En bas, parce que la fréquence d'usage est le seul
//        critère de rangement qui ne se discute pas.
//
// 2. « OÙ ON EN EST » DISPARAÎT COMME BLOC. Ses deux informations appartenaient
//    au rapport, pas à la colonne : le nombre d'actions à faire devient la
//    pastille de l'entrée « Rapport », la fraîcheur des données sa légende. Une
//    information rangée sous ce qu'elle qualifie n'a pas besoin d'un titre.
//
// 3. LE REPLI SURVIT SANS CLIGNOTER. Il vivait dans `localStorage`, lu dans un
//    `useEffect` : la colonne se peignait dépliée à 232 px puis sautait à 64 px
//    après hydratation, à chaque navigation. Il vit maintenant dans un COOKIE,
//    lu par `app/layout.tsx` et passé en prop — le premier octet de HTML porte
//    déjà la bonne largeur. C'est la seule raison de ce choix : `localStorage`
//    n'est pas lisible par le serveur, donc il ne peut pas ne pas clignoter.
//
// 4. SUR TÉLÉPHONE, UN TIROIR PLUTÔT QU'UNE FRISE. La barre horizontale rendait
//    les trois groupes invisibles (une frise n'a pas de sections) et défilait
//    latéralement sans le dire. Le tiroir coûte un tap de plus et rend la même
//    colonne groupée que sur écran. Il se ferme sur navigation, sur Échap et au
//    clic sur le fond.

type Entree = { href: string; label: string; glyphe: string; proprio?: true };
type Groupe = { titre: string | null; entrees: Entree[] };

// Les glyphes de canal viennent du lexique commun (▣ Meta, ◆ Google,
// ◎ Instagram, ◫ Thèmes) — jamais réinventés ici. Les autres sont choisis pour
// se distinguer À 13 PX, taille à laquelle cinq carrés hachurés se ressemblent
// tous : ▤ la page écrite du rapport, ◔ la part d'enveloppe consommée (le
// geste même des anneaux de la page Coûts), ◈ la conversion visée (un losange,
// pour ne pas se confondre avec les carrés/cercles déjà pris), ⧉ deux vues du
// même tableau pour le partage d'équipe. C'est la seule chose qui reste quand
// la colonne est repliée — il faut donc que ça se reconnaisse.
const GROUPES: Groupe[] = [
  { titre: null, entrees: [{ href: "/", label: "Rapport", glyphe: "▤" }] },
  {
    titre: "Où va l'argent",
    entrees: [
      { href: "/labels", label: "Thèmes", glyphe: "◫" },
      { href: "/conversions", label: "Conversions", glyphe: "◈" },
      { href: "/couts", label: "Coûts", glyphe: "◔" },
    ],
  },
  {
    titre: "Tes canaux",
    entrees: [
      { href: "/meta", label: "Meta", glyphe: "▣" },
      { href: "/google", label: "Google", glyphe: "◆" },
      { href: "/instagram", label: "Instagram", glyphe: "◎" },
    ],
  },
  {
    titre: "Réglages",
    entrees: [
      // Les connexions ne se gèrent que sur son propre compte : sur celui d'un
      // autre, l'entrée disparaît au lieu de mener à un refus.
      { href: "/comptes", label: "Connexions", glyphe: "⚯", proprio: true },
      { href: "/equipe", label: "Équipe", glyphe: "⧉" },
    ],
  },
];

export type InfosNav = {
  aFaire: number;
  fraicheur: string | null; // « données au 27 jul »
};

function Logo({ mot = true }: { mot?: boolean }) {
  return (
    <span className="flex items-center gap-2 shrink-0">
      <span
        className="h-[26px] w-[26px] rounded-[8px] bg-brand flex items-center justify-center shrink-0"
        aria-hidden
      >
        <svg viewBox="0 0 16 16" className="h-[14px] w-[14px]">
          <path
            d="M1.6 8.6h2.6l1.5-4.2 2.5 8 1.6-3.8h4.6"
            fill="none"
            stroke="#fff"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {mot && <span className="text-[15px] font-bold tracking-tight text-ink">Pulse</span>}
    </span>
  );
}

/** Le contenu de la colonne — le même sur écran et dans le tiroir du téléphone. */
function Contenu({
  compte,
  infos,
  path,
  replie,
  bouton,
}: {
  compte: CompteActif;
  infos: InfosNav;
  path: string;
  replie: boolean;
  bouton: { signe: string; titre: string; action: () => void };
}) {
  const actif = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="flex flex-col h-full px-3 py-4">
      <div className={`flex items-center mb-4 ${replie ? "flex-col gap-2" : "gap-2"}`}>
        <Logo mot={!replie} />
        <button
          onClick={bouton.action}
          aria-label={bouton.titre}
          title={bouton.titre}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-faint hover:bg-black/[0.05] hover:text-ink text-[13px] shrink-0 ${
            replie ? "" : "ml-auto"
          }`}
        >
          {bouton.signe}
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 min-w-0">
        {GROUPES.map((g, i) => {
          const entrees = g.entrees.filter((e) => !e.proprio || compte.uid === compte.moi);
          if (entrees.length === 0) return null;
          return (
            <div key={g.titre ?? "tete"} className={i > 0 ? "mt-4" : ""}>
              {/* Replié, un titre de 10 px n'a pas la place d'exister : le
                  groupe se dit alors par un filet, qui garde le rythme sans
                  mentir sur ce qu'il sépare. */}
              {g.titre &&
                (replie ? (
                  <div className="h-px bg-line mx-2 mb-2.5" aria-hidden />
                ) : (
                  <div className="text-[10px] uppercase tracking-widest text-faint font-bold px-3 mb-1.5">
                    {g.titre}
                  </div>
                ))}

              {entrees.map((e) => {
                const on = actif(e.href);
                const tete = e.href === "/";
                return (
                  <div key={e.href}>
                    <Link
                      href={e.href}
                      title={replie ? e.label : undefined}
                      aria-current={on ? "page" : undefined}
                      className={`relative flex items-center rounded-lg transition-colors ${
                        replie ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2"
                      } ${tete ? "text-[14px]" : "text-[13px]"} ${
                        on
                          ? "bg-ink text-white font-semibold"
                          : "text-ink/75 hover:bg-black/[0.05] font-medium"
                      }`}
                    >
                      <span
                        className={`text-[13px] w-[15px] text-center shrink-0 ${
                          on ? "text-white/75" : "text-faint"
                        }`}
                        aria-hidden
                      >
                        {e.glyphe}
                      </span>
                      {!replie && <span className="truncate">{e.label}</span>}

                      {tete && infos.aFaire > 0 && (
                        <span
                          title={`${infos.aFaire} action${infos.aFaire > 1 ? "s" : ""} à faire`}
                          className={
                            replie
                              ? `absolute top-1.5 right-2.5 h-[7px] w-[7px] rounded-full ${
                                  on ? "bg-white" : "bg-brand"
                                }`
                              : `ml-auto text-[10.5px] font-bold rounded-full px-1.5 py-0.5 ${
                                  on ? "bg-white/20 text-white" : "bg-brand text-white"
                                }`
                          }
                        >
                          {replie ? "" : infos.aFaire}
                        </span>
                      )}
                    </Link>

                    {/* La fraîcheur qualifie le rapport : elle se range sous
                        lui, pas dans un bloc à part qui redemanderait un titre. */}
                    {tete && !replie && infos.fraicheur && (
                      <div className="text-[10.5px] text-faint pl-[42px] pr-3 pt-1 pb-0.5">
                        {infos.fraicheur}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="mt-auto pt-5">
        {replie ? (
          // Replié, il n'y a pas 90 px pour « ↻ Mes données » ni pour un
          // e-mail. On garde le seul repère qui compte — QUEL compte je
          // regarde — et le cliquer déplie la colonne plutôt que de mener nulle
          // part.
          <button
            onClick={bouton.action}
            title={`${compte.email} — déplier pour agir`}
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-line text-[12px] font-bold text-muted uppercase hover:bg-black/[0.05] hover:text-ink transition-colors"
          >
            {(compte.email || "?").charAt(0)}
          </button>
        ) : (
          <div className="flex flex-col gap-2.5 border-t border-line pt-4">
            <CompteSwitch comptes={compte.comptes} actif={compte.uid} />
            {/* `ancrage="colonne"` : ici le panneau de suivi prend la largeur de
                la colonne et s'ouvre VERS LE HAUT. Ancré à droite et vers le
                bas comme ailleurs, il sortait de 29 px à gauche de l'écran et de
                34 px sous la fenêtre — deux coupes qu'aucun défilement ne
                rattrapait. Le détail est dans `fetch-button.tsx`. */}
            {compte.peutEditer && <FetchButton ancrage="colonne" />}
            <span className="text-[10.5px] text-faint truncate" title={compte.email}>
              {compte.email}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="w-full text-[11px] text-muted border border-line rounded-full px-3 py-1.5 hover:bg-black/[0.03] transition-colors"
              >
                Se déconnecter
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export function SideNav({
  compte,
  infos,
  replieInitial = false,
  cheminForce,
}: {
  compte: CompteActif;
  infos: InfosNav;
  /** Lu dans le cookie par `app/layout.tsx` — voir la note 3 en tête de fichier. */
  replieInitial?: boolean;
  /** Chemin imposé, pour rendre la barre hors session (page de contrôle). */
  cheminForce?: string;
}) {
  const courant = usePathname();
  const path = cheminForce ?? courant ?? "/";

  const [replie, setReplie] = useState(replieInitial);
  const [ouvert, setOuvert] = useState(false);

  // LA LARGEUR PART TOUJOURS DE LA MÊME VALEUR CÔTÉ SERVEUR ET AU PREMIER
  // RENDU CLIENT — le `useEffect` juste en dessous la corrige ensuite depuis
  // `localStorage`. C'est le même compromis qu'a fait `replie` avant de passer
  // par un cookie (voir la note 3 en tête de fichier) : un saut est possible au
  // chargement. On l'accepte ici — la demande porte sur `localStorage`, pas sur
  // un cookie — plutôt qu'un mismatch d'hydratation en lisant `window` pendant
  // le rendu.
  const [largeur, setLargeur] = useState(NAV_LARGEUR_DEFAUT);
  // Coupe la transition CSS pendant le glissement : sinon la colonne suit la
  // souris avec 200 ms de retard, ce qui se sent comme un pilotage mou.
  const [enGlissement, setEnGlissement] = useState(false);

  useEffect(() => {
    const stockee = Number(localStorage.getItem(LS_NAV_LARGEUR));
    if (Number.isFinite(stockee) && stockee >= NAV_LARGEUR_MIN && stockee <= NAV_LARGEUR_MAX) {
      setLargeur(stockee);
    }
  }, []);

  const basculer = () =>
    setReplie((v) => {
      // Un an, sur tout le site : c'est un réglage d'affichage, pas une
      // session. `SameSite=Lax` suffit — il n'autorise rien.
      document.cookie = `${COOKIE_NAV}=${
        v ? NAV_DEPLIEE : NAV_REPLIEE
      }; path=/; max-age=31536000; SameSite=Lax`;
      return !v;
    });

  // Le tiroir se ferme dès qu'on a navigué : sinon il recouvre la page qu'on
  // vient de demander.
  useEffect(() => {
    setOuvert(false);
  }, [courant]);

  // LE GLISSER-DÉPOSER SUR LE BORD DROIT — comme dans Notion. La colonne
  // commence à x = 0 (premier enfant du `lg:flex` de `layout.tsx`), donc
  // `clientX` EST la largeur voulue ; bornée entre `NAV_LARGEUR_MIN` et
  // `NAV_LARGEUR_MAX` pour qu'elle ne devienne ni un rail ni la moitié de
  // l'écran. On n'écrit dans `localStorage` qu'au relâchement — pas à chaque
  // pixel — pour ne pas déclencher des centaines d'écritures par glissement.
  const debuterRedim = (e: ReactMouseEvent) => {
    if (replie) return;
    e.preventDefault();
    setEnGlissement(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const bouger = (ev: MouseEvent) => {
      const suivante = Math.min(NAV_LARGEUR_MAX, Math.max(NAV_LARGEUR_MIN, ev.clientX));
      setLargeur(suivante);
    };
    const relacher = () => {
      window.removeEventListener("mousemove", bouger);
      window.removeEventListener("mouseup", relacher);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setEnGlissement(false);
      setLargeur((v) => {
        localStorage.setItem(LS_NAV_LARGEUR, String(v));
        return v;
      });
    };
    window.addEventListener("mousemove", bouger);
    window.addEventListener("mouseup", relacher);
  };

  useEffect(() => {
    if (!ouvert) return;
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    window.addEventListener("keydown", echap);
    return () => window.removeEventListener("keydown", echap);
  }, [ouvert]);

  return (
    <>
      {/* ── Téléphone et tablette : une barre de 52 px, et un tiroir ───────── */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/85 backdrop-blur px-4 py-2.5">
        <button
          onClick={() => setOuvert(true)}
          aria-label="Ouvrir la navigation"
          aria-expanded={ouvert}
          className="h-8 w-8 -ml-1 flex flex-col items-center justify-center gap-[3.5px] rounded-lg hover:bg-black/[0.05] transition-colors"
        >
          <span className="block h-[1.6px] w-[15px] rounded-full bg-ink" />
          <span className="block h-[1.6px] w-[15px] rounded-full bg-ink" />
          <span className="block h-[1.6px] w-[15px] rounded-full bg-ink" />
        </button>
        <Logo />
        {infos.aFaire > 0 && (
          <span className="text-[10.5px] font-bold rounded-full px-1.5 py-0.5 bg-brand text-white">
            {infos.aFaire}
          </span>
        )}
        <span className="ml-auto shrink-0">{compte.peutEditer && <FetchButton />}</span>
      </header>

      <div
        className={`lg:hidden fixed inset-0 z-40 transition-opacity duration-200 ${
          ouvert ? "opacity-100" : "opacity-0 invisible pointer-events-none"
        }`}
      >
        <div
          className="absolute inset-0 bg-ink/25"
          onClick={() => setOuvert(false)}
          aria-hidden
        />
        <div
          // 280 px comme la colonne d'écran, et pour la même mesure : en
          // dessous, l'étape « Classement des contenus par l'IA » passe sur deux
          // lignes dans le panneau de récolte. `max-w-[85vw]` garde la main sur
          // les téléphones étroits — à 320 px de large le tiroir retombe à
          // 272 px et l'étape se replie, ce qui est le comportement voulu :
          // couper, jamais ; passer à la ligne, s'il le faut vraiment.
          className={`absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white border-r border-line shadow-xl overflow-y-auto transition-transform duration-200 ${
            ouvert ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Contenu
            compte={compte}
            infos={infos}
            path={path}
            replie={false}
            bouton={{ signe: "✕", titre: "Fermer la navigation", action: () => setOuvert(false) }}
          />
        </div>
      </div>

      {/* ── Écran : la colonne ─────────────────────────────────────────────── */}
      {/* 280 px dépliée. Elle en faisait 240, choisis pour que « le bloc du bas
          cesse d'être compressé » et pour rester au-dessus des « 1 024 px sous
          lesquels la rangée boussole + hors-thème se replie ». LES DEUX MOITIÉS
          DE CE RAISONNEMENT ÉTAIENT FAUSSES, mesures à l'appui :

          · le bloc du bas était DÉJÀ compressé à 240. Sur un compte invité, la
            rangée « pastille lecture seule + sélecteur » réclame 95,4 + 8 +
            173,5 = 276,9 px et n'en recevait que 215 : le sélecteur était
            écrasé à 111,6 px, soit 62 px de moins que son libellé ;
          · le seuil de 1 024 px n'est pas une largeur de CONTENU mais le point
            de rupture `lg` de Tailwind, donc une largeur de FENÊTRE. Comme
            cette colonne est elle-même `hidden lg:flex`, elle disparaît avant
            de pouvoir replier quoi que ce soit. Aucune largeur de barre ne peut
            déclencher ce repli — il n'y a pas de falaise à 1 024, seulement une
            pente.

          280 vient d'une mesure, pas d'un arrondi : la rangée la plus large du
          panneau de récolte (l'étape « Classement des contenus par l'IA »,
          184,4 px, + 8 px de gouttière + le chrono « 16:04 », 31,5 px, + 26 px
          de cadre) demande 249,9 px. Plus les 24 px de marge de la colonne et
          son filet de 1 px : 274,9 px. Arrondi à 280 pour absorber l'arrondi
          sous-pixel et la police de repli. C'est la largeur à laquelle AUCUNE
          des sept étapes ne passe à la ligne.

          CE QUE ÇA COÛTE, EN CLAIR : sur un portable de 1 280, le contenu passe
          de 1 040 à 1 000 px — 936 px utiles dans le `max-w-7xl px-8` du
          rapport, contre 976 avant. Les trois colonnes de la rangée du haut
          perdent 12 px chacune. Si un jour ces 40 px manquent au rapport, le
          repli de secours est 256 px : on n'y perd qu'une chose, la plus longue
          des sept étapes passe sur deux lignes.

          64 px repliée : 40 px de cible cliquable et 12 px de marge de chaque
          côté — c'est le minimum sous lequel un rail cesse d'être un rail.

          280 RESTE LE POINT DE DÉPART, PAS UNE LIMITE. La colonne se glisse
          maintenant depuis son bord droit, comme dans Notion — `largeur` porte
          le choix de l'utilisateur, persisté dans `localStorage`
          (`lib/nav-largeur.ts`). Les bornes reprennent les mesures ci-dessus :
          `NAV_LARGEUR_MIN` est le repli de secours à 256 px (une étape peut
          repasser sur deux lignes, rien de pire), `NAV_LARGEUR_MAX` à 400 px
          pour qu'elle ne mange pas plus d'un tiers d'un écran de portable. */}
      <aside
        // `overflow-y-auto` : le panneau de récolte ajoute de la hauteur au bloc
        // du bas quand il s'ouvre — nettement plus depuis qu'il liste les six
        // canaux avec leur état, là où il ne montrait qu'une barre. Sur une
        // fenêtre courte (un portable de 13" avec la barre d'onglets et le
        // dock), la colonne n'a plus la hauteur — et sans cette ligne le
        // débordement était simplement invisible, comme il l'était déjà sans le
        // panneau sous 480 px de haut.
        // La liste des canaux porte son propre plafond (`max-h` dans
        // fetch-button.tsx) : un message d'erreur long ne peut donc pas
        // repousser le bouton indéfiniment vers le bas.
        // `relative` : le poignée de redimensionnement s'y ancre en `absolute`.
        // Pas de transition pendant le glissement (`enGlissement`) : sinon la
        // colonne suit la souris avec 200 ms de retard.
        className={`hidden lg:flex lg:flex-col lg:shrink-0 lg:h-screen lg:sticky lg:top-0 lg:overflow-y-auto relative border-r border-line bg-white/70 backdrop-blur ${
          enGlissement ? "" : "transition-[width] duration-200"
        } ${replie ? "lg:w-[64px]" : ""}`}
        style={replie ? undefined : { width: `${largeur}px` }}
      >
        <Contenu
          compte={compte}
          infos={infos}
          path={path}
          replie={replie}
          bouton={{
            signe: replie ? "»" : "«",
            titre: replie ? "Déplier la navigation" : "Replier la navigation",
            action: basculer,
          }}
        />

        {/* LA POIGNÉE — invisible au repos, un filet au survol et pendant le
            glissement (le même geste que Tailwind donne déjà à `.defile` :
            un signal qui n'existe que quand il sert). Absente repliée : un
            rail de 64 px ne se redimensionne pas, il se déplie. La zone de
            saisie fait 8 px pour rester atteignable malgré le filet de 1 px
            qu'elle porte à son bord droit — ENTIÈREMENT DANS la colonne
            (`right-0`, pas de décalage négatif) : `lg:overflow-y-auto` sur
            `<aside>` force `overflow-x` à se comporter en `auto`, qui aurait
            coupé toute poignée débordant du cadre. */}
        {!replie && (
          <div
            onMouseDown={debuterRedim}
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionner la navigation"
            aria-valuenow={largeur}
            aria-valuemin={NAV_LARGEUR_MIN}
            aria-valuemax={NAV_LARGEUR_MAX}
            className="absolute top-0 right-0 h-full w-2 cursor-col-resize group z-10"
          >
            <div
              className={`ml-auto h-full w-px transition-colors ${
                enGlissement ? "bg-brand" : "bg-transparent group-hover:bg-brand/50"
              }`}
            />
          </div>
        )}
      </aside>
    </>
  );
}
