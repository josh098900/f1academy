// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TeamPicker } from "../components/team/TeamPicker";
import type { LineupDriver } from "../lib/queries";

// Compact fixture grid. Prices chosen so the four premiums (Alpha…Delta,
// £44M) bust the £40M cap while plenty of valid combinations exist.
function driver(id: number, lastName: string, price: number): LineupDriver {
  return {
    driverId: id,
    fullName: `Test ${lastName}`,
    shortName: `T. ${lastName}`,
    lastName,
    countryCode: "GB",
    avatarUrl: null,
    carNumber: id,
    team: "Testline",
    f1Partner: null,
    isWildcard: false,
    price,
  };
}

const LINEUP: LineupDriver[] = [
  driver(1, "Alpha", 14.0),
  driver(2, "Bravo", 12.0),
  driver(3, "Charlie", 10.0),
  driver(4, "Delta", 8.0),
  driver(5, "Echo", 5.0),
  driver(6, "Foxtrot", 4.0),
];

const okSave = () => vi.fn(async () => ({ ok: true as const }));

// A driver card is an article with role="button" whose accessible name
// contains the last name. Looking it up by role (not getByText) avoids the
// duplicate match with the sticky bar's "Boost <name>" readout, which repeats
// the boosted driver's last name.
function card(lastName: string): HTMLElement {
  return screen.getByRole("button", {
    name: new RegExp(`\\b${lastName}\\b`),
  });
}

function boostToggle(lastName: string): HTMLElement {
  return within(card(lastName)).getByRole("button", {
    name: "Boost (2× points)",
  });
}

async function pick(user: ReturnType<typeof userEvent.setup>, names: string[]) {
  for (const name of names) await user.click(card(name));
}

const saveButton = () => screen.getByRole("button", { name: /^(Save team|Saved|Saving…)$/ });

describe("TeamPicker", () => {
  it("starts empty: 0/4 picked, zero budget, save disabled", () => {
    render(<TeamPicker lineup={LINEUP} onSave={okSave()} />);
    expect(screen.getByText("0/4 picked")).toBeInTheDocument();
    expect(screen.getByText("£0.0M / £40.0M")).toBeInTheDocument();
    expect(screen.getByText("Pick 4 more")).toBeInTheDocument();
    // Nothing dirty yet, so the button reads "Saved" and is disabled.
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
  });

  it("selecting drivers updates the count and budget", async () => {
    const user = userEvent.setup();
    render(<TeamPicker lineup={LINEUP} onSave={okSave()} />);
    await pick(user, ["Charlie", "Delta"]);
    expect(screen.getByText("2/4 picked")).toBeInTheDocument();
    expect(screen.getByText("£18.0M / £40.0M")).toBeInTheDocument();
    expect(screen.getByText("Pick 2 more")).toBeInTheDocument();
  });

  it("deselecting a picked driver frees the slot", async () => {
    const user = userEvent.setup();
    render(<TeamPicker lineup={LINEUP} onSave={okSave()} />);
    await pick(user, ["Charlie", "Delta"]);
    await user.click(card("Charlie"));
    expect(screen.getByText("1/4 picked")).toBeInTheDocument();
    expect(screen.getByText("£8.0M / £40.0M")).toBeInTheDocument();
  });

  it("with a full squad, an unselected driver can't be added", async () => {
    const user = userEvent.setup();
    render(<TeamPicker lineup={LINEUP} onSave={okSave()} />);
    await pick(user, ["Charlie", "Delta", "Echo", "Foxtrot"]);
    expect(screen.getByText("4/4 picked")).toBeInTheDocument();
    await user.click(card("Alpha")); // disabled — count must hold
    expect(screen.getByText("4/4 picked")).toBeInTheDocument();
  });

  it("asks for a boost once four are picked, then reports Team ready", async () => {
    const user = userEvent.setup();
    render(<TeamPicker lineup={LINEUP} onSave={okSave()} />);
    await pick(user, ["Charlie", "Delta", "Echo", "Foxtrot"]);
    expect(screen.getByText("Tap 2× to choose your boost")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    await user.click(boostToggle("Charlie"));
    expect(screen.getByText("Team ready")).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it("flags an over-budget squad and blocks saving", async () => {
    const user = userEvent.setup();
    render(<TeamPicker lineup={LINEUP} onSave={okSave()} />);
    await pick(user, ["Alpha", "Bravo", "Charlie", "Delta"]); // £44M
    await user.click(boostToggle("Alpha"));
    expect(screen.getByText("Over budget by £4.0M")).toBeInTheDocument();
    expect(screen.getByText("£44.0M / £40.0M")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("clears the boost when its driver is deselected", async () => {
    const user = userEvent.setup();
    render(<TeamPicker lineup={LINEUP} onSave={okSave()} />);
    await pick(user, ["Charlie", "Delta", "Echo", "Foxtrot"]);
    await user.click(boostToggle("Echo"));
    expect(screen.getByText("Team ready")).toBeInTheDocument();

    await user.click(card("Echo")); // deselect the boosted driver
    expect(screen.getByText("3/4 picked")).toBeInTheDocument();
    expect(screen.getByText("Pick 1 more")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("saves a valid team with the exact payload and confirms", async () => {
    const user = userEvent.setup();
    const onSave = okSave();
    render(<TeamPicker lineup={LINEUP} onSave={onSave} />);
    await pick(user, ["Charlie", "Delta", "Echo", "Foxtrot"]);
    await user.click(boostToggle("Delta"));
    await user.click(saveButton());

    expect(await screen.findByText("Team saved ✓")).toBeInTheDocument();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      driverIds: [3, 4, 5, 6],
      boostDriverId: 4,
      wildcard: false,
    });
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
  });

  it("surfaces a server rejection inline", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({
      ok: false as const,
      error: "Selection has locked for this round.",
    }));
    render(<TeamPicker lineup={LINEUP} onSave={onSave} />);
    await pick(user, ["Charlie", "Delta", "Echo", "Foxtrot"]);
    await user.click(boostToggle("Charlie"));
    await user.click(saveButton());

    expect(
      await screen.findByText("Selection has locked for this round.")
    ).toBeInTheDocument();
  });

  it("counts transfers against the baseline and shows the penalty", async () => {
    const user = userEvent.setup();
    render(
      <TeamPicker
        lineup={LINEUP}
        baseline={[1, 2, 3, 4]}
        initialSelected={[1, 2, 3, 4]}
        initialBoost={1}
        onSave={okSave()}
      />
    );
    // The transfers readout, scoped by its label ("1" alone also matches
    // Alpha's car number). Swap Delta -> Echo (1 transfer, free), then
    // Bravo -> Foxtrot (2nd, penalised -10).
    const transfers = () => screen.getByText("Transfers", { exact: false });
    await user.click(card("Delta"));
    await user.click(card("Echo"));
    expect(transfers()).toHaveTextContent(/Transfers\s*1/);
    expect(transfers()).not.toHaveTextContent("pts");

    await user.click(card("Bravo"));
    await user.click(card("Foxtrot"));
    expect(transfers()).toHaveTextContent(/Transfers\s*2/);
    expect(transfers()).toHaveTextContent("−10 pts");
  });

  it("wildcard flow: confirm dialog, then transfers are penalty-free", async () => {
    const user = userEvent.setup();
    render(
      <TeamPicker
        lineup={LINEUP}
        baseline={[1, 2, 3, 4]}
        initialSelected={[1, 2, 3, 4]}
        initialBoost={1}
        onSave={okSave()}
      />
    );
    await user.click(screen.getByRole("button", { name: "Play wildcard" }));
    const dialog = screen.getByRole("dialog", { name: "Play your wildcard" });
    expect(
      within(dialog).getByText(/unlimited transfers this round/)
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Play wildcard" })
    );

    expect(
      screen.getByRole("button", { name: "Wildcard on ✓" })
    ).toBeInTheDocument();
    // Two swaps, no penalty line — the wildcard tag shows instead.
    await user.click(card("Delta"));
    await user.click(card("Echo"));
    await user.click(card("Bravo"));
    await user.click(card("Foxtrot"));
    expect(screen.getByText("· wildcard")).toBeInTheDocument();
    expect(screen.queryByText(/−\d+ pts/)).not.toBeInTheDocument();
  });

  it("offers no wildcard chip when it was spent in a prior round", () => {
    render(
      <TeamPicker
        lineup={LINEUP}
        baseline={[1, 2, 3, 4]}
        initialSelected={[1, 2, 3, 4]}
        initialBoost={1}
        wildcardUsedInPriorRound
        onSave={okSave()}
      />
    );
    expect(
      screen.queryByRole("button", { name: "Play wildcard" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Wildcard used")).toBeInTheDocument();
  });

  it("a wildcard already saved on this round is sticky (not a button)", () => {
    render(
      <TeamPicker
        lineup={LINEUP}
        baseline={[1, 2, 3, 4]}
        initialSelected={[1, 2, 3, 4]}
        initialBoost={1}
        initialWildcard
        onSave={okSave()}
      />
    );
    const badge = screen.getByText("Wildcard active ✓");
    expect(badge.closest("button")).toBeNull();
  });
});
