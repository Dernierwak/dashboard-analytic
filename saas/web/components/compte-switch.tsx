"use client";

import { useTransition } from "react";
import { choisirCompte } from "@/app/actions";
import type { Compte } from "@/lib/account";

// Le sélecteur de compte — n'apparaît que si tu as accès à plus d'un dashboard.
// Quand tu regardes celui de quelqu'un d'autre, il le dit clairement : rien
// n'est plus déroutant que d'agir sur un compte en croyant être sur le sien.
//
// Un compte vide y reste listé, mais nommé pour ce qu'il est. On aurait pu le
// retirer ; le garder vaut mieux, pour deux raisons. Le jour où la personne
// branche enfin ses propres régies, une option qui APPARAÎT est un bug de plus
// à comprendre, alors qu'une option qui change de nom est une progression
// visible. Et un menu qui cache un compte auquel on a droit ne laisse aucun
// chemin pour y revenir : c'est précisément ce qu'il faut pour s'y connecter.

// Deux mots, et pas cinq : la colonne laisse 146 px de texte lisible, et
// « Mon compte · rien de connecté » s'y coupait à « rien de co… ». Un libellé
// tronqué en plein milieu du mot qui porte le sens ne vaut rien. La phrase
// entière est juste en dessous, au moment où elle sert.
const nommer = (c: Compte) => (c.vide ? `${c.label} · vide` : c.label);

export function CompteSwitch({
  comptes,
  actif,
}: {
  comptes: Compte[];
  actif: string;
}) {
  const [pending, startTransition] = useTransition();
  if (comptes.length < 2) return null;
  const courant = comptes.find((c) => c.id === actif);
  const invite = courant && courant.role !== "owner";

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        {invite && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-warn bg-warn/10 rounded-full px-2 py-1 whitespace-nowrap">
            {courant?.role === "viewer" ? "lecture seule" : "invité"}
          </span>
        )}
        <select
          disabled={pending}
          value={actif}
          onChange={(e) =>
            startTransition(async () => {
              await choisirCompte(e.target.value);
              window.location.reload();
            })
          }
          aria-label="Compte affiché"
          // La colonne offre 255 px de contenu, et sur un compte invité la
          // rangée « pastille + sélecteur » en réclame 276,9 : un libellé long
          // reste tronqué une fois le menu refermé, et le restera — élargir la
          // barre jusqu'à combler ces 22 px coûterait au rapport plus que ça ne
          // rapporte ici, parce qu'un `truncate` + `title` se dégrade
          // proprement. Le titre redonne le libellé entier au survol, et la
          // ligne ci-dessous le dit en clair au seul moment où ça compte.
          title={courant ? nommer(courant) : undefined}
          // `min-w-0` : sans lui, la pastille « lecture seule » et le sélecteur
          // additionnaient leurs largeurs et débordaient de la colonne — ce que
          // voit précisément l'invité, à toutes les pages.
          className={`text-[11.5px] font-semibold rounded-full border px-3 py-1.5 outline-none min-w-0 max-w-[190px] truncate ${
            invite ? "border-warn/40 bg-warn/[0.06] text-ink" : "border-line bg-white text-ink"
          }`}
        >
          {comptes.map((c) => (
            <option key={c.id} value={c.id}>
              {nommer(c)}
            </option>
          ))}
        </select>
      </div>

      {/* Un dashboard à zéro doit dire POURQUOI il est à zéro. Sans cette
          ligne, la page laisse croire que Pulse n'a rien trouvé, alors qu'il
          n'a simplement rien à chercher. */}
      {courant?.vide && (
        <p className="text-[10.5px] text-muted leading-snug">
          Aucune régie n&apos;est branchée sur ton compte.{" "}
          <a href="/comptes" className="underline underline-offset-2 hover:text-ink">
            En connecter une
          </a>
          , ou choisis un compte partagé ci-dessus.
        </p>
      )}
    </div>
  );
}
