import { useState } from "react";
import { useGameStore, DEFAULT_CHALLENGE_RULES, type ChallengeRules } from "@/store/gameStore";

type TimerPreset = { label: string; value: number | null };
type LimitPreset = { label: string; value: number | null };

const TIMER_PRESETS: readonly TimerPreset[] = [
  { label: "Aucun", value: null },
  { label: "60 s", value: 60_000 },
  { label: "120 s", value: 120_000 },
  { label: "180 s", value: 180_000 },
];

const LIMIT_PRESETS: readonly LimitPreset[] = [
  { label: "Illimité", value: null },
  { label: "1", value: 1 },
  { label: "3", value: 3 },
  { label: "5", value: 5 },
];

function pickInitial(stored: ChallengeRules | null): ChallengeRules {
  return stored ?? DEFAULT_CHALLENGE_RULES;
}

export function ChallengeConfigPhase() {
  const stored = useGameStore((s) => s.challengeRules);
  const confirmChallengeRules = useGameStore((s) => s.confirmChallengeRules);
  const backToMenu = useGameStore((s) => s.backToMenu);

  const [rules, setRules] = useState<ChallengeRules>(() => pickInitial(stored));

  function setTimer(value: number | null): void {
    setRules((r) => ({ ...r, timerMs: value }));
  }

  function setNotes(enabled: boolean): void {
    setRules((r) => ({ ...r, notesEnabled: enabled }));
  }

  function setLimit(value: number | null): void {
    setRules((r) => ({ ...r, listenLimit: value }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    confirmChallengeRules(rules);
  }

  return (
    <section className="challenge-config">
      <header>
        <p className="kicker">Mode Challenge</p>
        <h2>Configurer les règles</h2>
        <p className="reveal-notes">
          Joueur 1 fixe les contraintes imposées à Joueur 2 pour ce round.
        </p>
      </header>

      <form onSubmit={onSubmit} className="challenge-config-form">
        <fieldset className="challenge-config-field">
          <legend>Timer pour deviner</legend>
          <div className="chip-group" role="radiogroup" aria-label="Timer">
            {TIMER_PRESETS.map((preset) => {
              const selected = rules.timerMs === preset.value;
              return (
                <button
                  key={preset.label}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={selected ? "chip chip-selected" : "chip"}
                  onClick={() => setTimer(preset.value)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="challenge-config-field">
          <legend>Notes</legend>
          <div className="chip-group" role="radiogroup" aria-label="Notes">
            <button
              type="button"
              role="radio"
              aria-checked={rules.notesEnabled}
              className={rules.notesEnabled ? "chip chip-selected" : "chip"}
              onClick={() => setNotes(true)}
            >
              Activées
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!rules.notesEnabled}
              className={!rules.notesEnabled ? "chip chip-selected" : "chip"}
              onClick={() => setNotes(false)}
            >
              Désactivées
            </button>
          </div>
        </fieldset>

        <fieldset className="challenge-config-field">
          <legend>Ré-écoutes maximum</legend>
          <div className="chip-group" role="radiogroup" aria-label="Ré-écoutes">
            {LIMIT_PRESETS.map((preset) => {
              const selected = rules.listenLimit === preset.value;
              return (
                <button
                  key={preset.label}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={selected ? "chip chip-selected" : "chip"}
                  onClick={() => setLimit(preset.value)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="button-row">
          <button type="button" className="btn-secondary" onClick={backToMenu}>
            Annuler
          </button>
          <button type="submit">Lancer la partie</button>
        </div>
      </form>
    </section>
  );
}
