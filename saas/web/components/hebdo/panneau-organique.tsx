"use client";

import { useState } from "react";
import type { Bornes, FriseHebdo } from "@/lib/hebdo/frise";
import type { SourcesHebdo } from "@/lib/hebdo/sources";
import { organiqueVide, postsDans, type PostFrise } from "@/lib/hebdo/posts";
import { formatDe, SOURCE } from "@/lib/plateformes";
import { JOURS, dateNue, indexSemaine } from "@/lib/jour-de-travail";

// L'ONGLET ORGANIQUE — les posts de la semaine choisie en grille de deux
// colonnes : visuel 4:5, format, jour, lien vers le post. AUCUN CHIFFRE
// (spec, point 40) : retrouver ce qu'on a publié, pas le juger.
export function PanneauOrganique({
  frise,
  choisie,
  sources,
}: {
  frise: FriseHebdo;
  choisie: Bornes;
  sources: SourcesHebdo | null;
}) {
  if (frise.posts === undefined) {
    return <p className="text-[12.5px] text-muted">Les posts ne sont pas encore dans ce rapport.</p>;
  }
  const posts = postsDans(frise.posts, choisie);
  if (posts.length === 0) {
    return <p className="text-[12.5px] text-muted">{organiqueVide(sources, choisie)}</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {posts.map((p, i) => (
        <Post key={`${p.date}-${p.lien ?? p.visuel ?? i}`} p={p} />
      ))}
    </div>
  );
}

/** « mar. 21 » — le jour suffit, la semaine est en tête du panneau. */
function jour(iso: string): string {
  const d = dateNue(iso);
  return d ? `${JOURS[indexSemaine(d)].court}. ${d.getUTCDate()}` : iso;
}

function Post({ p }: { p: PostFrise }) {
  // Un lien de CDN Instagram expire en quelques jours quand le rapatriement de
  // l'image a échoué : on dit « pas de visuel » plutôt qu'une image cassée.
  const [casse, setCasse] = useState(false);
  const format = formatDe(p.format);
  const src = SOURCE[p.plateforme];
  const visuel = p.visuel && !casse ? p.visuel : null;

  const carte = (
    <div
      className="relative aspect-[4/5] overflow-hidden rounded-[10px] flex items-center justify-center text-[11.5px]"
      style={{ background: `${src.couleur}14`, color: src.couleur }}
    >
      {visuel ? (
        // Les images vivent dans le Storage Supabase : `next/image` demanderait
        // d'y déclarer le domaine.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={visuel} alt="" loading="lazy" onError={() => setCasse(true)}
          className="h-full w-full object-cover" />
      ) : (
        "pas de visuel"
      )}
      <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/75 px-1.5 py-0.5 text-[10.5px] text-white">
        {format.glyphe} {format.nom}
      </span>
    </div>
  );

  return (
    <div className="min-w-0">
      {p.lien ? (
        <a href={p.lien} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90"
          aria-label={`${format.nom} du ${jour(p.date)} sur ${src.nom}`}>
          {carte}
        </a>
      ) : (
        carte
      )}
      <div className="mt-1 flex items-baseline justify-between gap-1 text-[11px]">
        <span className="text-muted">{jour(p.date)}</span>
        {p.lien ? (
          <a href={p.lien} target="_blank" rel="noopener noreferrer" className="text-faint underline hover:text-ink">
            voir le post ↗
          </a>
        ) : (
          // La récolte ne relit qu'une partie des anciens posts : ceux-là n'ont
          // pas de permalink, et on ne le reconstruit pas.
          <span className="text-faint" title="Ce post n'a pas été relu depuis que Pulse récolte le lien.">
            lien non récolté
          </span>
        )}
      </div>
    </div>
  );
}
