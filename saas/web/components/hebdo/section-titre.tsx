// Le titre d'une section de l'hebdo, partagé par ses blocs.
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-[19px] sm:text-[21px] leading-tight text-ink mb-3.5 flex items-center gap-2.5">
      <span className="h-4 w-[3px] rounded-full bg-brand shrink-0" />
      {children}
    </h2>
  );
}
