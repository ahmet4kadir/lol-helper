# LoL Helper

A League of Legends companion app: champ select insights and a movable in-game overlay.
Built with Electron, TypeScript and React on top of Riot's **local client (LCU) API** and the
official **Live Client Data API**. Nothing is injected into the game, no memory is read and no
input is automated — the app only consumes the same read-only endpoints that tools like
Porofessor and Blitz use.

## Features

**Champ select**
- Both teams' picks (and pick intents) with a curated damage profile per champion (AD / AP / Mixed)
  and composition tags (tank, engage, peel, poke, …)
- Enemy lane inference from champion role priorities (best assignment over all 5! lane permutations)
- Sharp verdicts: "4 AD — armor shuts this team down", missing frontline / engage / peel
- "What to pick" and "How to build vs them" advice derived from both compositions
- Meta pick and ban suggestions for your assigned lane (win / pick / ban rate, filtered to what the
  team is missing) via a pluggable stats provider
- One-click "Send to chat" composition summary through the client's chat API

**In game (overlay)**
- Transparent always-on-top overlay with draggable widgets; each can be hidden/shown from a dock
- `Ctrl+Shift+L` toggles edit mode ↔ locked (clicks pass through to the game)
- Objective timers (Dragon, Grubs, Herald, Atakhan, Baron) — automatic from Live Client events
- Jungle camp timers — click a camp when it dies, right-click to clear
- Lane-by-lane level and CS comparison, kill score
- Gold difference widget that appears while **Tab** is held: team item-gold total, then lane by lane
- Main window hides itself when the game starts and comes back for the next champ select; the app
  lives in the tray

- Enemy summoner-spell and ultimate timers — click when you see the spell: cooldown is derived from
  the spell, the enemy's boots (Ionian), their level (ult rank) and an optional Cosmic Insight toggle
- Base → lane timer — "Recall" / "At base" per enemy, travel time from base move speed + boots;
  dead enemies show respawn + travel automatically
- Ten-player table on the loading screen: rank, recent form, record on the champion being played

**Players** (all through the client, no API key)
- Teammates' rank, recent form and record on their hovered champion right in champ select
- All ten players once the game loads
- Player lookup tab: any Riot ID → rank, last 20 games, champion records, mastery

**Champ select picks and bans** — click a suggestion to hover it in the client, "Pick"/"Ban" to lock.
Per-champion build (start, core, situational items with win rates, runes, spells, skill order) for
the champion you hover.

### Meta stats source

Riot does not publish win rates. `src/main/stats/` wraps community sites' unofficial endpoints
behind a `StatsProvider` interface (currently Lolalytics). Those endpoints are undocumented and
can change; `npm run probe:stats` prints a raw sample so the column mapping can be fixed quickly.
Results are cached for 6 hours. If no provider works the rest of the app is unaffected.

## Requirements

- Windows 10/11 (macOS works for the client part; the overlay is tuned for Windows)
- Node.js 20+
- League of Legends running in **Borderless** or **Windowed** mode (the overlay cannot draw over
  exclusive fullscreen)

## Run

```bash
npm install
npm run dev        # starts the app, connects to the League client when it is running
npm run dev:mock   # same UI with fake champ select + live game data, no League needed
npm run typecheck
npm run dist       # Windows installer in ./release
```

## How it works

```
src/
  main/
    lcu/connector.ts   discovers LCU port + token (process args or lockfile), REST + WebSocket
    lcu/champSelect.ts parses /lol-champ-select/v1/session
    lcu/players.ts     Riot ID -> puuid, rank, match history, mastery via the client
    live/liveClient.ts polls https://127.0.0.1:2999/liveclientdata/allgamedata
    data/ddragon.ts    Data Dragon champions, items, runes, per-champion detail; cached on disk
    stats/             Lolalytics tier list + builds decoded from page state (unofficial, pluggable)
    input/keyHook.ts   read-only global key listener (Tab held) via uiohook-napi
    windows.ts         control window + transparent overlay window
    index.ts           state machine; pushes a single AppState to all windows over IPC
  preload/             contextBridge API (window.helper)
  renderer/
    control/           normal window: champ select + live game panels
    overlay/           draggable widgets rendered over the game
  shared/              types, curated champion meta, composition analysis, game timings
```

The main process owns all state. Every change is broadcast as a full `AppState` snapshot, so
renderers are pure functions of that state and the mock mode is a one-line swap.

`shared/`, `stats/`, `data/` and `lcu/` do not import Electron (the only Electron-specific pieces
are `index.ts`, `windows.ts`, the tray and the key hook), so the analysis, meta stats, build
decoding and Data Dragon layers can be lifted into a web backend as they are. The LCU and Live
Client parts are inherently local; a website version would replace `lcu/players.ts` with the
Riot API.

## Is this allowed?

Riot permits third-party apps that read the LCU and Live Client Data APIs and draw an overlay,
as long as they do not read game memory, inject code or automate gameplay. Features such as
automatic enemy spell detection are deliberately out of scope for that reason — camp and spell
timers here are started manually by the user. The keyboard listener only observes whether Tab is
held; it never blocks, modifies or sends input.

## License

MIT
