// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormSpark } from "../components/FormSpark";

describe("FormSpark", () => {
  it("renders one bar per round with an accessible summary", () => {
    const { container } = render(
      <FormSpark values={[12, 20, 30]} roundNumbers={[1, 2, 3]} max={30} />
    );
    expect(
      screen.getByRole("img", { name: "Form: R1 12 pts, R2 20 pts, R3 30 pts" })
    ).toBeInTheDocument();
    expect(container.querySelectorAll("rect")).toHaveLength(3);
  });

  it("marks the latest round's bar in accent, earlier rounds muted", () => {
    const { container } = render(
      <FormSpark values={[12, 20, 30]} roundNumbers={[1, 2, 3]} max={30} />
    );
    const rects = [...container.querySelectorAll("rect")];
    expect(rects[0]).toHaveClass("fill-muted");
    expect(rects[1]).toHaveClass("fill-muted");
    expect(rects[2]).toHaveClass("fill-accent");
  });

  it("scales bar heights against the shared max", () => {
    const { container } = render(
      <FormSpark values={[15, 30]} roundNumbers={[1, 2]} max={30} />
    );
    const [half, full] = [...container.querySelectorAll("rect")];
    expect(half.getAttribute("height")).toBe("9"); // 15/30 of 18px
    expect(full.getAttribute("height")).toBe("18");
  });

  it("renders a did-not-race round as a baseline tick and says so", () => {
    const { container } = render(
      <FormSpark values={[null, null, 62]} roundNumbers={[1, 2, 3]} max={62} />
    );
    expect(
      screen.getByRole("img", { name: "Form: R1 —, R2 —, R3 62 pts" })
    ).toBeInTheDocument();
    const rects = [...container.querySelectorAll("rect")];
    expect(rects[0]).toHaveClass("fill-border-strong");
    expect(rects[0].getAttribute("height")).toBe("2");
    expect(rects[2]).toHaveClass("fill-accent");
  });

  it("clamps a negative weekend to the 2px baseline instead of drawing downward", () => {
    const { container } = render(
      <FormSpark values={[-5, 30]} roundNumbers={[1, 2]} max={30} />
    );
    const [neg] = [...container.querySelectorAll("rect")];
    expect(neg.getAttribute("height")).toBe("2");
  });

  it("renders nothing when there is no data at all", () => {
    const { container: empty } = render(
      <FormSpark values={[]} roundNumbers={[]} max={1} />
    );
    expect(empty.querySelector("svg")).toBeNull();

    const { container: allNull } = render(
      <FormSpark values={[null, null]} roundNumbers={[1, 2]} max={1} />
    );
    expect(allNull.querySelector("svg")).toBeNull();
  });
});
