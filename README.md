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
  age, personality and stagnation. One-off blows tip you into burnout, never
  straight through it; only working on through burnout ends in a breakdown.
- **Performance** is ranked against everyone at your level each quarter, in
  the design's brackets (top 5%, top 20%, middle, bottom 15% → PIP).
- **Promotion** needs readiness of 100 *and* an empty chair. Chairs open when
  people quit, retire, are fired or laid off, or move up themselves.
- **Peers** pick their plans by utility (ambition × gain − self-preservation
  × risk) and keep a ledger with you: allies warn and sponsor, enemies
  undercut you in calibration.
- **Industries** are patches over one default: tech (tech debt and 2 AM
  pages), consulting (up or out, utilization), private equity (face time,
  deal flow, carry), academia (tenure clock, citations, grants).
- **Defeat**: health at zero (death), motivation at zero (breakdown), or out
  of work with no savings (homelessness). **Victory**: retire at 62.

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
