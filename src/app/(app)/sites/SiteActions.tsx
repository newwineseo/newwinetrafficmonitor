"use client";

import Link from "next/link";
import { btn } from "@/components/ui";
import { deleteSite, setSiteActive } from "../actions";

/** Plain forms with server actions, so they work even before the page's JavaScript has loaded. */
export function SiteActions({ id, name, active }: { id: number; name: string; active: boolean }) {
  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <Link href={`/sites/${id}/edit`} className={btn.secondary}>Edit</Link>
      <form action={setSiteActive.bind(null, id, !active)}>
        <button className={btn.secondary}>{active ? "Pause" : "Resume"}</button>
      </form>
      <form action={deleteSite.bind(null, id)} onSubmit={(e) => {
        if (!confirm(`Delete ${name}? Its history and alerts are deleted too. This cannot be undone.`)) e.preventDefault();
      }}>
        <button className={btn.danger}>Delete</button>
      </form>
    </div>
  );
}
