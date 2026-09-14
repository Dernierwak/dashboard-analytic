"use client";

// PROTOTYPE — À JETER. Quatre façons de poser TES notes sur la courbe d'une
// page canal, à juger sur de vraies notes et de vrais chiffres. Ticket 19.
//
// ┌──────────────┬─────────────────────┬──────────────────┬──────────────────┐
// │              │ A — les traits      │ B — le peigne    │ C — la frise     │
// ├──────────────┼─────────────────────┼──────────────────┼──────────────────┤
// │ dans le tracé│ un trait par note   │ RIEN             │ RIEN             │
// │ le texte vit │ dans la liste       │ dans la liste    │ SUR la frise     │
// │ visible quand│ toujours            │ toujours         │ toujours         │
// │ ce que ça    │ le tracé est rayé   │ l'œil fait un    │ de la place, et  │
// │ coûte        │ dès 4-5 notes       │ aller-retour     │ ça déborde vite  │
// └──────────────┴─────────────────────┴──────────────────┴──────────────────┘
//   D — la liste commande : tracé NU par défaut ; survoler une note de la
//   liste allume SON trait. Rien n'est imposé, tout est atteignable.
//
// CE QUI EST INTERDIT ICI, ET QUI A DÉJÀ COÛTÉ UNE FOIS.
//
// Les repères d'action ont existé sur la courbe, et David les a fait retirer le
// 24 août 2026 : des points noirs PLEINS au milieu des points bleus de la série
// (`line-chart.tsx` l. 45-56). Aucune des quatre variantes ne pose quoi que ce
// soit SUR le tracé ni sur ses points — ni pastille, ni point, ni couleur de
// série. Une marque est verticale (le temps) ou elle est hors du cadre.
//
// ET AUCUNE NE JUGE. Une note n'a pas de verdict — tranché en 04 : juger
// obligerait Pulse à choisir à la place du client le chiffre à surveiller, donc
// à inventer une intention. Donc ici : aucune flèche, aucune couleur d'état,
// aucun « +12 % depuis ta note ». On montre une COÏNCIDENCE, jamais une cause.
//
// POURQUOI CE FICHIER REFAIT LA COQUE DE `MetricChart` AU LIEU DE L'ENVELOPPER.
// La marque doit se poser dans le repère du tracé, au pourcentage près. La
// coque du module (surtitre, chiffre, écart, sélecteur) a donc été recopiée
// telle quelle, et c'est le prix assumé d'un jetable : `MetricChart` et
// `LineChart` — dix-sept autres courbes — ne sont pas touchés pour une
// comparaison dont trois quarts partiront. Si une variante gagne, la marque
// devient une PROP de `LineChart` et cette copie disparaît.

import { useState } from "react";
import { LineChart } from "@/components/line-chart";
import type { NoteMarque, NotesCourbe } from "@/lib/proto-notes";

// LA GÉOMÉTRIE DE `LineChart`, RECOPIÉE. C'est ce qui fait coïncider les deux
// couches au pixel près — le SVG s'étire (`preserveAspectRatio="none"`) et
// tout ce qui se lit est posé par-dessus en HTML, positionné en POURCENTAGES
// de la même boîte. Mêmes nombres, même arithmétique, même résultat.
const W = 720, PAD_L = 6, PAD_R = 6, PAD_T = 10, PAD_B = 22, H = 190;
const HAUT_PCT = (PAD_T / H) * 100;
const BAS_PCT = ((H - PAD_B) / H) * 100;
const pctX = (i: number, n: number) =>
  n < 2 ? 50 : ((PAD_L + (i * (W - PAD_L - PAD_R)) / (n - 1)) / W) * 100;

// L'ENCRE D'UNE MARQUE N'EST PAS UNE COULEUR DE SÉRIE, ET CE N'EST PAS UN
// STATUT. Le bleu #1a56ff est la donnée ; le vert et le rouge sont réservés aux
// verdicts, qu'une note ne reçoit jamais. Une marque de note est donc de
// l'encre neutre, diluée — elle situe, elle ne commente pas.
const ENCRE = "#2b2b33";

function Trait({ pct, fort = false }: { pct: number; fort?: boolean }) {
  return (
    <span
      className="absolute w-px -translate-x-1/2 pointer-events-none transition-opacity"
      style={{
        left: `${pct}%`,
        top: `${HAUT_PCT}%`,
        height: `${BAS_PCT - HAUT_PCT}%`,
        background: ENCRE,
        opacity: fort ? 0.55 : 0.22,
      }}
    />
  );
}

function Chevron({ pct, fort = false }: { pct: number; fort?: boolean }) {
  return (
    <span
      className="absolute -translate-x-1/2 text-[9px] leading-none pointer-events-none"
      style={{ left: `${pct}%`, top: 0, color: ENCRE, opacity: fort ? 0.9 : 0.45 }}
      aria-hidden
    >
      ▲
    </span>
  );
}

function Numero({ pct, n, fort = false }: { pct: number; n: number; fort?: boolean }) {
  return (
    <span
      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full font-mono text-[8.5px] leading-none flex items-center justify-center pointer-events-none"
      style={{
        left: `${pct}%`,
        top: `${HAUT_PCT}%`,
        width: 13,
        height: 13,
        background: fort ? ENCRE : "#fff",
        color: fort ? "#fff" : ENCRE,
        border: `1px solid ${ENCRE}`,
        opacity: fort ? 1 : 0.6,
      }}
    >
      {n}
    </span>
  );
}

function jourCourt(iso: string): string {
  const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}

// CE QUE L'ÉCRAN DOIT AVOUER. Trois phrases, et aucune n'est décorative :
// chacune empêche une lecture fausse que la seule proximité produirait.
function Aveux({
  notes,
  nbAffichees,
  canal,
}: {
  notes: NotesCourbe;
  nbAffichees: number;
  canal: string;
}) {
  // UNE NOTE SANS THÈME N'A RIEN QUI LA RATTACHE À CETTE PLATEFORME-LÀ, et
  // c'est plus grave que le trou de campagne : le trou de campagne se voit
  // (le bandeau est juste au-dessus), celui-ci ne se voit pas du tout. La
  // poser sur la courbe de Meta lui prête un sujet qu'elle n'a jamais eu.
  // On l'affiche quand même — sinon on la cache, et une note écrite reste
  // écrite — mais on l'écrit.
  const sansTheme = notes.marques.filter((m) => !m.theme).length;
  return (
    <div className="text-[10.5px] text-faint leading-relaxed pt-3 mt-1 border-t border-line space-y-1">
      {sansTheme > 0 && (
        <p className="text-[10.5px] text-muted">
          <b className="font-semibold">
            {sansTheme === 1 ? "Une de ces notes ne porte aucun thème" : `${sansTheme} de ces notes ne portent aucun thème`}
          </b>{" "}
          — rien ne {sansTheme === 1 ? "la" : "les"} rattache à {canal} plutôt qu&apos;à un
          autre canal. {sansTheme === 1 ? "Elle est posée" : "Elles sont posées"} ici sur{" "}
          {sansTheme === 1 ? "sa" : "leur"} date, et rien de plus.
        </p>
      )}
      {/* LA PLUS IMPORTANTE. Le bandeau porte un filtre de campagne, la courbe
          lui obéit, les notes NON — `suivi_actions` n'a pas de colonne de
          campagne. Sans cette phrase, l'écran laisse croire que ces notes-là
          parlent de cette campagne-là. C'est `CLAUDE.md` §7. */}
      {notes.campActive && (
        <p className="text-[10.5px] text-muted">
          <b className="font-semibold">Ces notes ne sont pas filtrées par campagne.</b> Une
          note ne porte pas de campagne aujourd&apos;hui — seulement un thème et un jour.
          Tu vois donc toutes tes notes de la fenêtre, pendant que la courbe, elle, ne
          montre qu&apos;une campagne.
        </p>
      )}
      {notes.themesFiltres.length > 0 && (
        <p>
          Filtrées sur {notes.themesFiltres.length > 1 ? "les thèmes" : "le thème"}{" "}
          {notes.themesFiltres.join(", ")} — une note sans thème n&apos;apparaît pas.
        </p>
      )}
      {notes.horsFenetre > 0 && (
        <p>
          {notes.horsFenetre} autre{notes.horsFenetre > 1 ? "s" : ""} note
          {notes.horsFenetre > 1 ? "s" : ""} hors de la fenêtre affichée — élargis la
          période pour {notes.horsFenetre > 1 ? "les" : "la"} voir.
        </p>
      )}
      {nbAffichees > 0 && (
        <p>
          Une note dit ce que TU as fait ce jour-là. Elle ne reçoit aucun verdict : ce
          qu&apos;elle a changé, c&apos;est toi qui le lis sur la courbe.
        </p>
      )}
    </div>
  );
}

function Liste({
  marques,
  numerote,
  actif,
  onSurvol,
}: {
  marques: NoteMarque[];
  numerote: boolean;
  actif: string | null;
  onSurvol?: (id: string | null) => void;
}) {
  if (marques.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      {marques.map((m, k) => (
        <li
          key={m.id}
          onMouseEnter={() => onSurvol?.(m.id)}
          onMouseLeave={() => onSurvol?.(null)}
          className={`flex items-baseline gap-2 text-[12px] leading-snug rounded-md px-1.5 py-1 -mx-1.5 ${
            onSurvol ? "cursor-default" : ""
          } ${actif === m.id ? "bg-black/[0.04]" : ""}`}
        >
          {numerote ? (
            <span
              className="shrink-0 rounded-full font-mono text-[8.5px] w-[13px] h-[13px] flex items-center justify-center translate-y-[-1px]"
              style={{ border: `1px solid ${ENCRE}`, color: ENCRE }}
            >
              {k + 1}
            </span>
          ) : (
            <span className="shrink-0 text-[10px] uppercase tracking-widest text-faint font-semibold">
              {jourCourt(m.date)}
            </span>
          )}
          <span className="text-ink min-w-0">{m.titre}</span>
          {m.theme && <span className="shrink-0 text-[10.5px] text-faint">· {m.theme}</span>}
        </li>
      ))}
    </ul>
  );
}

export function ProtoNotesCourbe({
  variante,
  notes,
  labels,
  valeurs,
  nomSerie,
  fmtV,
  unite,
  entete,
  chiffre,
  selecteur,
  canal,
}: {
  variante: string;
  notes: NotesCourbe;
  /** Le nom du canal, écrit dans l'aveu « rien ne rattache cette note ici ». */
  canal: string;
  labels: string[];
  valeurs: number[];
  nomSerie: string;
  fmtV: (v: number) => string;
  unite: string;
  entete: React.ReactNode;
  chiffre: React.ReactNode;
  selecteur: React.ReactNode;
}) {
  const [actif, setActif] = useState<string | null>(null);
  const n = labels.length;
  const marques = notes.marques;
  const allume = (m: NoteMarque) => actif === m.id;

  const courbe = (
    <LineChart
      labels={labels}
      series={[{ name: nomSerie, color: "#1a56ff", values: valeurs }]}
      fmt={fmtV}
      unit={` ${unite}`}
      ariaLabel={`${nomSerie} par jour`}
    />
  );

  return (
    <div className="bg-white border border-line rounded-xl shadow-card p-5 mb-8">
      {entete}
      {chiffre}

      {/* LE TRACÉ ET SA COUCHE DE MARQUES. Le conteneur est `relative` et la
          couche `inset-0` : sans `bandes`, `LineChart` occupe toute la largeur
          de cette boîte, donc les deux repères coïncident. */}
      <div className="relative">
        {courbe}

        {(variante === "A" || variante === "D") && (
          <div className="absolute inset-0 pointer-events-none">
            {marques.map((m, k) =>
              variante === "D" && !allume(m) ? null : (
                <span key={m.id}>
                  <Trait pct={pctX(m.i, n)} fort={variante === "D" || allume(m)} />
                  {variante === "A" && <Numero pct={pctX(m.i, n)} n={k + 1} />}
                </span>
              )
            )}
          </div>
        )}
      </div>

      {/* B — LE PEIGNE : une rangée à part, SOUS l'axe. Le tracé ne gagne pas
          un pixel ; ce qui se lit est hors de son cadre. */}
      {variante === "B" && marques.length > 0 && (
        <div className="relative h-3.5 mt-0.5">
          {marques.map((m) => (
            <Chevron key={m.id} pct={pctX(m.i, n)} />
          ))}
        </div>
      )}

      {/* C — LA FRISE : le texte de la note à même la rangée, sous sa colonne.
          Pas de liste en dessous — la frise EST la liste, à sa place dans le
          temps. Le texte est tronqué dur : c'est ce que la variante coûte, et
          c'est ce qu'il faut juger. */}
      {variante === "C" && marques.length > 0 && (
        <div className="relative h-14 mt-0.5">
          {marques.map((m) => {
            const pct = pctX(m.i, n);
            // Aux bords, on cale le texte contre le bord plutôt que de le
            // centrer — même règle que l'`ancrage` des dates de `LineChart`,
            // sans quoi la première et la dernière note sortent du cadre.
            const ancre = pct < 15 ? "translate-x-0" : pct > 85 ? "-translate-x-full" : "-translate-x-1/2";
            return (
              <span key={m.id}>
                <Chevron pct={pct} />
                <span
                  className={`absolute top-3 w-[72px] text-[9.5px] leading-tight text-muted line-clamp-3 ${ancre}`}
                  style={{ left: `${pct}%` }}
                  title={m.titre}
                >
                  {m.titre}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {marques.length === 0 && (
        <p className="text-[12px] text-muted mt-3 leading-relaxed">
          Aucune note sur cette fenêtre.{" "}
          <span className="text-faint">
            Ce module ne montre que ce que tu as écrit toi-même — il n&apos;invente rien
            pour se remplir. Écris-en une depuis la page d&apos;accueil (« ✎ Noter quelque
            chose que tu as fait »), datée dans la période affichée, puis reviens ici.
          </span>
        </p>
      )}

      {variante !== "C" && (
        <Liste
          marques={marques}
          numerote={variante === "A"}
          actif={actif}
          onSurvol={variante === "D" ? setActif : undefined}
        />
      )}

      {variante === "D" && marques.length > 0 && (
        <p className="text-[10.5px] text-faint mt-2">
          Survole une note : son jour s&apos;allume sur la courbe.
        </p>
      )}

      <Aveux notes={notes} nbAffichees={marques.length} canal={canal} />

      {selecteur}
    </div>
  );
}
