# Changelog

Décisions structurelles modifiées par rapport à la version initiale de `PROJECT.md`. Une entrée par décision révisée, datée, justifiée. Format libre (pas de Keep-a-Changelog).

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
