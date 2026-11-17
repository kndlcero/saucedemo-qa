# saucedemo-qa

[![playwright](https://github.com/kndlcero/saucedemo-qa/actions/workflows/playwright.yml/badge.svg)](https://github.com/kndlcero/saucedemo-qa/actions/workflows/playwright.yml)

Automated, AI-assisted QA of [saucedemo.com](https://www.saucedemo.com).

- **[REPORT.md](REPORT.md):** the one-page report (bugs, UX, approach, how AI was used)
- **[docs/UX-REVIEW.md](docs/UX-REVIEW.md):** the top 5 UX issues, with annotated screenshots and fixes

## Run it

Requires Node 18 or newer.

```bash
git clone https://github.com/kndlcero/saucedemo-qa.git
cd saucedemo-qa
npm ci
npx playwright install chromium
npm test
```

Expected output: `65 passed` in about 1.5 minutes. To open the HTML report with traces, timings and the known-bug annotations:

```bash
npm run report
```

### Other commands
| Command | What it does |
|---|---|
| `npm run test:bugs` | Turns off the known-bug register, so the 19 defects show as real failures with their assertion messages. |
| `npx playwright test -g problem_user` | Runs one user's column of the matrix. |
| `npm run explore` | Exploratory probes: run every user through a full journey and dump JSON and screenshots to `explore-output/`. |
| `npm run ux:screens` | Regenerates the annotated UX screenshots in `docs/ux/`. |

## How the suite is built

```
tests/
  user-matrix.spec.ts     10 shopper checks × 5 users (standard_user is the reference)
  auth.spec.ts            locked-out user, validation, route guards, logout + back button
  shopping-rules.spec.ts  totals and 8% tax, cart persistence, form rules, standard_user defects
  support/users.ts        users, catalogue, and the KNOWN_BUGS register
  support/pages.ts        a thin page object (Shop)
scripts/                  exploration probes, screenshot annotator, failure summarizer
```

**The known-bug pattern.** Every check runs for every user. When a user is *known* to break a check, the test is marked `test.fail()` and annotated with its bug ID. As a result:
- CI stays green and every bug is listed, in one place, in the HTML report.
- A **new** bug, or a regression for `standard_user`, turns the run red.
- A **fixed** bug also turns the run red ("expected to fail but passed"), so the register can't silently go out of date.

Because an expected-failure test passes no matter *why* it fails, `npm run test:bugs` lets you confirm that each one fails on the intended assertion (all 19 do).

**Stability.** The suite talks to a public site over the internet, so it gets 1 retry locally (2 in CI) for network flakes. Before publishing, it passed 130 of 130 runs (`--repeat-each=2 --retries=0`). Layout checks measure element positions rather than comparing pixel snapshots, so they behave the same on Windows, macOS and Linux CI.

## CI
`.github/workflows/playwright.yml` runs the suite on every push and pull request, and weekly, so it notices if Sauce Labs changes the demo users. The HTML report is uploaded as a build artifact.
