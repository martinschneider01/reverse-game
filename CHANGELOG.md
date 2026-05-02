# Changelog

Décisions structurelles modifiées par rapport à la version initiale de `PROJECT.md`. Une entrée par décision révisée, datée, justifiée. Format libre (pas de Keep-a-Changelog).

## 2026-05-02 — Mode Téléphone Ouzbek — phases, store, persistance, hand-offs, fusion de l'ancien Mode 2

**Quoi** : design slice (#25) pour le futur Mode Téléphone Ouzbek — variante 4-joueurs en chaîne où J2 et J4 écoutent en reverse, J3 ré-enregistre depuis une note. Aucun code produit ; cette entrée trace les décisions documentées en §3.13 de `PROJECT.md`.

**Décisions PROJECT.md affectées** :
- §1 (Vision) — l'ancien "Mode 2 — Téléphone arabe" est absorbé dans Mode Téléphone Ouzbek (le double-twist d'inversion remplace la transcription phonétique pure) ; nouvelle section "Mode Téléphone Ouzbek".
- §3.13 (NOUVELLE) — enum de phases, schéma store, actions Zustand, règle "P3 sans accès reverse", persistance IndexedDB, copy hand-off, reuse vs duplication.
- §5.1 (state machine) — phases ajoutées (`recordingP1`, `handoffP2`, `guessingP2`, `handoffP3`, `recordingP3`, `handoffP4`, `guessingP4`, `revealOuzbek`) et discrimination via le champ `mode`.
- §5.2 (store) — champs Ouzbek séparés (`ouzbekRecordingP1`, `ouzbekNoteP2`, `ouzbekRecordingP3`) plutôt que réutilisation des champs Mode 1, et nouveau champ discriminant `mode: 'mode1' | 'ouzbek'`.
- §11 (glossaire) — Joueur 3, Joueur 4, Mode défini.

**Pourquoi** : sans schéma figé, chaque slice (#27 tracer bullet, #31 reveal, #32 Challenge variant) re-déciderait du nommage des phases, de la sémantique du store, et de l'enforcement de la règle "P3 sans reverse" — au risque de produire des PRs incompatibles. La fusion de l'ancien Mode 2 dans Mode Ouzbek élimine un mode redondant : l'inversion audio est l'identité du jeu, un mode "téléphone arabe sans inversion" n'apporte rien de spécifique.

**Comment (résumé des décisions clés)** :
- **Phase enum étendu** par 8 phases Ouzbek dans le même `Phase` plat (pas de FSM imbriquée). Discrimination des transitions partagées (`permissionGranted`) via un champ `mode: 'mode1' | 'ouzbek'` au store.
- **Champs Ouzbek séparés** (vs réutilisation de `originalRecording / notes / guessRecording`). Why : sémantique trop différente, le coût de 3 fields est inférieur au coût mental d'un mapping cross-mode.
- **"P3 sans reverse"** : prop existante `lockDirection="forward"` sur `<AudioPlayer />` (la sémantique est exacte — `reverseDisabled = lockDirection === "forward" || disabled`). Pas de nouveau prop, pas de fork.
- **Persistance** : champs optionnels lus avec `?? null` / `?? ""`, pas de bump de version (cohérent avec le pattern `challengeRules` / `guessingStartedAt` de #26 / #28). Phases persistables Ouzbek = toutes sauf `recordingP1` et `recordingP3` (enregistrement actif non-reprenable). Mode persisté pour rehydrater dans la bonne branche.
- **Reveal** : `RevealOuzbekPhase` séparé, pas de fork de `RevealPhase`. Factorisation après #32 si gênante.
- **Hand-offs explicites** entre J2/J3/J4 ; pas de hand-off pour J1 entrant (symétrique à Mode 1 sans hand-off avant `recordingA`).

**Anti-goals préservés** : pas de scoring/win-lose en Ouzbek non plus, pas d'abstraction `Round` générique, pas de FSM imbriquée par mode, pas de routeur ajouté.

**Slices débloquées** : #27 (tracer bullet end-to-end), #31 (reveal enrichi, dépendant de #27), #32 (Ouzbek Challenge, dépendant de #27 + #28 + #30).

**Décisions explicitement reportées** : layout exact du reveal (#31), mapping `ChallengeRules ↔ phases Ouzbek` et compteurs de ré-écoutes par phase (#32), modal de confirmation avant `revealOuzbekChain` (option, #27).

## 2026-05-02 — Mode Challenge — schéma de règles, phase de config, fusion de l'ancien Mode 3

**Quoi** : design slice (#24) pour le futur Mode Challenge — variante de Mode 1 avec règles configurables (timer, notes activées, limite ré-écoutes). Aucun code produit ; cette entrée trace les décisions documentées en §3.12 de `PROJECT.md`.

**Décisions PROJECT.md affectées** :
- §1 (Vision) — l'ancien "Mode 3 — écoutes limitées" est absorbé dans Mode Challenge ; nouvelle section "Mode Challenge".
- §3.12 (NOUVELLE) — schéma `ChallengeRules`, intégration au store, comportement de chaque règle, persistance du timer.
- §5.1 (state machine) — nouvelle phase `challengeConfig` ajoutée à l'enum `Phase`.
- §10 (roadmap) — v0.2 = Mode Challenge, v0.3 = Mode Téléphone Ouzbek, v0.4 = Ouzbek Challenge.

**Pourquoi** : sans schéma figé, chaque slice d'implémentation (#26 #28 #29 #30) re-déciderait du nom des champs et de leur sémantique, créant des frictions de merge. Avec un design en place, ces slices sont des tracer-bullets bien définis. La fusion de l'ancien Mode 3 dans Mode Challenge supprime un mode redondant : la règle "limite ré-écoutes" n'a pas besoin d'être un mode à elle seule.

**Comment** :
- `ChallengeRules` = `{ timerMs: number | null, notesEnabled: boolean, listenLimit: number | null }`. `null` partout = comportement Mode 1 (utile pour le tracer bullet de #26).
- Store : ajout de `challengeRules: ChallengeRules | null` au `GameState`, actions `startChallenge` / `confirmChallengeRules`. `newRound` conserve les règles (round suivant dans le même mode), `backToMenu` les reset.
- Phase `challengeConfig` ajoutée entre `menu` et `permission` — un écran de premier plan, pas un overlay (ceci justifie une phase plutôt qu'un `<ConfirmDialog>`).
- Persistance : `challengeRules` ajouté à `PersistedState` (le slice d'implémentation choisira entre bumper `version: 2` avec migration ou champ optionnel). Pour le timer : `guessingStartedAt: number | null` epoch ms, calcul du remaining à la rehydratation.
- Comportement timer expiry : transition forcée `guessing --> reveal` (pas d'écran intermédiaire). Timer ne pause pas pendant les ré-écoutes (wall-clock). À ajuster post-HITL si trop brutal / trop dur.
- Reveal : conditionne le rendu sur `challengeRules` sans forker le composant (pas d'abstraction prématurée — cf. §3.7).

**Anti-goals préservés** : pas de scoring/win-lose même en Challenge, pas de `<RevealMode1>` / `<RevealChallenge>` séparés, pas d'extraction prématurée de `<ConfigScreen />` générique avant que Mode Ouzbek (#27) montre la duplication réelle.

**Slices débloquées** : #26 (squelette + écran config), #28 (timer), #29 (notes off), #30 (ré-écoutes), et indirectement #32 (Ouzbek Challenge).

## 2026-05-02 — Confirmation "Êtes-vous sûr ?" en modal au-dessus de l'écran de devinage

**Quoi** : la phase `confirmEnd` n'est plus rendue en plein écran (composant `ConfirmEndPhase` supprimé). À la place, `App.tsx` rend `<GuessingPhase>` ET un `<ConfirmDialog>` overlay quand `phase === 'confirmEnd'`. La state machine et le schéma de persistance IndexedDB sont inchangés.

**Décision PROJECT.md affectée** : §3.4 (fin de round et révélation).

**Pourquoi** : un plein-écran cassait le contexte visuel (notes, recording, compteur disparaissaient pendant la confirmation). Un modal préserve le contexte derrière le backdrop. Bonus : on extrait un `<ConfirmDialog>` réutilisable qui servira aux écrans de configuration des futurs modes Challenge (#26) et Ouzbek (#27).

**Comment** :
- `src/components/ConfirmDialog.tsx` : composant générique avec backdrop cliquable (= annulation), Escape (= annulation), focus initial sur le bouton "Annuler", titre + message + variantes de bouton (`primary` / `danger`), support de `children` pour du contenu custom.
- `src/App.tsx` : `phase === 'guessing' || phase === 'confirmEnd'` rend `<GuessingPhase>` ; `phase === 'confirmEnd'` rend en plus le `<ConfirmDialog>`.
- Phase `confirmEnd` **conservée** dans l'enum et les actions du store (`endGuessing`, `cancelEnd`, `confirmEnd`). Why: éviter une migration du schéma IDB et préserver la reprise après lock screen pendant la modal.
- `ConfirmEndPhase.tsx` et son test supprimés (rendu remplacé par la composition App.tsx + ConfirmDialog).

## 2026-05-02 — Persistance IndexedDB d'un round actif

**Quoi** : un round actif (phases `guessing`, `confirmEnd`, `reveal`) est persisté en IndexedDB et restauré à l'ouverture suivante de l'app.

**Décisions PROJECT.md affectées** :
- §2 anti-goal "pas de persistance" — révisé, voir entrée biffée.
- §3.5 "tout en mémoire, volatile" — remplacé par la stratégie de persistance détaillée.

**Pourquoi** : sur mobile (iOS Safari surtout), le verrouillage de l'écran pendant quelques minutes suffit à faire décharger la PWA en arrière-plan. Sans persistance, ça équivaut à un refresh — le round est perdu. Le scénario d'usage (téléphone qui passe entre joueurs en soirée) implique fréquemment des temps morts pendant lesquels l'écran se verrouille.

**Comment** :
- `Recording` étend désormais `{ forward, reverse, durationMs }` avec un `blob: Blob` (le WebM/Opus source, déjà produit par `MediaRecorder`).
- `src/store/persistence.ts` : interface étroite `loadPersistedState / savePersistedState / clearPersistedState`. Sérialisation `Blob → { ArrayBuffer + mimeType }` pour portabilité tests (fake-indexeddb).
- `src/store/persistGameStore.ts` : abonnement Zustand debouncé 200ms ; sauvegarde uniquement si phase savable + recording présent, sinon `clear`.
- `App.tsx` : à l'init, charge l'état persisté, re-`decodeAudioData` les blobs, re-`reverseBuffer`, hydrate le store. L'abonnement de sauvegarde se monte après l'hydratation. Échec d'hydratation → fallback `menu`.

**Anti-goals préservés** : pas d'historique multi-parties (un seul round persisté à la fois), pas de scoring, pas de tracking. La persistance ne couvre que le round courant.

**Dépendance ajoutée** : `fake-indexeddb` (devDependency) pour tester `persistence.ts` sous jsdom.
