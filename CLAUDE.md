# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Let's Play!": an all-in-one app for a ~6–7-year-old that combines three of the owner's games behind one launcher (the "hub") with ONE shared daily play-time limit set by a grown-up. Tablet first, also iPhone.

```
index.html               the hub: storybook launcher, shared play time, grown-up settings, shared sleep scene
games/bus/               Bendy Bus Counting Fun (index.html, game.js, style.css), canvas, landscape
games/grizzly/index.html Grizzly and the Lemmings (20 mini games), canvas 960x540, landscape
games/mrt/index.html     MRT Math Express, DOM, portrait-phone first
icons/, manifest.webmanifest, .nojekyll   hosting
```

No build step, no dependencies; everything is drawn and synthesised in code and works offline from `file://` (the bus game loads the Baloo 2 web font when online and falls back without it).

The owner reviews as a player, from screenshots and a link, not from code. Report in plain language and send screenshots of visible changes.

## Where the games come from

The games are copies of the owner's standalone games, plus a small "hub mode" patch in each:
- Bus: this repo's `gh-pages` branch (`index.html`, `game.js`, `style.css`).
- Grizzly: the `Grizzly-and-the-lemmings-game` repo's `index.html` (its CLAUDE.md documents the game in depth).
- MRT: the `MRT-GAME` repo's `index.html` (its CLAUDE.md and `tests/play.js` document and test it).

Hub mode only switches on with `?hub=1` inside an iframe (`const HUB = /[?&]hub=1\b/.test(location.search) && window.parent !== window`). Without it each copy behaves exactly like the original. To bring in a newer version of a game, re-apply that game's hub-mode code (everything guarded by `HUB`, plus the hub-only CSS) to the new file; `git log -p games/<game>` shows it.

## Hub ↔ game protocol (postMessage, always to `'*'`)

In `file://` the frames have opaque origins, so never touch `parent.document` and don't rely on storage shared between hub and game. Ignore messages that aren't objects with a `hub` string; games also check `e.source === window.parent`, and the hub checks that messages come from the current frame.

| from → to | message | when |
|---|---|---|
| game → hub | `{hub:'hello', game}` | script start; the hub closes a frame that hasn't said hello within ~6 s |
| game → hub | `{hub:'exit'}` | child taps the "all games" button |
| game → hub | `{hub:'sleep'}` | the game's own gentle bedtime ending has finished; the hub treats it as the end of the day |
| game → hub | `{hub:'stars', count}` | optional, for the stars shown on the launcher |
| hub → game | `{hub:'time', limit, left, used, share}` | about every second and on hello; `left` is null and `share` 0 when the limit is off |
| hub → game | `{hub:'pause'}` | right before the frame is removed |

In hub mode every game: doesn't count time or touch its own play-time storage; hides its own grown-up gear/gate/settings; shows the shared **all-games button** top-left on its start screen (a 64px cream paper circle, fill `#fff6e0`, rim `#d9b57f`, with a 2×2 grid of rounded cards `#f26b5b` `#f5b83d` / `#5cb85c` `#4fa3e0`, bobbing gently); shows the shared clock chip look (cream pill, drawn clock, m:ss, orange with a moon in the last minute); runs its own gentle bedtime ending and then posts `sleep` once; never starts a new round once time is up; and paints the letterbox around its canvas as sky and grass (Grizzly, Bus).

- **Grizzly:** the menu gear spot becomes the all-games button; its bedtime ending (end-of-level overlay for 3 s, or `BEDTIME_GRACE`) posts `sleep` where it used to `go('sleep')`.
- **MRT:** `#homeClock` becomes the all-games button (inline SVG). Its "2 more stops" flow starts at 60 s left, so its bedtime ride usually ends before zero; it posts `sleep` ~7 s into the sleepy end screen. At zero on the start or normal end screen it posts `sleep` at once.
- **Bus:** it had no limiter; hub mode adds the clock chip, a last-minute warning between stops, an evening-to-night sky following `share`, and a goodnight moment (the bus parks, lights off, "Goodnight, bus!") after the stop in progress is answered.

## The hub (`index.html`)

One canvas, in the Grizzly paper-cut art style (its art kit, palette and the embedded Fredoka font were copied in).
- **Launcher:** a panoramic storybook world with three places on paper islands joined by a path: the bendy bus at its stop, Grizzly and the lemmings, the MRT train on a viaduct. Places idle-animate and take turns doing a "look at me" act. A tap pops (pointerdown), then on pointerup squashes, plays a sound, speaks the name, throws confetti, zooms in and closes an iris in that game's colour with its hero bouncing while the frame loads. Landscape: places side by side; portrait: zig-zag down the hills. Arrow keys / Enter / 1–3 / M work too.
- **Turn sideways:** Grizzly and Bus are landscape games. On a portrait screen the hub shows a "Turn me sideways!" card instead, opens the game when the device turns, and covers a running game (not counting time) if it's turned back upright. MRT opens in any orientation.
- **Play time:** storage `hub-limit` (minutes, default 20; Off/10/15/20/30) and `hub-play` = `{day:'Y-M-D' (no zero padding), used: seconds, extra: minutes}`. Counts whole seconds only while a game frame is showing (after hello, no transition, no modal, no sideways card, page visible), and never past the allowance. Re-reads on `storage` events and when the page becomes visible. The launcher shows minutes left plus a sun-to-moon track; the sky follows `share()` from dawn to night, with warm window and lamp light drawn after the night tint.
- **Bedtime:** at zero the game finishes the turn and posts `sleep` (fallback: force-sleep 3 minutes past zero). The shared sleep scene shows everyone asleep with a lullaby; places can't be opened; it survives reloads. Adding time in the settings wakes everyone.
- **Grown-ups:** the gear (top left, launcher and sleep scene only) → a 6–9 × 6–9 times-table check on a keypad (a wrong answer shakes and gives a new sum) → limit, today's use, "+5 min today", "Start today again", Done.
- **Other storage:** `hub-stars`, `hub-music`, `hub-mute`. Every access in try/catch; works without storage.
- **iOS audio:** unlocks on pointerup/touchend/click/keydown and sets `navigator.audioSession.type = 'playback'`; buttons fire on pointerup. Hub music stops while a game is open; on leaving a game the hub posts `pause`, cancels speech and removes the frame.
- **Test hook** `window.__hub`: `open(key, {anyway})` (returns `'rotate'` when the sideways card shows), `exit()`, `state()`, `playTime` (`left()`, `used()`, `share()`, `limit`), `modal` (with `answer`), `layout()`, `buttons()`, `setUrl(key, url)` (point a place at a fake game), `closeRotate()`, `sky(phase)`.

## Testing

No test suite in this repo. Verify with headless Playwright (`require('playwright')` is preinstalled in cloud sessions), serving the folder with `python3 -m http.server` or loading `file://`. Useful sizes: iPad 1180×820, 1024×768, 820×1180; iPhone 390×844, 844×390, 375×667.
- Seed bedtime states with `page.addInitScript(() => { localStorage.setItem('hub-limit','20'); localStorage.setItem('hub-play', JSON.stringify({day, used: 1130, extra: 0})) })`; `hub-limit` `'0'` turns the limit off.
- The MRT suite (`node tests/play.js` in the MRT-GAME repo) still runs against a copy of `games/mrt/index.html` placed next to that `tests/` folder (with its `icons/` and manifest), proving standalone behaviour is unchanged.
- Each game's own test hooks still work inside the frame (`frame.evaluate`): Grizzly `window.__game`, Bus `window.__bendyBus`.
- Never commit test hooks or shortened timers.

## Design constraints

Gentle for young kids: no game over, no timers except the grown-up's daily limit, which never cuts a child off mid-turn. Pre-readers: big targets, minimal text, spoken names. Touch first. Original characters, tunes and sounds; no copied TV-cartoon looks, real MRT/bus chimes or operator branding. Paper-cut storybook look: flat shapes, a darker crescent on the lower right, rims in a deeper tone, no black outlines.
