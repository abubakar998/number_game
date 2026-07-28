# Sharing Plusminus — launch strategy

Live: <https://number-game-2l4k.onrender.com/>

---

## 0. Pre-launch blockers — all implemented ✅

| # | Issue | Status |
|---|-------|--------|
| 1 | **No social preview tags** — links rendered as bare URLs | ✅ Full `og:` + `twitter:` card set, with a generated 1200×630 image at `/og.png`. |
| 2 | **Cold start** — free tier sleeps after ~15 min idle | ✅ Opt-in keep-alive, off by default (see below). |
| 3 | **No shareable room link** | ✅ `?room=CODE` invite links; a **Copy invite link** button appears with the room code. |
| 4 | **In-memory rooms** | Policy, not code — **don't redeploy during a promo push**, it ends every game in progress. |

**Regenerating the share card:** `node tools/make-og-image.js` rewrites `public/og.png`.
Edit the strings at the bottom of that script to change the wording. It draws with Node's
built-in `zlib` only, so the project keeps its single dependency.

**Turning on keep-alive** (only worth it around a launch push): set `KEEPALIVE_URL` to the
public URL in Render's environment settings, optionally `KEEPALIVE_MINUTES` (default 10).
Left unset, nothing pings. It's deliberately opt-in — it burns free-tier hours the host
would rather reclaim, so a paid instance is the clean fix for a genuinely busy site.

**Note on the preview card:** the `og:` URLs are absolute and hardcoded to
`number-game-2l4k.onrender.com` (scrapers don't resolve relative paths). If the domain ever
changes, update the `<head>` block in `public/index.html`. After deploying, re-scrape the
link once on each platform so the old bare-URL preview isn't served from cache.

---

## 1. Positioning

The name does the first half of the work: **Plusminus** — one game, two directions. Don't sell the rest as "a number game", which sounds like homework. Sell the **mathematical hook**, which is genuinely unusual:

> **This game is solved. There is a line of maths that decides the winner before the first move — and the computer knows it.**

Three angles, in order of strength:

1. **"You cannot beat Legendary."** Provocative, testable, and *true* — from a won seat, perfect play is unbeatable. People will try to disprove it. That's engagement you don't have to manufacture.
2. **The fairness trick.** One player picks the numbers, the *other* picks who goes first — the ancient "I cut, you choose" principle applied to a game. Rigging becomes pointless. This is the most *interesting* thing in the project and travels well beyond gaming audiences.
3. **Two games, one engine.** Count up and win, or count down and whoever hits zero loses. The second is the *misère* form, and its winning rule differs by exactly one — a detail that reliably surprises people who assume it's symmetric.

Supporting facts worth mentioning: free, no signup, no install, works on a phone, cross-device online play.

---

## 2. Platform plan

Ranked by fit. Do not blast the same copy everywhere — each community punishes that.

### Reddit — best fit, start here
Communities reward substance and honesty about self-promotion. Post as a maker sharing something, not as an ad.

- **r/WebGames**, **r/playmygame**, **r/SideProject** — the game itself.
- **r/webdev**, **r/javascript** — the build. Angle: zero build step, one dependency, shared rules module that runs identically in the browser and Node.
- **r/mathpuzzles**, **r/math** — the theory. Angle: the modular rule and the misère asymmetry. Lead with the puzzle, link second.

Rules: read each sub's self-promo policy, post one at a time over several days, and reply to every comment for the first few hours.

### Hacker News — "Show HN"
Angle: server-authoritative design. The server owns move validation *and* the turn clock, so a reconnect resumes your timer instead of resetting it — a small exploit that's easy to miss. Post Tue–Thu morning US time. Be present in the thread.

### X / Twitter
Short hook + a screen recording of a full game. The AI difficulty comparison makes a good thread.

### LinkedIn
The engineering story, not the game. Cut-and-choose as a fairness-design decision; the solved-game maths driving the AI.

### TikTok / Reels / Shorts
"I'll beat you every single time" → play a round → reveal the rule. Under 30 seconds. Highest ceiling, most work.

---

## 3. Ready-to-post copy

**X / Twitter (hook post)**
> I built a game you can't win.
>
> Not "hard" — *mathematically impossible*, if the computer gets the right start.
>
> There's one line of arithmetic that decides the winner before anyone moves. Beat Legendary and you've disproved it.
>
> Free, no signup: [link]

**X thread continuation**
> 2/ The trick: with Max add = 4, you win by always leaving your opponent on a multiple of 5. Get there once and they can never escape.
>
> 3/ So whoever picks the numbers could rig it. Fix: one player sets the numbers, the *other* chooses who moves first. Rigging stops working — the chooser just takes the winning side.
>
> 4/ There's a second mode where you count *down* and whoever hits zero loses. Same maths, except the magic number shifts by one. Most people assume it's symmetric. It isn't.

**Reddit (r/WebGames / r/SideProject)**
> **I built Plusminus — a two-player number game that's mathematically solved. Try to beat the "Legendary" AI**
>
> Add up to N each turn, first to the target wins. Or play the subtraction version, where you count down and whoever lands on zero loses.
>
> The interesting part: it's a solved game, so with perfect play the winner is decided the moment the numbers are chosen. That means whoever picks the numbers could rig it — so the game splits the roles. One side sets the numbers, the other picks who moves first. Rigging becomes useless.
>
> Three AI levels. Legendary plays perfectly and genuinely can't be beaten from a winning start — your only chance is taking the right seat. Beginner blunders often enough to be fun.
>
> Also has hotseat and online play with room codes. Free, no signup, no install.
>
> [link]
>
> Built with vanilla JS and one dependency (`ws`). Happy to answer anything about the maths or the implementation.

**Hacker News**
> **Show HN: Plusminus – a solved number game with a server-authoritative AI opponent**
>
> Two variants of the same subtraction game — normal play (reach the target, win) and misère (hit zero, lose). Both are solved, so the AI is a closed-form rule rather than a search.
>
> Two design details I found interesting:
>
> - Because the game is solved, whoever picks the parameters could force a win. So the roles are split: one player sets the numbers, the other chooses who moves first — cut-and-choose. Rigging becomes self-defeating.
> - The turn clock is server-owned. A browser-side timer can be stalled, and worse, reloading the page would hand you a fresh turn. A reconnect resyncs the remaining time instead of restarting it.
>
> Vanilla JS, one dependency. [link]

**LinkedIn**
> I built a small two-player game, and the most interesting problem wasn't the code — it was fairness.
>
> The game is mathematically solved: with perfect play, the winner is determined the moment the two parameters are chosen. So whoever sets them could always force a win.
>
> The fix is centuries old. One player sets the numbers; the *other* chooses who moves first. Exactly the logic of letting one child cut the cake and the other pick the slice. Rigging the parameters stops being an advantage, because the opponent just takes the winning side.
>
> A reminder that some problems are better solved by changing the incentives than by adding rules.
>
> Playable free, no signup: [link]

---

## 4. Content beyond launch day

The maths is a renewable series — one idea per post:

1. Why "leave them on a multiple of 5" wins every time.
2. Cut-and-choose, and where else it shows up (rent splitting, inheritance, treaties).
3. Why the countdown version's rule shifts by one — the misère surprise.
4. Why a 35%-accurate AI still beats most people (they're below 35% too).
5. Why the turn clock had to move to the server — with the reload exploit as the story.

---

## 5. Honest expectations

Most launches get modest numbers, and that's normal. Judge it on **whether people finish a game and start a second one**, not on impressions. If you want that signal, a simple counter of games completed would tell you more than any analytics dashboard.

With invite links now in place, every online game is a potential invitation — someone pastes a link into a chat and their friend is playing in one click. That's the mechanism most likely to spread the game, so it's worth leading with "play a friend" in your copy rather than only "beat the AI".
