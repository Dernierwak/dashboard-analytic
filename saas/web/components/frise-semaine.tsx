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
// Quatre semaines plutôt qu'une : sur sept colonnes une barre ne raconte rien,
// et ce qu'on cherche ici est le rythme et les trous. La semaine du rapport est
// marquée à part pour qu'on la retrouve d'un coup d'œil.
//
// Les couleurs sont celles de l'anneau : un thème garde sa teinte d'un module à
// l'autre, sinon on relit la légende à chaque bloc.

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

const CANAL: Record<string, string> = { meta: "▣", google: "◆" };

export function FriseSemaine({ f, univers }: { f: Frise; univers: string[] }) {
  const grille = jours(f.debut, f.fin);
  const n = grille.length;
  if (n < 7) return null;

  const idx = (iso: string) => grille.indexOf(iso);
  const pos = (i: number) => (i / n) * 100;
  // La couleur vient du LABEL, pas de sa position ici : c'est ce qui la rend
  // identique dans l'anneau juste au-dessus et stable la semaine prochaine.
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
    .filter((x) => x.jusqua && x.jusqua < f.fin);

  const postsParJour = new Map<string, typeof f.posts>();
  for (const p of f.posts) {
    const l = postsParJour.get(p.date) ?? [];
    l.push(p);
    postsParJour.set(p.date, l);
  }

  return (
    <div className="bg-white border border-line rounded-xl shadow-card overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 flex-wrap px-4 sm:px-5 pt-4 pb-2">
        <div className="text-[10px] uppercase tracking-widest text-faint font-bold">
          Ce qui tournait <span className="text-ink">· 4 semaines</span>
        </div>
        <div className="text-[10.5px] text-faint">
          {f.campagnes.length} campagne{f.campagnes.length > 1 ? "s" : ""} ·{" "}
          {f.posts.length} publication{f.posts.length > 1 ? "s" : ""}
        </div>
      </div>

      {/* L'échelle de temps, avec la semaine du rapport détourée */}
      <div className="px-4 sm:px-5">
        <div className="relative h-4">
          <div
            className="absolute inset-y-0 rounded-t-md bg-brand/[0.07] border-x border-t border-brand/20"
            style={{ left: `${pos(debutSemaine)}%`, right: 0 }}
          />
          <div
            className="absolute top-0 text-[9.5px] font-bold text-brand uppercase tracking-wide pl-1.5"
            style={{ left: `${pos(debutSemaine)}%` }}
          >
            cette semaine
          </div>
        </div>
      </div>

      {/* Les campagnes — une barre par campagne, du premier au dernier jour où
          elle a réellement dépensé. Triées par dépense : la plus lourde en tête. */}
      <div className="px-4 sm:px-5 max-h-[38vh] overflow-y-auto">
        <div className="relative">
          {/* la bande « cette semaine » traverse toutes les lignes */}
          <div
            className="absolute inset-y-0 bg-brand/[0.05] border-x border-brand/20 pointer-events-none"
            style={{ left: `${pos(debutSemaine)}%`, right: 0 }}
          />
          {f.campagnes.map((c) => {
            const a = Math.max(0, idx(c.debut));
            const b = Math.min(n - 1, idx(c.fin));
            const t = couleur(c.theme);
            const lim = limite(c.canal);
            const coupeParLesDonnees = b >= lim && lim < n - 1;
            return (
              <div key={`${c.canal}-${c.nom}`} className="relative py-[5px] group">
                <div className="relative h-[18px]">
                  <div
                    className="absolute inset-y-[3px] rounded-full"
                    style={{
                      left: `${pos(a)}%`,
                      width: `${Math.max(1.2, ((b - a + 1) / n) * 100)}%`,
                      background: t?.aplat ?? "rgba(0,0,0,0.06)",
                      border: `1px solid ${t?.trait ?? "#d8d8de"}`,
                      // Coupée par le bord des données : on l'estompe au lieu de
                      // lui donner une fin nette qu'on ne mesure pas.
                      maskImage: coupeParLesDonnees
                        ? "linear-gradient(90deg,#000 82%,transparent)"
                        : undefined,
                      WebkitMaskImage: coupeParLesDonnees
                        ? "linear-gradient(90deg,#000 82%,transparent)"
                        : undefined,
                    }}
                    title={`${c.nom} · ${libelle(c.debut)} → ${libelle(c.fin)} · ${c.jours} jour${
                      c.jours > 1 ? "s" : ""
                    } de diffusion · ${Math.round(c.depense)} CHF${
                      c.continu ? "" : " · diffusion interrompue puis reprise"
                    }`}
                  />
                  <span
                    className="absolute inset-y-0 flex items-center text-[10.5px] text-ink/80 whitespace-nowrap pl-1.5 pointer-events-none"
                    style={{ left: `${pos(a)}%` }}
                  >
                    <span className="text-faint mr-1">{CANAL[c.canal] ?? "·"}</span>
                    <span className="max-w-[26ch] truncate">{c.nom}</span>
                    {!c.continu && (
                      <span className="text-warn ml-1.5" title="diffusion interrompue">
                        ⌇
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Les publications — mêmes 4 semaines, même échelle. C'est le
          rapprochement qui compte : un pic qui suit un post ou une campagne. */}
      <div className="px-4 sm:px-5 pt-3 pb-1 border-t border-line mt-2">
        <div className="text-[10px] uppercase tracking-wide text-faint font-semibold mb-1.5">
          Tes publications
        </div>
        <div className="relative h-7">
          <div
            className="absolute inset-y-0 bg-brand/[0.05] border-x border-brand/20"
            style={{ left: `${pos(debutSemaine)}%`, right: 0 }}
          />
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
                  left: `calc(${pos(i) + 100 / n / 2}% - 5px)`,
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
          {f.posts.length === 0 && (
            <span className="absolute inset-0 flex items-center text-[11px] text-faint">
              aucune publication sur la période
            </span>
          )}
        </div>
      </div>

      {/* L'échelle, en dates lisibles */}
      <div className="px-4 sm:px-5 pb-3 flex justify-between text-[9.5px] text-faint font-mono">
        <span>{libelle(f.debut)}</span>
        <span>{libelle(grille[Math.floor(n / 2)])}</span>
        <span>{libelle(f.fin)}</span>
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
