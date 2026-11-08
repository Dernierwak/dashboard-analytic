import Link from "next/link";
import { jourLong } from "@/lib/instagram/annee";
import { texteFigeAu } from "@/lib/instagram/etat";

// ── LES DEUX ENCARTS D'ÉTAT DE LA PAGE ───────────────────────────────────────
//
// Spec, § La page — Les états de la page. L'état se décide dans
// `lib/instagram/etat.ts` (harnais du ticket 15) ; ici, seulement l'écriture.
// Le compte gratuit n'a pas d'encart : même page, mêmes règles, et aucun appel
// à l'achat ([Le compte gratuit à 10 posts], spec user story 31).

/** Jeton mort : en tête, pleine largeur, au-dessus de la page grisée. */
export function EncartJetonMort({ figeAu }: { figeAu: string | null }) {
  const jusquau = figeAu ? `jusqu'au ${jourLong(figeAu, true)}` : "jusqu'au dernier relevé";
  return (
    <section
      role="status"
      className="mt-6 rounded-xl border border-warn/30 bg-gradient-to-br from-warn/10 to-white px-5 py-5 sm:px-7 sm:py-6 shadow-card"
    >
      <h2 className="font-serif text-[22px] sm:text-[26px] leading-tight text-ink">{texteFigeAu(figeAu)}</h2>
      <p className="mt-1.5 text-[13px] text-muted max-w-[72ch] leading-relaxed">
        La connexion à Meta a expiré : Pulse ne peut plus lire ton compte Instagram. Rien n&apos;est
        effacé — la page ci-dessous montre ce qui était en base {jusquau}.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 max-w-[880px]">
        <div className="min-w-0">
          <h3 className="text-[11px] uppercase tracking-wide font-semibold text-faint">Ce qui reste juste</h3>
          <ul className="mt-1.5 space-y-1 text-[12.5px] text-ink leading-relaxed list-disc pl-4">
            <li>Les chiffres de chaque post, tels que relevés {jusquau}.</li>
            <li>Les posts de plus de 7 jours : leurs chiffres ne bougeaient plus.</li>
            <li>La courbe du compte, jour par jour, {jusquau}.</li>
          </ul>
        </div>
        <div className="min-w-0">
          <h3 className="text-[11px] uppercase tracking-wide font-semibold text-faint">Ce qui manque</h3>
          <ul className="mt-1.5 space-y-1 text-[12.5px] text-ink leading-relaxed list-disc pl-4">
            <li>Les posts publiés depuis : ils ne sont pas en base.</li>
            <li>Les posts qui avaient moins de 7 jours : leurs chiffres ont pu changer depuis.</li>
            <li>Les abonnés, la portée et les interactions du compte depuis.</li>
          </ul>
        </div>
      </div>
      <Link
        href="/comptes"
        className="mt-5 inline-flex items-center rounded-lg bg-ink px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
      >
        Reconnecter Instagram
      </Link>
      <p className="mt-2 text-[11.5px] text-faint">
        La page se remet à jour au passage du worker qui suit la reconnexion (chaque jour à 07:00 UTC).
      </p>
    </section>
  );
}

/** Le badge de la page grisée : rappelle, au-dessus des modules, à quelle date
 *  ils sont arrêtés. */
export function BadgeFige({ figeAu }: { figeAu: string | null }) {
  return (
    <span className="inline-flex items-center rounded-full border border-warn/30 bg-warn/10 px-2.5 py-0.5 text-[11px] font-medium text-warn">
      {figeAu ? `figé au ${jourLong(figeAu, true)}` : "figé"}
    </span>
  );
}

/** Compte neuf : un seul encart, à la place de toute la page — des modules
 *  vides n'y diraient rien de plus. */
export function EncartCompteNeuf({ motDuWorker }: { motDuWorker: string | null }) {
  return (
    <section className="mt-6 rounded-xl border border-line bg-white px-5 py-6 sm:px-7 shadow-card max-w-[760px]">
      <h2 className="font-serif text-[22px] leading-tight text-ink">Ton compte Instagram n&apos;a pas encore été lu</h2>
      <p className="mt-2 text-[13px] text-muted leading-relaxed">
        Le premier passage du worker — chaque jour à 07:00 UTC — lira :
      </p>
      <ul className="mt-1.5 space-y-1 text-[12.5px] text-ink leading-relaxed list-disc pl-4">
        <li>tes posts les plus récents et leurs chiffres (portée, j&apos;aime, commentaires, enregistrements, partages…) ;</li>
        <li>la portée et les interactions de ton compte, jour par jour, sur les 90 derniers jours ;</li>
        <li>tes abonnés, jour par jour, sur les 30 derniers jours au plus — Instagram ne remonte pas plus loin.</li>
      </ul>
      <p className="mt-2 text-[12.5px] text-muted leading-relaxed">
        Ensuite, chaque passage ajoute ce qui est publié et relève les chiffres qui bougent encore. La page se
        remplit à mesure.
      </p>
      {motDuWorker && (
        <p className="mt-3 text-[12px] text-warn bg-warn/5 border border-warn/20 rounded-lg px-3 py-2 leading-relaxed">
          Au dernier passage, Instagram n&apos;a pas été lu : {motDuWorker}.{" "}
          <Link href="/comptes" className="underline font-medium">Aller à Comptes →</Link>
        </p>
      )}
    </section>
  );
}
