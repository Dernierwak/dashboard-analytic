import Link from "next/link";
import { dateCourte, formaterValeur, libellePlace, raisonPlace } from "@/lib/instagram/tableau";
import { COULEUR_FORMAT } from "@/lib/instagram/couleurs";
import { METRIQUES, NOM_FORMAT, type CleMetrique } from "@/lib/instagram/lecture";
import { lienInstagram, type Params } from "@/lib/instagram/liens";
import type { Meilleur } from "@/lib/instagram/meilleurs";
import { MiniMoustache } from "./mini-moustache";
import { AgePost } from "@/components/instagram/age";

// ── LA LISTE DES 5 MEILLEURS POSTS DE LA PÉRIODE ────────────────────────────
//
// Spec, « Tes posts face à ton année », dernier point : à droite du module,
// collante, qui défile — vignette, valeur, place, mini-moustache, légende,
// « Boosté » s'il y a lieu, « Lire le post ». Aucun filtre propre. Le calcul
// est `meilleursDe` (`lib/instagram/meilleurs.ts`, harnais du ticket 11) ;
// les numéros sont les mêmes que ceux du nuage.

export function ListeMeilleurs({ liste, metrique, params }: { liste: Meilleur[]; metrique: CleMetrique; params: Params }) {
  const nom = METRIQUES[metrique].nom;
  return (
    <aside aria-labelledby="titre-meilleurs" className="min-w-0 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
      <div className="rounded-2xl border border-line bg-white p-4">
        <h3 id="titre-meilleurs" className="text-[15px] font-semibold text-ink">
          Tes {liste.length > 1 ? `${liste.length} meilleurs posts` : "meilleurs posts"} de la période
        </h3>
        <p className="mt-0.5 text-[12px] text-muted">
          Sur {nom.toLowerCase()} — sans les posts de moins de 48 h ni ceux qui n&apos;ont pas ce chiffre.
        </p>
        {liste.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted">Aucun post de la période n&apos;a encore ce chiffre.</p>
        ) : (
          <ol className="mt-3 grid gap-3">
            {liste.map((m) => (
              <Carte key={m.post.id} m={m} metrique={metrique} params={params} />
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

function Carte({ m, metrique, params }: { m: Meilleur; metrique: CleMetrique; params: Params }) {
  const p = m.post;
  const couleur = p.format ? COULEUR_FORMAT[p.format].trait : "#8b8e98";
  const place = libellePlace(m.place);
  const lien = lienInstagram(params, { post: p.id });
  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex min-w-0 gap-3">
        <Link href={lien} scroll={false} className="relative shrink-0" aria-label={`Lire le post n° ${m.rang}`}>
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" loading="lazy" className="h-16 w-16 rounded-lg border border-line object-cover" />
          ) : (
            <span className="block h-16 w-16 rounded-lg border border-line bg-black/[0.04]" aria-hidden />
          )}
          <span
            className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ background: couleur }}
            aria-hidden
          >
            {m.rang}
          </span>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <b className="text-[17px] tabular-nums text-ink">{formaterValeur(metrique, m.valeur)}</b>
            <span className="text-[12px] text-muted" title={raisonPlace(m.place)}>
              {place ?? ""}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-faint">
            <span>{p.format ? NOM_FORMAT[p.format] : "Format inconnu"}</span>
            <span>· {dateCourte(p.date)}</span>
            <AgePost post={p} />

            {p.boosteVuLe && (
              <span className="rounded-full border border-line px-1.5 py-px text-[10.5px] text-muted" title="Instagram a listé au moins une annonce sur ce post">
                Boosté
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-[12.5px] text-ink/80" title={p.legende}>
            {p.legende || "(sans légende)"}
          </p>
        </div>
      </div>
      {m.moustache && p.format && (
        <div className="mt-2">
          <MiniMoustache moustache={m.moustache} valeur={m.valeur} format={p.format} metrique={metrique} />
        </div>
      )}
      <Link href={lien} scroll={false} className="mt-1.5 inline-block text-[12.5px] font-medium text-ink underline-offset-2 hover:underline">
        Lire le post →
      </Link>
    </li>
  );
}
