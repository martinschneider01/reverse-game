import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdatePrompt } from "./UpdatePrompt";
import { INITIAL_PWA_STATE, usePwaStore } from "@/store/pwaStore";

describe("<UpdatePrompt />", () => {
  beforeEach(() => {
    usePwaStore.setState({ ...INITIAL_PWA_STATE, acceptUpdate: async () => {} });
  });

  it("renders nothing when no update is pending", () => {
    const { container } = render(<UpdatePrompt />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the banner with a Recharger button when needsRefresh flips to true", () => {
    usePwaStore.getState().setNeedsRefresh(true);
    render(<UpdatePrompt />);

    expect(screen.getByText(/nouvelle version disponible/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /recharger/i })).toBeInTheDocument();
  });

  it("calls acceptUpdate when the user clicks Recharger and reflects the loading state", async () => {
    const user = userEvent.setup();
    const pending = Promise.withResolvers<void>();
    const acceptUpdate = vi.fn(() => pending.promise);
    usePwaStore.setState({ needsRefresh: true, acceptUpdate });

    render(<UpdatePrompt />);
    const reload = screen.getByRole("button", { name: /^recharger$/i });
    await user.click(reload);

    expect(acceptUpdate).toHaveBeenCalledTimes(1);
    // While the SW handshake is in flight, the button is disabled with a
    // "Rechargement…" label so the user doesn't double-click and confuse the
    // reload handshake.
    const reloading = screen.getByRole("button", { name: /rechargement/i });
    expect(reloading).toBeDisabled();

    pending.resolve();
  });
});
