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

### Mode Téléphone Ouzbek (prévu v0.3)

Variante 4-joueurs en chaîne, basée sur le mécanisme d'inversion :

1. **Joueur 1** enregistre une phrase.
2. **Joueur 2** écoute la version **inversée** de J1 et écrit une note (transcription, indications, ce qu'il pense entendre).
3. **Joueur 3** lit la note de J2 et enregistre un nouveau vocal en suivant ce qu'il comprend — **sans pouvoir écouter la version inversée de son propre enregistrement** (cf. §3.13).
4. **Joueur 4** écoute la version **inversée** de l'enregistrement de J3 et donne sa réponse oralement à J1, qui valide en lançant le reveal.
5. **Reveal** : la chaîne complète est lisible (les deux recordings dans les deux sens, la note en texte).

Schéma de phases, store, persistance et "P3 sans reverse" détaillés en §3.13. Les slices d'implémentation (#27 tracer bullet, #31 reveal enrichi, #32 variante Challenge) ne devraient pas avoir à re-décider de ces points.

### Mode 2 — Téléphone arabe — fusionné dans Mode Téléphone Ouzbek

Variante prévue à l'origine avec une étape de transcription phonétique sans inversion audio. Absorbée dans le Mode Téléphone Ouzbek qui ajoute le double-twist d'inversion (J2 et J4 écoutent reverse) sans changer le format 4-joueurs en chaîne. La transcription phonétique disparaît : J2 écrit une note libre.

### Mode Challenge — Mode 1 + règles configurables (prévu v0.2)

Variante de Mode 1 où Joueur 1 configure les contraintes imposées à Joueur 2 avant de jouer le round : timer pendant le devinage, notes activées ou non, limite du nombre de ré-écoutes. Schéma des règles et comportement détaillés en §3.12. Subsume l'ancien "Mode 3 — écoutes limitées" qui n'est qu'une des règles du Challenge.

### Mode 3 — Écoutes limitées — fusionné dans Mode Challenge

Variante prévue à l'origine comme un mode séparé. La règle "limite de ré-écoutes" est désormais une des trois règles configurables du Mode Challenge (cf. §3.12). Pas de mode séparé pour cette unique règle.

### Mode futur — Multijoueur en ligne (lointain, hors roadmap)

Partage d'un lien à un autre joueur, partie asynchrone ou en temps réel. **Ne pas pré-architecturer pour ça** dans le MVP — on traitera quand on y sera.

---

## 2. Anti-goals (ce qu'on ne fait PAS en v1)

Liste explicite pour empêcher tout agent de réintroduire ces idées par défaut.

- ~~**Pas de persistance** — ni IndexedDB, ni localStorage pour les recordings/notes. Tout est en mémoire (Zustand). Un refresh = partie perdue. Documenté et accepté.~~ **Révisé** : un round actif est maintenant persisté en IndexedDB (cf. §3.5) — un téléphone qui se verrouille n'efface plus la partie. Voir `CHANGELOG.md`.
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

- **Bouton "Fin"** avec confirmation ("Êtes-vous sûr ?") rendue en **modal au-dessus de l'écran de devinage** (composant `<ConfirmDialog />` réutilisable). Why: le user veut une protection contre le clic accidentel ; un modal préserve le contexte (notes, recording, compteur visibles derrière) là où l'ancien plein-écran cassait le flow visuel. La phase `confirmEnd` reste dans la state machine pour ne pas migrer le schéma de persistance IndexedDB ; seule la composition de rendu change (App.tsx rend `<GuessingPhase>` ET `<ConfirmDialog>` quand `phase === 'confirmEnd'`).
- **Écran de révélation** : (1) le vocal original de A — lisible à l'endroit ET à l'envers, (2) le dernier vocal de B — lisible à l'endroit ET à l'envers, (3) les notes en texte, (4) bouton "Nouvelle partie", (5) bouton "Retour à l'accueil". **Tous les players du reveal supportent un toggle direction.**
- **Pas de tracking win/lose**, pas de cérémonie 🎉 / 😅.

### 3.5 Persistance et permissions

- **Round actif persisté en IndexedDB.** Why: les navigateurs mobiles (iOS Safari surtout) déchargent agressivement les PWAs en arrière-plan ; un téléphone qui se verrouille quelques minutes faisait perdre la partie. On persiste le strict nécessaire pour reprendre : phase (`guessing` / `confirmEnd` / `reveal` uniquement — les autres sont éphémères ou n'ont rien à sauvegarder), `originalRecording`, `guessRecording`, `notes`, `listenCount`.
- **Recordings persistés sous forme de Blob source.** On stocke le Blob Opus/WebM produit par `MediaRecorder` (sérialisé en `ArrayBuffer + mimeType` pour rester portable côté tests). À la rehydratation : `decodeAudioData` + `reverseBuffer` reconstruisent les `AudioBuffer`. Why: `AudioBuffer` n'est pas sérialisable, et le Blob est déjà disponible gratuitement à l'enregistrement.
- **Sauvegarde debounced (200ms) sur chaque changement du store**, via un abonnement Zustand monté après la rehydratation pour éviter de réécrire pendant l'init. La persistance est best-effort : un échec IDB (quota, navigation privée) est silencieux et n'affecte pas le round courant.
- **Effacement** : transition vers `menu` (via `backToMenu`) ou `recordingA` sans recording (via `newRound`) déclenche un `clearPersistedState`.
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

### 3.12 Mode Challenge — règles configurables

Variante du Mode 1 (cf. §1) où le Joueur 1 configure des contraintes pour le Joueur 2 avant le round. Cette section fixe le schéma et l'intégration ; les slices d'implémentation (#26 squelette, #28 timer, #29 notes, #30 ré-écoutes) ne devraient pas avoir à re-décider de ces points.

#### Entrée depuis le menu — bouton séparé

- **Un second bouton "Mode Challenge" sur l'écran Menu**, sous "Nouvelle partie" (Mode 1). Pas de toggle ni d'interrupteur. Why: chaque mode a un setup distinct (Challenge → écran de config, Ouzbek → flow 4-joueurs) ; un toggle bundlerait deux flows incompatibles. Trois ou quatre boutons sur le menu reste lisible. Symétrie avec l'entrée prévue pour le Mode Téléphone Ouzbek (#27).

#### Schéma `ChallengeRules`

```ts
type ChallengeRules = {
  /** Durée de la phase guessing en ms. null = pas de timer (comportement Mode 1). */
  timerMs: number | null;
  /** Si false, <NotesEditor /> n'est pas rendu et la section notes est absente du reveal. */
  notesEnabled: boolean;
  /** Plafond de ré-écoutes ; bouton "Écouter" désactivé quand listenCount >= listenLimit.
   *  null = illimité (comportement Mode 1). */
  listenLimit: number | null;
};

const DEFAULT_CHALLENGE_RULES: ChallengeRules = {
  timerMs: null,
  notesEnabled: true,
  listenLimit: null,
};
```

Why ces défauts : opening Mode Challenge sans rien changer = comportement Mode 1 strict. C'est utile pour le tracer bullet (#26) qui valide la mécanique de bout en bout sans avoir de règle réellement appliquée. L'utilisateur doit explicitement activer les contraintes — pas de surprise.

Les UI presets pour le timer (60s / 120s / 180s) et listenLimit (1 / 3 / 5) sont la responsabilité du composant de config (#26), pas du schéma.

#### Intégration au store Zustand

- Ajouter au `GameState` : `challengeRules: ChallengeRules | null`. `null` = on n'est pas en Mode Challenge (ou Mode 1 par défaut).
- Nouvelle action `startChallenge()` : `menu --> challengeConfig`. **N'écrit pas encore les rules** — c'est `confirmChallengeRules(rules)` qui le fait.
- Nouvelle action `confirmChallengeRules(rules: ChallengeRules)` : `challengeConfig --> permission`, écrit `challengeRules: rules`.
- `newRound` (depuis `reveal` en Mode Challenge) : **conserve `challengeRules`**, reset le reste comme aujourd'hui. Why: enchaîner plusieurs rounds avec la même config est le cas usuel ; reconfigurer à chaque round serait pénible.
- `backToMenu` : reset `challengeRules` à `null` (comme tout le reste via `INITIAL_STATE`).
- Pas de slice dédié — un seul store, pas d'abstraction prématurée (cf. §3.7).

#### State machine — nouvelle phase `challengeConfig`

```ts
type Phase =
  | "menu"
  | "challengeConfig"   // NOUVEAU — écran de config Mode Challenge
  | "permission"
  | "permissionDenied"
  | "recordingA"
  | "guessing"
  | "confirmEnd"
  | "reveal";
```

- Transition : `menu --(startChallenge)--> challengeConfig --(confirmChallengeRules)--> permission --> recordingA --> guessing --> ...`
- Annuler depuis `challengeConfig` : `backToMenu` (réutilisation de l'action existante).
- Why phase plutôt que modal `<ConfirmDialog>` : le config screen est un écran de premier plan vers lequel l'utilisateur navigue, pas un overlay éphémère. Il a aussi sa propre adresse mentale ("je suis en train de configurer"), ce qui justifie une phase. `<ConfirmDialog>` reste réservé aux confirmations courtes (Fin de round) et pourra éventuellement être réutilisé _à l'intérieur_ de `challengeConfig` pour valider le départ ("Lancer la partie ?").

#### Persistance IndexedDB

- Étendre `PersistedState` avec `challengeRules: ChallengeRules | null`.
- Choix laissé au slice d'implémentation (#26) entre :
  - **(a)** bumper `version: 1` → `version: 2` avec migration triviale `v1 --> { ...v1, challengeRules: null }`,
  - **(b)** traiter le champ comme optionnel à la lecture (`raw.challengeRules ?? null`) sans bumper la version.
- Ne pas persister la phase `challengeConfig` (reconfigurable, pas un état "engagé"). Les phases persistables restent `guessing`, `confirmEnd`, `reveal` (cf. §3.5).
- Pour le timer (cf. ci-dessous) : ajouter aussi `guessingStartedAt: number | null` (epoch ms) dans le state persisté pour reprendre le décompte après lock screen.

#### Comportement quand une règle est violée

- **Limite ré-écoutes atteinte** : bouton "Écouter" désactivé. Compteur affiché `X / N`. Aucune transition de phase. Si `listenLimit === null` : compteur reste informatif comme aujourd'hui (`X` simple).
- **Notes désactivées** : `<NotesEditor />` non rendu pendant `guessing` ; section notes absente du `reveal`. Aucune écriture dans `notes` du store (pas de pollution de la persistance).
- **Timer expiré** : transition forcée `guessing --> reveal` (saute `confirmEnd`). Why: si B est en train de ré-écouter ou enregistrer quand le timer hit zéro, c'est plus net de basculer directement vers le reveal que de lui imposer un modal "temps écoulé". Le reveal montre déjà tous les artefacts (original, dernière prise de B, notes), B peut comparer là à son rythme. Si HITL test sur device réel révèle que la coupure est trop brutale, on insèrera une phase intermédiaire dans une slice ultérieure — pas en MVP.
- **Timer ne pause pas pendant les ré-écoutes** : le décompte est wall-clock à partir de l'entrée dans `guessing`. Why: simpler à implémenter (pas d'interaction timer ↔ events audio), plus "challenge-y" (savoir quand écouter fait partie du jeu). Si trop dur en HITL, on ajoutera la pause.
- **Persistance du timer** : `guessingStartedAt` est écrit au moment de la transition `recordingA → guessing` (uniquement si `challengeRules?.timerMs !== null`). À la rehydratation : `remaining = timerMs - (Date.now() - guessingStartedAt)`. Si `remaining <= 0` : transition immédiate vers `reveal`.

#### Reveal — adaptation conditionnelle

- Le composant `RevealPhase` lit `challengeRules` du store et conditionne l'affichage :
  - Section notes affichée seulement si `challengeRules?.notesEnabled !== false` (ou si `challengeRules === null`, = Mode 1).
  - Affichage optionnel "Écoutes : X / N" si `listenLimit !== null`, sinon "Écoutes : X".
  - Pas de cérémonie particulière selon le mode — l'app reste neutre (cf. §3.4).
- Pas de fork du composant `RevealPhase` ni d'abstraction `RevealMode1` / `RevealChallenge` — on conditionne dans le composant existant. Si la duplication devient gênante en Mode Ouzbek (cf. §10), on extraira à ce moment-là (cf. §3.7 — pas d'abstraction prématurée).

#### Décisions explicitement reportées aux slices d'implémentation

Le design ci-dessus ne tranche pas les points suivants ; ils relèvent du contexte que seul le code touchera :

- Forme exacte du `<ConfigScreen />` (presets vs slider, layout) — décidé en #26.
- Position du compteur du timer (header sticky, inline) et format (`mm:ss` vs `Xs`) — #28.
- Animations / transitions visuelles entre phases — pas de décision écrite, défaut au composant.
- Si `<ConfirmDialog>` est réutilisé dans `challengeConfig` pour valider le départ — option, pas obligation.

### 3.13 Mode Téléphone Ouzbek — phases, store, persistance, hand-offs

Variante 4-joueurs en chaîne (cf. §1). Cette section fixe la structure ; les slices d'implémentation (#27 tracer bullet, #31 reveal enrichi, #32 variante Challenge) ne devraient pas avoir à re-décider de ces points.

#### Entrée depuis le menu — bouton séparé

- **Un troisième bouton "Mode Ouzbek" sur l'écran Menu**, sous "Mode Challenge". Pas de toggle, pas d'écran de choix de mode imbriqué. Why: cohérent avec §3.12 ("entrée Mode Challenge — bouton séparé") — chaque mode a un setup distinct, un toggle bundlerait des flows incompatibles. Trois ou quatre boutons sur le menu reste lisible.

#### Enum de phases

Phases ajoutées à l'enum `Phase` (cf. §5.1) :

```ts
| 'recordingP1'   // J1 enregistre (max 15s, comme recordingA)
| 'handoffP2'     // "Passe le téléphone à J2"
| 'guessingP2'    // J2 écoute la reverse de P1 + écrit la note
| 'handoffP3'     // "Passe le téléphone à J3"
| 'recordingP3'   // J3 lit la note + enregistre (pas d'accès reverse — cf. ci-dessous)
| 'handoffP4'     // "Passe le téléphone à J4"
| 'guessingP4'    // J4 écoute la reverse de P3 + répond oralement à J1
| 'revealOuzbek'  // chaîne complète lisible (deux recordings dans les deux sens, note)
```

Transitions linéaires :

```
menu --(startOuzbek)--> permission --(permissionGranted, mode='ouzbek')--> recordingP1
recordingP1 --(finishRecordingP1)--> handoffP2
handoffP2 --(startGuessingP2)--> guessingP2
guessingP2 --(finishGuessingP2)--> handoffP3
handoffP3 --(startRecordingP3)--> recordingP3
recordingP3 --(finishRecordingP3)--> handoffP4
handoffP4 --(startGuessingP4)--> guessingP4
guessingP4 --(revealOuzbekChain)--> revealOuzbek
revealOuzbek --(newOuzbekRound)--> recordingP1   (mode reste 'ouzbek')
* --(backToMenu)--> menu                           (reset complet via INITIAL_STATE)
```

Why des hand-offs explicites (vs implicites comme en Mode 1) : avec 4 joueurs au lieu de 2, le téléphone change de main 3 fois par round. Un écran de hand-off entre chaque rôle évite que le joueur sortant garde le device par inertie (et fasse fuiter la phase suivante).

Why `permissionGranted` partagé (et pas `permissionGrantedOuzbek` séparé) : la permission micro elle-même est neutre vis-à-vis du mode ; seule la phase de destination diffère. La discrimination via le champ `mode` (cf. §5.2) garde la state machine plate. `permissionDenied` et `retryPermission` sont aussi partagés.

#### Schéma store — champs Ouzbek

Cf. §5.2 pour le `GameState` complet. Trois champs ajoutés :

- `ouzbekRecordingP1: Recording | null` — recording de J1, input du chain.
- `ouzbekNoteP2: string` — la note de J2 (transcription libre, pas phonétique forcée).
- `ouzbekRecordingP3: Recording | null` — recording de J3 (re-utterance basée sur la note).

Pas de field pour P4 (J4 répond oralement, pas d'artefact à stocker).

Pas de `ouzbekListenCountP2` / `ouzbekListenCountP4` dans le tracer bullet (#27) — la limite de ré-écoutes est une règle Challenge (#32), elle réutilisera le `listenCount` existant **par phase active** (cf. §3.12 — la sémantique du compteur est "écoutes pendant la phase guessing courante" et reset au passage de phase, à valider en #32).

#### Actions Zustand

Actions ajoutées :

- `startOuzbek()` : `menu --> permission`, set `mode = 'ouzbek'`.
- `finishRecordingP1(rec)` : `recordingP1 --> handoffP2`, écrit `ouzbekRecordingP1 = rec`.
- `startGuessingP2()` : `handoffP2 --> guessingP2`.
- `setOuzbekNoteP2(note)` : écrit `ouzbekNoteP2`, gardé par `phase === 'guessingP2'`.
- `finishGuessingP2()` : `guessingP2 --> handoffP3`.
- `startRecordingP3()` : `handoffP3 --> recordingP3`.
- `finishRecordingP3(rec)` : `recordingP3 --> handoffP4`, écrit `ouzbekRecordingP3 = rec`.
- `startGuessingP4()` : `handoffP4 --> guessingP4`.
- `revealOuzbekChain()` : `guessingP4 --> revealOuzbek`. Pas de bool "validation J1" en store — le clic sur le bouton EST la validation.
- `newOuzbekRound()` : `revealOuzbek --> recordingP1`, clear les trois champs `ouzbek*`. Ne touche pas `mode` (on reste en Ouzbek). Analogue de `newRound` pour Mode 1.

Action partagée modifiée :

- `permissionGranted()` : route vers `recordingA` si `mode === 'mode1'`, sinon `recordingP1`. Aucun nouveau callsite à introduire — le bouton "Réessayer" / la grant flow restent identiques.

`backToMenu()` reste inchangée (reset complet via `INITIAL_STATE`, qui doit inclure `mode: 'mode1'` comme défaut neutre — équivalent au comportement actuel pour les écrans de menu).

#### Règle "P3 sans accès reverse" — approche

**Approche retenue : prop existante `lockDirection="forward"` sur `<AudioPlayer />`.**

Si la phase `recordingP3` rend un `<AudioPlayer />` pour permettre à J3 de se réécouter avant de confirmer (recommandé pour l'UX — sinon J3 ne peut pas vérifier ce qu'il vient de dire), passer `lockDirection="forward"` désactive le bouton reverse exactement comme requis (cf. `src/components/AudioPlayer.tsx` lignes 177–178 : `reverseDisabled = lockDirection === "forward" || disabled`).

Why cette approche (et pas les alternatives) :

| Approche | Pour | Contre |
|---|---|---|
| **(a) `lockDirection="forward"`** | Réutilise un mécanisme existant. Le bouton reverse reste visible mais inerte (affordance claire : "tu ne peux pas écouter à l'envers ici"). J3 peut écouter forward pour vérifier sa diction. | (aucun — c'est exactement la sémantique demandée) |
| (b) Pas d'AudioPlayer du tout en `recordingP3` | Garantit zéro accès, même par bug. | J3 ne peut plus vérifier sa prise. Friction UX (re-record sans pouvoir écouter). |
| (c) Nouveau prop `hideReverse` (reverse button absent) | Plus défensif que (a). | Code mort (un prop pour un seul cas), redondant avec `lockDirection`. |

**Décision : (a).** Si HITL test révèle que J3 a tendance à pré-fuiter le contenu en se réécoutant trop, on retombera sur (b) dans une slice ultérieure. Le coût d'un revert est nul.

Note : J3 ne doit PAS voir `ouzbekRecordingP1` non plus (cela reverse-leak P1). La phase `recordingP3` ne rend que la note de J2 (texte) + `<AudioRecorder />` + après prise, optionnellement `<AudioPlayer recording={ouzbekRecordingP3} lockDirection="forward" />`. Aucune référence à `ouzbekRecordingP1` dans cette phase.

#### Persistance IndexedDB

Schéma `PersistedState` étendu (cf. `src/store/persistence.ts`) :

```ts
type PersistedPhase =
  // Mode 1 / Challenge (existant)
  | "guessing" | "confirmEnd" | "reveal"
  // Mode Ouzbek (nouveau)
  | "handoffP2" | "guessingP2" | "handoffP3"
  | "handoffP4" | "guessingP4" | "revealOuzbek";

type PersistedState = {
  version: 1;
  phase: PersistedPhase;
  mode: 'mode1' | 'ouzbek';
  // existant — Mode 1 / Challenge
  originalRecording: PersistedRecording | null;
  guessRecording: PersistedRecording | null;
  notes: string;
  listenCount: number;
  challengeRules: PersistedChallengeRules | null;
  guessingStartedAt: number | null;
  // nouveau — Mode Ouzbek
  ouzbekRecordingP1: PersistedRecording | null;
  ouzbekNoteP2: string;
  ouzbekRecordingP3: PersistedRecording | null;
};
```

**Phases persistables Ouzbek** : `handoffP2`, `guessingP2`, `handoffP3`, `handoffP4`, `guessingP4`, `revealOuzbek`. **Non persistables** : `recordingP1` et `recordingP3` (enregistrement actif via `MediaRecorder` impossible à reprendre proprement après lock — symétrique avec `recordingA` non-persistable en Mode 1). Si l'app reload pendant `recordingP3`, IDB pointe encore sur `handoffP3` (la transition vers `recordingP3` ne re-sauvegarde pas), donc J3 retombe sur le hand-off et redémarre l'enregistrement.

**Compatibilité descendante** : suivre le pattern établi par `challengeRules` et `guessingStartedAt` (#26, #28) — champs lus en optionnel à la rehydratation (`raw.mode ?? 'mode1'`, `raw.ouzbekRecordingP1 ?? null`, `raw.ouzbekNoteP2 ?? ""`, `raw.ouzbekRecordingP3 ?? null`), sans bump de `version`. Un save pré-Ouzbek se rehydrate en Mode 1 strict.

**Choix de version** : ne PAS bumper `version: 1 → 2`. Le pattern optionnel est déjà en place (cf. `src/store/persistence.ts` lignes 53–57), reste cohérent. Si plus tard une migration non-triviale s'impose (renommage d'un champ), on bumpera proprement à ce moment-là — le coût d'un V2 + migration n'est pas justifié pour ajouter quatre champs optionnels.

#### Reuse vs duplication

Cf. §3.7 — pas d'abstraction "Round générique" prématurée. Pour Ouzbek :

- **Primitives réutilisées telles quelles** : `<AudioRecorder />`, `<AudioPlayer />` (avec `lockDirection`), `<NotesEditor />`, `<ConfirmDialog />`. Aucune modification.
- **Phases écrites en neuf** : `RecordingP1Phase`, `HandoffP2Phase`, `GuessingP2Phase`, `HandoffP3Phase`, `RecordingP3Phase`, `HandoffP4Phase`, `GuessingP4Phase`, `RevealOuzbekPhase`. Pas de tentative de partager du code avec `RecordingAPhase` / `GuessingPhase` / `RevealPhase` — l'orchestration est mode-spécifique, et la duplication est limitée à du JSX de structure.
- **Reveal séparé** : `RevealOuzbekPhase` distinct de `RevealPhase`. Si la duplication devient gênante après #32, on factorisera (cf. #31 "pas d'abstraction prématurée avec le reveal Mode 1").

#### Hand-off — copy proposée

Format inspiré de §3.2 (hand-off explicite) :

- `handoffP2` : "Joueur 2, prends le téléphone. Joueurs 1, 3 et 4 : ne regardez pas l'écran." → bouton "C'est moi, J2".
- `handoffP3` : idem pour J3.
- `handoffP4` : idem pour J4.

Pas de hand-off pour J1 entrant — il vient juste de cliquer "Mode Ouzbek" sur le menu. Symétrique à Mode 1 (pas de hand-off avant `recordingA`).

#### Décisions explicitement reportées aux slices d'implémentation

- **Layout exact du `RevealOuzbekPhase`** (ordre des players, mise en avant de la note) — décidé en #31. Le contrat minimal : tout est lisible, deux recordings dans les deux sens, note en texte (cf. acceptance criteria #31).
- **Mapping des règles `ChallengeRules` aux phases Ouzbek** (timer sur `guessingP4` seul ou aussi `guessingP2` ? notes désactivées a-t-il du sens en Ouzbek puisque la note est le pivot ?) — décidé en #32 lors du triage. La règle `notesEnabled = false` casserait le jeu : option recommandée = retirer cette règle de la config Ouzbek (ou la griser avec un tooltip explicatif).
- **Compteur de ré-écoutes par phase guessing** (un seul `listenCount` partagé qui se reset à `finishGuessingP2` ? deux compteurs séparés `listenCountP2` / `listenCountP4` ?) — décidé en #32. Recommandation : un seul `listenCount` partagé qui se reset à `finishGuessingP2`, pour rester cohérent avec la sémantique actuelle ("écoutes pendant la phase guessing courante").
- **Modal de confirmation avant `revealOuzbekChain`** (réutiliser `<ConfirmDialog>` pour "Tout révéler ?") — option, pas obligation. Décidé au moment de #27.

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
  // partagé
  | 'menu'
  | 'challengeConfig' // écran de config Mode Challenge (cf. §3.12)
  | 'permission'      // demande micro
  | 'permissionDenied'
  // Mode 1 / Mode Challenge
  | 'recordingA'      // A enregistre (max 15s)
  | 'guessing'        // B écoute, note, enregistre
  | 'confirmEnd'      // confirmation "Êtes-vous sûr ?"
  | 'reveal'          // tout est lisible, dans les 2 sens
  // Mode Téléphone Ouzbek (cf. §3.13)
  | 'recordingP1'     // J1 enregistre
  | 'handoffP2'       // "Passe à J2"
  | 'guessingP2'      // J2 écoute reverse de P1 + écrit la note
  | 'handoffP3'       // "Passe à J3"
  | 'recordingP3'     // J3 lit la note + enregistre (pas d'accès reverse — cf. §3.13)
  | 'handoffP4'       // "Passe à J4"
  | 'guessingP4'      // J4 écoute reverse de P3 + répond oralement
  | 'revealOuzbek'    // chaîne complète lisible
```

Transitions linéaires, pilotées par actions Zustand. Le `mode` du round (`'mode1' | 'ouzbek'`) est porté par un champ dédié au store (cf. §5.2) et discrimine les transitions partagées (`permissionGranted` route vers `recordingA` ou `recordingP1` selon le mode). Pas de routeur ; pas de FSM imbriquée — un seul enum `Phase` plat suffit.

### 5.2 Store Zustand (forme)

Un seul store. Slices internes par concern :

```ts
type GameState = {
  // phase machine
  phase: Phase;

  // mode du round actif (cf. §3.13). Discrimine la branche
  // post-permission (recordingA vs recordingP1) et l'identité du round
  // jusqu'au backToMenu.
  mode: 'mode1' | 'ouzbek';

  // Mode 1 / Mode Challenge
  originalRecording: Recording | null;   // A's recording
  guessRecording: Recording | null;       // B's last recording (overwrites)
  notes: string;
  listenCount: number;
  challengeRules: ChallengeRules | null;
  guessingStartedAt: number | null;

  // Mode Téléphone Ouzbek (cf. §3.13)
  ouzbekRecordingP1: Recording | null;   // J1's recording (input du chain)
  ouzbekNoteP2: string;                   // note de J2 (transcription libre)
  ouzbekRecordingP3: Recording | null;   // J3's recording (re-utterance)

  // actions
  startGame: () => void;
  // ... etc
};

type Recording = {
  forward: AudioBuffer;
  reverse: AudioBuffer;
  durationMs: number;
  blob: Blob; // source Opus/WebM, retenu pour persistance IDB (cf. §3.5)
};
```

Why champs Ouzbek séparés (vs réutilisation de `originalRecording / notes / guessRecording`) : la sémantique diffère assez pour justifier la duplication. `originalRecording` et `guessRecording` portent une intention "Mode 1" (l'original à deviner / la proposition de B) ; les utiliser pour P1 et P3 forcerait les futurs lecteurs du store à tenir un mapping mental "ce champ veut dire X en Mode 1, Y en Ouzbek". Trois champs en plus est un coût accepté pour rester littéral. Cohérent avec §3.7 ("primitives réutilisables, pas d'abstraction Round générique"). Si la duplication devient gênante après #32, on factorisera.

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
- `<ConfirmDialog title message onConfirm onCancel confirmVariant />` — modal réutilisable (backdrop, Escape, focus initial sur "Annuler"). Servira aussi aux écrans de configuration des modes Challenge / Ouzbek.

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
│       ├── gameStore.test.ts
│       ├── persistence.ts            # IndexedDB load/save/clear
│       ├── persistence.test.ts
│       ├── persistGameStore.ts       # debounced save subscription
│       └── persistGameStore.test.ts
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
| **v0.2** | Mode Challenge (#26 squelette + #28 timer + #29 notes off + #30 ré-écoutes) — schéma `ChallengeRules` figé en §3.12 | Round Challenge complet jouable avec règles non-triviales appliquées, persistance du timer survit au lock screen, tests sur l'application des règles |
| **v0.3** | Mode Téléphone Ouzbek (#27 tracer bullet + #31 reveal enrichi) — design en attente (#25 HITL) | Round Ouzbek 4-joueurs jouable de bout en bout, persistance du round actif, reveal présentant la chaîne complète |
| **v0.4** | Mode Téléphone Ouzbek Challenge (#32) — combine les deux précédents | Round Ouzbek avec règles `ChallengeRules` appliquées aux phases pertinentes (guessingP4 et/ou guessingP2) |
| **v0.x** | Réflexion et éventuelle implémentation du mode online | Hors scope actuel |

Note : "Mode 2 (téléphone arabe)" et "Mode 3 (écoutes limitées)" de la roadmap initiale sont absorbés respectivement par Mode Téléphone Ouzbek (v0.3) et Mode Challenge (v0.2). Voir §1 et §3.12.

---

## 11. Glossaire / domaine

- **Round** — une séquence complète enregistrement → devinage → révélation.
- **Phase** — état courant de la machine à état (`menu`, `recordingA`, etc.).
- **Recording** — un couple `{ forward: AudioBuffer, reverse: AudioBuffer }` représentant un enregistrement réversible.
- **Joueur 1** (copy UI) / **A** (code interne, Mode 1) — le joueur qui enregistre la phrase originale.
- **Joueur 2** (copy UI) / **B** (code interne, Mode 1) — le joueur qui devine. Why: la copy utilisateur utilise des numéros (cohérence avec les modes multi-joueurs à venir où on parlera de Joueur 1/2/3/4) ; les noms de phases internes Mode 1 (`recordingA`, `originalRecording`, `guessRecording`) restent en A/B pour limiter le diff et éviter les régressions sur la persistance IndexedDB.
- **Joueur 3** / **Joueur 4** (Mode Ouzbek uniquement) — re-récorder (J3, lit la note de J2 et enregistre) et résolveur final (J4, écoute reverse de P3, répond oralement). Why : nommage en P1/P2/P3/P4 dans le code Ouzbek (`recordingP1`, `ouzbekRecordingP3`, etc.) — pas d'alias A/B/C/D parce que A/B portent une sémantique Mode 1 qui ne se transpose pas.
- **Mode** — `'mode1' | 'ouzbek'` ; identité structurelle du round actif. Discrimine la branche post-permission. Distinct de `challengeRules` qui ajoute des contraintes orthogonales aux deux modes.
- **Original recording** — l'enregistrement du Joueur 1 en Mode 1 (la phrase à deviner). Stocké en interne sous `originalRecording`. En Mode Ouzbek, l'équivalent (recording de J1 en haut de chain) est stocké sous `ouzbekRecordingP1`.
- **Guess recording** — la dernière prise du Joueur 2 (sa proposition vocale) en Mode 1. Stocké en interne sous `guessRecording`. Pas d'équivalent en Mode Ouzbek (J4 répond oralement, sans recording).
- **Direction** — `'forward' | 'reverse'` ; sens dans lequel un Recording est joué par un AudioPlayer.
- **Playback rate** — multiplicateur de vitesse appliqué au player (0.25 à 2.0).
- **Hand-off** — transition entre joueurs avec écran dédié pour le passage du téléphone (cf. §3.2). Mode Ouzbek introduit trois hand-offs explicites (`handoffP2`, `handoffP3`, `handoffP4`) parce que 4 joueurs implique plus de friction de coordination que les 2 joueurs du Mode 1.

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
