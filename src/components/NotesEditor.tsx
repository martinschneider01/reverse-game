export type NotesEditorProps = {
  value: string;
  onChange: (next: string) => void;
};

export function NotesEditor({ value, onChange }: NotesEditorProps) {
  return (
    <label>
      Notes
      <textarea
        aria-label="Notes"
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
