"use client";

import { useEffect, useRef } from "react";
import type { Frise } from "@/lib/report";
import { teinteLabel } from "@/lib/palette";

// « Ce qui tournait » — le temps, enfin visible.
//
// Le reste du rapport dit ce que la semaine a DONNÉ. Rien ne disait ce qui
// était en l'air pour l'obtenir. Or c'est ce qui rend les chiffres lisibles :
// une campagne lancée le mercredi n'a eu que la moitié de la semaine, et on lui
// compare pourtant des chiffres de semaine pleine ; un creux de portée suivi de
// dix jours sans publication n'est pas un problème d'algorithme.
//
// UN AN, pas un trimestre : la durée médiane de diffusion est de 82 jours, et
// la saisonnalité — printemps, été, fêtes — ne se lit pas sur trois mois.
//
// UN SEUL CADRE DE DÉFILEMENT, et c'est important. La version précédente en
// avait deux imbriqués : le cadre horizontal, et la liste des campagnes en
// `overflow-y`. Or CSS convertit en `auto` l'axe laissé à `visible` dès que
// l'autre ne l'est pas — la liste se dotait donc de SON propre défilement
// horizontal, et les barres se désalignaient de l'axe des dates. Ici un seul
// conteneur défile dans les deux sens ; l'en-tête reste collé en haut.

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

function jours(debut: string, fin: string): string[] {
  const out: string[] = [];
  const d = new Date(debut + "T00:00:00Z");
  const f = new Date(fin + "T00:00:00Z");
  while (d <= f) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function libelle(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}
function mois(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${MOIS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}

const CANAL: Record<string, string> = { meta: "▣", google: "◆" };

export function FriseSemaine({ f, univers }: { f: Frise; univers: string[] }) {
  const cadre = useRef<HTMLDivElement>(null);
  const grille = jours(f.debut, f.fin);
  const n = grille.length;

  // Sur un an, 11 px par jour ferait 4 000 px : on resserre. Une campagne d'un
  // mois garde 210 px, largement de quoi lire sa durée.
  const PX = n > 200 ? 7 : 11;
  const largeur = n * PX;

  // Un an de frise ouvert sur janvier ne sert à rien : on arrive sur
  // aujourd'hui, et on remonte le temps si on veut.
  useEffect(() => {
    if (cadre.current) cadre.current.scrollLeft = cadre.current.scrollWidth;
  }, [largeur]);

  if (n < 7) return null;

  const idx = (iso: string) => grille.indexOf(iso);
  const x = (i: number) => i * PX;
  const couleur = (theme: string | null) => (theme ? teinteLabel(theme, univers) : null);
  const debutSemaine = Math.max(0, idx(f.semaine_debut));

  // Jusqu'où chaque source est réellement à jour. Au-delà, on ne sait rien —
  // et une barre qui s'arrête là ne veut pas dire que la campagne s'est arrêtée.
  const limite = (canal: string): number => {
    const c = f.couverture?.[canal as "meta" | "google" | "instagram"] ?? null;
    if (!c) return n - 1;
    const i = idx(c);
    return i >= 0 ? i : n - 1;
  };
  const retards = (["meta", "google"] as const)
    .map((c) => ({ canal: c, jusqua: f.couverture?.[c] ?? null }))
    .filter((v) => v.jusqua && v.jusqua < f.fin);

  const bornes = grille.map((j, i) => ({ i, j })).filter((v) => v.j.slice(8) === "01");

  const postsParJour = new Map<string, typeof f.posts>();
  for (const p of f.posts) {
    const l = postsParJour.get(p.date) ?? [];
    l.push(p);
    postsParJour.set(p.date, l);
  }

  // Le fond commun à toutes les bandes : les débuts de mois et la semaine
  // en cours. Posé dans chaque bande pour rester aligné au défilement.
  const Fond = () => (
    <>
      {bornes.map((b) => (
        <div key={b.j} className="absolute inset-y-0 border-l border-line" style={{ left: x(b.i) }} />
      ))}
      <div
        className="absolute inset-y-0 bg-brand/[0.06] border-x border-brand/25 pointer-events-none"
        style={{ left: x(debutSemaine), width: largeur - x(debutSemaine) }}
      />
    </>
  );

  return (
    <div className="bg-white border border-line rounded-xl shadow-card overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 flex-wrap px-4 sm:px-5 pt-4 pb-2">
        <div className="text-[10px] uppercase tracking-widest text-faint font-bold">
          Ce qui tournait <span className="text-ink">· 12 mois</span>
        </div>
        <div className="text-[10.5px] text-faint">
          {f.campagnes.length} campagne{f.campagnes.length > 1 ? "s" : ""} ·{" "}
          {f.posts.length} publication{f.posts.length > 1 ? "s" : ""} · glisse ← →
        </div>
      </div>

      {/* Un seul cadre, deux axes. Tout ce qui est dedans partage la même
          largeur, donc la même échelle de temps. */}
      <div ref={cadre} className="overflow-auto max-h-[62vh] overscroll-x-contain">
        <div style={{ width: largeur }}>
          {/* L'échelle, collée en haut pendant qu'on parcourt les campagnes */}
          <div className="sticky top-0 z-10 bg-white border-b border-line">
            <div className="relative h-[26px]">
              {bornes.map((b) => (
                <span key={b.j} className="absolute inset-y-0 border-l border-line" style={{ left: x(b.i) }} />
              ))}
              <div
                className="absolute inset-y-0 bg-brand/[0.07] border-x border-brand/25"
                style={{ left: x(debutSemaine), width: largeur - x(debutSemaine) }}
              />
              {bornes.map((b) => (
                <span
                  key={`t-${b.j}`}
                  className="absolute top-[7px] text-[9.5px] font-mono text-faint pl-1 whitespace-nowrap"
                  style={{ left: x(b.i) }}
                >
                  {mois(b.j)}
                </span>
              ))}
              <span
                className="absolute top-[7px] text-[9.5px] font-bold text-brand uppercase tracking-wide pr-1.5 whitespace-nowrap -translate-x-full"
                style={{ left: x(debutSemaine) }}
              >
                cette sem. →
              </span>
            </div>
          </div>

          {/* Les campagnes — une barre chacune, du premier au dernier jour où
              elle a réellement dépensé. Triées par dépense. */}
          <div className="relative pt-1">
            <Fond />
            {f.campagnes.map((c) => {
              const a = Math.max(0, idx(c.debut));
              const b = Math.min(n - 1, idx(c.fin));
              const t = couleur(c.theme);
              const lim = limite(c.canal);
              const coupe = b >= lim && lim < n - 1;
              return (
                <div key={`${c.canal}-${c.nom}`} className="relative h-[24px]">
                  <div
                    className="absolute inset-y-[4px] rounded-full"
                    style={{
                      left: x(a),
                      width: Math.max(5, (b - a + 1) * PX),
                      background: t?.aplat ?? "rgba(0,0,0,0.06)",
                      border: `1px solid ${t?.trait ?? "#d8d8de"}`,
                      maskImage: coupe ? "linear-gradient(90deg,#000 90%,transparent)" : undefined,
                      WebkitMaskImage: coupe
                        ? "linear-gradient(90deg,#000 90%,transparent)"
                        : undefined,
                    }}
                    title={`${c.nom} · ${libelle(c.debut)} → ${libelle(c.fin)} · ${c.jours} jour${
                      c.jours > 1 ? "s" : ""
                    } de diffusion · ${Math.round(c.depense)} CHF${
                      c.continu ? "" : " · diffusion interrompue puis reprise"
                    }`}
                  />
                  <span
                    className="absolute inset-y-0 flex items-center text-[10.5px] text-ink/80 whitespace-nowrap pl-2 pointer-events-none"
                    style={{ left: x(a) }}
                  >
                    <span className="text-faint mr-1">{CANAL[c.canal] ?? "·"}</span>
                    {c.nom}
                    {!c.continu && (
                      <span className="text-warn ml-1.5" title="diffusion interrompue">
                        ⌇
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Les publications, même échelle : c'est le rapprochement qui compte
              — un pic qui suit un post ou le lancement d'une campagne. */}
          <div className="sticky bottom-0 z-10 bg-white border-t border-line pt-1.5">
            <div className="relative h-7">
              <Fond />
              <div className="absolute inset-x-0 top-1/2 border-t border-line" />
              <span
                className="sticky left-2 z-20 float-left text-[9.5px] uppercase tracking-wide text-faint font-semibold bg-white/90 px-1 rounded"
                style={{ lineHeight: "28px" }}
              >
                publications
              </span>
              {[...postsParJour.entries()].map(([jour, liste]) => {
                const i = idx(jour);
                if (i < 0) return null;
                const t = couleur(liste[0].theme);
                return (
                  <span
                    key={jour}
                    className="absolute top-1/2 -translate-y-1/2 rounded-full border-2"
                    style={{
                      left: x(i) + PX / 2 - 4,
                      height: 8,
                      width: 8,
                      background: t?.aplat ?? "rgba(0,0,0,0.06)",
                      borderColor: t?.trait ?? "#8a8a94",
                    }}
                    title={`${libelle(jour)} · ${liste
                      .map((p) => p.theme ?? "sans thème")
                      .join(", ")}${liste.length > 1 ? ` (${liste.length} posts)` : ""}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-5 pt-2 pb-2.5 text-[10px] text-faint">
        Une barre = une campagne, du premier au dernier jour où elle a réellement dépensé.
        Un point = une publication. <span className="text-warn">⌇</span> diffusion
        interrompue puis reprise. La frise s&apos;ouvre sur aujourd&apos;hui — glisse vers
        la gauche pour remonter l&apos;année.
      </div>

      {retards.length > 0 && (
        <p className="text-[10.5px] text-warn leading-relaxed px-4 sm:px-5 py-2.5 border-t border-line bg-warn/[0.04]">
          {retards
            .map(
              (r) =>
                `${r.canal === "meta" ? "Meta" : "Google Ads"} : pas de données après le ${libelle(
                  r.jusqua!
                )}`
            )
            .join(" · ")}
          . Les barres s&apos;arrêtent là, pas forcément les campagnes — c&apos;est la
          récolte qui n&apos;est pas allée plus loin.
        </p>
      )}
    </div>
  );
}
