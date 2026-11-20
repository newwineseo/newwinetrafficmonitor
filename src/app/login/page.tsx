"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } else {
      setError((await res.json().catch(() => ({}))).error ?? "Login failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg bg-white p-6 shadow">
        <div className="mb-6 rounded bg-navy px-4 py-3 text-white">
          <h1 className="text-lg font-semibold">NewWine Traffic Monitor</h1>
        </div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
        <input
          id="password" type="password" autoComplete="current-password" required autoFocus
          value={password} onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2 focus:border-accent focus:outline-none"
        />
        {error && <p role="alert" className="mb-4 text-sm text-critical">Error: {error}</p>}
        <button disabled={busy} className="w-full rounded bg-brand px-4 py-2 font-medium text-white hover:bg-accent disabled:opacity-60">
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
