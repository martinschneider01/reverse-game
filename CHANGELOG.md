# Changelog

Décisions structurelles modifiées par rapport à la version initiale de `PROJECT.md`. Une entrée par décision révisée, datée, justifiée. Format libre (pas de Keep-a-Changelog).

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
