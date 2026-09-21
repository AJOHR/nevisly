"use client";

import type { PowerPlayAssignment } from "@/lib/nhl/powerPlay";

function formatFreshness(value: string | null) {
  if (!value) {
    return "source update time unavailable";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PowerPlayBadge({
  assignment,
}: {
  assignment?: PowerPlayAssignment;
}) {
  if (!assignment) {
    return <span className="text-zinc-700">—</span>;
  }

  return (
    <span
      className={`whitespace-nowrap text-[10px] font-black ${
        assignment.unit === "PP1" ? "text-fuchsia-300" : "text-sky-300"
      }`}
      title={`${assignment.source} · updated ${formatFreshness(
        assignment.updatedAt
      )} · informational only; not used in Nevisly scoring`}
    >
      {assignment.unit}
    </span>
  );
}
