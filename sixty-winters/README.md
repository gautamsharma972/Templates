# Sixty Winters

A legacy RPG for Android and iOS where **your hero's lifespan is the only currency**.

Every road, rest, lesson and burst of power costs seasons of one finite life. Heroes age as they
travel: Might fades, Lore deepens. Death is certain. What you leave behind is the game: a grave
other players find on the road, a notched heirloom, and an heir who carries one of your traits.

## Why this game (market research, November 2026)

| Finding | Source | What it means for the design |
|---|---|---|
| Mobile RPG revenue has fallen four years running. In 2025: MMORPG −13%, idle RPG −14%, turn-based −6%. | Sensor Tower *State of Mobile 2026* via [Mistplay](https://business.mistplay.com/resources/rpg-mobile-game-trends), [Mobidictum](https://mobidictum.com/?p=410489) | Cloning an existing sub-genre means entering a shrinking, crowded pool. |
| Downloads fell 12% in H1 2026 while IAP fell only 2%; new launches took ~7% of 2025 revenue. | [PocketGamer.biz](https://www.pocketgamer.biz/mobile-gaming-iap-dipped-2-as-ad-spend-climbed-in-h1-2026/), [Mobidictum](https://mobidictum.com/?p=211736) | Installs are scarce and expensive. Retention, not acquisition, is the lever. |
| Median retention is ~22% D1, 4% D7, 0.7% D30; top-decile games reach ~40 / 12 / 4. RPGs sit near 30 / 10 / 3.5. | GameAnalytics 2026 via [InvestGame](https://investgame.net/news/pdf/2026-01-20-mobile_retention_benchmarks_2026/), [Segwise](https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies) | Targets to beat: D1 40%, D7 15%, D30 6%. |
| Gacha RPGs are losing player trust even where revenue holds; most Japanese gacha titles die within three years. | [TechWiser](https://techwiser.com/gacha-games-losing-players/), [Outlook Respawn](https://respawn.outlookindia.com/gaming/gaming-news/japans-gacha-game-bubble-bursts-as-most-titles-die-within-3-years), [Naavik](https://naavik.co/digest/beyond-gacha-why-chinas-gaming-giants-are-pivoting-to-lifestyle-sims/) | No gacha, no energy timers. Trust is a differentiator. |
| The hybrid-casual roguelike template (Archero 2, Capybara Go) earns well but every entry shares one meta. | [Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2025/7/31/habbys-hybridcasual-empire-the-template-that-built-a-powerhouse) | Short sessions work. The fusion-and-evolve meta is the saturated part. |
| Real-time multiplayer has the longest sessions but poor retention; async features that reward solo players do better. | GameAnalytics via [Playio](https://blog.playio.co/how-to-retain-mau-mobile-games), [GameGrowthAdvisor](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-retention-strategies-2026/) | Multiplayer here is asynchronous: you play alone, among other players' traces. |
| A systemic premium game can top mobile charts (Balatro: ~$4.4M mobile in its first months). | [PocketGamer.biz](https://www.pocketgamer.biz/balatro-nears-44m-on-mobile-amid-a-sudden-spending-surge) | Depth of one clean mechanic sells without a live-ops treadmill. |

A search for mobile RPGs combining generational legacy with an async shared world found none.
The retention figures above come from secondary write-ups that disagree in places; treat them
as ranges, not exact values.

## What is different

1. **Time is the only resource.** There is no gold, mana or energy. Travel costs seasons. Resting
   costs seasons. Training costs a winter. In a fight you can *burn a winter* to double a blow.
2. **Ageing changes how you play.** Might peaks at 26–36 and fades; Lore keeps growing. The same
   hero is a fighter at 25 and a sage at 55, so no build stays solved.
3. **Death is content for someone else.** Your fallen hero becomes a grave on this week's road.
   Other players can light a candle there or ask the shade to fight beside them. Each candle
   reaches you as Renown the next time you open the game.
4. **One road per week, shared by everyone.** The realm is generated from the week number, so
   all players walk the same map and can talk about it.
5. **The house outlives the hero.** An heir inherits a trait you choose; the heirloom gains a
   notch per generation; Renown buys permanent house perks.

### Retention design

| Horizon | Hook |
|---|---|
| Session (3–6 min) | One realm: nine steps and a warden. Saved after every tap. |
| Day | "Three travelers lit a candle for Mira." Rewards arrive while you are away, with no timers. |
| Week | A new shared realm every Monday. |
| Months | The family tree, the heirloom's notches, house perks. |

Monetisation is deliberately out of the prototype. The fit is premium or cosmetic (grave
styles, heirloom skins, house crests), never selling time, because time is the game.

## Run it

```bash
npm install
npm run dev        # play in a browser
npm test           # engine rules and balance simulation
npm run server     # shared-world server on :8787
VITE_API_URL=http://localhost:8787 npm run dev   # play against that server
```

Without `VITE_API_URL` the game runs offline: the weekly realm is identical, and graves belong
to seeded wanderers instead of players.

## Build for the stores

The game is one TypeScript codebase wrapped by [Capacitor](https://capacitorjs.com). The native
projects are in `android/` and `ios/`.

```bash
VITE_API_URL=https://your-server.example npm run android   # opens Android Studio
VITE_API_URL=https://your-server.example npm run ios       # opens Xcode (macOS only)
```

Android needs Android Studio with an SDK; iOS needs a Mac with Xcode. Neither was available
where this was written, so the native projects are generated and synced but **have not been
compiled or run on a device yet**.

## Layout

| Path | What |
|---|---|
| `src/engine.ts` | All rules. Pure, deterministic, serialisable state. No DOM. |
| `src/content.ts` | Traits, foes, names, realms. |
| `src/main.ts`, `src/style.css` | The interface. |
| `src/net.ts` | Shared-world client. Every call is best-effort; play never waits on it. |
| `server/server.mjs` | Zero-dependency Node server for graves and candles. |
| `tests/engine.test.ts` | Rules, save/load, and a 300-life balance simulation. |

## Before launch

- Host the server and move its JSON file to a real database; add rate limiting.
- Player accounts, so a house survives a lost phone (saves are on-device only today).
- Push notifications for candles; art, sound and haptics; store listings and icons.
- More content: the prototype has 6 foes, 2 elites, 5 wardens and 8 road events.
- A soft launch to measure D1/D7/D30 against the targets above.
