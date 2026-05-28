import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CoachCard } from "@/components/coach/CoachCard";
import { CoachOptIn } from "@/components/coach/CoachOptIn";
import { getCurrentUser } from "@/lib/auth";
import { teamColor } from "@/lib/f1-teams";
import {
  type DriverRoundResult,
  getCoachEnabled,
  getDriverProfile,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

import { getDriverTake } from "../../coach-actions";

const SESSION_LABELS: Record<string, string> = {
  qualifying: "Quali",
  race1: "Race 1",
  race2: "Race 2",
  race3: "Race 3",
};

function pos(p: number | null): string {
  return p === null ? "—" : `P${p}`;
}

export default async function DriverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const driverId = Number(id);
  if (!Number.isInteger(driverId)) notFound();

  const supabase = await createClient();
  const user = await getCurrentUser();
  const [profile, coachEnabled] = await Promise.all([
    getDriverProfile(supabase, driverId),
    user ? getCoachEnabled(supabase, user.id) : Promise.resolve(false),
  ]);
  if (!profile) notFound();

  const color = teamColor(profile.f1Partner);

  return (
    <main>
      <header
        className="relative border-b border-border-default px-6 py-8 sm:px-12"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <Link
          href="/drivers"
          className="font-mono text-xs tracking-wider text-muted uppercase transition-colors hover:text-secondary"
        >
          ← All drivers
        </Link>

        <div className="mt-4 flex items-center gap-5">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={profile.fullName}
              width={72}
              height={72}
              className="size-16 shrink-0 border border-border-default bg-surface sm:size-[72px]"
              unoptimized
            />
          ) : null}
          <div className="min-w-0">
            <p className="font-body text-xs tracking-[0.2em] text-secondary uppercase">
              {profile.team ?? "Team TBC"}
              {profile.f1Partner ? ` · ${profile.f1Partner}` : ""}
              {profile.carNumber !== null ? ` · #${profile.carNumber}` : ""}
            </p>
            <h1 className="mt-1 font-display text-[clamp(2rem,5vw,3.5rem)] leading-none tracking-wide uppercase">
              {profile.fullName}
            </h1>
          </div>
        </div>

        <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3">
          <div>
            <dt className="font-mono text-[10px] tracking-wider text-muted uppercase">
              Price
            </dt>
            <dd
              data-tabular
              className="mt-0.5 font-mono text-xl text-primary tabular-nums"
            >
              {profile.price !== null ? `£${profile.price.toFixed(1)}M` : "—"}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] tracking-wider text-muted uppercase">
              Season points
            </dt>
            <dd
              data-tabular
              className="mt-0.5 font-mono text-xl text-primary tabular-nums"
            >
              {profile.seasonPoints}
            </dd>
          </div>
        </dl>
      </header>

      <section className="px-6 py-6 sm:px-12">
        {coachEnabled ? (
          <CoachCard load={getDriverTake.bind(null, driverId)} title="Coach's Take" />
        ) : (
          <CoachOptIn body={`The Coach can give you a quick AI scouting read on ${profile.lastName} — grounded in her price and form this season.`} />
        )}
      </section>

      <section className="px-6 pb-12 sm:px-12">
        <h2 className="font-display text-sm tracking-[0.2em] text-secondary uppercase">
          Form this season
        </h2>
        {profile.history.length === 0 ? (
          <p className="mt-3 font-body text-sm text-muted">
            No completed rounds yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-px">
            {profile.history.map((r) => (
              <RoundRow key={r.roundNumber} round={r} />
            ))}
          </ul>
        )}
      </section>

      {profile.wikipediaUrl ? (
        <p className="px-6 pb-12 font-mono text-xs text-muted sm:px-12">
          <a
            href={profile.wikipediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tracking-wider uppercase underline-offset-4 hover:underline"
          >
            Wikipedia ↗
          </a>
        </p>
      ) : null}
    </main>
  );
}

function RoundRow({ round }: { round: DriverRoundResult }) {
  return (
    <li className="flex items-center justify-between border border-border-default bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="font-display text-sm tracking-wide text-primary uppercase">
          R{round.roundNumber} · {round.circuitName}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-4 font-mono text-[11px] text-secondary tabular-nums">
          {round.sessions.map((s, i) => (
            <span key={i}>
              {SESSION_LABELS[s.type] ?? s.type} {pos(s.position)}
              {s.fastestLap ? " · FL" : ""}
            </span>
          ))}
        </p>
      </div>
      <div
        data-tabular
        className="shrink-0 pl-4 font-mono text-lg text-primary tabular-nums"
      >
        {round.points} pts
      </div>
    </li>
  );
}
