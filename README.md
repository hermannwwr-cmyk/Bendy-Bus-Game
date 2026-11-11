# 🚌 Bendy Bus Counting Fun

A counting game for kids around 6 years old. A green Singapore‑style **bendy bus** (articulated bus) drives past HDB blocks from stop to stop. At each stop, passengers get **off** and **on**, and the child counts them.

## How to play

1. Open `index.html` in any modern browser (desktop, iPad or phone in landscape). No install or build step is needed.
2. Pick a level:
   - 🐣 **Easy**: up to 5 passengers
   - 🐥 **Medium**: up to 10 passengers
   - 🦁 **Big Kid**: up to 15 passengers
3. Ride the route: 5 bus stops (Hawker Centre, Zoo, MRT Station, Kopitiam…) and then the Bus Interchange.
4. At each stop:
   - The bell rings *ding!* when someone wants to get off.
   - People walk out of the **EXIT** door. Each one gets a number bubble and the game counts aloud: "1, 2…"
   - People in the queue tap their card at the **ENTRY** door (*beep!*) and take a seat, and the game counts them too.
   - Then the child answers **"How many passengers are on the bus now?"** by tapping one of 3 big number buttons. Each button also shows dots, so the child can match amounts.
5. A wrong answer is never a dead end. The game says "Let's count together!", puts a number on each passenger one at a time, and lets the child try again.
6. A right answer earns a star ⭐, confetti and a simple number sentence like `3 − 1 + 2 = 5`, which introduces adding and taking away.

### 🗺️ Route map

A cartoon top‑down map shows the whole bus route: the start flag, every bus stop with its picture and name, HDB blocks, trees, a river and the sea. The bus moves along the road on the map in real time. Stops already visited get a green tick, and the next stop glows yellow.

- The map opens on its own for a few seconds each time the bus leaves for the next stop, so the child can see where the bus is going.
- Tap the 🗺️ button to open the map at any time. Tap anywhere to close it.
- The map closes by itself when a counting question appears.

The first stop starts with an easier warm‑up question: *"How many people are waiting at the bus stop?"* At the last stop everyone gets off and waves, and the question is *"How many people got off?"*

## Sound and animation

- All sounds are made in code with the Web Audio API: engine hum that rises with speed, stop bell, brake hiss, door chime, door‑closing beeps, card tap beep, footsteps, counting pops, a cheer jingle and a looping background tune.
- Spoken counting and instructions use the browser's built‑in speech, with an English (Singapore) voice if one is installed.
- 🔊 turns sound effects and voice on or off. 🎵 turns the music on or off. 🏠 goes back to the start screen.
- The animation includes a moving background with HDB blocks (laundry poles included), a bendy bus that bounces and flexes at the joint, spinning wheels, exhaust puffs, sliding doors, walking and waving passengers, and confetti.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page layout and on‑screen buttons |
| `style.css` | Styling for buttons and panels |
| `game.js` | The game: drawing, animation, sound, speech and game logic |

No images or audio files are used. Everything is drawn and synthesised in code.

## Play online (optional)

To get a link a child can open on a tablet, turn on GitHub Pages in the repository settings (**Settings → Pages → Deploy from branch**) and choose this branch.
