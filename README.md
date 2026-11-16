# Let's Play! 🚌🐻🚆

Three kids' games in one app, for children around 6–7, played mostly on a tablet:

| | Game | What it is |
|---|---|---|
| 🚌 | **Bendy Bus** | Count the passengers getting on and off a Singapore bendy bus at every stop (up to 5). |
| 🐻 | **Grizzly and the Lemmings** | 20 gentle mini games: catching, counting, adding and taking away with pictures, mazes, puzzles and more. |
| 🚆 | **MRT Train** | Ride a real MRT line and answer adding and taking-away questions (numbers up to 10) as passengers get on and off. |

Open `index.html` (or the published page), tap a picture, and play. Every game has a round cream "all games" button (four coloured squares) on its start screen to come back.

## One play-time limit for all three

A grown-up sets a single daily limit that covers all three games together (20 minutes a day unless changed).

- **Settings:** tap the ⚙️ gear on the home screen. A times-table question keeps children out. Then choose Off, 10, 15, 20 or 30 minutes, give "+5 minutes today", or "Start today again".
- **What counts:** time only counts while a game is open, not on the home screen.
- **Sky clock:** the sky in the home screen and the games goes from morning to evening to night as the time is used up.
- **Ending:** no game ever stops mid-question. In the last minute each game says it's getting sleepy. When the time is up, the child finishes the current turn, sees that game's goodnight, and then everyone (Grizzly, the lemmings, the bus and the train) is asleep under the stars until tomorrow or until a grown-up adds time.

Like any web page, this can be undone by clearing the browser's site data. For a hard lock, use the device's own screen-time controls.

## Files

| Path | What it is |
|---|---|
| `index.html` | The home screen ("hub"): the storybook world, the shared play-time limit, the grown-up settings and the bedtime scene |
| `games/bus/` | Bendy Bus Counting Fun |
| `games/grizzly/index.html` | Grizzly and the Lemmings |
| `games/mrt/index.html` | MRT Math Express |

No build step, no downloads: everything is drawn and synthesised in code, and it works offline from `file://`. Each game still works on its own when opened directly.
