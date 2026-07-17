"use client";

import { useTransition } from "react";
import { setPostLabel } from "@/app/actions";

// Assigne un thème à un post Instagram (un seul par post), dans la table.
export function PostLabelSelect({
  postId,
  current,
  labels,
}: {
  postId: string;
  current: string | null;
  labels: string[];
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={current ?? ""}
      disabled={pending || !postId}
      onChange={(e) =>
        startTransition(async () => {
          await setPostLabel(postId, e.target.value || null);
        })
      }
      className={`text-[11px] font-medium rounded-full border px-2 py-1 outline-none cursor-pointer disabled:opacity-50 max-w-[120px] ${
        current
          ? "border-brand/25 text-brand bg-brand/[0.05]"
          : "border-line text-faint bg-white"
      }`}
    >
      <option value="">— thème</option>
      {labels.map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
    </select>
  );
}
