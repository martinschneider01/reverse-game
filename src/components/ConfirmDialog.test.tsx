import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

describe("<ConfirmDialog />", () => {
  it("renders title, message, and the two action buttons", () => {
    render(
      <ConfirmDialog
        title="Êtes-vous sûr ?"
        message="Cette action est définitive."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { name: /êtes-vous sûr/i })).toBeInTheDocument();
    expect(screen.getByText(/cette action est définitive/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /annuler/i })).toBeInTheDocument();
  });

  it("uses custom labels when provided", () => {
    render(
      <ConfirmDialog
        title="Démarrer"
        confirmLabel="Lancer"
        cancelLabel="Retour"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /lancer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retour/i })).toBeInTheDocument();
  });

  it("clicking confirm calls onConfirm", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog title="t" onConfirm={onConfirm} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: /confirmer/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("clicking cancel calls onCancel", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog title="t" onConfirm={onConfirm} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: /annuler/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("clicking the backdrop calls onCancel", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog title="t" onConfirm={onConfirm} onCancel={onCancel} />);
    await user.click(screen.getByTestId("confirm-dialog-backdrop"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("clicking inside the dialog body does NOT call onCancel", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog title="t" message="hello" onConfirm={onConfirm} onCancel={onCancel} />);
    await user.click(screen.getByRole("dialog"));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("pressing Escape calls onCancel", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog title="t" onConfirm={onConfirm} onCancel={onCancel} />);
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("auto-focuses the cancel button on mount", () => {
    render(<ConfirmDialog title="t" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /annuler/i })).toHaveFocus();
  });

  it("applies the danger variant class to confirm when requested", () => {
    render(
      <ConfirmDialog title="t" confirmVariant="danger" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /confirmer/i })).toHaveClass("btn-danger");
  });

  it("renders children inside the dialog body when provided", () => {
    render(
      <ConfirmDialog title="t" onConfirm={vi.fn()} onCancel={vi.fn()}>
        <p data-testid="custom-child">extra content</p>
      </ConfirmDialog>,
    );
    expect(screen.getByTestId("custom-child")).toBeInTheDocument();
  });
});
