import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotesEditor } from "./NotesEditor";

describe("<NotesEditor />", () => {
  it("renders the current value and emits onChange when the user types", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NotesEditor value="" onChange={onChange} />);

    const textarea = screen.getByRole("textbox", { name: /notes/i });
    expect(textarea).toHaveValue("");

    await user.type(textarea, "ab");

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls.map((call) => call[0])).toEqual(["a", "b"]);
  });

  it("displays the controlled value", () => {
    render(<NotesEditor value="hypothèse" onChange={() => {}} />);
    expect(screen.getByRole("textbox", { name: /notes/i })).toHaveValue("hypothèse");
  });
});
