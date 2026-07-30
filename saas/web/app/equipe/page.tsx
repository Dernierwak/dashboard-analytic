// Équipe — donner l'accès à son dashboard à quelqu'un d'autre.
// Les données ne sont jamais dupliquées : on élargit la règle de lecture au
// compte de l'invité. Les jetons Meta/Google, eux, ne sont jamais partagés.
import { getCompteActif } from "@/lib/account";
import { listerMembres } from "@/app/actions";
import { SiteHeader } from "@/components/site-header";
import { EquipeManager } from "@/components/equipe-manager";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const compte = await getCompteActif();
  const membres = compte.uid === compte.moi ? await listerMembres() : [];
  const invite = compte.uid !== compte.moi;

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <SiteHeader email={compte.email} active="equipe" compte={compte} />

      <div className="mb-7">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          Partage d&apos;accès
        </p>
        <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
          Ton équipe.
        </h1>
        <p className="text-[13px] text-muted mt-2 leading-relaxed max-w-[68ch]">
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

      <div className="mt-8 rounded-xl border border-line bg-black/[0.015] p-4">
        <div className="text-[11px] uppercase tracking-wide text-faint font-bold mb-1.5">
          Ce qui n&apos;est jamais partagé
        </div>
        <p className="text-[12.5px] text-muted leading-relaxed">
          Tes connexions Meta et Google Analytics restent à toi seul. Une personne
          invitée voit les chiffres récoltés, jamais de quoi aller les chercher — elle
          ne peut donc rien faire sur tes comptes publicitaires en dehors de Pulse.
        </p>
      </div>
    </main>
  );
}
