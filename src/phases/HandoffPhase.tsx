export type HandoffPhaseProps = {
  /** Numéro du joueur qui prend le téléphone (2, 3 ou 4). */
  player: 2 | 3 | 4;
  /** Liste des autres joueurs à inclure dans la consigne ("ne regardez pas l'écran"). */
  others: ReadonlyArray<number>;
  /** Action déclenchée par le bouton de confirmation. */
  onContinue: () => void;
};

export function HandoffPhase({ player, others, onContinue }: HandoffPhaseProps) {
  const othersText = others.length > 1 ? `Joueurs ${others.join(", ")}` : `Joueur ${others[0]}`;
  return (
    <section>
      <p className="kicker">Hand-off</p>
      <h2>Joueur {player}, prends le téléphone</h2>
      <p>{othersText} : ne regardez pas l'écran.</p>
      <button type="button" onClick={onContinue}>
        C'est moi, J{player}
      </button>
    </section>
  );
}
