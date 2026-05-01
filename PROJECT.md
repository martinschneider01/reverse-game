# Reverso

Party-game vocal où un joueur enregistre une phrase, l'app l'inverse, et un autre joueur doit deviner la phrase originale en n'entendant que la version inversée.

Ce fichier est la **source unique de vérité** pour les agents (et humains) qui interviennent sur le projet. Lis-le en entier avant d'implémenter ou de proposer des changements structurants.

---

## 1. Vision & Game Design

### Concept

Un jeu local où :
1. Un joueur **A** s'éloigne et enregistre une courte phrase au micro (ex: "Bonjour les amis !").
2. L'app inverse l'audio.
3. Un joueur **B** n'entend que l'inversion, et doit reconstituer la phrase originale.
4. B dispose d'outils (ré-écoutes, notes, enregistrement de sa propre voix à l'endroit/envers, contrôle de vitesse) pour décoder.
5. Quand B est prêt, il propose sa réponse à voix haute. La résolution se fait oralement entre les joueurs (l'app ne juge rien).
6. L'app révèle ensuite l'enregistrement original, le dernier essai de B, et les notes — tous lisibles dans les deux sens.

### Mode 1 — Solo Reverse (MVP)

Le mode décrit ci-dessus. **C'est le seul mode implémenté en v1.** Les autres modes sont prévus mais hors scope MVP.

### Mode 2 — Téléphone arabe (futur, v0.2)

- Joueur 1 enregistre une phrase.
- Joueur 2 écoute, prend des notes phonétiques (avec indications d'intonation).
- Joueur 3 lit les notes et enregistre un nouveau vocal en suivant les indications.
- Joueur 4 écoute (autant qu'il veut) et propose sa devinette.
- Implique une étape "transcription phonétique" (texte) qui n'existe pas en Mode 1.

### Mode 3 — Écoutes limitées (futur, v0.3)

Variante de Mode 1 où le joueur A configure un **nombre maximum d'écoutes** pour B. Le compteur déjà affiché en Mode 1 (cf. §3.1 décisions) devient bloquant.

### Mode futur — Multijoueur en ligne (lointain, hors roadmap)

Partage d'un lien à un autre joueur, partie asynchrone ou en temps réel. **Ne pas pré-architecturer pour ça** dans le MVP — on traitera quand on y sera.

---

## 2. Anti-goals (ce qu'on ne fait PAS en v1)

Liste explicite pour empêcher tout agent de réintroduire ces idées par défaut.

- **Pas de persistance** — ni IndexedDB, ni localStorage pour les recordings/notes. Tout est en mémoire (Zustand). Un refresh = partie perdue. Documenté et accepté.
- **Pas d'historique de parties.** Quand on revient au menu, tout est oublié.
- **Pas de scoring, pas de tracking win/lose.** L'app reste neutre, les joueurs s'organisent eux-mêmes.
- **Pas de système de joueurs nommés / rôles persistants.** Le téléphone change de main physiquement, c'est tout.
- **Pas de routeur (pas de TanStack Router).** Machine à état Zustand pour les phases.
- **Pas de CI (GitHub Actions).** Les pre-commit hooks tiennent ce rôle pour le MVP.
- **Pas d'i18n.** UI en français hardcodé.
- **Pas de tests E2E sur du vrai audio.** Trop coûteux. Logique pure 100% testée + mocks.
- **Pas de pitch-preservation** sur le contrôle de vitesse — la vitesse change la hauteur (effet "tape physique"), c'est un choix.
- **Pas d'abstraction "Round" générique** dès le MVP. On extrait des **primitives** (composants, fonctions pures) et on factorisera quand Mode 2 fera apparaître la duplication réelle.
- **Pas d'ADRs séparés** pour le moment. Tout est dans ce PROJECT.md.

---

## 3. Décisions clés et trade-offs

Chaque décision est suivie d'un `Why:` court. Si tu envisages d'aller à l'inverse, lis le `Why:` d'abord.

### 3.1 Plateforme

- **Mobile-first PWA, installable, offline-capable une fois chargée.** Why: scénario d'usage = un téléphone qui passe entre joueurs en soirée. Desktop reste fonctionnel via responsive simple.

### 3.2 Pass-and-play UX

- **Hand-off explicite entre joueurs** : quand A doit enregistrer, écran dédié "Joueur A, éloigne-toi pour enregistrer". Why: si B entend A enregistrer, le jeu n'a aucun sens. On résout ça par contrat de jeu (règle UX), pas par tech.
- **Phases distinctes avec écrans de transition** : Menu → Hand-off A → Enregistrement A → Hand-off B → Devinage → Confirmation Fin → Révélation.

### 3.3 Boîte à outils du joueur B

- **Ré-écoutes illimitées en Mode 1**, avec compteur informatif non bloquant.
- **Une seule prise de B** (qu'il écrase à chaque nouvel enregistrement). Why: simplicité, et le user a explicitement préféré ça.
- **Notes en textarea simple multi-ligne**, persistantes pendant le round, **affichées dans la révélation finale**.
- **Slider de vitesse continu de 0.25× à 2×** avec snap léger sur 1×, sans pitch-preserve. S'applique sur le player générique → marche pour A, pour B, et pour les players de la révélation.

### 3.4 Fin de round et révélation

- **Bouton "Fin"** avec confirmation ("Êtes-vous sûr ?"). Why: le user veut une protection contre le clic accidentel.
- **Écran de révélation** : (1) le vocal original de A — lisible à l'endroit ET à l'envers, (2) le dernier vocal de B — lisible à l'endroit ET à l'envers, (3) les notes en texte, (4) bouton "Nouvelle partie", (5) bouton "Retour à l'accueil". **Tous les players du reveal supportent un toggle direction.**
- **Pas de tracking win/lose**, pas de cérémonie 🎉 / 😅.

### 3.5 Persistance et permissions

- **Tout en mémoire (Zustand), volatile.** Un refresh perd le round.
- **Demande de permission micro au "Démarrer une partie"**, pas au lancement de l'app.
- **Si refus du micro** : écran d'erreur dédié, instructions courtes spécifiques au navigateur, bouton "Réessayer".

### 3.6 Audio

- **Durée max 15 secondes** par enregistrement en Mode 1. Why: phrases courtes = cœur du fun, et ça contient l'usage mémoire. Configurable par mode plus tard (Mode 2 montera probablement à 30s).
- **Capture via `MediaRecorder`** → Blob WebM/Opus → décodé en `AudioBuffer` immédiatement.
- **Stratégie d'inversion** : précalcul du buffer inversé au moment de l'enregistrement (`reverse()` sur les `Float32Array` de chaque canal). On stocke 2 `AudioBuffer` (forward + reverse) par recording. Why: latence zéro à la lecture, fonction pure facile à tester.
- **Lecture via `AudioBufferSourceNode`** avec `playbackRate` pour la vitesse. Toggle direction = swap entre les deux buffers.

### 3.7 Architecture front

- **Pas de routeur. Machine à état Zustand** avec une enum `Phase` typée.
- **Un seul store Zustand**, structuré en slices internes si besoin.
- **Primitives réutilisables extraites** : `<AudioRecorder />`, `<AudioPlayer />`, `<NotesEditor />`. **Pas d'abstraction "Round" générique** — on copiera vers Mode 2 et on factorisera après avoir vu la duplication réelle.

### 3.8 Stack qualité

- **Pre-commit fait tout, pas de CI** : `oxlint` + `oxfmt --check` (sur fichiers stagés via `lint-staged`), `tsc --noEmit` global, `vitest run --related`.
- **`jsdom`** comme environnement de test (plus complet que happy-dom).
- **Pas de seuil de couverture dur.** Règle informelle : modules purs (audio, state) à 100%, le reste à l'œil.

### 3.9 Branding et langue

- **Nom de travail : "Reverso"**. Modifiable.
- **UI en français hardcodé**, pas d'i18n en MVP.

### 3.10 PWA

- **Niveau standard** : manifest + service worker précachant les assets statiques (via `vite-plugin-pwa` + Workbox). App fonctionne offline une fois chargée. Service worker désactivé en mode dev.
- **Stratégie de cache** :
  - **Précache** (au build) : tous les `*.{js,css,html,png,svg,webmanifest}` du bundle, déclaré via `workbox.globPatterns` dans `vite.config.ts`. Couvre le bundle JS/CSS, `index.html`, le manifest, et les icônes (192/512 + maskable, plus `apple-touch-icon` et `favicon-32`).
  - **Navigation fallback** : `navigateFallback: 'index.html'` pour servir l'app shell quand l'URL demandée n'est pas précachée (SPA-style).
  - **Pas de runtime caching** : aucune ressource externe (pas de CDN, pas d'API). Tout est local au bundle, le précache suffit.
  - **Mise à jour** : `registerType: 'autoUpdate'` — un nouveau SW prend le contrôle au prochain chargement après déploiement, sans prompt utilisateur.
  - **Dev mode** : `devOptions.enabled: false` — pas de SW pendant `bun run dev` pour éviter de masquer les changements de code.
- **Manifest** : `name`, `short_name`, `description`, `lang: fr`, `start_url: .`, `scope: .`, `theme_color`, `background_color`, `display: standalone`, `orientation: portrait`. Icônes en deux variantes `purpose` : `any` (standard) et `maskable` (pour Android adaptive icons).

### 3.11 TypeScript 7 beta

- **TS 7 beta confirmé**, choix volontaire. Si l'outillage casse pendant le scaffolding (incompatibilité plugin Vite, types `@types/*`), **fallback temporaire en TS 5.x autorisé** avec note dans ce fichier expliquant pourquoi. Re-tenter l'upgrade régulièrement.

---

## 4. Stack technique

| Couche | Outil | Version | Why |
|---|---|---|---|
| Package manager + runtime | `bun` | latest | Vitesse d'install, scripts unifiés |
| Bundler / dev server | `vite` | latest | Standard React rapide |
| UI | `react` | 19.x | Standard |
| Langage | `typescript` | 7.x beta | Choix utilisateur |
| State | `zustand` | latest | Léger, store unique pour la machine à état |
| Routing | — | — | Pas de routeur en MVP (cf. §3.7) |
| PWA | `vite-plugin-pwa` | latest | Manifest + service worker via Workbox |
| Linter | `oxlint` | latest | Rapide, Rust-based |
| Formatter | `oxfmt` | latest | Idem |
| Tests | `vitest` + `@testing-library/react` + `jsdom` | latest | Choix utilisateur |
| Pre-commit | `husky` + `lint-staged` | latest | Standard, bien connu des agents |

---

## 5. Architecture

### 5.1 Machine à état (phases)

```
type Phase =
  | 'menu'
  | 'permission'      // demande micro
  | 'permissionDenied'
  | 'handoffA'        // "Joueur A, éloigne-toi"
  | 'recordingA'      // A enregistre (max 15s)
  | 'handoffB'        // "Passe le téléphone à B"
  | 'guessing'        // B écoute, note, enregistre
  | 'confirmEnd'      // confirmation "Êtes-vous sûr ?"
  | 'reveal'          // tout est lisible, dans les 2 sens
```

Transitions linéaires, pilotées par actions Zustand (`startGame`, `confirmHandoff`, `startRecordingA`, `finishRecordingA`, `submitGuess`, `confirmEnd`, `cancelEnd`, `newRound`, `backToMenu`).

### 5.2 Store Zustand (forme)

Un seul store. Slices internes par concern :

```ts
type GameState = {
  // phase machine
  phase: Phase;

  // recordings (volatile, in-memory only)
  originalRecording: Recording | null;   // A's recording
  guessRecording: Recording | null;       // B's last recording (overwrites)

  // notes
  notes: string;

  // actions
  startGame: () => void;
  // ... etc
};

type Recording = {
  forward: AudioBuffer;
  reverse: AudioBuffer;
  durationMs: number;
};
```

### 5.3 Pipeline audio

```
   ┌─────────────────────┐
   │   MediaRecorder     │   capture → Blob WebM/Opus
   └──────────┬──────────┘
              ▼
   ┌─────────────────────┐
   │   decodeRecording   │   Blob → AudioBuffer (pure async fn)
   └──────────┬──────────┘
              ▼
   ┌─────────────────────┐
   │   reverseBuffer     │   AudioBuffer → AudioBuffer (pure)
   └──────────┬──────────┘
              ▼
   ┌─────────────────────┐
   │   { forward, reverse } stored in Zustand
   └──────────┬──────────┘
              ▼
   ┌─────────────────────┐
   │   AudioPlayer       │   uses AudioBufferSourceNode
   │                     │   props: buffer, playbackRate, direction
   └─────────────────────┘
```

### 5.4 Primitives réutilisables

- `<AudioRecorder onRecorded={(rec) => ...} maxDurationMs={15000} />`
- `<AudioPlayer recording={Recording} direction="forward"|"reverse" />` — interne : slider vitesse, bouton play/pause, toggle direction
- `<NotesEditor value notes onChange />`

Ces primitives sont indépendantes des phases et seront réutilisées par Mode 2 / Mode 3.

---

## 6. Structure des dossiers (proposée)

```
reverse-game/
├── PROJECT.md
├── package.json
├── bun.lockb
├── tsconfig.json
├── vite.config.ts
├── index.html
├── public/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── ...
├── src/
│   ├── main.tsx
│   ├── App.tsx                       # routeur de phase
│   ├── audio/
│   │   ├── reverseBuffer.ts          # pure
│   │   ├── reverseBuffer.test.ts
│   │   ├── decodeRecording.ts        # pure (async)
│   │   ├── decodeRecording.test.ts
│   │   └── wrappers/
│   │       ├── recorder.ts           # wraps MediaRecorder
│   │       ├── recorder.test.ts
│   │       ├── player.ts             # wraps AudioBufferSourceNode
│   │       └── player.test.ts
│   ├── components/
│   │   ├── AudioRecorder.tsx
│   │   ├── AudioRecorder.test.tsx
│   │   ├── AudioPlayer.tsx
│   │   ├── AudioPlayer.test.tsx
│   │   ├── NotesEditor.tsx
│   │   └── NotesEditor.test.tsx
│   ├── phases/
│   │   ├── MenuPhase.tsx
│   │   ├── HandoffAPhase.tsx
│   │   ├── RecordingAPhase.tsx
│   │   ├── HandoffBPhase.tsx
│   │   ├── GuessingPhase.tsx
│   │   ├── ConfirmEndPhase.tsx
│   │   ├── RevealPhase.tsx
│   │   └── PermissionDeniedPhase.tsx
│   └── store/
│       ├── gameStore.ts
│       └── gameStore.test.ts
└── .husky/
    └── pre-commit
```

**Tests co-localisés** avec les modules (`*.test.ts(x)` à côté du fichier).

---

## 7. Conventions de code

- **TypeScript strict** activé (`"strict": true` dans `tsconfig.json`).
- **Pas de `any`** sauf cas justifié et commenté.
- **Pas de classes** sauf si vraiment nécessaire ; fonctions pures et hooks.
- **Nommage** : `camelCase` pour fonctions/variables, `PascalCase` pour composants/types. Phases en `MenuPhase`, etc.
- **Imports absolus** via alias (`@/audio/reverseBuffer`) — configurer dans `tsconfig.json` + `vite.config.ts`.
- **Pas de commentaires** qui décrivent le QUOI. Commenter uniquement le POURQUOI quand c'est non évident.
- **Pas de barrels (`index.ts`)** sauf besoin avéré — ils complexifient le tree-shaking et la lecture.

---

## 8. Stratégie de tests (TDD)

### 8.1 Trois couches

| Couche | Cible | Approche | Couverture cible |
|---|---|---|---|
| **Logique pure** | `reverseBuffer`, `decodeRecording`, store Zustand | TDD strict, tests deterministic, pas de mocks navigateur | 100% |
| **Wrappers audio** | `recorder.ts`, `player.ts` | Tests avec mocks de `MediaRecorder`, `AudioContext` | 80%+ |
| **Composants** | `AudioRecorder`, `AudioPlayer`, phases | RTL, wrappers mockés via injection (props ou store) | golden-path + cas critiques |

### 8.2 Patterns de test

- **Logique pure** : input → output, jamais de side-effects. `reverseBuffer` prend un `AudioBuffer`, retourne un `AudioBuffer`.
- **Wrappers** : interface étroite (`startRecording()`, `stopRecording(): Promise<Blob>`). On peut mocker l'API navigateur avec `vi.stubGlobal('MediaRecorder', ...)`.
- **Composants** : on injecte les wrappers (via prop ou store) pour ne pas dépendre des APIs navigateur dans les tests RTL.

### 8.3 Pas testé en MVP

- E2E avec vrai audio.
- Comportement du service worker PWA.
- Permissions navigateur réelles (juste mockées).

Documenter ces lacunes ici quand elles deviennent gênantes.

---

## 9. Workflow de développement

### 9.1 Scripts (`package.json`)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "oxlint src",
    "format": "oxfmt src",
    "format:check": "oxfmt --check src",
    "typecheck": "tsc --noEmit",
    "prepare": "husky"
  }
}
```

Toutes les commandes lancées via `bun run <script>`.

### 9.2 Pre-commit hook

Configuré via `husky` + `lint-staged`. Lance, dans cet ordre :

1. `oxlint` sur les fichiers stagés (rapide).
2. `oxfmt --check` sur les fichiers stagés (rapide).
3. `tsc --noEmit` global (lent mais critique).
4. `vitest run --related` sur les fichiers stagés.

Si un échoue, le commit est bloqué. **Never bypass with `--no-verify`** — corriger la cause racine.

### 9.3 Bun spécificités

- `bun install` au lieu de `npm install`.
- `bun add <pkg>` / `bun add -d <pkg>` pour ajouter.
- `bunx <bin>` au lieu de `npx`.
- Lockfile : `bun.lockb` (binaire, à committer).

---

## 10. Roadmap

| Version | Contenu | Critères de done |
|---|---|---|
| **v0.1 (MVP)** | Mode 1 complet, PWA installable, offline-capable, tests à 3 couches en place | Un round complet jouable de bout en bout sur mobile, audio inversé fidèle, pre-commit vert |
| **v0.2** | Mode 2 (téléphone arabe) — extraire les abstractions APRÈS avoir copié l'orchestration et observé la duplication | Mode 2 jouable à 4 joueurs en local, primitives factorisées sans casser Mode 1 |
| **v0.3** | Mode 3 (écoutes limitées configurables) — réutilise le compteur déjà présent | Configuration de la limite à l'enregistrement de A, blocage en lecture quand atteinte |
| **v0.x** | Réflexion et éventuelle implémentation du mode online | Hors scope actuel |

---

## 11. Glossaire / domaine

- **Round** — une séquence complète enregistrement → devinage → révélation.
- **Phase** — état courant de la machine à état (`menu`, `recordingA`, etc.).
- **Recording** — un couple `{ forward: AudioBuffer, reverse: AudioBuffer }` représentant un enregistrement réversible.
- **Original recording** — l'enregistrement de A (la phrase à deviner).
- **Guess recording** — la dernière prise de B (sa proposition vocale).
- **Direction** — `'forward' | 'reverse'` ; sens dans lequel un Recording est joué par un AudioPlayer.
- **Playback rate** — multiplicateur de vitesse appliqué au player (0.25 à 2.0).
- **Hand-off** — transition entre joueurs avec écran dédié pour le passage du téléphone.

---

## 12. Checklist de scaffolding initial

À suivre dans l'ordre par l'agent qui monte le projet pour la première fois.

### Setup projet

1. `bun init` puis adapter `package.json` (name: `reverso`, type: `module`).
2. Installer Vite + React + TS 7 beta : `bun add -d vite @vitejs/plugin-react typescript@beta`.
3. Installer React : `bun add react react-dom` + `bun add -d @types/react @types/react-dom`.
4. Créer `vite.config.ts`, `tsconfig.json` (strict, alias `@/*` → `src/*`), `index.html`, `src/main.tsx`, `src/App.tsx` minimal.
5. Vérifier que `bun run dev` affiche un "Hello Reverso".

### Outillage qualité

6. Installer `bun add -d oxlint oxfmt`. Créer config minimale si nécessaire.
7. Installer Vitest + RTL + jsdom : `bun add -d vitest @testing-library/react @testing-library/jest-dom jsdom @vitest/coverage-v8`.
8. Configurer `vitest.config.ts` avec environnement `jsdom` et setup file (`@testing-library/jest-dom/vitest`).
9. Installer Husky + lint-staged : `bun add -d husky lint-staged`. `bun run prepare`. Créer `.husky/pre-commit` qui lance `bunx lint-staged && bun run typecheck`.
10. Ajouter dans `package.json` une section `lint-staged` qui mappe les fichiers stagés vers `oxlint`, `oxfmt --check`, et `vitest run --related`.

### PWA

11. Installer `bun add -d vite-plugin-pwa`. Configurer dans `vite.config.ts` (registerType: `autoUpdate`, manifest avec name "Reverso", theme color, icônes placeholder 192/512). Désactiver le SW en dev.

### Premier vertical slice (TDD)

12. **Test rouge** : écrire `src/audio/reverseBuffer.test.ts` avec un cas trivial (un AudioBuffer mono 4 samples `[1, 2, 3, 4]` → `[4, 3, 2, 1]`).
13. Implémenter `src/audio/reverseBuffer.ts` — fonction pure qui clone l'`AudioBuffer` et inverse chaque canal.
14. Itérer (multi-canal, longueur impaire, etc.) jusqu'à confiance.
15. Wrapper `recorder.ts` et `player.ts` avec leurs tests respectifs (mocks `MediaRecorder`, `AudioContext`).
16. Composant `AudioRecorder` (RTL).
17. Composant `AudioPlayer` (RTL, avec slider et toggle direction).
18. Composant `NotesEditor` (RTL).
19. Store Zustand `gameStore` avec la machine à état + ses tests.
20. Phases (`MenuPhase`, `HandoffAPhase`, ..., `RevealPhase`) — tests RTL focalisés sur les transitions et le rendu correct.
21. `App.tsx` qui sélectionne la phase à rendre selon `useGameStore(s => s.phase)`.

### Polish

22. Icônes PWA (peuvent être des placeholders).
23. Test manuel d'un round complet sur un vrai téléphone (Safari iOS + Chrome Android).
24. Vérifier que `bun run build` produit un bundle qui passe Lighthouse PWA.

---

## 14. HITL — Test device réel (T7)

Cette checklist requiert **un humain avec un iPhone et un Android physiques**. Elle ne peut pas être automatisée. Cocher manuellement et joindre captures d'écran à la PR T7.

### Préparation

- [ ] Builder en local : `bun run build`
- [ ] Servir le bundle via HTTPS (le SW PWA exige HTTPS sauf sur `localhost`). Options :
  - `bun run preview` + reverse-proxy ngrok / Cloudflare Tunnel
  - Déployer sur un host statique (Vercel / Netlify / GitHub Pages)
- [ ] Ouvrir l'URL HTTPS depuis le téléphone physique

### iOS Safari (iPhone réel)

- [ ] Premier chargement OK, l'app affiche le menu
- [ ] "Ajouter à l'écran d'accueil" via le menu de partage Safari
- [ ] L'icône installée correspond à l'`apple-touch-icon` (180×180)
- [ ] Lancement depuis l'écran d'accueil → mode standalone (pas de barre Safari)
- [ ] Permission micro demandée au "Démarrer une partie", accordable
- [ ] Round complet jouable : Menu → HandoffA → RecordingA → HandoffB → Guessing → ConfirmEnd → Reveal
- [ ] Audio inversé audible et fidèle
- [ ] Mode avion : recharger l'app depuis l'écran d'accueil → toujours fonctionnelle
- [ ] Mode portrait imposé OK (rotation paysage soit rejetée, soit gracieusement acceptée)

### Android Chrome (téléphone réel)

- [ ] Premier chargement OK, l'app affiche le menu
- [ ] Bandeau "Ajouter à l'écran d'accueil" proposé OU installable via le menu Chrome
- [ ] L'icône installée utilise la variante maskable (forme adaptative selon le launcher)
- [ ] Lancement depuis l'écran d'accueil → mode standalone (pas d'UI Chrome)
- [ ] Permission micro demandée au "Démarrer une partie", accordable
- [ ] Round complet jouable de bout en bout
- [ ] Audio inversé audible et fidèle
- [ ] Mode avion : recharger l'app depuis l'icône → toujours fonctionnelle

### Lighthouse PWA audit

- [ ] `bunx lighthouse <url-https> --view --preset=desktop` (ou via DevTools)
- [ ] Score Installable : OK
- [ ] Score PWA Optimized : OK (ou écarts documentés ici)
- [ ] Tout critère failing est soit corrigé, soit listé ci-dessous comme limitation acceptée :
  - _(à remplir lors du test HITL)_

### Bugs mobile-specific

Si découverts pendant le HITL :
- soit corrigés dans la slice T7,
- soit déposés en issue séparée avec label `bug` et référencés ici.

---

## 13. Notes pour les agents

- **Lis ce fichier en entier** avant de proposer un changement structurant.
- **Si tu changes une décision listée en §3**, mets à jour cette section ET ajoute une ligne dans `CHANGELOG.md` (à créer la première fois).
- **Si tu ajoutes une dépendance**, justifie-la en commit message (pourquoi elle est nécessaire, pourquoi cet outil et pas un autre).
- **Suis le TDD pour la logique pure**. Pour les composants RTL, écris au moins le golden path en test avant de considérer la tâche faite.
- **N'introduis pas d'abstractions prématurées.** Le YAGNI est explicite (cf. §2).
- **Pas de `--no-verify`** sur les commits. Si le hook échoue, fixe la cause.
