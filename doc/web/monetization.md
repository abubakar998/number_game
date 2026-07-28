# Marketing and monetizing Plusminus — an honest assessment

Companion to [social-launch.md](social-launch.md), which covers launch-day execution. This
doc is about money, and it starts with the part most guides skip.

---

## 1. The honest picture

Plusminus is a free browser game with no accounts, no saved progress, and sessions measured
in minutes. That's a fine thing to have built — but it means **direct revenue is very small
until traffic is very large.** Rough industry figures:

| Path | Realistic revenue |
|------|-------------------|
| Display ads @ ~$2 CPM | 10,000 monthly page views ≈ **$20/month** |
| Donations (Ko-fi / GitHub Sponsors) | **$0–20/month** for a project this size |
| Paid mobile app @ $1.99 | Near zero without a marketing budget — discovery is the whole game |
| HTML5 portal licensing | **$500–2,000 one-off**, or rev-share, *if accepted* |
| Education / classroom licensing | **$30–800/year**, small but real willingness to pay |

The uncomfortable arithmetic: to earn even minimum wage from ads you'd need roughly a
million page views a month. That is not a realistic target for an abstract two-player
number game, and pursuing it will make the game worse.

**So the honest recommendation is: don't monetize the game directly. Monetize what it
proves.** More on that in §4.

---

## 2. You can't monetize what you can't measure

Every option below depends on knowing whether the live site gets 10 visits a month or
10,000. **This is now instrumented** — a built-in counter, no third-party script:

```
GET /stats     → JSON of all counters
```

| Field | Meaning |
|-------|---------|
| `pageLoads` | Loads of the front page. **Not** unique visitors — there's nothing to dedupe by, so treat it as an upper bound. |
| `started` / `finished` | Games, split by mode (`hotseat` / `cpu` / `online`). Counted client-side, so local games are included too. |
| `byEnding` | How games ended: `win`, `resign`, or `timeout`. |
| `byVariant` | Addition vs Subtraction — tells you which game people actually want. |

Privacy: counts only. No cookies, no identifiers, no IP storage, so no consent banner is
required. Set `STATS_TOKEN` in the environment to require `?token=…` on `/stats`.

Counters are in memory and reset when the free tier sleeps, so each game finish also
prints a `[stats]` line to stdout — Render's log view is what survives restarts.

**The number that matters is `finished ÷ started`.** If people routinely abandon games,
the product isn't fun enough yet and no monetization strategy will fix that. Give it a
month of real traffic before committing to anything below.

---

## 3. Infrastructure you'd need first

Most paid features assume things the app doesn't currently have:

| Feature you'd want to sell | What it requires today |
|---|---|
| Accounts, saved stats, leaderboards | A database — rooms and scores are in-memory and die on restart |
| Anything with recurring billing | Accounts + a payment provider + the legal side (tax, refunds, ToS) |
| Reliable paid experience | A paid host — the free tier sleeps after 15 min and drops live games |

That's a real chunk of work standing between here and any subscription model. Weigh it
against the revenue table in §1 before starting.

---

## 4. The options, ranked by realism

### ★ 1. Treat it as a portfolio asset (highest actual value)
This project demonstrates things employers and clients pay well for: authoritative
server design, a solved-game AI, an exploit-resistant turn clock, a shared rules module
running in both browser and Node, and genuinely rigorous verification (an exhaustive
minimax solve as a test). Written up properly, that is worth vastly more in job or
freelance terms than any ad revenue this game will ever produce.

**Action:** a detailed write-up of the *engineering*, not the game. The reconnect-clock
exploit and the misère asymmetry are the two best stories.

### ★ 2. itch.io — free distribution, built-in tipping
The natural home for a browser game like this. Real audience, no gatekeeping, and native
"pay what you want" support. Costs an afternoon to publish.

**Action:** publish with the share card as cover art, tagged `math`, `two-player`,
`strategy`, `turn-based`.

### ★ 3. HTML5 game portals — the only realistic direct money
Portals like **Poki**, **CrazyGames**, **GameDistribution** and **Y8** license browser
games for a one-off fee or ad revenue share. This is how browser games actually earn.

Be realistic: they favour high-retention games with broad appeal, and an abstract
two-player maths game is a hard sell. The **vs Computer** mode with three difficulty levels
is the strongest angle. Expect rejection from the big ones; the smaller portals are more
permissive. Free to try, so worth the submissions.

### 4. The education angle — the clearest willingness to pay
This is a genuine teaching tool for modular arithmetic, game theory, and fair division. That
audience *does* buy resources.

**Action:** package a lesson — worksheet, teacher notes, the cut-and-choose discussion — and
list it on Teachers Pay Teachers. Post in r/matheducation and maths-teacher communities.
A "classroom mode" (one teacher, many students, no chat) would be the paid upgrade.

### 5. Build an audience on the maths, monetize that
The content series in [social-launch.md](social-launch.md) §4 is the asset here. The game is
the hook; the audience is the product. Slow, but it compounds — and the ideas are genuinely
interesting, which is the hard part most people lack.

### 6. Donations
A Ko-fi or GitHub Sponsors link costs ten minutes and has no downside. Expect very little.

---

## 5. What not to do

- **Don't add ads at current traffic.** You'd trade the clean, instant, no-signup feel — the
  best thing about the product — for a few dollars a month.
- **Don't build accounts and subscriptions speculatively.** That's weeks of work plus a
  paid host, for a product with no demonstrated demand. Get the §2 numbers first.
- **Don't gate the core game.** Its whole appeal is that it's instant and free. Paywalling
  the second variant would kill sharing, which is your only distribution.
- **Don't buy ads.** Paid acquisition for a free game with no revenue per user is money set
  on fire.

---

## 6. Marketing ideas beyond the launch plan

Additions to [social-launch.md](social-launch.md), aimed at compounding rather than one-off spikes:

- **The standing challenge.** "Nobody has beaten Legendary from a losing seat — because
  nobody can." A claim people re-share by trying to break it. Costs nothing, renews forever.
- **Embeddable widget.** An `<iframe>` snippet so maths bloggers and teachers can drop the
  game into a post. Turns other people's audiences into your distribution.
- **Maths YouTubers.** The cut-and-choose fairness mechanism and the misère
  off-by-one are exactly Numberphile/Stand-up Maths territory. A short, well-written email
  with the interesting part up front is a genuine long shot with a large payoff.
- **Puzzle of the day.** A fixed daily Target/Max pair everyone plays — the Wordle
  mechanic. This is the single strongest retention idea here, and the only one that would
  justify building persistence.
- **Product Hunt**, once the invite links and share card have been live long enough to
  have been tested by real users.

---

## 7. Suggested sequence

1. ✅ Analytics shipped — now just wait a month and read `/stats`. *(§2)*
2. Meanwhile: publish on itch.io, write the engineering post, run the launch plan. *(§4.1, §4.2)*
3. Read the finished-to-started ratio. **If it's poor, the game isn't fun enough yet and no
   monetization will fix that** — improve the game instead.
4. If it's good: submit to portals, and build the daily puzzle. *(§4.3, §6)*
5. Only then consider anything requiring accounts and payments.
