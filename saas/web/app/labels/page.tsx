// Labels unifiés — une seule liste de thèmes pour Meta + Google + Instagram.
// Renommer / supprimer se propage partout (mêmes règles que scripts/labels.py).
import { getLabelsData } from "@/lib/channels";
import { SiteHeader } from "@/components/site-header";
import { CreateLabel, LabelRow } from "@/components/label-manager";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const data = await getLabelsData();

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <SiteHeader email={data.email} active="labels" />

      <div className="mb-7">
        <p className="text-[11px] uppercase tracking-widest text-faint font-semibold mb-1.5">
          Une liste, trois canaux
        </p>
        <h1 className="font-serif text-3xl sm:text-[34px] leading-tight text-ink">
          Tes thèmes.
        </h1>
        <p className="text-[13px] text-muted mt-2 leading-relaxed">
          Un thème regroupe campagnes Meta <span style={{ color: "#1a56ff" }}>▣</span>, Google{" "}
          <span style={{ color: "#1a7a4a" }}>◆</span> et posts Instagram{" "}
          <span style={{ color: "#7b4fff" }}>◎</span> — le rapport peut alors dire ce que
          chaque thème te rapporte. Renommer ou supprimer se propage partout.
        </p>
      </div>

      <CreateLabel />

      {data.rows.length === 0 ? (
        <div className="bg-white border border-line rounded-xl shadow-card p-6 text-center">
          <p className="text-[14px] text-ink font-medium">Aucun thème pour l&apos;instant.</p>
          <p className="text-[12.5px] text-muted mt-2 leading-relaxed">
            Crée ton premier ci-dessus (ex. « e-bike », « promo été »), puis assigne-le à
            tes campagnes dans les pages Meta et Google.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-xl shadow-card divide-y divide-line">
          {data.rows.map((row) => (
            <LabelRow key={row.name} row={row} />
          ))}
        </div>
      )}
    </main>
  );
}
