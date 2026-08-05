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
// Un trimestre, pas un mois : les campagnes durent presque toujours plus que
// quatre semaines, et une barre qui touche les deux bords ne dit plus rien de
// sa durée. On donne donc au temps une largeur fixe (≈ 11 px par jour) et on le
// fait DÉFILER horizontalement plutôt que de le comprimer — comprimer, c'est
// perdre l'information qu'on est venu chercher. La liste des campagnes défile
// verticalement de son côté.
//
// Les couleurs viennent du label lui-même : un thème garde sa teinte d'un
// module à l'autre et d'une semaine à l'autre.

const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];
const PX_JOUR = 11; // largeur d'une journée — c'est elle qui fixe la largeur totale

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

const CANAL: Record<string, string> = { meta: "▣", google: "◆" };

export function FriseSemaine({ f, univers }: { f: Frise; univers: string[] }) {
  const grille = jours(f.debut, f.fin);
  const n = grille.length;
  if (n < 7) return null;

  const largeur = n * PX_JOUR;
  const idx = (iso: string) => grille.indexOf(iso);
  const x = (i: number) => i * PX_JOUR;
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

  // Les débuts de mois : sur un trimestre, ce sont eux qui donnent le repère.
  const bornes = grille
    .map((j, i) => ({ i, j }))
    .filter((v) => v.j.slice(8) === "01" && v.i > 0);

  const postsParJour = new Map<string, typeof f.posts>();
  for (const p of f.posts) {
    const l = postsParJour.get(p.date) ?? [];
    l.push(p);
    postsParJour.set(p.date, l);
  }

  // Le fond commun à toutes les lignes : les débuts de mois et la bande de la
  // semaine en cours. Répété plutôt que posé une fois, parce que la liste des
  // campagnes défile verticalement dans son propre cadre.
  const Fond = () => (
    <>
      {bornes.map((b) => (
        <div
          key={b.j}
          className="absolute inset-y-0 border-l border-line"
          style={{ left: x(b.i) }}
        />
      ))}
      <div
        className="absolute inset-y-0 bg-brand/[0.05] border-x border-brand/20 pointer-events-none"
        style={{ left: x(debutSemaine), width: largeur - x(debutSemaine) }}
      />
    </>
  );

  return (
    <div className="bg-white border border-line rounded-xl shadow-card overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 flex-wrap px-4 sm:px-5 pt-4 pb-2">
        <div className="text-[10px] uppercase tracking-widest text-faint font-bold">
          Ce qui tournait <span className="text-ink">· 3 mois</span>
        </div>
        <div className="text-[10.5px] text-faint">
          {f.campagnes.length} campagne{f.campagnes.length > 1 ? "s" : ""} ·{" "}
          {f.posts.length} publication{f.posts.length > 1 ? "s" : ""} · défile ↔
        </div>
      </div>

      {/* Un seul cadre qui défile latéralement : la bande de semaine, les
          barres, les publications et les dates restent alignées entre elles. */}
      <div className="overflow-x-auto">
        <div style={{ width: largeur, minWidth: largeur }} className="px-0">
          {/* L'étiquette de la semaine en cours */}
          <div className="relative h-4">
            <div
              className="absolute inset-y-0 rounded-t-md bg-brand/[0.07] border-x border-t border-brand/20"
              style={{ left: x(debutSemaine), width: largeur - x(debutSemaine) }}
            />
            <div
              className="absolute top-0 text-[9.5px] font-bold text-brand uppercase tracking-wide pl-1.5 whitespace-nowrap"
              style={{ left: x(debutSemaine) }}
            >
              cette semaine
            </div>
          </div>

          {/* Les campagnes — une barre chacune, du premier au dernier jour où
              elle a réellement dépensé. Triées par dépense. */}
          <div className="max-h-[38vh] overflow-y-auto">
            <div className="relative" style={{ width: largeur }}>
              <Fond />
              {f.campagnes.map((c) => {
                const a = Math.max(0, idx(c.debut));
                const b = Math.min(n - 1, idx(c.fin));
                const t = couleur(c.theme);
                const lim = limite(c.canal);
                const coupe = b >= lim && lim < n - 1;
                return (
                  <div key={`${c.canal}-${c.nom}`} className="relative h-[26px]">
                    <div
                      className="absolute inset-y-[5px] rounded-full"
                      style={{
                        left: x(a),
                        width: Math.max(6, (b - a + 1) * PX_JOUR),
                        background: t?.aplat ?? "rgba(0,0,0,0.06)",
                        border: `1px solid ${t?.trait ?? "#d8d8de"}`,
                        // Coupée par le bord des données : on l'estompe plutôt
                        // que de lui donner une fin nette qu'on ne mesure pas.
                        maskImage: coupe
                          ? "linear-gradient(90deg,#000 88%,transparent)"
                          : undefined,
                        WebkitMaskImage: coupe
                          ? "linear-gradient(90deg,#000 88%,transparent)"
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
          </div>

          {/* Les publications, sur la même échelle : c'est le rapprochement qui
              compte — un pic qui suit un post ou le lancement d'une campagne. */}
          <div className="relative mt-2 pt-3 border-t border-line" style={{ width: largeur }}>
            <div className="relative h-7">
              <Fond />
              <div className="absolute inset-x-0 top-1/2 border-t border-line" />
              {[...postsParJour.entries()].map(([jour, liste]) => {
                const i = idx(jour);
                if (i < 0) return null;
                const t = couleur(liste[0].theme);
                return (
                  <span
                    key={jour}
                    className="absolute top-1/2 -translate-y-1/2 rounded-full border-2"
                    style={{
                      left: x(i) + PX_JOUR / 2 - 5,
                      height: 10,
                      width: 10,
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

          {/* L'échelle : un repère au début de chaque mois */}
          <div className="relative h-5" style={{ width: largeur }}>
            <span className="absolute top-0 text-[9.5px] font-mono text-faint pl-0.5">
              {libelle(f.debut)}
            </span>
            {bornes.map((b) => (
              <span
                key={b.j}
                className="absolute top-0 text-[9.5px] font-mono text-faint pl-1"
                style={{ left: x(b.i) }}
              >
                {libelle(b.j)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-5 pt-1 pb-2.5 text-[10px] text-faint">
        Une barre = une campagne, du premier au dernier jour où elle a réellement dépensé.
        Un point = une publication. <span className="text-warn">⌇</span> diffusion
        interrompue puis reprise.
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
