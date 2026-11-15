# 3-minute walkthrough (recording script)

| Time | Show | Say |
|---|---|---|
| 0:00–0:20 | README on GitHub | "This is a Playwright suite for saucedemo. Clone it, `npm ci`, install the browser, `npm test`, and you have 65 green tests in about 90 seconds." |
| 0:20–0:50 | Terminal: `npm test` running, then `npm run report` | "Green doesn't mean bug-free. 19 of these are *expected failures*. Each one is a known defect with an ID, listed here in the HTML report." Open one problem_user test and show the `known-bug` annotation and trace. |
| 0:50–1:20 | `tests/support/users.ts` → `KNOWN_BUGS`, then `user-matrix.spec.ts` | "One shopper contract, run against every user, with standard_user as the reference. The bug register is one table. If Sauce Labs fixes a bug, the run goes red, so the register stays accurate." |
| 1:20–1:45 | Terminal: `npm run test:bugs` summary | "Expected-failure tests pass no matter *why* they fail. This mode turns the register off so I can check that every failure is the real bug, not a broken locator. That exact problem happened while I was building this." |
| 1:45–2:25 | REPORT.md bug table, then docs/UX-REVIEW.md screenshots 1–3 | Biggest findings: an empty cart can be ordered for $0, error_user's Finish does nothing, visual_user's random prices. Then the UX issues: the form error handling, the cart without quantities, and the mobile layout. |
| 2:25–3:00 | REPORT.md, "Where AI helped and where it got things wrong" | "An AI agent explored the site, triaged the bugs and wrote most of the code. It also invented a bug that wasn't there, missed the 5-second login, and wrote a locator that made tests pass for the wrong reason. My job was to check every claim against evidence." |
