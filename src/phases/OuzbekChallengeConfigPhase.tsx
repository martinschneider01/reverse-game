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

// La règle notesEnabled est volontairement absente : la note de J2 est le
// pivot du jeu Ouzbek (J3 enregistre à partir d'elle), la désactiver casserait
// la chaîne (cf. PROJECT.md §3.13 — décision triage de #32).
function pickInitial(stored: ChallengeRules | null): ChallengeRules {
  if (stored === null) return { ...DEFAULT_CHALLENGE_RULES, notesEnabled: true };
  return { ...stored, notesEnabled: true };
}

function initialCustomTimer(stored: ChallengeRules | null): string {
  if (!stored || stored.timerMs === null) return "";
  if (TIMER_PRESETS.some((p) => p.value === stored.timerMs)) return "";
  return String(stored.timerMs / 1000);
}

function initialCustomLimit(stored: ChallengeRules | null): string {
  if (!stored || stored.listenLimit === null) return "";
  if (LIMIT_PRESETS.some((p) => p.value === stored.listenLimit)) return "";
  return String(stored.listenLimit);
}

function parseCustomSeconds(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1) return null;
  return n * 1000;
}

function parseCustomLimit(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export function OuzbekChallengeConfigPhase() {
  const stored = useGameStore((s) => s.challengeRules);
  const confirmChallengeRules = useGameStore((s) => s.confirmChallengeRules);
  const backToMenu = useGameStore((s) => s.backToMenu);

  const [rules, setRules] = useState<ChallengeRules>(() => pickInitial(stored));
  const [customTimer, setCustomTimer] = useState<string>(() => initialCustomTimer(stored));
  const [customLimit, setCustomLimit] = useState<string>(() => initialCustomLimit(stored));

  function selectTimerPreset(value: number | null): void {
    setRules((r) => ({ ...r, timerMs: value }));
    setCustomTimer("");
  }

  function selectLimitPreset(value: number | null): void {
    setRules((r) => ({ ...r, listenLimit: value }));
    setCustomLimit("");
  }

  function onCustomTimerChange(raw: string): void {
    setCustomTimer(raw);
    setRules((r) => ({ ...r, timerMs: parseCustomSeconds(raw) }));
  }

  function onCustomLimitChange(raw: string): void {
    setCustomLimit(raw);
    setRules((r) => ({ ...r, listenLimit: parseCustomLimit(raw) }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    confirmChallengeRules(rules);
  }

  const timerPresetActive = customTimer === "";
  const limitPresetActive = customLimit === "";

  return (
    <section className="challenge-config">
      <header>
        <p className="kicker">Ouzbek Challenge</p>
        <h2>Configurer les règles</h2>
        <p className="reveal-notes">
          Les contraintes s'appliquent à Joueur 2 (transcription) et Joueur 4 (devinage final).
        </p>
      </header>

      <form onSubmit={onSubmit} className="challenge-config-form">
        <fieldset className="challenge-config-field">
          <legend>Timer par phase de devinage</legend>
          <div className="chip-group" role="radiogroup" aria-label="Timer">
            {TIMER_PRESETS.map((preset) => {
              const selected = timerPresetActive && rules.timerMs === preset.value;
              return (
                <button
                  key={preset.label}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={selected ? "chip chip-selected" : "chip"}
                  onClick={() => selectTimerPreset(preset.value)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <label className="challenge-config-custom">
            <span>Personnalisé (secondes)</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="ex. 90"
              value={customTimer}
              onChange={(e) => onCustomTimerChange(e.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className="challenge-config-field">
          <legend>Ré-écoutes maximum par phase</legend>
          <div className="chip-group" role="radiogroup" aria-label="Ré-écoutes">
            {LIMIT_PRESETS.map((preset) => {
              const selected = limitPresetActive && rules.listenLimit === preset.value;
              return (
                <button
                  key={preset.label}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={selected ? "chip chip-selected" : "chip"}
                  onClick={() => selectLimitPreset(preset.value)}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <label className="challenge-config-custom">
            <span>Personnalisé</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="ex. 7"
              value={customLimit}
              onChange={(e) => onCustomLimitChange(e.target.value)}
            />
          </label>
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
