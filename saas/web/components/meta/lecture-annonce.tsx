import { Icone } from "@/components/meta/elements";
import { PanneauLateral } from "@/components/meta/panneau";
import { dateFr } from "@/lib/jour-de-travail";
import { BOUTON_SANS_NOM, type Carte, type ContenuAnnonce, type Visuel } from "@/lib/meta/annonce";
import type { AnnonceLue } from "@/lib/meta/donnees";

// ── L'ANNONCE LUE, DANS LE PANNEAU LATÉRAL ───────────────────────────────────
//
// User stories 37 à 43 ; forme reprise de la variante P du prototype que David
// a retenue (ticket 06 de la carte) : l'aperçu tel qu'il s'affiche dans le fil,
// puis chaque champ en entier, variantes numérotées. Le calcul (quoi montrer,
// d'où vient le visuel, quelle adresse est sûre) est dans `lib/meta/annonce.ts`,
// testé.
//
// AUCUN CHIFFRE ICI, et une phrase qui dit pourquoi (user story 42) : Meta ne
// rend aucune mesure par texte, par visuel ou par variante qu'on puisse poser
// à côté, et sur un carrousel il recolle les métriques des cartes 2..n sur la
// première (ticket 03 de la carte ; `.scratch/meta-ads/recherche/
// metriques-par-asset.md`, § « Une agrégation qui déforme le carrousel »).
//
// L'aperçu n'a ni nom de Page ni photo de profil : la récolte ne les lit pas,
// et un faux en-tête serait un contenu fabriqué.
//
// Sans directive : rendu côté serveur, glissé dans le panneau client.

export function LectureAnnonce({ annonce, fermeture }: { annonce: AnnonceLue; fermeture: string }) {
  const { ouverte, contenu, lueLe } = annonce;
  return (
    <PanneauLateral titre={ouverte.nom || "Annonce sans nom"} sousTitre={ouverte.sous} fermeture={fermeture}>
      {contenu === "absente" ? (
        <Message>
          Pulse n&apos;a pas encore lu le contenu de cette annonce chez Meta. Il arrivera avec le prochain passage de la récolte.
        </Message>
      ) : contenu === "illisible" ? (
        <Message>Le contenu de cette annonce n&apos;a pas pu être lu. Les chiffres de la page, eux, ne sont pas touchés.</Message>
      ) : (
        <Contenu x={contenu} lueLe={lueLe} />
      )}
    </PanneauLateral>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 rounded-xl bg-canvas px-4 py-3 text-[14px] text-muted">{children}</p>;
}

function Contenu({ x, lueLe }: { x: ContenuAnnonce; lueLe: string | null }) {
  const date = lueLe ? new Date(lueLe) : null;
  return (
    <div className="mt-1 space-y-6">
      <ApercuFil x={x} />
      <Liens liens={x.liens} />
      <div className="space-y-5">
        <Champ nom="Texte principal" valeurs={x.textes} />
        <Champ nom="Titre" valeurs={x.titres} />
        <Champ nom="Description" valeurs={x.descriptions} />
        <Champ nom="Bouton" valeurs={x.boutons} />
        <Visuels visuels={x.visuels} />
        <Cartes cartes={x.cartes} />
      </div>
      <div className="space-y-2 border-t border-line pt-4 text-[12px] leading-relaxed text-faint">
        <p>
          Ce sont des textes et des visuels, pas des mesures : Meta ne donne aucun chiffre par texte, par visuel ou par
          variante{x.cartes.length > 0 ? ", et sur un carrousel il range ceux des cartes suivantes sur la première" : ""}.
          Pulse n&apos;en affiche donc aucun ici.
        </p>
        {x.aDesVariantes && (
          <p>Meta assemble ces variantes à la diffusion et ne dit pas laquelle a été vue : Pulse n&apos;en classe aucune.</p>
        )}
        {date && !isNaN(date.getTime()) && <p>Contenu lu chez Meta le {dateFr(date)}.</p>}
      </div>
    </div>
  );
}

// L'annonce telle qu'elle s'affiche dans un fil : c'est ce que la personne a
// publié, et ce qu'elle reconnaît au premier coup d'œil.
function ApercuFil({ x }: { x: ContenuAnnonce }) {
  const { texte, titre, description, visuel } = x.apercu;
  // Un bouton qu'on ne sait pas nommer n'a pas de libellé à imiter dans le
  // fil : il se lit dans le champ « Bouton », plus bas.
  const bouton = x.apercu.bouton === BOUTON_SANS_NOM ? null : x.apercu.bouton;
  const carrousel = x.cartes.length > 0;
  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-white">
      <figcaption className="px-3.5 pt-3 text-[11.5px] text-faint">Tel qu&apos;il s&apos;affiche dans le fil</figcaption>
      {texte && <p className="whitespace-pre-line px-3.5 pb-3 pt-2 text-[13.5px] leading-relaxed text-ink">{texte}</p>}
      {carrousel ? (
        <div className="flex snap-x gap-2 overflow-x-auto px-3.5 pb-3">
          {x.cartes.map((c, i) => (
            <div key={i} className="w-[62%] shrink-0 snap-start overflow-hidden rounded-lg border border-line">
              <VisuelStorage visuel={c.visuel} className="aspect-square" />
              <p className="truncate px-2.5 py-2 text-[12px] text-ink">{c.titre ?? "Carte sans titre"}</p>
            </div>
          ))}
        </div>
      ) : (
        visuel && <VisuelStorage visuel={visuel} className="aspect-[4/3]" />
      )}
      {(titre || description || bouton) && (
        <div className="flex min-w-0 items-center gap-3 bg-canvas px-3.5 py-3">
          <span className="min-w-0 flex-1">
            {titre && <span className="block truncate text-[13.5px] font-semibold text-ink">{titre}</span>}
            {description && <span className="block truncate text-[12px] text-muted">{description}</span>}
          </span>
          {bouton && (
            <span className="flex h-8 shrink-0 items-center rounded-md bg-[#e4e6eb] px-3 text-[12.5px] font-semibold text-ink">{bouton}</span>
          )}
        </div>
      )}
    </figure>
  );
}

/** Un visuel venu de Storage. Meta en a un que Pulse n'a pas copié : on le
 *  dit, plutôt que de pointer vers une URL de Meta qui expire. */
function VisuelStorage({ visuel, className }: { visuel: Visuel | null; className: string }) {
  if (!visuel?.url) {
    return (
      <div className={`flex items-center justify-center bg-[#efeee9] px-4 text-center text-[12px] text-faint ${className}`}>
        {visuel ? "Visuel pas encore copié dans Pulse" : "Aucun visuel"}
      </div>
    );
  }
  return (
    <div className={`relative bg-[#efeee9] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- une image venue de Storage : l'optimiseur d'images demanderait d'autoriser le domaine sans rien apporter ici. */}
      <img src={visuel.url} alt="" className="h-full w-full object-cover" loading="lazy" />
      {visuel.video && (
        <span className="absolute inset-0 flex items-center justify-center" aria-label="Vidéo">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 pl-0.5 text-[12px] text-ink">▶</span>
        </span>
      )}
    </div>
  );
}

// « L'annonce envoie vers… » : l'adresse lue dans la créa. Aucune adresse,
// aucun lien — jamais une adresse devinée (user story 41).
function Liens({ liens }: { liens: string[] }) {
  if (liens.length === 0) {
    return <p className="text-[13px] text-muted">Meta ne donne aucune adresse de destination dans cette annonce.</p>;
  }
  return (
    <div>
      <p className="mb-1.5 text-[12px] text-muted">L&apos;annonce envoie vers…</p>
      <ul className="space-y-1">
        {liens.map((l) => (
          <li key={l} className="min-w-0">
            <a
              href={l}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 text-[14px] font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              <span className="truncate">{l}</span>
              <Icone nom="fleche" className="h-3.5 w-3.5 shrink-0 -rotate-45" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Tout ce qui a été écrit, champ par champ, sans rien couper : c'est ici
// qu'un texte long se lit en entier.
function Champ({ nom, valeurs }: { nom: string; valeurs: string[] }) {
  if (valeurs.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-[12px] text-muted">
        {nom}
        {valeurs.length > 1 ? ` · ${valeurs.length} variantes` : ""}
      </p>
      <ol className="space-y-1.5">
        {valeurs.map((v, i) => (
          <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink">
            {valeurs.length > 1 && <span className="w-3 shrink-0 pt-0.5 text-[11.5px] tabular-nums text-faint">{i + 1}</span>}
            <span className="min-w-0 whitespace-pre-line break-words">{v}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Visuels({ visuels }: { visuels: Visuel[] }) {
  if (visuels.length < 2) return null;
  return (
    <div>
      <p className="mb-1.5 text-[12px] text-muted">Visuels · {visuels.length} variantes</p>
      <ol className="grid grid-cols-2 gap-2">
        {visuels.map((v, i) => (
          <li key={i} className="relative min-w-0 overflow-hidden rounded-lg border border-line">
            <VisuelStorage visuel={v} className="aspect-square" />
            <span className="absolute left-1.5 top-1.5 rounded bg-white/90 px-1.5 text-[11px] tabular-nums text-muted">{i + 1}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Cartes({ cartes }: { cartes: Carte[] }) {
  if (cartes.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-[12px] text-muted">Cartes du carrousel · {cartes.length}</p>
      <ol className="space-y-3">
        {cartes.map((c, i) => (
          <li key={i} className="flex min-w-0 gap-3">
            <span className="w-3 shrink-0 pt-0.5 text-[11.5px] tabular-nums text-faint">{i + 1}</span>
            <div className="w-16 shrink-0 overflow-hidden rounded-lg border border-line">
              <VisuelStorage visuel={c.visuel} className="aspect-square" />
            </div>
            <div className="min-w-0 flex-1 text-[14px] leading-relaxed">
              <p className="break-words font-medium text-ink">{c.titre ?? "Carte sans titre"}</p>
              {c.description && <p className="break-words text-muted">{c.description}</p>}
              {c.lien && (
                <a href={c.lien} target="_blank" rel="noopener noreferrer" className="block truncate text-[13px] text-brand hover:underline">
                  {c.lien}
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
