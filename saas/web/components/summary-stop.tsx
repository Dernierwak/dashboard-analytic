"use client";

// Empêche un élément interactif placé dans un <summary> de replier/déplier
// le <details> quand on clique dessus (ex. le sélecteur de thème).
export function SummaryStop({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={className}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {children}
    </span>
  );
}
