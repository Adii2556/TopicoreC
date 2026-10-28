import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";

describe("application fallback pages", () => {
  it("offers a working retry without exposing the underlying error", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    render(<ErrorPage error={new Error("sensitive internal detail")} reset={reset} />);

    expect(
      screen.getByRole("heading", { name: "Topicore could not display this page." }),
    ).toBeVisible();
    expect(screen.queryByText(/sensitive internal detail/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("returns an unknown route to the generator", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "This page does not exist." })).toBeVisible();
    expect(screen.getByRole("link", { name: "Return to generator" })).toHaveAttribute("href", "/");
  });
});
