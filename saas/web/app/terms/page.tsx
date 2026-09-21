import type { Metadata } from "next";
import { VueDocumentLegal } from "@/components/document-legal";
import { DOCUMENTS_LEGAUX } from "@/lib/legal";

const INFO = DOCUMENTS_LEGAUX.terms;

export const metadata: Metadata = {
  title: `${INFO.titre} — Pulse`,
  description: INFO.description,
};

export default function Page() {
  return <VueDocumentLegal slug="terms" />;
}
