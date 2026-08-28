"use client";

import { useState } from "react";
import { useAdminData, adminAction, Panel, Table, Badge, Button } from "@/components/admin/ui";
import { useDialog, validators } from "@/components/admin/Dialog";

interface Goal {
  minute: number;
  team: "home" | "away";
}

interface CustomMatch {
  id: string;
  home_team: string;
  away_team: string;
  league: string;
  kickoff: string;
  odds_home: number;
  odds_draw: number;
  odds_away: number;
  goal_timeline: Goal[];
  is_live: boolean;
  is_locked: boolean;
  best_odds: boolean;
  final_home: number | null;
  final_away: number | null;
  finished: boolean;
}

const BLANK = {
  home_team: "",
  away_team: "",
  league: "Betlixx Special",
  kickoff: "",
  odds_home: 2.0,
  odds_draw: 3.2,
  odds_away: 3.5,
  best_odds: false,
};

export default function CustomMatchesPage() {
  const { data, error, reload, busy } = useAdminData<{ matches: CustomMatch[] }>(
    "/api/admin/custom-matches",
  );
  const [form, setForm] = useState(BLANK);
  const [note, setNote] = useState<string | null>(null);
  const { ask, confirm, dialog } = useDialog();

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminAction("/api/admin/custom-matches", "POST", {
      ...form,
      kickoff: new Date(form.kickoff).toISOString(),
    });
    setNote(res.ok ? "Match created." : (res.error ?? "Failed"));
    if (res.ok) {
      setForm(BLANK);
      reload();
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await adminAction("/api/admin/custom-matches", "PATCH", { id, ...body });
    setNote(res.ok ? "Updated." : (res.error ?? "Failed"));
    if (res.ok) reload();
  };

  const editTimeline = async (m: CustomMatch) => {
    const values = await ask({
      title: "Goal timeline",
      description:
        `${m.home_team} v ${m.away_team}. The timeline drives the live score, and the clock decides ` +
        "when the match is over — so this match settles itself with no further input.",
      fields: [
        {
          name: "timeline",
          label: "Goals",
          placeholder: "23:home, 61:away, 88:home",
          defaultValue: (m.goal_timeline ?? []).map((g) => `${g.minute}:${g.team}`).join(", "),
          hint: "minute:team, comma separated. Leave empty for a goalless match.",
          validate: validators.goalTimeline,
        },
      ],
    });
    if (!values) return;

    const timeline: Goal[] = values.timeline
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((part) => {
        const [minute, team] = part.split(":").map((x) => x.trim());
        return { minute: Number(minute), team: team as "home" | "away" };
      })
      .sort((a, b) => a.minute - b.minute);

    await patch(m.id, { goal_timeline: timeline });
  };

  const setResult = async (m: CustomMatch) => {
    const values = await ask({
      title: "Finalise the result",
      description:
        `${m.home_team} v ${m.away_team}. This ends the match now and overrides the goal timeline. ` +
        "Only needed to close a match early — otherwise the clock finishes it by itself.",
      fields: [
        {
          name: "score",
          label: "Final score",
          placeholder: "2-1",
          hint: "Home first.",
          validate: validators.scoreline,
        },
      ],
      confirmLabel: "Finalise",
    });
    if (!values) return;

    const [h, a] = values.score.split("-").map((x) => Number(x.trim()));
    await patch(m.id, { final_home: h, final_away: a });
  };

  const remove = async (m: CustomMatch) => {
    const ok = await confirm({
      title: "Delete this match?",
      description: `${m.home_team} v ${m.away_team} is removed from the board. Tickets already placed on it are not refunded automatically.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;

    const res = await adminAction(`/api/admin/custom-matches?id=${m.id}`, "DELETE");
    setNote(res.ok ? "Deleted." : (res.error ?? "Failed"));
    if (res.ok) reload();
  };

  return (
    <div className="space-y-3">
      {note && <p className="text-[12px] text-[var(--text-muted)]">{note}</p>}
      {error && <p className="text-[13px] text-[var(--lose)]">{error}</p>}

      <Panel title="Create a match">
        <form onSubmit={create} className="grid gap-2 p-3 sm:grid-cols-4">
          <Input placeholder="Home team" value={form.home_team} onChange={(v) => setForm({ ...form, home_team: v })} required />
          <Input placeholder="Away team" value={form.away_team} onChange={(v) => setForm({ ...form, away_team: v })} required />
          <Input placeholder="League" value={form.league} onChange={(v) => setForm({ ...form, league: v })} />
          <input
            type="datetime-local"
            value={form.kickoff}
            onChange={(e) => setForm({ ...form, kickoff: e.target.value })}
            required
            className="rounded bg-[var(--surface-2)] px-2.5 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
          <Input placeholder="Home odds" type="number" value={String(form.odds_home)} onChange={(v) => setForm({ ...form, odds_home: Number(v) })} />
          <Input placeholder="Draw odds" type="number" value={String(form.odds_draw)} onChange={(v) => setForm({ ...form, odds_draw: Number(v) })} />
          <Input placeholder="Away odds" type="number" value={String(form.odds_away)} onChange={(v) => setForm({ ...form, odds_away: Number(v) })} />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold">
              <input
                type="checkbox"
                checked={form.best_odds}
                onChange={(e) => setForm({ ...form, best_odds: e.target.checked })}
              />
              Best odds
            </label>
            <Button tone="accent" type="submit">
              Create
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title={`Custom matches${data ? ` (${data.matches.length})` : ""}`}>
        {busy && !data ? (
          <p className="p-6 text-[13px] text-[var(--text-muted)]">Loading…</p>
        ) : (
          <Table head={["Match", "Kickoff", "Odds", "Goals", "State", "Actions"]}>
            {(data?.matches ?? []).map((m) => (
              <tr key={m.id}>
                <td className="px-3 py-2">
                  <p className="font-semibold">
                    {m.home_team} v {m.away_team}
                  </p>
                  <p className="text-[11px] text-[var(--text-faint)]">{m.league}</p>
                </td>
                <td className="px-3 py-2 text-[11px]">{new Date(m.kickoff).toLocaleString()}</td>
                <td className="px-3 py-2 font-mono text-[11px]">
                  {Number(m.odds_home).toFixed(2)} / {Number(m.odds_draw).toFixed(2)} /{" "}
                  {Number(m.odds_away).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-[11px] text-[var(--text-muted)]">
                  {(m.goal_timeline ?? []).length
                    ? m.goal_timeline.map((g) => `${g.minute}'${g.team === "home" ? "H" : "A"}`).join(" ")
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {m.finished ? (
                      <Badge tone="muted">
                        FT {m.final_home}-{m.final_away}
                      </Badge>
                    ) : m.is_live ? (
                      <Badge tone="lose">Live</Badge>
                    ) : (
                      <Badge tone="pending">Upcoming</Badge>
                    )}
                    {m.is_locked && <Badge tone="muted">Locked</Badge>}
                    {m.best_odds && <Badge tone="win">Boost</Badge>}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <Button onClick={() => editTimeline(m)}>Timeline</Button>
                    <Button onClick={() => patch(m.id, { is_live: !m.is_live })}>
                      {m.is_live ? "End live" : "Go live"}
                    </Button>
                    <Button onClick={() => patch(m.id, { is_locked: !m.is_locked })}>
                      {m.is_locked ? "Unlock" : "Lock"}
                    </Button>
                    <Button onClick={() => patch(m.id, { best_odds: !m.best_odds })}>Boost</Button>
                    <Button onClick={() => setResult(m)}>Finalise</Button>
                    <Button tone="danger" onClick={() => remove(m)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      {dialog}
    </div>
  );
}

function Input({
  value,
  onChange,
  ...props
}: {
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input
      {...props}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded bg-[var(--surface-2)] px-2.5 py-2 text-[12px] outline-none focus:ring-1 focus:ring-[var(--accent)]"
    />
  );
}
