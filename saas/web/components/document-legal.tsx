import Link from "next/link";
import { chargerDocumentLegal, DOCUMENTS_LEGAUX, type Bloc, type Segment, type SlugLegal } from "@/lib/legal";

// Le rendu d'un document légal, et rien d'autre : les `.md` de `legal/`
// n'emploient que six constructions (titres, paragraphes, listes, tableaux,
// traits, et gras / italique / code / liens en ligne). Tout est volontairement
// sobre — un reviewer Google doit pouvoir lire le texte, pas le décor.

function Ligne({ contenu }: { contenu: Segment[] }) {
  return (
    <>
      {contenu.map((s, i) => {
        if (s.t === "gras")
          return (
            <strong key={i} className="font-semibold text-ink">
              <Ligne contenu={s.contenu} />
            </strong>
          );
        if (s.t === "italique")
          return (
            <em key={i}>
              <Ligne contenu={s.contenu} />
            </em>
          );
        if (s.t === "code")
          return (
            <code key={i} className="font-mono text-[0.9em] bg-canvas border border-line rounded px-1 py-0.5">
              {s.v}
            </code>
          );
        if (s.t === "lien") {
          const interne = s.href.startsWith("/");
          if (interne)
            return (
              <Link key={i} href={s.href} className="text-brand underline underline-offset-2">
                {s.v}
              </Link>
            );
          return (
            <a
              key={i}
              href={s.href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-brand underline underline-offset-2"
            >
              {s.v}
            </a>
          );
        }
        return <span key={i}>{s.v}</span>;
      })}
    </>
  );
}

function Rendu({ bloc }: { bloc: Bloc }) {
  if (bloc.t === "separateur") return <hr className="border-0 border-t border-line my-8" />;

  if (bloc.t === "titre") {
    if (bloc.niveau === 1)
      return (
        <h1 className="font-serif text-[28px] leading-tight text-ink mt-2 mb-6">
          <Ligne contenu={bloc.contenu} />
        </h1>
      );
    if (bloc.niveau === 2)
      return (
        <h2 className="text-[16px] font-semibold text-ink mt-10 mb-3">
          <Ligne contenu={bloc.contenu} />
        </h2>
      );
    return (
      <h3 className="text-[13.5px] font-semibold text-ink mt-6 mb-2">
        <Ligne contenu={bloc.contenu} />
      </h3>
    );
  }

  if (bloc.t === "liste")
    return (
      <ul className="my-3 space-y-1.5 text-[13.5px] text-muted leading-relaxed">
        {bloc.items.map((item, i) => (
          <li key={i} className="pl-4 relative">
            <span className="absolute left-0 top-[0.6em] w-1 h-1 rounded-full bg-faint" />
            <Ligne contenu={item} />
          </li>
        ))}
      </ul>
    );

  if (bloc.t === "tableau")
    return (
      <div className="my-4 overflow-x-auto border border-line rounded-xl bg-white">
        <table className="w-full text-[13px] text-muted">
          <thead>
            <tr className="border-b border-line">
              {bloc.entetes.map((c, i) => (
                <th key={i} className="text-left font-semibold text-ink px-3 py-2 whitespace-nowrap">
                  <Ligne contenu={c} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bloc.lignes.map((ligne, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                {ligne.map((c, j) => (
                  <td key={j} className="px-3 py-2 align-top">
                    <Ligne contenu={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <p className="my-3 text-[13.5px] text-muted leading-relaxed">
      <Ligne contenu={bloc.contenu} />
    </p>
  );
}

// Le point d'entrée des trois pages : elles ne portent que leur slug.
export async function VueDocumentLegal({ slug }: { slug: SlugLegal }) {
  const doc = await chargerDocumentLegal(slug);
  if (!doc.pret)
    return <DocumentNonPublie titre={DOCUMENTS_LEGAUX[slug].titre} bloquants={doc.bloquants} />;
  return <DocumentLegal blocs={doc.blocs} />;
}

function DocumentLegal({ blocs }: { blocs: Bloc[] }) {
  return (
    <PageLegale>
      {blocs.map((bloc, i) => (
        <Rendu key={i} bloc={bloc} />
      ))}
    </PageLegale>
  );
}

// Ce qu'on sert tant qu'un document porte un `<PLACEHOLDER>` ou une affirmation
// marquée « À VÉRIFIER AVANT PUBLICATION ». La raison exacte ne s'affiche PAS :
// elle part dans les journaux du serveur. « Nos DPA ne sont pas encore signés »
// est vrai, et ce n'est pas une phrase qu'on publie sur son propre site.
function DocumentNonPublie({ titre, bloquants }: { titre: string; bloquants: string[] }) {
  console.warn(`[legal] ${titre} n'est pas publiable : ${bloquants.join(" · ")}`);
  return (
    <PageLegale>
      <h1 className="font-serif text-[28px] leading-tight text-ink mt-2 mb-4">{titre}</h1>
      <p className="text-[13.5px] text-muted leading-relaxed">
        Ce document n&apos;est pas encore publié. Il est en cours de finalisation et
        paraîtra à cette adresse.
      </p>
      <p className="text-[13.5px] text-muted leading-relaxed mt-3">
        D&apos;ici là, écris-nous depuis l&apos;application et nous répondrons à
        toute question sur tes données.
      </p>
    </PageLegale>
  );
}

function PageLegale({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-canvas px-5 py-10">
      <div className="mx-auto w-full max-w-[72ch]">
        <Link href="/" className="text-[15px] font-bold tracking-tight text-ink">
          Pulse
        </Link>
        <div className="mt-8">{children}</div>
        <nav className="mt-14 pt-5 border-t border-line flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-faint">
          <Link href="/privacy" className="hover:text-ink">Confidentialité</Link>
          <Link href="/terms" className="hover:text-ink">CGU</Link>
          <Link href="/suppression" className="hover:text-ink">Suppression des données</Link>
        </nav>
      </div>
    </main>
  );
}
