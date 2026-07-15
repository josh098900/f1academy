// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { QuickRace } from "../components/paddock/QuickRace";
import type { RatedDriver } from "../lib/paddock/ratings";

// QuickRace refreshes the page's server data when the flag drops (the coin
// balance is deliberately stale until then); there is no app router mounted
// in jsdom, so stub it.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// A believable field: one clear front-runner, a midfield, and a backmarker.
const DRIVERS: RatedDriver[] = [
  { driverId: 1, name: "Alisha Palmowski", shortName: "A. Palmowski", stats: { pace: 75, racecraft: 71, consistency: 85 } },
  { driverId: 2, name: "Ella Bruce", shortName: "M. Bruce", stats: { pace: 74, racecraft: 42, consistency: 85 } },
  { driverId: 3, name: "Emma Felbermayr", shortName: "E. Felbermayr", stats: { pace: 73, racecraft: 60, consistency: 85 } },
  { driverId: 4, name: "Nina Gademan", shortName: "N. Gademan", stats: { pace: 71, racecraft: 66, consistency: 79 } },
  { driverId: 5, name: "Poppy Westcott", shortName: "P. Westcott", stats: { pace: 71, racecraft: 39, consistency: 85 } },
  { driverId: 6, name: "Lola Billard", shortName: "L. Billard", stats: { pace: 70, racecraft: 31, consistency: 85 } },
  { driverId: 7, name: "Chiara Bättig", shortName: "C. Bättig", stats: { pace: 69, racecraft: 53, consistency: 74 } },
  { driverId: 8, name: "Maya Paatz", shortName: "M. Paatz", stats: { pace: 67, racecraft: 48, consistency: 85 } },
  { driverId: 9, name: "Alba Hurup Larsen", shortName: "A. Hurup Larsen", stats: { pace: 66, racecraft: 38, consistency: 85 } },
];

function tyre(name: "Soft" | "Medium" | "Hard") {
  return screen.getAllByRole("button", { name });
}

describe("QuickRace — the pit wall", () => {
  it("lists every driver with the ratings the player is choosing on", async () => {
    render(<QuickRace drivers={DRIVERS} />);
    // Quickest first — the ranking is the information.
    const first = screen.getByRole("button", { name: /Palmowski/ });
    expect(first).toHaveTextContent("75/71/85");
    expect(screen.getByRole("button", { name: /Hurup Larsen/ })).toBeInTheDocument();
  });

  it("lets the player pick a driver, and says who is following the plan", async () => {
    const user = userEvent.setup();
    render(<QuickRace drivers={DRIVERS} />);
    await user.click(screen.getByRole("button", { name: /Felbermayr/ }));
    expect(screen.getByRole("button", { name: /Felbermayr/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByText(/follows this literally/i)).toHaveTextContent(
      "E. Felbermayr"
    );
  });

  it("draws a clean plan as clean", () => {
    render(<QuickRace drivers={DRIVERS} />);
    // Default: medium → hard, box at 65%. Both tyres last.
    expect(screen.getByText(/clean plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Box lap \d+/)).toBeInTheDocument();
  });

  it("warns BEFORE the lights when the plan runs the tyre past its cliff", async () => {
    const user = userEvent.setup();
    render(<QuickRace drivers={DRIVERS} />);

    // Start on softs — they fall off a cliff at 70% wear — then refuse to box
    // until 90%. (userEvent can't drive a range input in jsdom; fireEvent.change
    // is the honest way to set one.)
    await user.click(tyre("Soft")[0]);
    fireEvent.change(screen.getByLabelText(/box at/i), { target: { value: "90" } });

    expect(screen.getByText(/falls off on lap/i)).toBeInTheDocument();
    expect(screen.getByText(/on dead tyres/i)).toBeInTheDocument();
  });

  it("warns when the tyre the player FINISHES on will not last", async () => {
    const user = userEvent.setup();
    render(<QuickRace drivers={DRIVERS} />);

    // Josh's plan: start medium, fit SOFTS at the stop. One stop only — so the
    // softs have to see it home, and they won't.
    await user.click(tyre("Soft")[1]); // second picker = "Fit at stop"
    expect(screen.getByText(/won't last/i)).toBeInTheDocument();
    expect(screen.getByText(/bring it home/i)).toBeInTheDocument();
  });

  it("pre-commits the safety-car call on the pit wall, boxing by default", async () => {
    const user = userEvent.setup();
    render(<QuickRace drivers={DRIVERS} />);

    // The default is what a real pit wall would do: take the cheap stop.
    const box = screen.getByRole("button", { name: /box for the cheap stop/i });
    const stay = screen.getByRole("button", { name: /stay out/i });
    expect(box).toHaveAttribute("aria-pressed", "true");
    expect(stay).toHaveAttribute("aria-pressed", "false");

    await user.click(stay);
    expect(stay).toHaveAttribute("aria-pressed", "true");
    expect(box).toHaveAttribute("aria-pressed", "false");
  });

  it("runs qualifying before the race, and shows every driver's lap", async () => {
    const user = userEvent.setup();
    render(<QuickRace drivers={DRIVERS} />);
    await user.click(screen.getByRole("button", { name: /lights out/i }));

    // The shootout was always in the sim; now the player sees it. Eight laps,
    // one of them pole, and a gap for everyone else.
    expect(screen.getByText(/qualifying/i)).toBeInTheDocument();
    expect(screen.getByText("POLE")).toBeInTheDocument();
    // Lap times, as M:SS.mmm.
    expect(screen.getAllByText(/^\d:\d\d\.\d\d\d$/)).toHaveLength(8);
    // Gaps to pole for the other seven.
    expect(screen.getAllByText(/^\+\d+\.\d\d\d$/)).toHaveLength(7);
  });

  it("goes racing from the grid", async () => {
    const user = userEvent.setup();
    render(<QuickRace drivers={DRIVERS} />);
    await user.click(screen.getByRole("button", { name: /lights out/i }));
    await user.click(screen.getByRole("button", { name: /to the grid/i }));

    expect(screen.getByText(/qualified/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new race/i })).toBeInTheDocument();
    // The timing tower is live.
    expect(screen.getByText(/^LEADER$/)).toBeInTheDocument();
  });

  it("locks contract drivers in the picker and defaults to a drivable seat", async () => {
    const user = userEvent.setup();
    // Only the bottom four are drivable (a fresh account, nothing signed).
    render(
      <QuickRace drivers={DRIVERS} usableDriverIds={[6, 7, 8, 9]} />
    );

    // The default pick is the best driver you're ALLOWED to run, not P1.
    expect(screen.getByRole("button", { name: /Billard/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    // The stars are visible but locked...
    const top = screen.getByRole("button", { name: /Palmowski/ });
    expect(top).toBeDisabled();
    expect(top).toHaveTextContent("Contract");
    await user.click(top);
    expect(top).toHaveAttribute("aria-pressed", "false");
    // ...and the way to them is signposted.
    expect(
      screen.getByRole("link", { name: /signed in the roster/i })
    ).toHaveAttribute("href", "/paddock/drivers");
  });

  it("banks the race through the server when a hookup exists", async () => {
    // The server mints the seed and settles the payout; the component must
    // send the committed plan and race on the seed it gets back. (Without
    // the hookup — every other test here — it races locally, unpaid.)
    const user = userEvent.setup();
    const runRace = vi.fn(async () => ({
      ok: true as const,
      seed: 424242,
      coinsEarned: 100,
      balance: 260,
      carLevels: { power: 0, aero: 0, reliability: 0, pitCrew: 0 },
      racesToday: 1,
    }));
    render(<QuickRace drivers={DRIVERS} runRace={runRace} />);
    await user.click(screen.getByRole("button", { name: /lights out/i }));

    expect(await screen.findByText(/qualifying/i)).toBeInTheDocument();
    expect(runRace).toHaveBeenCalledTimes(1);
    expect(runRace).toHaveBeenCalledWith({
      driverId: 1, // the top-ranked driver is the default pick
      strategy: expect.objectContaining({
        startCompound: "medium",
        boxUnderSafetyCar: true,
      }),
    });
  });
});
