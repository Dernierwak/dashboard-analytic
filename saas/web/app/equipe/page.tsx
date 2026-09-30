// Équipe — donner l'accès à son dashboard à quelqu'un d'autre.
// Les données ne sont jamais dupliquées : on élargit la règle de lecture au
// compte de l'invité. Les jetons Meta/Google, eux, ne sont jamais partagés.
import { IconeConnexions } from "@/components/icones";
import { getCompteActif } from "@/lib/account";
import { listerMembres } from "@/app/actions";
import { EquipeManager } from "@/components/equipe-manager";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const compte = await getCompteActif();
  const membres = compte.uid === compte.moi ? await listerMembres() : [];
  const invite = compte.uid !== compte.moi;

  return (
    // Pas de `max-w-*` : voir la note dans `app/page.tsx`.
    <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-9">

      <div className="mb-8">
        <h1 className="font-serif text-[36px] sm:text-[42px] leading-[1.05] tracking-[-0.02em] text-ink">
          Ton équipe.
        </h1>
        <p className="text-[14.5px] text-muted mt-3 leading-relaxed max-w-[64ch]">
          Une personne invitée voit <span className="font-semibold text-ink">tes données
          et ton rapport</span>, depuis son propre compte. Rien n&apos;est dupliqué : elle
          regarde le tien. Tu peux retirer l&apos;accès à tout moment, et elle perd la vue
          dans la seconde.
        </p>
      </div>

      {invite ? (
        <div className="bg-white border border-line rounded-xl shadow-card p-6">
          <p className="text-[13.5px] text-ink font-medium">
            Tu regardes le compte de quelqu&apos;un d&apos;autre.
          </p>
          <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
            Le partage se gère depuis le compte propriétaire. Repasse sur
            <span className="font-semibold text-ink"> Mon compte</span> en haut à droite
            pour inviter quelqu&apos;un sur le tien.
          </p>
        </div>
      ) : (
        <EquipeManager membres={membres} />
      )}

      <div className="mt-8 flex gap-3.5 items-start rounded-2xl border border-dashed border-ink/15 p-5">
        <IconeConnexions taille={20} className="shrink-0 mt-0.5 text-brand" />
        <div className="min-w-0">
        <h2 className="text-[14px] text-ink font-semibold mb-1">
          Ce qui n&apos;est jamais partagé
        </h2>
        <p className="text-[13px] text-muted leading-relaxed max-w-[68ch]">
          Tes connexions Meta et Google Analytics restent à toi seul. Une personne
          invitée voit les chiffres récoltés, jamais de quoi aller les chercher — elle
          ne peut donc rien faire sur tes comptes publicitaires en dehors de Pulse.
        </p>
        </div>
      </div>
    </main>
  );
}
