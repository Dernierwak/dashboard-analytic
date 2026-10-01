"use client";

// PROTOTYPE, À RETIRER — voir `page.tsx`. Quatrième passage du ticket 05.
//
// La structure est celle du BRIEF (`.scratch/meta-ads/brief.md`), dans son
// ordre : barre de filtres collante → vue d'ensemble → comparaison → tableau
// hiérarchique, avec l'historique des changements posé sur les courbes.
//
// Ce que le retour de David du 2026-09-30 (troisième passage) a changé :
//   · la vue d'ensemble montre le TOTAL, pas une ligne par campagne ; le filtre
//     campagne resserre ;
//   · la catégorie se choisit sur trois cartes qui se lisent comme des vues,
//     repliées en sélecteur compact dans la barre au défilement ;
//   · la barre suit, se détache en pilule, et ses menus (campagne, période avec
//     calendrier) sont de vrais menus ;
//   · la comparaison part de la variante C (classement, on coche, la courbe
//     apparaît), toujours avec DEUX métriques distinctes, en deux variantes de
//     mise en page, `?comparaison=C1|C2`.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// ─── Le calendrier ────────────────────────────────────────────────────────────
// Jour de travail : lundi 28 sept. 2026. Le dernier jour complet est le
// dimanche 27 : toute comparaison exclut le jour en cours (`CLAUDE.md` §7).
const JOURS = 112;
const FIN = Date.UTC(2026, 8, 27);
const DEBUT = FIN - (JOURS - 1) * 86_400_000;
// Meta révise une conversion jusqu'à 28 jours (ticket 04).
const PREMIER_JOUR_PROVISOIRE = JOURS - 28;

const date = (d: number) => new Date(DEBUT + d * 86_400_000);
const court = (d: number) => date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const long = (d: number) =>
  date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });


// Palette validée par `dataviz/scripts/validate_palette.js` sur fond blanc,
// dans cet ordre (CVD ΔE ≥ 9,1 entre voisins). Trois couleurs sont sous 3:1
// de contraste : l'identité passe donc aussi par la légende nommée et le nom
// écrit au bout des courbes, jamais par la couleur seule.
const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

// ─── Les données inventées ────────────────────────────────────────────────────
type Format = "image" | "video" | "carrousel";
type Annonce = {
  id: string;
  nom: string;
  format: Format;
  fond: [string, string];
  accroche: string;
  // Le contenu des assets : Meta le rend toujours, par l'endpoint des créas
  // (ticket 03). Ses MÉTRIQUES, elles, n'existent pas pour une créa unique.
  textes: string[];
  titres: string[];
  descriptions: string[];
  visuels: string[];
  imp: number;
  ctr: number;
  cvr: number | null; // null : Meta ne rend AUCUNE action de conversion
  cpm: number;
  pente: number;
  debut?: number;
  fin?: number;
};
type AdSet = { id: string; nom: string; annonces: Annonce[] };
type Campagne = { nom: string; couleur: string; adsets: AdSet[] };

const CAMPAGNES: Campagne[] = [
  {
    nom: "Soldes d'automne",
    couleur: PALETTE[0],
    adsets: [
      {
        id: "s1", nom: "Acheteurs 30 j",
        annonces: [
          {
            id: "a1", nom: "Carrousel manteaux", format: "carrousel", fond: ["#e9d8c4", "#b98b62"],
            accroche: "Trois manteaux, un hiver.",
            textes: ["Laine recyclée, coupe droite, trois coloris. Jusqu'à −30 % tout le week-end."],
            titres: ["Les manteaux de la saison"],
            descriptions: ["Livraison offerte dès 60 €"],
            visuels: ["Manteau camel", "Manteau marine", "Manteau gris"],
            imp: 4200, ctr: 0.019, cvr: 0.045, cpm: 9.5, pente: 0.04,
          },
          {
            id: "a2", nom: "Vidéo 15 s — essayage", format: "video", fond: ["#cfd8ef", "#56699f"],
            accroche: "Essayé, adopté.",
            textes: ["Camille essaie la parka en 15 secondes chrono.", "La parka qui a tenu tout l'hiver dernier."],
            titres: ["La parka qui tient chaud", "Parka : −30 %"],
            descriptions: ["Retours gratuits sous 30 jours"],
            visuels: ["Vidéo essayage 15 s"],
            imp: 3100, ctr: 0.014, cvr: 0.031, cpm: 11, pente: -0.05, fin: JOURS - 4,
          },
        ],
      },
      {
        id: "s2", nom: "Similaires 1 %",
        annonces: [
          {
            id: "a3", nom: "Image unique — −30 %", format: "image", fond: ["#f3c9bd", "#c9553f"],
            accroche: "−30 %",
            textes: ["Les soldes d'automne commencent. Stocks limités sur les tailles M et L."],
            titres: ["−30 % sur toute la collection"],
            descriptions: ["Jusqu'au 4 octobre"],
            visuels: ["Visuel soldes"],
            imp: 6800, ctr: 0.011, cvr: 0.018, cpm: 6.8, pente: 0.02,
          },
        ],
      },
    ],
  },
  {
    nom: "Notoriété — Marque",
    couleur: PALETTE[1],
    adsets: [
      {
        id: "s3", nom: "Large FR 25-45",
        annonces: [
          {
            id: "a4", nom: "Vidéo marque 30 s", format: "video", fond: ["#d5e3d8", "#3f5f4b"],
            accroche: "Fait pour durer.",
            textes: ["Depuis 2014, on dessine des vêtements qu'on garde dix ans."],
            titres: ["Notre histoire"],
            descriptions: [],
            visuels: ["Vidéo marque 30 s"],
            imp: 14000, ctr: 0.004, cvr: null, cpm: 3.1, pente: -0.02,
          },
          {
            id: "a5", nom: "Reel coulisses", format: "video", fond: ["#e2d9f3", "#6b54a8"],
            accroche: "Dans l'atelier.",
            textes: ["Une journée à l'atelier de Roubaix, de la coupe à l'étiquette."],
            titres: ["Les coulisses"],
            descriptions: [],
            visuels: ["Reel 22 s"],
            imp: 9000, ctr: 0.006, cvr: null, cpm: 3.6, pente: 0.1, debut: JOURS - 21,
          },
        ],
      },
    ],
  },
  {
    nom: "Guides du blog",
    couleur: PALETTE[2],
    adsets: [
      {
        id: "s4", nom: "Intérêts mode",
        annonces: [
          {
            id: "a6", nom: "Guide des tailles", format: "image", fond: ["#cdeae2", "#2d8a73"],
            accroche: "S, M ou L ?",
            textes: ["Notre guide pour trouver la bonne taille du premier coup."],
            titres: ["Le guide des tailles"],
            descriptions: ["Lecture : 3 minutes"],
            visuels: ["Illustration mètre ruban"],
            imp: 3800, ctr: 0.024, cvr: 0.004, cpm: 5.2, pente: 0.06,
          },
          {
            id: "a7", nom: "Entretenir la laine", format: "image", fond: ["#efe6c9", "#9a8340"],
            accroche: "30 °C, pas plus.",
            textes: ["Laver, sécher, ranger : tout pour qu'un pull en laine dure dix hivers."],
            titres: ["Entretenir la laine"],
            descriptions: ["Lecture : 4 minutes"],
            visuels: ["Photo pull plié"],
            imp: 2600, ctr: 0.021, cvr: 0.002, cpm: 5.6, pente: -0.01,
          },
        ],
      },
    ],
  },
  {
    nom: "Relance panier",
    couleur: PALETTE[3],
    adsets: [
      {
        id: "s5", nom: "Paniers abandonnés 7 j",
        annonces: [
          {
            id: "a8", nom: "Catalogue dynamique", format: "carrousel", fond: ["#f5e3bd", "#b07a12"],
            accroche: "Toujours là.",
            textes: ["Les articles de ton panier t'attendent encore. Livraison offerte."],
            titres: ["Ton panier t'attend"],
            descriptions: ["Offre valable 48 h"],
            visuels: ["Produit du catalogue (varie selon la personne)"],
            imp: 1500, ctr: 0.028, cvr: 0.09, cpm: 14, pente: 0.03,
          },
        ],
      },
    ],
  },
];

const ADSETS = CAMPAGNES.flatMap((c) => c.adsets);
const ANNONCES = ADSETS.flatMap((s) => s.annonces);
// La couleur suit l'élément, jamais son rang ni la sélection : un élément
// garde la sienne quand on en ajoute ou retire un autre.
const couleurDe = (id: string) => {
  const liste = id.startsWith("s") ? ADSETS.map((s) => s.id) : ANNONCES.map((x) => x.id);
  return PALETTE[liste.indexOf(id) % PALETTE.length];
};
const campagneDeAnnonce = (a: Annonce) => CAMPAGNES.find((c) => c.adsets.some((s) => s.annonces.includes(a)))!;
const campagneDeAdSet = (s: AdSet) => CAMPAGNES.find((c) => c.adsets.includes(s))!;
const annoncesDe = (c: Campagne) => c.adsets.flatMap((s) => s.annonces);

type Changement = { jour: number; campagne: string; objet: string; nature: string; detail: string };
// Ce que `platform_changes` porte déjà (`fetch_meta_ads.py::fetch_activities`).
const CHANGEMENTS: Changement[] = [
  { jour: JOURS - 50, campagne: "Soldes d'automne", objet: "Similaires 1 %", nature: "Budget", detail: "40 € → 60 € par jour" },
  { jour: JOURS - 38, campagne: "Guides du blog", objet: "Intérêts mode", nature: "Audience", detail: "Ajout de l'intérêt « Mode durable »" },
  { jour: JOURS - 21, campagne: "Notoriété — Marque", objet: "Reel coulisses", nature: "Créa", detail: "Nouvelle annonce publiée" },
  { jour: JOURS - 21, campagne: "Notoriété — Marque", objet: "Large FR 25-45", nature: "Budget", detail: "80 € → 120 € par jour" },
  { jour: JOURS - 12, campagne: "Soldes d'automne", objet: "Acheteurs 30 j", nature: "Enchère", detail: "Coût le plus bas → plafond de coût 18 €" },
  { jour: JOURS - 4, campagne: "Soldes d'automne", objet: "Vidéo 15 s — essayage", nature: "Statut", detail: "Active → en pause" },
  { jour: JOURS - 4, campagne: "Soldes d'automne", objet: "Carrousel manteaux", nature: "Créa", detail: "Deuxième carte remplacée" },
  { jour: JOURS - 4, campagne: "Relance panier", objet: "Paniers abandonnés 7 j", nature: "Budget", detail: "15 € → 25 € par jour" },
];

type Jour = { imp: number; portee: number; clics: number; conv: number | null; dep: number } | null;

function graine(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const JOURNAL = new Map<Annonce, Jour[]>();
for (const a of ANNONCES) {
  const r = graine(a.nom);
  JOURNAL.set(
    a,
    Array.from({ length: JOURS }, (_, d) => {
      if ((a.debut !== undefined && d < a.debut) || (a.fin !== undefined && d >= a.fin)) return null;
      const rythme = 1 + 0.14 * Math.sin(((d % 7) / 7) * Math.PI * 2);
      const imp = Math.round(a.imp * rythme * (1 + a.pente * (d / 7 - 8)) * (0.9 + 0.2 * r()));
      const clics = Math.round(imp * a.ctr * (0.85 + 0.3 * r()));
      return {
        imp,
        // PROTOTYPE : une portée inventée. La vraie se lit au niveau affiché,
        // elle ne s'additionne pas (ticket « La portée s'additionne… »).
        portee: Math.round(imp / (1.35 + 0.3 * r())),
        clics,
        conv: a.cvr === null ? null : Math.round(clics * a.cvr * (0.65 + 0.7 * r())),
        dep: (imp / 1000) * a.cpm * (0.88 + 0.24 * r()),
      };
    }),
  );
}

type Somme = { imp: number; portee: number; clics: number; conv: number | null; dep: number; vide: boolean };
function somme(annonces: Annonce[], de: number, a: number): Somme {
  const t: Somme = { imp: 0, portee: 0, clics: 0, conv: null, dep: 0, vide: true };
  for (const an of annonces)
    for (let d = Math.max(0, de); d < a; d++) {
      const j = JOURNAL.get(an)![d];
      if (!j) continue;
      t.vide = false;
      t.imp += j.imp;
      t.portee += j.portee;
      t.clics += j.clics;
      t.dep += j.dep;
      if (j.conv !== null) t.conv = (t.conv ?? 0) + j.conv;
    }
  return t;
}

// ─── Les trois catégories, avec les métriques du brief ───────────────────────
type Categorie = "notoriete" | "trafic" | "conversion";
type Metrique = {
  cle: string;
  nom: string;
  lire: (s: Somme) => number | null;
  format: (v: number) => string;
  hausseBonne: boolean;
  aide?: string;
};

// `useGrouping: "always"` : le français ne groupe pas les nombres à quatre
// chiffres par défaut, et « 5000 » voisinait avec « 10,0 k » sur le même axe.
const nf = (v: number, d = 0) =>
  v.toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d, useGrouping: "always" } as Intl.NumberFormatOptions);
const compact = (v: number) =>
  v >= 1_000_000 ? `${nf(v / 1_000_000, 2)} M` : v >= 10_000 ? `${nf(v / 1000, v >= 100_000 ? 0 : 1)} k` : nf(v);
const div = (a: number | null, b: number) => (a === null || b === 0 ? null : a / b);

const CATEGORIES: Record<Categorie, { titre: string; metriques: Metrique[] }> = {
  notoriete: {
    titre: "Notoriété",
    metriques: [
      { cle: "imp", nom: "Impressions", lire: (s) => s.imp, format: compact, hausseBonne: true },
      { cle: "cpm", nom: "CPM", lire: (s) => div(s.dep * 1000, s.imp), format: (v) => `${nf(v, 2)} €`, hausseBonne: false, aide: "Coût pour 1 000 impressions." },
      { cle: "portee", nom: "Portée", lire: (s) => s.portee, format: compact, hausseBonne: true, aide: "Personnes différentes touchées. Elle ne s'additionne pas d'un jour à l'autre." },
      { cle: "freq", nom: "Fréquence", lire: (s) => div(s.imp, s.portee), format: (v) => nf(v, 2), hausseBonne: false, aide: "Impressions ÷ portée : combien de fois une même personne a vu tes annonces." },
    ],
  },
  trafic: {
    titre: "Trafic",
    metriques: [
      { cle: "clics", nom: "Clics sur le lien", lire: (s) => s.clics, format: compact, hausseBonne: true },
      { cle: "ctr", nom: "CTR", lire: (s) => div(s.clics, s.imp), format: (v) => `${nf(v * 100, 2)} %`, hausseBonne: true, aide: "Clics sur le lien ÷ impressions." },
      { cle: "cpc", nom: "CPC", lire: (s) => div(s.dep, s.clics), format: (v) => `${nf(v, 2)} €`, hausseBonne: false, aide: "Coût par clic sur le lien." },
    ],
  },
  conversion: {
    titre: "Conversion",
    metriques: [
      { cle: "conv", nom: "Conversions", lire: (s) => s.conv, format: nf, hausseBonne: true, aide: "Achats attribués par Meta." },
      { cle: "cpa", nom: "Coût par conversion", lire: (s) => (s.conv ? s.dep / s.conv : null), format: (v) => `${nf(v, 2)} €`, hausseBonne: false },
      // Meta n'a AUCUN taux de conversion (ticket 04) : notre dénominateur, écrit.
      { cle: "taux", nom: "Taux de conversion", lire: (s) => div(s.conv, s.clics), format: (v) => `${nf(v * 100, 2)} %`, hausseBonne: true, aide: "Conversions ÷ clics sur le lien. Meta ne fournit pas de taux : c'est notre calcul." },
    ],
  },
};

type Ecart = { txt: string; sens: -1 | 0 | 1; bon: boolean | null };
function ecart(m: Metrique, avant: Somme, apres: Somme): Ecart | null {
  const a = m.lire(avant), b = m.lire(apres);
  if (a === null || b === null || avant.vide || apres.vide || a === 0) return null;
  // Sous 20 unités, un pourcentage ment (1 → 3 conversions = « +200 % »).
  if (a < 20 && Number.isInteger(a)) {
    const d = b - a;
    const sens = Math.sign(d) as -1 | 0 | 1;
    return { txt: d === 0 ? "stable" : `${d > 0 ? "+" : "−"}${nf(Math.abs(d))}`, sens, bon: sens === 0 ? null : (sens > 0) === m.hausseBonne };
  }
  const v = (b - a) / a;
  if (Math.abs(v) < 0.005) return { txt: "stable", sens: 0, bon: null };
  const sens = Math.sign(v) as -1 | 1;
  return { txt: `${nf(Math.abs(v) * 100, Math.abs(v) < 0.1 ? 1 : 0)} %`, sens, bon: (sens > 0) === m.hausseBonne };
}

function Pastille({ e }: { e: Ecart | null }) {
  if (!e) return <span className="text-[12px] px-2 py-0.5 rounded-full bg-[#f1f0ec] text-faint whitespace-nowrap">pas comparable</span>;
  const teinte = e.bon === null ? "bg-[#f1f0ec] text-muted" : e.bon ? "bg-[#e6f3ec] text-pos" : "bg-[#fbe9e7] text-neg";
  return (
    <span className={`text-[12px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 whitespace-nowrap ${teinte}`}>
      {e.sens > 0 ? "▲" : e.sens < 0 ? "▼" : "="} {e.txt}
    </span>
  );
}


// ─── Les icônes ───────────────────────────────────────────────────────────────
// Dessinées à la main (trait 1,75, 24 px) : pas de dépendance ajoutée au projet
// pour un prototype jetable.
type NomIcone = "oeil" | "clic" | "sac" | "calendrier" | "chevron" | "loupe" | "coche" | "croix" | "calques" | "crayon" | "fleche";
function Icone({ nom, className = "h-4 w-4" }: { nom: NomIcone; className?: string }) {
  const t = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {nom === "oeil" && <><path {...t} d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle {...t} cx="12" cy="12" r="3" /></>}
      {nom === "clic" && <><path {...t} d="m9 9 5 12 1.8-5.2L21 14 9 9Z" /><path {...t} d="M7.2 2.2 8 5.1M5.1 8 2.2 7.2M14 4.1 12 6M6 12l-1.9 2" /></>}
      {nom === "sac" && <><path {...t} d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path {...t} d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>}
      {nom === "calendrier" && <><rect {...t} x="3" y="4" width="18" height="18" rx="2" /><path {...t} d="M16 2v4M8 2v4M3 10h18" /></>}
      {nom === "chevron" && <path {...t} d="m6 9 6 6 6-6" />}
      {nom === "loupe" && <><circle {...t} cx="11" cy="11" r="7" /><path {...t} d="m21 21-4.3-4.3" /></>}
      {nom === "coche" && <path {...t} d="M20 6 9 17l-5-5" />}
      {nom === "croix" && <path {...t} d="M18 6 6 18M6 6l12 12" />}
      {nom === "calques" && <><path {...t} d="m12 2 10 5-10 5L2 7l10-5Z" /><path {...t} d="m2 17 10 5 10-5M2 12l10 5 10-5" /></>}
      {nom === "crayon" && <path {...t} d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />}
      {nom === "fleche" && <path {...t} d="M5 12h14M12 5l7 7-7 7" />}
    </svg>
  );
}

const ICONE_CATEGORIE: Record<Categorie, NomIcone> = { notoriete: "oeil", trafic: "clic", conversion: "sac" };
const QUESTION: Record<Categorie, string> = {
  notoriete: "Combien de personnes t'ont vu",
  trafic: "Combien sont venues sur ton site",
  conversion: "Combien ont acheté",
};

// Un chiffre qui défile jusqu'à sa nouvelle valeur quand la catégorie ou la
// période change : l'œil voit ce qui a bougé. Rien pour qui a réduit les
// animations.
function useDefile(cible: number | null) {
  const [v, setV] = useState(cible);
  const depuis = useRef(cible);
  useEffect(() => {
    if (cible === null || depuis.current === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(cible); depuis.current = cible; return;
    }
    const a = depuis.current, t0 = performance.now();
    let id = 0;
    const pas = (t: number) => {
      const k = Math.min(1, (t - t0) / 450), e = 1 - Math.pow(1 - k, 3);
      setV(a + (cible - a) * e);
      if (k < 1) id = requestAnimationFrame(pas); else depuis.current = cible;
    };
    id = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(id);
  }, [cible]);
  return v;
}
function Chiffre({ valeur, format, className }: { valeur: number | null; format: (v: number) => string; className?: string }) {
  const v = useDefile(valeur);
  return <span className={className}>{v === null ? "—" : format(v)}</span>;
}

// ─── La courbe ────────────────────────────────────────────────────────────────
// Lissage monotone (Fritsch-Carlson) : la courbe ne dépasse jamais les points
// qu'elle relie, donc elle n'invente ni pic ni creux.
function chemin(pts: [number, number][]) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  const n = pts.length, dx: number[] = [], m: number[] = [], t: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); m.push((pts[i + 1][1] - pts[i][1]) / dx[i]); }
  t.push(m[0]);
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]));
  t.push(m[n - 2]);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + h * t[i]).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - h * t[i + 1]).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

type Serie = { id: string; nom: string; couleur: string; pts: (number | null)[]; fantome?: boolean };

function Courbe({
  series, de, a, metrique, changements = [], onJour, largeur = 560, hauteur = 200, remplir = false, provisoire = false, etiquettes = false, cle,
}: {
  series: Serie[]; de: number; a: number; metrique: Metrique; changements?: number[]; onJour?: (d: number) => void;
  largeur?: number; hauteur?: number; remplir?: boolean; provisoire?: boolean; etiquettes?: boolean; cle: string;
}) {
  const boite = useRef<HTMLDivElement>(null);
  const [survol, setSurvol] = useState<number | null>(null);
  const W = largeur, H = hauteur, G = 44, D = etiquettes ? 140 : 10, HAUT = 10, BAS = 24;
  const n = a - de;
  const vals = series.flatMap((s) => s.pts.slice(0, n).filter((v): v is number => v !== null));
  const brut = Math.max(1e-9, ...vals);
  const p10 = Math.pow(10, Math.floor(Math.log10(brut / 3)));
  const pas = [1, 2, 5, 10].map((k) => k * p10).find((k) => brut / k <= 3.5)!;
  const max = Math.ceil(brut / pas) * pas;
  const x = (i: number) => G + (i / Math.max(1, n - 1)) * (W - G - D);
  const y = (v: number) => HAUT + (1 - v / max) * (H - HAUT - BAS);
  const ticks = Array.from({ length: Math.round(max / pas) + 1 }, (_, i) => i * pas);
  const pasDate = n <= 14 ? Math.max(1, Math.round(n / 5)) : n <= 35 ? 7 : 14;
  const dates = Array.from({ length: Math.floor((n - 1) / pasDate) + 1 }, (_, i) => n - 1 - i * pasDate).filter((i) => i >= 0);
  // `useId` et pas `cle` : un nom de campagne (apostrophe, espace) cassait
  // `url(#…)` et le dégradé tombait en noir.
  const idGrad = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const troncons = (s: Serie) => {
    const out: [number, number][][] = [];
    let cur: [number, number][] = [];
    s.pts.slice(0, n).forEach((v, i) => {
      if (v === null) { if (cur.length) out.push(cur); cur = []; return; }
      cur.push([x(i), y(v)]);
    });
    if (cur.length) out.push(cur);
    return out;
  };

  const fins = etiquettes
    ? series.filter((s) => !s.fantome).map((s) => {
        let i = n - 1;
        while (i >= 0 && s.pts[i] === null) i--;
        return i < 0 ? null : { s, i, yv: y(s.pts[i]!), yl: y(s.pts[i]!) };
      }).filter((f): f is { s: Serie; i: number; yv: number; yl: number } => f !== null).sort((u, v) => u.yl - v.yl)
    : [];
  for (let k = 1; k < fins.length; k++) if (fins[k].yl - fins[k - 1].yl < 15) fins[k].yl = fins[k - 1].yl + 15;

  const bouge = (e: React.PointerEvent) => {
    const r = boite.current!.getBoundingClientRect();
    const i = Math.round((((e.clientX - r.left) / r.width) * W - G) / (W - G - D) * (n - 1));
    setSurvol(i >= 0 && i < n ? i : null);
  };
  const jourSurvol = survol === null ? null : de + survol;
  const principal = series.find((s) => !s.fantome);
  const aChangement = jourSurvol !== null && changements.includes(jourSurvol);

  return (
    <div ref={boite} className="relative select-none" onPointerMove={bouge} onPointerLeave={() => setSurvol(null)}
      onClick={() => aChangement && onJour?.(jourSurvol!)} style={{ cursor: aChangement && onJour ? "pointer" : "crosshair" }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block overflow-visible" role="img" aria-label={metrique.nom}>
        <defs>
          <linearGradient id={idGrad} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={principal?.couleur ?? "#1a56ff"} stopOpacity={0.16} />
            <stop offset="100%" stopColor={principal?.couleur ?? "#1a56ff"} stopOpacity={0} />
          </linearGradient>
        </defs>
        {provisoire && PREMIER_JOUR_PROVISOIRE < a && (
          <rect x={x(Math.max(0, PREMIER_JOUR_PROVISOIRE - de))} y={HAUT} width={x(n - 1) - x(Math.max(0, PREMIER_JOUR_PROVISOIRE - de))} height={H - HAUT - BAS}
            fill="url(#hachures)" opacity={0.6} />
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={G} x2={W - D} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#dddcd6" : "#f0efeb"} strokeWidth={1} />
            <text x={G - 8} y={y(t) + 3.5} fontSize={10} fill="#9a9ca4" textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>{metrique.format(t)}</text>
          </g>
        ))}
        {dates.map((i) => (
          <text key={i} x={x(i)} y={H - 6} fontSize={10} fill="#9a9ca4" textAnchor={i === n - 1 ? "end" : "middle"}>{court(de + i)}</text>
        ))}
        {series.map((s) => troncons(s).map((tr, k) => (
          <g key={`${s.id}${k}${cle}`}>
            {remplir && !s.fantome && tr.length > 1 && (
              <path d={`${chemin(tr)}L${tr[tr.length - 1][0]},${y(0)}L${tr[0][0]},${y(0)}Z`} fill={`url(#${idGrad})`} className="apparait" />
            )}
            <path d={chemin(tr)} fill="none" stroke={s.fantome ? "#c3c2bb" : s.couleur} strokeWidth={s.fantome ? 1.5 : 2}
              strokeDasharray={s.fantome ? "4 4" : undefined} strokeLinecap="round" className={s.fantome ? "" : "trace"} pathLength={s.fantome ? undefined : 1} />
          </g>
        )))}
        {principal && changements.filter((d) => d >= de && d < a).map((d) => {
          const v = principal.pts[d - de];
          if (v === null || v === undefined) return null;
          const actif = jourSurvol === d;
          return (
            <g key={d} pointerEvents="none" className="apparait">
              <circle cx={x(d - de)} cy={y(v)} r={actif ? 9 : 6.5} fill="#fff" stroke="#0e0f12" strokeWidth={actif ? 2 : 1.5} style={{ transition: "r 150ms" }} />
              <path d={`M${x(d - de) - 2.4},${y(v) + 2.4}l3.6-3.6 1.2 1.2-3.6 3.6-1.6.4Z`} fill="#0e0f12" />
            </g>
          );
        })}
        {fins.map((f) => (
          <g key={f.s.id}>
            <line x1={x(f.i) + 5} x2={W - D + 8} y1={f.yv} y2={f.yl} stroke="#e2e1db" strokeWidth={1} />
            <circle cx={x(f.i)} cy={f.yv} r={3.5} fill={f.s.couleur} stroke="#fff" strokeWidth={1.5} />
            <text x={W - D + 12} y={f.yl + 4} fontSize={11.5} fill="#0e0f12" fontWeight={500}>{f.s.nom.length > 19 ? f.s.nom.slice(0, 18) + "…" : f.s.nom}</text>
          </g>
        ))}
        {survol !== null && (
          <g pointerEvents="none">
            <line x1={x(survol)} x2={x(survol)} y1={HAUT} y2={H - BAS} stroke="#0e0f12" strokeOpacity={0.14} strokeWidth={1} />
            {series.map((s) => s.pts[survol] !== null && s.pts[survol] !== undefined && (
              <circle key={s.id} cx={x(survol)} cy={y(s.pts[survol]!)} r={3.5} fill={s.fantome ? "#c3c2bb" : s.couleur} stroke="#fff" strokeWidth={1.5} />
            ))}
          </g>
        )}
      </svg>
      {survol !== null && (
        <div className="pointer-events-none absolute top-0 z-10 rounded-xl bg-ink/95 text-white px-3 py-2.5 min-w-[180px] shadow-xl backdrop-blur-sm"
          style={{ left: `${(x(survol) / W) * 100}%`, transform: x(survol) > W * 0.55 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}>
          <p className="text-[11px] text-white/60 capitalize mb-1">{long(de + survol)}</p>
          {series.map((s) => (
            <div key={s.id} className="flex items-center gap-2 py-px">
              <span className={`h-[3px] w-3 rounded-full shrink-0 ${s.fantome ? "opacity-60" : ""}`} style={{ background: s.fantome ? "#c3c2bb" : s.couleur }} />
              <span className="text-[13px] font-semibold tabular-nums">{s.pts[survol] === null || s.pts[survol] === undefined ? "—" : metrique.format(s.pts[survol]!)}</span>
              <span className="text-[11px] text-white/60 truncate">{s.nom}</span>
            </div>
          ))}
          {aChangement && (
            <p className="text-[11.5px] text-[#9db8ff] mt-1.5 pt-1.5 border-t border-white/10 flex items-center gap-1.5">
              <Icone nom="crayon" className="h-3 w-3" /> {CHANGEMENTS.filter((c) => c.jour === jourSurvol).length} changement(s) · clique pour voir
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Le panneau latéral ───────────────────────────────────────────────────────
function Panneau({ ouvert, fermer, titre, sousTitre, children }: {
  ouvert: boolean; fermer: () => void; titre: string; sousTitre?: string; children: React.ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [fermer]);
  return (
    <div className={`fixed inset-0 z-50 ${ouvert ? "" : "pointer-events-none"}`} aria-hidden={!ouvert}>
      <div onClick={fermer} className={`absolute inset-0 bg-ink/25 backdrop-blur-[2px] transition-opacity duration-300 ${ouvert ? "opacity-100" : "opacity-0"}`} />
      <aside role="dialog" aria-label={titre}
        className={`absolute right-3 top-3 bottom-3 w-[calc(100%-24px)] sm:w-[420px] rounded-2xl bg-white shadow-2xl flex flex-col transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none ${ouvert ? "translate-x-0 opacity-100" : "translate-x-[110%] opacity-0"}`}>
        <header className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-[20px] font-semibold text-ink leading-tight first-letter:uppercase">{titre}</h3>
            {sousTitre && <p className="text-[13px] text-muted mt-1">{sousTitre}</p>}
          </div>
          <button onClick={fermer} className="h-8 w-8 shrink-0 rounded-full bg-canvas hover:bg-[#ecebe6] text-muted flex items-center justify-center" aria-label="Fermer">
            <Icone nom="croix" className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
      </aside>
    </div>
  );
}

// ─── Une créa, dessinée ───────────────────────────────────────────────────────
function Crea({ a, className = "", mini = false }: { a: Annonce; className?: string; mini?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-lg ${className}`} style={{ background: `linear-gradient(160deg, ${a.fond[0]} 0%, ${a.fond[1]} 100%)` }}>
      <div className="absolute -right-6 -bottom-8 h-[70%] aspect-square rounded-full opacity-25" style={{ background: a.fond[0] }} />
      <div className="absolute left-[12%] bottom-[16%] h-[40%] w-[34%] rounded-t-full opacity-40" style={{ background: a.fond[1], filter: "brightness(0.8)" }} />
      {!mini && <p className="absolute left-2.5 right-2.5 top-2.5 font-semibold text-white leading-[1.05] text-[clamp(11px,1.2vw,17px)] drop-shadow-sm">{a.accroche}</p>}
      {!mini && a.format === "video" && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-8 w-8 rounded-full bg-white/85 flex items-center justify-center text-ink text-[11px] pl-0.5">▶</span>
        </span>
      )}
      {!mini && a.format === "carrousel" && (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {[0, 1, 2].map((i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-white" : "bg-white/50"}`} />)}
        </span>
      )}
    </div>
  );
}

// ─── Lire une annonce (ticket 06) ─────────────────────────────────────────────
// Trois endroits possibles pour la même matière, `?lecture=T|P|S` :
//   T — dans le tableau, un quatrième rang sous l'annonce ;
//   P — dans le panneau latéral, le même que celui des changements ;
//   S — sous les graphes de comparaison, à plat, sans clic.
// Le contenu vient de l'endpoint des créas, jamais des insights (ticket 03) :
// il n'y a donc aucun chiffre à côté d'un texte, d'une carte ou d'une variante.
type Lecture = "T" | "P" | "S";
const LECTURES: { cle: Lecture; nom: string }[] = [
  { cle: "T", nom: "Dans le tableau" },
  { cle: "P", nom: "Panneau latéral" },
  { cle: "S", nom: "Sous la comparaison" },
];

const bouton = (x: Annonce) => (campagneDeAnnonce(x).nom === "Relance panier" || campagneDeAnnonce(x).nom === "Soldes d'automne" ? "Acheter" : "En savoir plus");

// L'annonce telle qu'elle s'affiche dans un fil : c'est ce que la personne a
// publié, et ce qu'elle reconnaît au premier coup d'œil.
function ApercuFil({ x }: { x: Annonce }) {
  const cartes = x.format === "carrousel" && x.visuels.length > 1;
  return (
    <div className="rounded-xl border border-line bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <span className="h-8 w-8 rounded-full bg-ink text-white text-[12px] font-semibold flex items-center justify-center shrink-0">ML</span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-ink leading-tight">Maison Laine</span>
          <span className="block text-[11.5px] text-muted">Sponsorisé</span>
        </span>
      </div>
      <p className="px-3.5 pb-3 text-[13.5px] text-ink leading-relaxed">{x.textes[0]}</p>
      {cartes ? (
        <div className="flex gap-2 overflow-x-auto px-3.5 pb-3 snap-x">
          {x.visuels.map((v) => (
            <div key={v} className="w-[62%] shrink-0 snap-start rounded-lg border border-line overflow-hidden">
              <Crea a={x} className="aspect-square rounded-none" mini />
              <p className="px-2.5 py-2 text-[12px] text-ink truncate">{v}</p>
            </div>
          ))}
        </div>
      ) : (
        <Crea a={x} className="aspect-[4/3] rounded-none" />
      )}
      <div className="flex items-center gap-3 px-3.5 py-3 bg-canvas">
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-ink truncate">{x.titres[0]}</span>
          {x.descriptions[0] && <span className="block text-[12px] text-muted truncate">{x.descriptions[0]}</span>}
        </span>
        <span className="h-8 px-3 rounded-md bg-[#e4e6eb] text-[12.5px] font-semibold text-ink flex items-center shrink-0">{bouton(x)}</span>
      </div>
    </div>
  );
}

// Tout ce qui a été écrit, champ par champ, sans rien couper : c'est là qu'un
// texte long se lit en entier.
function ChampsAnnonce({ x }: { x: Annonce }) {
  const groupe = (nom: string, valeurs: string[]) => valeurs.length === 0 ? null : (
    <div>
      <p className="text-[12px] text-muted mb-1.5">{nom}{valeurs.length > 1 ? ` · ${valeurs.length} variantes` : ""}</p>
      <ul className="space-y-1.5">
        {valeurs.map((v, i) => (
          <li key={i} className="flex gap-2.5 text-[14px] text-ink leading-relaxed">
            {valeurs.length > 1 && <span className="text-[11.5px] text-faint tabular-nums pt-0.5 w-3 shrink-0">{i + 1}</span>}
            <span className="min-w-0">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  const variantes = [x.textes, x.titres, x.descriptions].some((l) => l.length > 1);
  return (
    <div className="space-y-4">
      {groupe("Texte principal", x.textes)}
      {groupe("Titre", x.titres)}
      {groupe("Description", x.descriptions)}
      {groupe(x.format === "carrousel" ? "Cartes du carrousel" : x.format === "video" ? "Vidéo" : "Image", x.visuels)}
      {variantes && (
        <p className="text-[12px] text-faint leading-relaxed">Meta assemble ces variantes à la diffusion. Il ne dit pas de façon fiable laquelle a été vue ni laquelle a marché : Pulse n&apos;en classe aucune.</p>
      )}
      {x.format === "carrousel" && (
        <p className="text-[12px] text-faint leading-relaxed">Aucune carte ne porte de chiffre : Meta range ceux des cartes suivantes sur la première.</p>
      )}
    </div>
  );
}

function ContenuAnnonce({ x }: { x: Annonce }) {
  return (
    <div className="space-y-6 mt-1">
      <ApercuFil x={x} />
      <ChampsAnnonce x={x} />
      <p className="text-[12px] text-faint pt-4 border-t border-line leading-relaxed">
        Le contenu tel que Meta le rend au dernier passage de Pulse. Ce sont des textes, pas des mesures.
      </p>
    </div>
  );
}

// Sous les graphes de comparaison, les créas des éléments cochés (le brief :
// « aperçu visuel des créas comparées »). Selon la lecture, elles s'ouvrent
// dans le panneau (P), portent leur texte à plat (S), ou ne sont qu'un visuel (T).
function CreasComparees({ c, lecture, ouvrir }: { c: ReturnType<typeof useComparaison>; lecture: Lecture; ouvrir: (id: string) => void }) {
  const annonces = c.choisis.flatMap((e) => e.annonces.map((x) => ({ x, couleur: couleurDe(e.id) })));
  if (annonces.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="text-[14px] font-semibold text-ink mb-3">Les créas comparées</p>
      <div className={`grid gap-4 ${lecture === "S" ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"}`}>
        {annonces.map(({ x, couleur }) => {
          const tete = (
            <>
              <Crea a={x} className={lecture === "S" ? "aspect-[16/10]" : "aspect-square"} />
              <span className="flex items-center gap-2 mt-2.5 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: couleur }} />
                <span className="text-[13.5px] font-medium text-ink truncate">{x.nom}</span>
              </span>
            </>
          );
          if (lecture === "P") return (
            <button key={x.id} onClick={() => ouvrir(x.id)} className="group text-left min-w-0 rounded-xl p-2 -m-2 hover:bg-white transition-colors">
              {tete}
              <span className="text-[12.5px] text-brand mt-1 flex items-center gap-1 group-hover:gap-1.5 transition-all">Lire le texte <Icone nom="fleche" className="h-3.5 w-3.5" /></span>
            </button>
          );
          if (lecture === "S") return (
            <div key={x.id} className="min-w-0 rounded-2xl bg-white border border-line p-4">
              {tete}
              <div className="mt-4"><ChampsAnnonce x={x} /></div>
            </div>
          );
          return <div key={x.id} className="min-w-0">{tete}</div>;
        })}
      </div>
    </div>
  );
}

// ─── Les menus de la barre ────────────────────────────────────────────────────
function Popover({ ouvert, fermer, children, className = "" }: { ouvert: boolean; fermer: () => void; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const f = (e: MouseEvent) => { if (!ref.current?.parentElement?.contains(e.target as Node)) fermer(); };
    const k = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    document.addEventListener("mousedown", f); document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", f); document.removeEventListener("keydown", k); };
  }, [ouvert, fermer]);
  return (
    <div ref={ref}
      className={`absolute top-[calc(100%+8px)] z-40 rounded-2xl bg-white border border-line shadow-[0_20px_50px_rgba(14,15,18,0.16)] origin-top transition-all duration-200 ease-out ${ouvert ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-1 pointer-events-none"} ${className}`}>
      {children}
    </div>
  );
}

function BoutonBarre({ children, onClick, actif }: { children: React.ReactNode; onClick: () => void; actif: boolean }) {
  return (
    <button onClick={onClick} aria-expanded={actif}
      className={`h-10 shrink-0 whitespace-nowrap flex items-center gap-2 rounded-full border px-3.5 text-[13.5px] font-medium transition-all ${actif ? "border-ink/25 bg-white ring-4 ring-ink/5" : "border-line bg-white hover:border-ink/20"}`}>
      {children}
    </button>
  );
}

function ChoixCampagne({ valeur, onChange, compact }: { valeur: string | null; onChange: (v: string | null) => void; compact?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const fermer = useMemo(() => () => setOuvert(false), []);
  const choisie = CAMPAGNES.find((c) => c.nom === valeur);
  const lignes = CAMPAGNES.filter((c) => c.nom.toLowerCase().includes(q.toLowerCase()));
  const depense = (c: Campagne) => somme(annoncesDe(c), JOURS - 28, JOURS).dep;
  return (
    <div className="relative">
      <BoutonBarre onClick={() => setOuvert((o) => !o)} actif={ouvert}>
        <Icone nom="calques" className="h-4 w-4 text-muted" />
        {choisie ? <><span className="h-2 w-2 rounded-full" style={{ background: choisie.couleur }} />{choisie.nom}</> : compact ? "Toutes" : "Toutes les campagnes"}
        <Icone nom="chevron" className={`h-3.5 w-3.5 text-muted transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </BoutonBarre>
      <Popover ouvert={ouvert} fermer={fermer} className="right-0 w-[320px] p-2">
        <label className="flex items-center gap-2 px-3 h-10 rounded-xl bg-canvas text-muted">
          <Icone nom="loupe" className="h-4 w-4" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une campagne" className="bg-transparent outline-none text-[14px] text-ink flex-1 placeholder:text-faint" />
        </label>
        <div className="mt-1.5">
          {[null, ...lignes].map((c) => {
            const actif = (c?.nom ?? null) === valeur;
            return (
              <button key={c?.nom ?? "toutes"} onClick={() => { onChange(c?.nom ?? null); setOuvert(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[14px] transition-colors ${actif ? "bg-[#f1f4ff]" : "hover:bg-canvas"}`}>
                {c ? <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c.couleur }} /> : <Icone nom="calques" className="h-4 w-4 text-muted shrink-0" />}
                <span className="flex-1 min-w-0 truncate text-ink">{c?.nom ?? "Toutes les campagnes"}</span>
                {c && <span className="text-[12px] text-faint tabular-nums">{nf(depense(c))} € · 4 sem.</span>}
                <Icone nom="coche" className={`h-4 w-4 text-brand shrink-0 transition-opacity ${actif ? "opacity-100" : "opacity-0"}`} />
              </button>
            );
          })}
        </div>
      </Popover>
    </div>
  );
}

const RACCOURCIS = [
  { nom: "7 derniers jours", jours: 7 },
  { nom: "14 derniers jours", jours: 14 },
  { nom: "4 dernières semaines", jours: 28 },
  { nom: "8 dernières semaines", jours: 56 },
  { nom: "12 dernières semaines", jours: 84 },
];

function ChoixPeriode({ de, a, onChange, compact }: { de: number; a: number; onChange: (de: number, a: number) => void; compact?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [debutClic, setDebutClic] = useState<number | null>(null);
  const [survol, setSurvol] = useState<number | null>(null);
  const fermer = useMemo(() => () => { setOuvert(false); setDebutClic(null); }, []);
  const raccourci = RACCOURCIS.find((r) => a === JOURS && a - de === r.jours);
  // Les deux derniers mois, du lundi au dimanche. Les jours hors historique
  // (et le jour en cours) ne se cliquent pas.
  const mois = [7, 8].map((m) => {
    const premier = Date.UTC(2026, m, 1), dernier = Date.UTC(2026, m + 1, 0);
    const decal = (new Date(premier).getUTCDay() + 6) % 7;
    const cases: (number | null)[] = Array(decal).fill(null);
    for (let t = premier; t <= dernier; t += 86_400_000) cases.push(Math.round((t - DEBUT) / 86_400_000));
    return { nom: new Date(premier).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }), cases };
  });
  const bornes = debutClic !== null && survol !== null ? [Math.min(debutClic, survol), Math.max(debutClic, survol) + 1] : [de, a];
  const clic = (d: number) => {
    if (debutClic === null) { setDebutClic(d); return; }
    const x = Math.min(debutClic, d), y = Math.max(debutClic, d) + 1;
    onChange(x, y); setDebutClic(null); setOuvert(false);
  };
  return (
    <div className="relative">
      <BoutonBarre onClick={() => setOuvert((o) => !o)} actif={ouvert}>
        <Icone nom="calendrier" className="h-4 w-4 text-muted" />
        <span>{raccourci ? (compact ? `${raccourci.jours} j` : raccourci.nom) : `${court(de)} – ${court(a - 1)}`}</span>
        {!compact && <span className="text-faint font-normal hidden xl:inline">· {court(de)} – {court(a - 1)}</span>}
        <Icone nom="chevron" className={`h-3.5 w-3.5 text-muted transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </BoutonBarre>
      <Popover ouvert={ouvert} fermer={fermer} className="right-0 w-[min(640px,calc(100vw-32px))] flex overflow-hidden">
        <div className="w-[190px] shrink-0 border-r border-line p-2">
          {RACCOURCIS.map((r) => {
            const actif = raccourci === r;
            return (
              <button key={r.jours} onClick={() => { onChange(JOURS - r.jours, JOURS); fermer(); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] text-left ${actif ? "bg-[#f1f4ff] text-ink font-semibold" : "text-ink hover:bg-canvas"}`}>
                {r.nom}
                {actif && <Icone nom="coche" className="h-4 w-4 text-brand" />}
              </button>
            );
          })}
          <p className="text-[11.5px] text-faint px-3 pt-3 mt-2 border-t border-line leading-snug">Comparée à la période d&apos;avant, de même durée. Le jour en cours n&apos;est jamais compté.</p>
        </div>
        <div className="flex-1 p-4 grid sm:grid-cols-2 gap-5">
          {mois.map((m) => (
            <div key={m.nom}>
              <p className="text-[13px] font-semibold text-ink capitalize mb-2 text-center">{m.nom}</p>
              <div className="grid grid-cols-7 text-center text-[10.5px] text-faint mb-1">{["L", "M", "M", "J", "V", "S", "D"].map((j, i) => <span key={i}>{j}</span>)}</div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {m.cases.map((d, i) => {
                  if (d === null) return <span key={i} />;
                  const horsHistorique = d < 0 || d >= JOURS;
                  const dans = d >= bornes[0] && d < bornes[1];
                  const bord = d === bornes[0] || d === bornes[1] - 1;
                  return (
                    <button key={i} disabled={horsHistorique} onClick={() => clic(d)} onMouseEnter={() => setSurvol(d)}
                      className={`h-8 text-[12.5px] tabular-nums transition-colors ${horsHistorique ? "text-[#d5d4ce] cursor-not-allowed" : ""} ${dans ? (bord ? "bg-ink text-white rounded-lg font-semibold" : "bg-[#eef2ff] text-ink") : !horsHistorique ? "text-ink hover:bg-canvas rounded-lg" : ""}`}>
                      {date(d).getUTCDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="sm:col-span-2 text-[12px] text-muted -mt-1">
            {debutClic === null ? "Ou clique deux jours pour une période sur mesure." : `Du ${court(debutClic)} au… clique le dernier jour.`}
          </p>
        </div>
      </Popover>
    </div>
  );
}

// ─── Le sélecteur de catégorie ────────────────────────────────────────────────
// Trois cartes, pas trois boutons : chacune montre ce qu'elle mesure et son
// chiffre, et l'active est marquée sans ambiguïté. Au défilement, elles se
// replient en un sélecteur compact dans la barre, avec un curseur qui glisse.
function CartesCategorie({ categorie, choisir, annonces, de, a }: {
  categorie: Categorie; choisir: (c: Categorie) => void; annonces: Annonce[]; de: number; a: number;
}) {
  const n = a - de;
  return (
    <div className="grid sm:grid-cols-3 gap-3" role="tablist" aria-label="Ce que tu analyses">
      {(Object.keys(CATEGORIES) as Categorie[]).map((k) => {
        const actif = k === categorie;
        const m = CATEGORIES[k].metriques[0];
        const s = somme(annonces, de, a), p = somme(annonces, de - n, de);
        return (
          <button key={k} role="tab" aria-selected={actif} onClick={() => choisir(k)}
            className={`group relative text-left rounded-2xl p-5 transition-all duration-300 ${actif
              ? "bg-ink text-white shadow-[0_18px_40px_-12px_rgba(14,15,18,0.45)] -translate-y-0.5"
              : "bg-white border border-line hover:border-ink/15 hover:shadow-[0_10px_30px_-12px_rgba(14,15,18,0.18)] hover:-translate-y-0.5"}`}>
            <div className="flex items-center justify-between">
              <span className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${actif ? "bg-white/12 text-white" : "bg-canvas text-ink group-hover:bg-[#eef2ff] group-hover:text-brand"}`}>
                <Icone nom={ICONE_CATEGORIE[k]} className="h-[18px] w-[18px]" />
              </span>
              <span className={`text-[12px] font-medium flex items-center gap-1 transition-opacity ${actif ? "text-white/70" : "text-brand opacity-0 group-hover:opacity-100"}`}>
                {actif ? <>Vue active <Icone nom="coche" className="h-3.5 w-3.5" /></> : <>Voir <Icone nom="fleche" className="h-3.5 w-3.5" /></>}
              </span>
            </div>
            <p className={`text-[17px] font-semibold mt-4 ${actif ? "text-white" : "text-ink"}`}>{CATEGORIES[k].titre}</p>
            <p className={`text-[13px] mt-0.5 ${actif ? "text-white/65" : "text-muted"}`}>{QUESTION[k]}</p>
            <div className="flex items-baseline gap-2 mt-4">
              <span className={`text-[24px] font-semibold tracking-tight ${actif ? "text-white" : "text-ink"}`}>{s.vide || m.lire(s) === null ? "—" : m.format(m.lire(s)!)}</span>
              <span className={`text-[12.5px] ${actif ? "text-white/60" : "text-muted"}`}>{m.nom.toLowerCase()}</span>
              <span className="ml-auto"><PastilleSur e={ecart(m, p, s)} sombre={actif} /></span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PastilleSur({ e, sombre }: { e: Ecart | null; sombre?: boolean }) {
  if (!sombre) return <Pastille e={e} />;
  if (!e) return <span className="text-[12px] text-white/50">pas comparable</span>;
  return <span className={`text-[12px] font-semibold ${e.bon === null ? "text-white/70" : e.bon ? "text-[#7ee2a8]" : "text-[#ff9d8f]"}`}>{e.sens > 0 ? "▲" : e.sens < 0 ? "▼" : "="} {e.txt}</span>;
}

function SegmentCategorie({ categorie, choisir }: { categorie: Categorie; choisir: (c: Categorie) => void }) {
  const cles = Object.keys(CATEGORIES) as Categorie[];
  const i = cles.indexOf(categorie);
  return (
    <div className="relative grid grid-cols-3 bg-[#efeee9] rounded-full p-1 w-[318px]" role="tablist">
      <span className="absolute top-1 bottom-1 left-1 rounded-full bg-ink shadow transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ width: "calc((100% - 8px) / 3)", transform: `translateX(${i * 100}%)` }} />
      {cles.map((k) => (
        <button key={k} role="tab" aria-selected={k === categorie} onClick={() => choisir(k)}
          className={`relative z-10 h-8 flex items-center justify-center gap-1.5 rounded-full text-[12.5px] font-medium transition-colors duration-300 ${k === categorie ? "text-white" : "text-muted hover:text-ink"}`}>
          <Icone nom={ICONE_CATEGORIE[k]} className="h-3.5 w-3.5" />{CATEGORIES[k].titre}
        </button>
      ))}
    </div>
  );
}

// ─── Bloc 1 — vue d'ensemble ──────────────────────────────────────────────────
// Le TOTAL de ce qui est filtré, une courbe par métrique, et la période d'avant
// en pointillé pour lire l'écart sans calcul. Pas une ligne par campagne : la
// vue générale d'abord, le filtre campagne pour resserrer (retour de David).
function VueEnsemble({ categorie, annonces, noms, de, a, ouvrirJour }: {
  categorie: Categorie; annonces: Annonce[]; noms: Set<string>; de: number; a: number; ouvrirJour: (d: number) => void;
}) {
  const metriques = CATEGORIES[categorie].metriques;
  const n = a - de;
  const jours = [...new Set(CHANGEMENTS.filter((c) => noms.has(c.campagne)).map((c) => c.jour))];
  const s = somme(annonces, de, a), p = somme(annonces, de - n, de);
  const serie = (m: Metrique, depuis: number) => Array.from({ length: n }, (_, i) => {
    const x = somme(annonces, depuis + i, depuis + i + 1);
    return x.vide ? null : m.lire(x);
  });
  const [principale, ...autres] = metriques;
  const Carte = ({ m, grande }: { m: Metrique; grande?: boolean }) => (
    <div className={`bg-white rounded-2xl border border-line p-5 sm:p-6 min-w-0 flex flex-col ${grande ? "lg:col-span-2" : ""}`}
      style={grande ? { gridRow: `span ${autres.length}` } : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted flex items-center gap-1" title={m.aide}>{m.nom}{m.aide && <span className="text-faint cursor-help">ⓘ</span>}</p>
          <Chiffre valeur={s.vide ? null : m.lire(s)} format={m.format} className={`block font-semibold text-ink tracking-tight leading-none mt-2 ${grande ? "text-[44px]" : "text-[28px]"}`} />
          <p className="text-[12px] text-faint mt-2">vs {m.lire(p) === null || p.vide ? "—" : m.format(m.lire(p)!)} la période d&apos;avant</p>
        </div>
        <Pastille e={ecart(m, p, s)} />
      </div>
      <div className={`${grande ? "mt-6" : "mt-4"} mt-auto`}>
        <Courbe cle={`${categorie}-${m.cle}-${de}-${a}-${[...noms].join()}`} metrique={m} de={de} a={a} remplir provisoire={categorie === "conversion"}
          largeur={grande ? 720 : 400} hauteur={grande ? (autres.length === 3 ? 560 : 330) : 130}
          series={[
            { id: "avant", nom: "Période d'avant", couleur: "#c3c2bb", pts: serie(m, de - n), fantome: true },
            { id: "total", nom: noms.size === CAMPAGNES.length ? "Toutes les campagnes" : [...noms].join(", "), couleur: "#1a56ff", pts: serie(m, de) },
          ]}
          changements={grande ? jours : []} onJour={ouvrirJour} />
      </div>
    </div>
  );
  return (
    <section>
      <EnTeteBloc titre="Vue d'ensemble" texte={noms.size === CAMPAGNES.length ? "Le total de toutes tes campagnes, jour par jour." : `Le total de ${[...noms].join(", ")}, jour par jour.`}>
        <div className="flex items-center gap-4 text-[12.5px] text-muted flex-wrap">
          <span className="flex items-center gap-1.5"><span className="h-[2px] w-4 bg-brand rounded-full" /> Cette période</span>
          <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-[#b7b6af]" /> Période d&apos;avant</span>
          <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded-full border-[1.5px] border-ink bg-white flex items-center justify-center"><Icone nom="crayon" className="h-2 w-2" /></span> Un changement, clique pour le voir</span>
        </div>
      </EnTeteBloc>
      <div className="grid lg:grid-cols-3 gap-4">
        <Carte m={principale} grande />
        {autres.map((m) => <Carte key={m.cle} m={m} />)}
      </div>
      {categorie === "conversion" && (
        <p className="text-[12.5px] text-warn mt-3">Zone hachurée : les 28 derniers jours, que Meta peut encore réviser. Ces conversions sont provisoires.</p>
      )}
    </section>
  );
}

function EnTeteBloc({ titre, texte, children }: { titre: string; texte: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-x-6 gap-y-3 flex-wrap mb-5">
      <div>
        <h2 className="text-[22px] font-semibold text-ink tracking-tight">{titre}</h2>
        <p className="text-[14px] text-muted mt-1">{texte}</p>
      </div>
      {children}
    </div>
  );
}

// ─── Bloc 2 — comparaison, en trois variantes ────────────────────────────────
type Element = { id: string; nom: string; sous: string; annonces: Annonce[] };
const MAX_COMPARES = 4;

function useComparaison(categorie: Categorie, campagnes: Campagne[], de: number, a: number) {
  const metriques = CATEGORIES[categorie].metriques;
  const [niveau, setNiveau] = useState<"adsets" | "annonces">("annonces");
  const [m1, setM1] = useState(metriques[0].cle);
  const [m2, setM2] = useState(metriques[1].cle);
  const [choix, setChoix] = useState<string[] | null>(null);
  const adsets = campagnes.flatMap((c) => c.adsets);
  const elements: Element[] = niveau === "adsets"
    ? adsets.map((s) => ({ id: s.id, nom: s.nom, sous: campagneDeAdSet(s).nom, annonces: s.annonces }))
    : adsets.flatMap((s) => s.annonces).map((x) => ({ id: x.id, nom: x.nom, sous: campagneDeAnnonce(x).nom, annonces: [x] }));
  const metrique = metriques.find((m) => m.cle === m1) ?? metriques[0];
  const metrique2 = metriques.find((m) => m.cle === m2) ?? metriques[1];
  const valeur = (e: Element, m = metrique) => { const s = somme(e.annonces, de, a); return s.vide ? null : m.lire(s); };
  const classement = [...elements].sort((u, v) => {
    const x = valeur(u), y = valeur(v);
    if (x === null) return 1; if (y === null) return -1;
    return metrique.hausseBonne ? y - x : x - y;
  });
  const selection = (choix ?? classement.slice(0, 3).map((e) => e.id)).filter((id) => elements.some((e) => e.id === id));
  useEffect(() => { setChoix(null); setM1(metriques[0].cle); setM2(metriques[1].cle); }, [categorie, niveau, campagnes.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const basculer = (id: string) => {
    if (selection.includes(id)) setChoix(selection.filter((x) => x !== id));
    else if (selection.length < MAX_COMPARES) setChoix([...selection, id]);
  };
  const serie = (e: Element, m: Metrique): Serie => ({
    id: e.id, nom: e.nom, couleur: couleurDe(e.id),
    pts: Array.from({ length: a - de }, (_, i) => { const s = somme(e.annonces, de + i, de + i + 1); return s.vide ? null : m.lire(s); }),
  });
  return { metriques, niveau, setNiveau, metrique, setM1, metrique2, setM2, elements, classement, selection, basculer, valeur, serie, choisis: elements.filter((e) => selection.includes(e.id)) };
}

function PuceMetrique({ m, actif, onClick }: { m: Metrique; actif: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`h-8 px-3.5 rounded-full text-[13px] font-medium border transition-all whitespace-nowrap ${actif ? "bg-ink text-white border-ink" : "bg-white text-muted border-line hover:text-ink hover:border-ink/20"}`}>
      {m.nom}
    </button>
  );
}

// Les réglages communs aux deux variantes : le niveau, puis DEUX métriques
// distinctes — la première classe la liste et trace le premier graphe, la
// seconde trace le second. Choisir pour la seconde la métrique de la première
// les échange, pour qu'elles restent distinctes.
function Reglages({ c }: { c: ReturnType<typeof useComparaison> }) {
  const choisir1 = (cle: string) => { if (cle === c.metrique2.cle) c.setM2(c.metrique.cle); c.setM1(cle); };
  const choisir2 = (cle: string) => { if (cle === c.metrique.cle) c.setM1(c.metrique2.cle); c.setM2(cle); };
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="relative grid grid-cols-2 bg-[#efeee9] rounded-full p-1 w-[200px] shrink-0">
        <span className="absolute top-1 bottom-1 left-1 rounded-full bg-white shadow-sm transition-transform duration-300"
          style={{ width: "calc((100% - 8px) / 2)", transform: `translateX(${c.niveau === "adsets" ? 0 : 100}%)` }} />
        {(["adsets", "annonces"] as const).map((k) => (
          <button key={k} onClick={() => c.setNiveau(k)} className={`relative z-10 h-8 rounded-full text-[13px] font-medium ${c.niveau === k ? "text-ink" : "text-muted"}`}>{k === "adsets" ? "Ad sets" : "Annonces"}</button>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] font-semibold text-muted w-[18px] h-[18px] rounded-full bg-[#efeee9] flex items-center justify-center">1</span>
        {c.metriques.map((m) => <PuceMetrique key={m.cle} m={m} actif={c.metrique.cle === m.cle} onClick={() => choisir1(m.cle)} />)}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] font-semibold text-muted w-[18px] h-[18px] rounded-full bg-[#efeee9] flex items-center justify-center">2</span>
        {c.metriques.map((m) => <PuceMetrique key={m.cle} m={m} actif={c.metrique2.cle === m.cle} onClick={() => choisir2(m.cle)} />)}
      </div>
    </div>
  );
}

// La liste classée : tous les éléments, classés sur la métrique 1, avec leur
// barre et la valeur des DEUX métriques. On coche, la courbe apparaît.
function ListeClassee({ c, dense = false }: { c: ReturnType<typeof useComparaison>; dense?: boolean }) {
  const max = Math.max(1e-9, ...c.classement.map((e) => c.valeur(e) ?? 0));
  const entete = (
    <div className="flex items-center gap-3 px-3 pb-2 text-[11.5px] text-faint">
      <span className="w-5" /><span className="w-5">#</span><span className="w-9" /><span className="flex-1">{c.niveau === "adsets" ? "Ad set" : "Annonce"}</span>
      <span className="w-[74px] text-right">{c.metrique.nom}</span>
      <span className="w-[64px] text-right">{c.metrique2.nom}</span>
    </div>
  );
  const ligne = (e: Element) => {
    const k = c.classement.indexOf(e);
    const v = c.valeur(e), v2 = c.valeur(e, c.metrique2);
    const actif = c.selection.includes(e.id), plein = !actif && c.selection.length >= MAX_COMPARES;
    return (
      <button key={e.id} onClick={() => c.basculer(e.id)} disabled={plein}
        className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${actif ? "bg-[#f6f7ff]" : "hover:bg-canvas"} ${plein ? "opacity-50 cursor-not-allowed" : ""}`}>
        <span className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${actif ? "border-transparent text-white" : "border-[#cfcec8] text-transparent"}`} style={{ background: actif ? couleurDe(e.id) : "transparent" }}>
          <Icone nom="coche" className="h-3.5 w-3.5" />
        </span>
        <span className="text-[12px] text-faint w-5 tabular-nums">{k + 1}</span>
        <Crea a={e.annonces[0]} className="h-9 w-9 shrink-0" mini />
        <span className="flex-1 min-w-0">
          <span className="block text-[13.5px] text-ink truncate">{e.nom}</span>
          <span className="block h-1.5 mt-1.5 rounded-full bg-[#efeee9] overflow-hidden">
            <span className="block h-full rounded-full transition-all duration-500" style={{ width: `${((v ?? 0) / max) * 100}%`, background: actif ? couleurDe(e.id) : "#b8b7b0" }} />
          </span>
        </span>
        <span className="text-[14px] font-semibold text-ink tabular-nums w-[74px] text-right">{v === null ? "—" : c.metrique.format(v)}</span>
        <span className="text-[13px] text-muted tabular-nums w-[64px] text-right">{v2 === null ? "—" : c.metrique2.format(v2)}</span>
      </button>
    );
  };
  // Sur deux colonnes, le classement se lit de haut en bas, colonne après
  // colonne : 1 à 4 à gauche, 5 à 8 à droite — pas en zigzag.
  const moitie = Math.ceil(c.classement.length / 2);
  const colonnes = dense ? [c.classement.slice(0, moitie), c.classement.slice(moitie)] : [c.classement];
  return (
    <div>
      <div className={dense ? "grid md:grid-cols-2 gap-x-4" : ""}>
        {colonnes.map((col, i) => (
          <div key={i} className="min-w-0">
            <div className={i > 0 ? "hidden md:block" : ""}>{entete}</div>
            {col.map(ligne)}
          </div>
        ))}
      </div>
      <p className="text-[11.5px] text-faint px-3 pt-2">Coche jusqu&apos;à {MAX_COMPARES} éléments. Classés sur « {c.metrique.nom} ».</p>
    </div>
  );
}

function DeuxGraphes({ c, de, a, categorie, cote }: { c: ReturnType<typeof useComparaison>; de: number; a: number; categorie: Categorie; cote: boolean }) {
  if (c.choisis.length === 0) return <p className="text-[14px] text-muted py-24 text-center">Coche un élément dans la liste.</p>;
  return (
    <div className={`grid gap-6 ${cote ? "lg:grid-cols-2" : ""}`}>
      {[c.metrique, c.metrique2].map((m, k) => (
        <div key={`${k}-${m.cle}`} className="min-w-0">
          <p className="text-[14px] font-semibold text-ink mb-2 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-muted w-[18px] h-[18px] rounded-full bg-[#efeee9] flex items-center justify-center">{k + 1}</span>
            {m.nom}, jour par jour
          </p>
          <Courbe cle={`${k}-${m.cle}-${c.selection.join()}-${de}-${a}`} metrique={m} de={de} a={a} series={c.choisis.map((e) => c.serie(e, m))}
            etiquettes largeur={cote ? 560 : 640} hauteur={cote ? 280 : 210} provisoire={categorie === "conversion"} />
        </div>
      ))}
    </div>
  );
}

// C1 — la liste à gauche, les deux graphes empilés à droite.
function ComparaisonC1({ c, de, a, categorie }: { c: ReturnType<typeof useComparaison>; de: number; a: number; categorie: Categorie }) {
  return (
    <div className="bg-white rounded-2xl border border-line overflow-hidden">
      <div className="p-5 border-b border-line"><Reglages c={c} /></div>
      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="p-3 lg:border-r border-line"><ListeClassee c={c} /></div>
        <div className="p-5 min-w-0"><DeuxGraphes c={c} de={de} a={a} categorie={categorie} cote={false} /></div>
      </div>
    </div>
  );
}

// C2 — la liste en haut, sur deux colonnes ; les deux graphes côte à côte
// dessous, en pleine largeur.
function ComparaisonC2({ c, de, a, categorie }: { c: ReturnType<typeof useComparaison>; de: number; a: number; categorie: Categorie }) {
  return (
    <div className="bg-white rounded-2xl border border-line overflow-hidden">
      <div className="p-5 border-b border-line"><Reglages c={c} /></div>
      <div className="p-3 border-b border-line"><ListeClassee c={c} dense /></div>
      <div className="p-5"><DeuxGraphes c={c} de={de} a={a} categorie={categorie} cote /></div>
    </div>
  );
}

const VARIANTES_COMPARAISON = [
  { cle: "C1", nom: "Graphes à droite", C: ComparaisonC1 },
  { cle: "C2", nom: "Graphes en dessous", C: ComparaisonC2 },
] as const;

function Comparaison({ categorie, campagnes, de, a, variante, choisirVariante, lecture, ouvrir }: {
  categorie: Categorie; campagnes: Campagne[]; de: number; a: number; variante: string; choisirVariante: (v: string) => void;
  lecture: Lecture; ouvrir: (id: string) => void;
}) {
  const c = useComparaison(categorie, campagnes, de, a);
  const V = VARIANTES_COMPARAISON.find((v) => v.cle === variante) ?? VARIANTES_COMPARAISON[0];
  return (
    <section>
      <EnTeteBloc titre="Comparaison" texte="Une métrique, plusieurs ad sets ou annonces côte à côte.">
        <div className="flex items-center gap-1 rounded-full border border-dashed border-warn/50 bg-[#fff8ec] p-1" title="Prototype : trois façons de faire ce bloc">
          <span className="text-[11.5px] text-warn font-medium px-2">Variante</span>
          {VARIANTES_COMPARAISON.map((v) => (
            <button key={v.cle} onClick={() => choisirVariante(v.cle)}
              className={`h-7 px-3 rounded-full text-[12.5px] font-medium transition-colors ${v.cle === V.cle ? "bg-warn text-white" : "text-warn hover:bg-warn/10"}`}>
              {v.cle} · {v.nom}
            </button>
          ))}
        </div>
      </EnTeteBloc>
      <V.C c={c} de={de} a={a} categorie={categorie} />
      <CreasComparees c={c} lecture={lecture} ouvrir={ouvrir} />
    </section>
  );
}

// ─── Bloc 3 — tableau hiérarchique ────────────────────────────────────────────
function Tableau({ categorie, campagnes, de, a, lecture, ouvrir }: {
  categorie: Categorie; campagnes: Campagne[]; de: number; a: number; lecture: Lecture; ouvrir: (id: string) => void;
}) {
  const metriques = CATEGORIES[categorie].metriques;
  const n = a - de;
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const basculer = (k: string) => setOuverts((o) => { const s = new Set(o); s.has(k) ? s.delete(k) : s.add(k); return s; });
  // Au rang de l'annonce, seule la lecture T déplie un quatrième rang. En P,
  // la ligne ouvre le panneau ; en S, le tableau s'arrête à l'annonce.
  const ligne = (cle: string, niveau: number, nom: React.ReactNode, annonces: Annonce[]) => {
    const s = somme(annonces, de, a), p = somme(annonces, de - n, de);
    const ouvert = ouverts.has(cle);
    const feuille = niveau === 2 && lecture !== "T";
    const clic = niveau === 2 && lecture === "P" ? () => ouvrir(cle) : feuille ? undefined : () => basculer(cle);
    return (
      <tr key={cle} onClick={clic} className={`group border-t border-line transition-colors ${clic ? "cursor-pointer hover:bg-[#f6f7ff]" : ""} ${ouvert ? "bg-[#fafaf8]" : "bg-white"}`}>
        <td className="py-3.5 pr-4" style={{ paddingLeft: 20 + niveau * 28 }}>
          <span className="flex items-center gap-3 min-w-0">
            {feuille ? <span className="h-6 w-6 shrink-0" /> : <span className={`h-6 w-6 shrink-0 rounded-md flex items-center justify-center text-muted transition-all group-hover:bg-white ${ouvert ? "" : "-rotate-90"}`}><Icone nom="chevron" className="h-3.5 w-3.5" /></span>}
            {nom}
            {niveau === 2 && lecture === "P" && <span className="ml-1 text-[12.5px] text-brand opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">Lire <Icone nom="fleche" className="h-3.5 w-3.5" /></span>}
          </span>
        </td>
        {metriques.map((m, i) => (
          <td key={m.cle} className="py-3.5 px-4 text-right whitespace-nowrap">
            <span className={`tabular-nums ${i === 0 ? "text-[15px] font-semibold text-ink" : "text-[14px] text-ink/75"}`}>{s.vide || m.lire(s) === null ? "—" : m.format(m.lire(s)!)}</span>
          </td>
        ))}
        <td className="py-3.5 pl-2 pr-5 text-right"><Pastille e={ecart(metriques[0], p, s)} /></td>
      </tr>
    );
  };
  const assets = (x: Annonce) => {
    const lignes: { type: string; contenu: React.ReactNode }[] = [
      ...x.visuels.map((v, i) => ({ type: x.format === "video" ? "Vidéo" : x.visuels.length > 1 ? `Image ${i + 1}` : "Image", contenu: <span className="flex items-center gap-3"><Crea a={x} className="h-11 w-11 shrink-0" mini /><span className="text-ink">{v}</span></span> })),
      ...x.textes.map((t, i) => ({ type: x.textes.length > 1 ? `Texte principal ${i + 1}` : "Texte principal", contenu: <span className="text-ink leading-relaxed">{t}</span> })),
      ...x.titres.map((t, i) => ({ type: x.titres.length > 1 ? `Titre ${i + 1}` : "Titre", contenu: <span className="text-ink font-medium">{t}</span> })),
      ...x.descriptions.map((t) => ({ type: "Description", contenu: <span className="text-ink">{t}</span> })),
    ];
    return (
      <tr key={x.id + "-assets"} className="border-t border-line bg-[#fafaf8]">
        <td colSpan={metriques.length + 2} className="py-4 pr-5" style={{ paddingLeft: 20 + 3 * 28 }}>
          <div className="rounded-xl bg-white border border-line p-4 max-w-[780px]">
            <div className="grid gap-3">
              {lignes.map((l, i) => (
                <div key={i} className="grid grid-cols-[130px_1fr] gap-4 items-center text-[14px]">
                  <span className="text-[12px] text-muted">{l.type}</span>{l.contenu}
                </div>
              ))}
            </div>
            <p className="text-[12px] text-faint mt-4 pt-3 border-t border-line">Meta ne donne pas de chiffres par asset pour une annonce à créa unique : on montre ce qui a été publié, pas une mesure qu&apos;on n&apos;a pas.</p>
          </div>
        </td>
      </tr>
    );
  };
  return (
    <section>
      <EnTeteBloc titre="Tableau détaillé" texte={lecture === "T" ? "De la campagne jusqu'à l'asset. Les colonnes suivent la vue choisie." : "De la campagne jusqu'à l'annonce. Les colonnes suivent la vue choisie."} />
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[780px]">
          <thead>
            <tr className="text-[12px] text-muted text-right">
              <th className="text-left font-medium py-3.5 pl-5">{lecture === "T" ? "Campagne › ad set › annonce › asset" : "Campagne › ad set › annonce"}</th>
              {metriques.map((m) => <th key={m.cle} className="font-medium py-3.5 px-4" title={m.aide}>{m.nom}</th>)}
              <th className="font-medium py-3.5 pl-2 pr-5">{metriques[0].nom} vs avant</th>
            </tr>
          </thead>
          <tbody>
            {campagnes.flatMap((c) => [
              ligne(c.nom, 0, <span className="flex items-center gap-2.5 text-[15px] font-semibold text-ink"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.couleur }} />{c.nom}</span>, annoncesDe(c)),
              ...(ouverts.has(c.nom) ? c.adsets.flatMap((s) => [
                ligne(s.id, 1, <span className="text-[14px] text-ink">{s.nom}</span>, s.annonces),
                ...(ouverts.has(s.id) ? s.annonces.flatMap((x) => [
                  ligne(x.id, 2, <span className="flex items-center gap-3 text-[14px] text-ink min-w-0"><Crea a={x} className="h-9 w-9 shrink-0" mini /><span className="truncate">{x.nom}</span></span>, [x]),
                  ...(lecture === "T" && ouverts.has(x.id) ? [assets(x)] : []),
                ]) : []),
              ]) : []),
            ])}
          </tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-muted mt-2">« — » : Meta n&apos;a rien rendu, ce n&apos;est pas un zéro.</p>
    </section>
  );
}

// ─── La page ──────────────────────────────────────────────────────────────────
export function Prototype() {
  const params = useSearchParams();
  const router = useRouter();
  const chemin_ = usePathname();
  const categorie = (["notoriete", "trafic", "conversion"].includes(params.get("categorie") ?? "") ? params.get("categorie") : "notoriete") as Categorie;
  const filtre = params.get("campagne");
  const de = Math.max(0, Math.min(JOURS - 1, Number(params.get("de") ?? JOURS - 28)));
  const a = Math.max(de + 1, Math.min(JOURS, Number(params.get("a") ?? JOURS)));
  const variante = params.get("comparaison") ?? "C1";
  const lecture = (["T", "P", "S"].includes(params.get("lecture") ?? "") ? params.get("lecture") : "T") as Lecture;
  const campagnes = filtre ? CAMPAGNES.filter((c) => c.nom === filtre) : CAMPAGNES;
  const annonces = campagnes.flatMap(annoncesDe);
  const noms = new Set(campagnes.map((c) => c.nom));

  // Un lien énumère ce qu'il CHANGE, jamais ce qu'il garde (`CLAUDE.md` §8).
  const changer = (modifs: Record<string, string | null>) => {
    const n = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(modifs)) (v === null ? n.delete(k) : n.set(k, v));
    router.replace(`${chemin_}?${n.toString()}`, { scroll: false });
  };

  // La barre suit au défilement : dès que les cartes de catégorie sortent de
  // l'écran, elle se détache en pilule flottante et le sélecteur compact y
  // glisse.
  const sentinelle = useRef<HTMLDivElement>(null);
  const [detachee, setDetachee] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => setDetachee(!e.isIntersecting), { rootMargin: "-72px 0px 0px 0px" });
    if (sentinelle.current) o.observe(sentinelle.current);
    return () => o.disconnect();
  }, []);

  // Un seul panneau pour deux usages : le jour d'un changement, ou une annonce
  // à lire. Ouvrir l'un ferme l'autre.
  const [jour, setJourBrut] = useState<number | null>(null);
  const [lue, setLue] = useState<string | null>(null);
  const setJour = (j: number | null) => { setLue(null); setJourBrut(j); };
  const ouvrir = (id: string) => { setJourBrut(null); setLue(id); };
  const fermer = useMemo(() => () => { setJourBrut(null); setLue(null); }, []);
  const annonceLue = lue === null ? null : ANNONCES.find((x) => x.id === lue) ?? null;
  const duJour = jour === null ? [] : CHANGEMENTS.filter((c) => c.jour === jour && noms.has(c.campagne));

  return (
    <main className="min-h-screen bg-[#f7f6f3] pb-24">
      <style>{`
        @keyframes tracer { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
        @keyframes apparait { from { opacity: 0; } to { opacity: 1; } }
        .trace { stroke-dasharray: 1; stroke-dashoffset: 0; animation: tracer 900ms cubic-bezier(.2,.8,.2,1) both; }
        .apparait { animation: apparait 600ms 300ms ease-out both; }
        @media (prefers-reduced-motion: reduce) { .trace, .apparait { animation: none; } }
      `}</style>
      <svg width="0" height="0" className="absolute">
        <defs>
          <pattern id="hachures" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#e6c79a" strokeWidth="2" />
          </pattern>
        </defs>
      </svg>

      {/* La barre collante */}
      <div className="sticky top-0 z-30 pointer-events-none">
        <div className={`max-w-[1280px] mx-auto px-4 sm:px-8 transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${detachee ? "pt-3" : "pt-0"}`}>
          <div className={`pointer-events-auto flex items-center gap-3 flex-nowrap transition-all duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${detachee
            ? "rounded-full bg-white/80 backdrop-blur-xl border border-white shadow-[0_12px_40px_-12px_rgba(14,15,18,0.28)] pl-3 pr-2 py-2"
            : "rounded-none bg-[#f7f6f3] border border-transparent py-5"}`}>
            <div className="flex items-center gap-3 mr-auto min-w-0">
              <span className={`rounded-xl bg-gradient-to-br from-[#2f6bff] to-[#1543d8] text-white flex items-center justify-center font-semibold shrink-0 shadow-sm transition-all duration-500 ${detachee ? "h-8 w-8 text-[13px] rounded-full" : "h-11 w-11 text-[18px]"}`}>M</span>
              <div className="min-w-0">
                <p className={`font-semibold text-ink leading-tight transition-all duration-500 ${detachee ? "text-[15px]" : "text-[24px] tracking-tight"}`}>Meta Ads</p>
                <p className={`text-[12.5px] text-muted transition-all duration-300 overflow-hidden ${detachee ? "max-h-0 opacity-0" : "max-h-6 opacity-100"}`}>Données jusqu&apos;au dimanche 27 sept., dernier jour complet</p>
              </div>
            </div>
            <div className={`shrink-0 transition-all duration-500 overflow-hidden ${detachee ? "max-w-[330px] opacity-100" : "max-w-0 opacity-0"}`}>
              <SegmentCategorie categorie={categorie} choisir={(k) => changer({ categorie: k })} />
            </div>
            <ChoixCampagne valeur={filtre} compact={detachee} onChange={(v) => changer({ campagne: v })} />
            <ChoixPeriode de={de} a={a} compact={detachee} onChange={(x, y) => changer({ de: String(x), a: String(y) })} />
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-8">
        <div ref={sentinelle}>
          <CartesCategorie categorie={categorie} choisir={(k) => changer({ categorie: k })} annonces={annonces} de={de} a={a} />
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap mt-3">
          <p className="text-[12px] text-warn">Prototype, les chiffres sont inventés.</p>
          <div className="flex items-center gap-1 rounded-full border border-dashed border-warn/50 bg-[#fff8ec] p-1" title="Prototype : où lire le texte d'une annonce">
            <span className="text-[11.5px] text-warn font-medium px-2">Lire une annonce</span>
            {LECTURES.map((l) => (
              <button key={l.cle} onClick={() => changer({ lecture: l.cle })}
                className={`h-7 px-3 rounded-full text-[12.5px] font-medium transition-colors ${l.cle === lecture ? "bg-warn text-white" : "text-warn hover:bg-warn/10"}`}>
                {l.cle} · {l.nom}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-16 mt-10">
          <VueEnsemble categorie={categorie} annonces={annonces} noms={noms} de={de} a={a} ouvrirJour={setJour} />
          <Comparaison categorie={categorie} campagnes={campagnes} de={de} a={a} variante={variante} choisirVariante={(v) => changer({ comparaison: v })} lecture={lecture} ouvrir={ouvrir} />
          <Tableau categorie={categorie} campagnes={campagnes} de={de} a={a} lecture={lecture} ouvrir={ouvrir} />
        </div>
      </div>

      <Panneau ouvert={jour !== null || annonceLue !== null} fermer={fermer}
        titre={annonceLue ? annonceLue.nom : jour === null ? "" : long(jour)}
        sousTitre={annonceLue
          ? `${campagneDeAnnonce(annonceLue).nom} › ${ADSETS.find((s) => s.annonces.includes(annonceLue))!.nom}`
          : `${duJour.length} changement${duJour.length > 1 ? "s" : ""}${filtre ? ` sur ${filtre}` : " sur toutes les campagnes"}`}>
        {annonceLue ? <ContenuAnnonce x={annonceLue} /> : <>
        <ol className="relative border-l border-line ml-1.5 space-y-6 mt-2">
          {duJour.map((c, i) => (
            <li key={i} className="pl-6 relative">
              <span className="absolute -left-[7px] top-1 h-3.5 w-3.5 rounded-full ring-4 ring-white" style={{ background: CAMPAGNES.find((k) => k.nom === c.campagne)!.couleur }} />
              <span className="inline-block text-[11.5px] font-semibold text-brand bg-[#eef2ff] rounded-full px-2 py-0.5">{c.nature}</span>
              <p className="text-[16px] text-ink font-medium mt-1.5">{c.detail}</p>
              <p className="text-[13px] text-muted mt-0.5">{c.objet} · {c.campagne}</p>
            </li>
          ))}
        </ol>
        <p className="text-[12.5px] text-faint mt-8 pt-4 border-t border-line leading-relaxed">
          Ce que Meta déclare. Un changement qu&apos;il ne rapporte pas n&apos;apparaît pas ici : l&apos;absence de point ne prouve pas que rien n&apos;a bougé.
        </p>
        </>}
      </Panneau>
    </main>
  );
}
