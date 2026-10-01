# The Ladder

A career simulator. Forty years, one quarter at a time, sixty workdays a
quarter. You split each day's bandwidth between delivery, mentoring,
networking and recovery, choose your hours, and answer what the quarter
throws at you. Every colleague in your division runs the same equations you
do: they burn out, get PIP'd, quit, get poached and compete with you for the
same empty chairs.

Play: <https://kirbisity.github.io/the-ladder/>

## How it works

- **Bandwidth** = hours × IQ × √health × motivation^0.3, split four ways.
- **Health** and **motivation** drift toward targets set by your hours, rest,
  age, personality and stagnation. Under 20% motivation is burnout: the screen
  greys and productivity drains toward nothing. Rest (35%+ Recovery) counts
  as sick leave and speeds recovery; after a year with an employer, **FMLA**
  gives twelve unpaid, job-protected weeks off. Motivation at zero is a
  breakdown, but the last 10% resists every fall.
- **Performance** is ranked against everyone at your level each quarter, in
  the design's brackets (top 5%, top 20%, middle, bottom 15% → PIP).
- **Promotion** needs readiness of 100, a strong standing (a smoothed stack
  rank) *and* an empty chair. Chairs open when people quit, retire, are fired
  or laid off, or move up themselves; senior chairs often go to outside
  hires, and years stuck at a level read as a plateau. Past the fork you pick
  a **track**: management (judged more and more on influence and people) or
  expert (judged on your own work). The Org tree's Career ladder shows both.
- **Pay** follows standing toward a target in the level's band, a few years
  behind it, and is never cut. Someone paid for past glory who has slipped
  is first on a layoff list unless someone above vouches for them.
- **Employers** come in tiers: high-growth (quarterly reviews, most PIPs, fast
  growth, best pay), established (twice a year), steady (once a year, more
  politics) and startups (equity; most fold, a few sell). Companies drift
  between tiers. Higher tiers cost more jobs and reach financial
  independence sooner. You pick the kind of employer for your first job (or
  take a surprise); later offers come from the market.
- **Peers** pick their plans by utility (ambition × gain − self-preservation
  × risk) and keep a ledger with you: allies warn and sponsor, enemies
  undercut you in calibration.
- **Characters**: Simon C (INTJ, takes long hours well, hates networking),
  Jennifer B (ENFP, takes long hours well, a natural networker), Chloe C
  (ENTP, moonshots, needs fun and autonomy), Joseph J (ISTJ, an average Joe),
  Richard K (ENFJ, works the room), Chris W (INTP, IQ 150, sustains extreme
  hours), Adam R (ENTJ, the natural leader) and Eve M (ISFJ, steady, but long
  hours wear her down). Everyone in the game goes by first name and last
  initial, and they differ only in numbers on the character card. Each is a
  3D model (a small software renderer, like Slope Lab's skier) built from their
  look card, so portraits, the office and every cut scene show the same face.
- **Industries** are patches over one default, each with its own seven
  projects and its own event deck: tech (on-call, migrations, RTO mandates,
  CVEs), consulting (up or out, utilization, death-march cases, sales
  targets), private equity (face time, IC memos, covenants, carry), academia
  (tenure clock, papers, grants, sabbaticals).
- **Events** open each quarter at work (or, out of work, from the job-hunt
  deck: COBRA, contract gigs, final rounds), and life lands on random days
  mid-quarter: medical bills priced by whether you are insured, rent hikes,
  car trouble, family.
- **Time off**: holidays of one, two or four weeks (15 paid days a year),
  and FMLA.
- **Age** fades body and mood past 35 (long days cost more, enthusiasm
  mellows) while bad news lands softer. Click the health or motivation bar for
  the breakdown. Universities are gentle on age; high-growth tech and finance
  are not, and push older people out. **Autopilot** runs whole quarters and
  answers events as you last did, asking only about new kinds.
- **Money**: click it for the net worth chart and the FIRE tracker. High-growth
  tech reaches financial independence around 35, steady tech around 50,
  startups sometimes overnight; academia rarely. At the end, save a one-page
  shareable story.
- **Out of work**, the search costs more than money the longer it runs:
  mood sinks, stress raises the odds of illness and medical bills, a
  marriage may break (half of everything, plus lawyers), and debt piles up.
- **Defeat**: health at zero (death), motivation at zero (breakdown), or out
  of work past the debt you can carry (homelessness). **Victory**: retire at
  62, or retire early (FIRE) once net worth covers your spending for life
  (25 years of it at 60, about 33 at 40). Every
  ending plays an animated scene (a funeral, a rainy alley, a hospital
  ward, retirement in a home that matches the money, a trip round the
  world) and closes with the story of the career, written from its
  journal. Big moments get short scenes too; Settings → Developer replays
  any of them.

## Balance

Balance is measured, not guessed. `tools/balance.js` plays whole careers with
policy bots (grinder, coaster, minimal, balanced, politician, adaptive,
random) for every character and industry and prints outcome tables:

```
npm run balance -- 25 tech all
```

`test/balance.test.js` pins the targets as relationships between play styles:
grinding fails, steady play retires, minimal effort stays low, the top chair
stays rare, and each defeat state is reachable.

`tools/characters.js` plays every character with the same policy and prints
how high they climb, how often they lose jobs and how they end;
`test/characters.test.js` pins how the characters relate (Joseph lands
senior, Adam leads, Chris sustains twelve-hour days, Chloe does best in
academia). The outcome report plays each character at each kind of
employer and writes a page:

```
node tools/characters.js 20 tech            # [careers] [industry|all] [policy] [tier]
node tools/report.js 30 tech out/tech.json   # one file per industry, plus `extras`
node tools/report-page.js out out/report.html
node tools/spiral.js 150 27                  # the unemployment spiral by quarters out
```

## Develop

```
npm test          # simulation, save/load and balance tests
npm run serve     # http://127.0.0.1:8933/
```

`window.theLadder.advanceDays(n)` steps the game without timers, for tests
in hidden browser tabs. `test/layout-sweep.browser.js` checks every screen
and dialog for overflow at ten viewport sizes.

Plain ES modules, no build step. Pushing to `main` runs the tests and
publishes the site.
