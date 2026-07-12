// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { QuickRace } from "../components/paddock/QuickRace";
import type { RatedDriver } from "../lib/paddock/ratings";

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

  it("goes racing when the player commits", async () => {
    const user = userEvent.setup();
    render(<QuickRace drivers={DRIVERS} />);
    await user.click(screen.getByRole("button", { name: /lights out/i }));

    // The grid came from qualifying, so the player has a real starting slot.
    expect(screen.getByText(/qualified/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new race/i })).toBeInTheDocument();
  });
});
