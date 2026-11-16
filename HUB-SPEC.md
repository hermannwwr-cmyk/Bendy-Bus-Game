# All-in-one app: shared spec (working brief for the builders)

The app lives in `/home/user/Bendy-Bus-Game` (git branch `claude/dazzling-albattani-67ajm8`).
It combines three existing kids' games (child is ~6–7, plays on an iPad/tablet, also iPhone) behind one
launcher ("the hub") with ONE shared, grown-up play-time limit.

```
index.html              the hub (launcher, shared clock, grown-up settings, shared sleep screen)
games/bus/              Bendy Bus Counting Fun (index.html, game.js, style.css) - canvas, landscape
games/grizzly/index.html Grizzly and the Lemmings (20 mini games) - canvas 960x540, landscape
games/mrt/index.html    MRT Math Express - DOM, portrait-phone first, also works landscape
```

Each game runs inside a full-screen `<iframe>` created by the hub with `?hub=1` on its URL, e.g.
`games/mrt/index.html?hub=1`. Without `?hub=1` every game must behave EXACTLY as before
(standalone mode untouched). Everything must keep working offline from `file://` (no build step,
no dependencies, everything inline/synthesised). In `file://` the frames have opaque "null" origins,
so always use `postMessage(msg, '*')` and never touch `parent.document` or rely on shared
localStorage between hub and game.

## Hub mode in a game

```js
const HUB = /[?&]hub=1\b/.test(location.search) && window.parent !== window;
```

In hub mode a game:
1. Does NOT count play time and does NOT read/write its own play-time storage keys
   (Grizzly `grizzly-limit`/`grizzly-play`, MRT `mrtLimit`/`mrtPlay`). Its other storage (stars,
   badges, sound settings) stays as is.
2. Hides its own grown-up gear / settings / gate (the hub owns those). Where that button was on the
   game's own start/menu screen, it shows instead a big friendly **"back to all games"** button
   (a house/map-style icon in the game's own art style, at least 56px tap target) that posts
   `{hub:'exit'}`. (Grizzly: the gear spot at (40,30) on the menu and sleep screens. MRT: the
   ⏱️ `#homeClock` chip on the start screen. Bus: add one on the title screen, top-left.)
   In-game home buttons keep going to the game's own start/menu screen as today.
3. Takes its time from the hub. The hub posts, about once a second and immediately after the game
   posts `{hub:'hello'}` (which the game sends as soon as its script starts):
   ```js
   {hub:'time', limit: 20 /*minutes, 0 = off*/, left: 734 /*seconds left today, Infinity-free: null when limit is 0*/, used: 466 /*seconds*/, share: 0.39 /*0..1 of today's allowance used, 0 when off*/}
   ```
   The game's existing clock chip, sky clock and "getting sleepy" warnings use these values
   instead of its own counter (Grizzly `playTime.left()/used()/share()/limit`, MRT `playTime`).
   Until the first message arrives, behave as "no limit".
4. Bedtime: when `left` reaches 0 the game runs its OWN existing gentle ending, never cutting a
   child off mid-question/mid-turn (Grizzly: next end-of-level overlay shown for 3 s or its
   BEDTIME_GRACE; MRT: "2 more stops" / "Last stop!" then the night end screen; Bus has no limiter
   today: let the current stop finish (question answered right), then end with a short
   "The bus is going to sleep" goodnight moment of a few seconds). When that ending is done,
   instead of showing its own sleep/lock screen, the game posts `{hub:'sleep'}` once. The hub then
   removes the iframe and shows the shared sleep scene. (The hub also force-sleeps after a
   generous fallback of 3 minutes past zero, so a game that never posts is still stopped.)
5. On `{hub:'pause'}` the game should silence music/speech (the hub sends it right before it
   removes the frame; mostly a courtesy - removal kills the frame anyway).
6. Nothing else changes: same art, sounds, gameplay, difficulty, star/badge storage.

## Messages, summary

| from → to | message | when |
|---|---|---|
| game → hub | `{hub:'hello', game:'bus'|'grizzly'|'mrt'}` | script start |
| game → hub | `{hub:'exit'}` | child taps "back to all games" |
| game → hub | `{hub:'sleep'}` | the game's gentle bedtime ending has finished |
| game → hub | `{hub:'stars', count:N}` (optional) | stars/badges changed, for the hub's cards |
| hub → game | `{hub:'time', limit, left, used, share}` | ~1 s, and on hello |
| hub → game | `{hub:'pause'}` | before the frame is removed |

Ignore messages that are not objects with a `hub` string field.

## The hub (index.html)

Counts play time (whole seconds) only while a game frame is showing, no grown-up modal is open, and
the page is visible. Storage keys `hub-limit` (minutes, default 20; choices Off/10/15/20/30) and
`hub-play` = `{day:'Y-M-D' (no zero padding), used: seconds, extra: minutes}`; a new day starts
fresh; every access in try/catch; works without storage. `left = limit*60 + extra*60 - used`.

- Launcher: three huge, gorgeous, animated cards/scenes for the three games, a big title, spoken
  names on tap (speechSynthesis), sound effects and an original gentle tune (Web Audio, no files),
  music/sound toggle. Pre-readers must manage it: minimal text, big targets, voice.
- Grown-up gear (top-left) → times-table check 6–9 × 6–9 on an on-screen keypad (wrong answer
  shakes and gives a new sum) → settings: daily limit Off/10/15/20/30, today's use, "+5 minutes
  today", "Start today again", Done. Same design as the games' existing ones.
- Shows minutes left on the launcher (a friendly chip) and a sky that goes morning → afternoon →
  evening → night as the allowance is used (like the games do).
- Locked (left <= 0): launcher shows the shared sleep scene (all three games' heroes asleep under
  the stars - Grizzly + lemmings, the bendy bus with sleepy eyes/headlights off, the MRT train -
  with a lullaby); cards can't be opened; adding time in settings wakes everyone.
- Frame lifecycle: tapping a card plays a short transition, creates the iframe (full viewport,
  no border, `allow="autoplay"`), stops hub music. On `exit`/`sleep` it posts `pause`, removes
  the frame, calls `speechSynthesis.cancel()`, and transitions back.
- iOS audio: unlock Web Audio + speech on real taps (pointerup/touchend/click/keydown), set
  `navigator.audioSession.type='playback'` when available. Buttons fire on pointerup.
- Test hook `window.__hub` with at least: `open(key)`, `exit()`, `state()` (current screen,
  frame key), `playTime` (`left()`, `used()`, `limit`).

## Design constraints (from the owner's games)
Gentle for young kids: no game over, no timers other than the grown-up's daily limit, which never
cuts a child off mid-turn. Touch first. Original characters/tunes/sounds (don't copy TV cartoons or
real MRT/bus chimes or operator branding). Storybook / paper-cut look: flat shapes, soft shading,
no black outlines, warm rich colours. Must look stunning on an iPad (1024×768 and 1180×820 landscape,
also portrait) and on an iPhone (390×844 portrait and sideways).
