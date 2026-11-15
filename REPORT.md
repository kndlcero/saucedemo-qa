# Swag Labs (saucedemo.com): QA report

**Scope:** login, catalogue, sort, product detail, cart, and the 3-step checkout, for all 6 demo users. Desktop Chrome, plus a mobile UX pass.
**Result:** 65 automated tests, all green. **19 defects** are recorded as expected failures: 16 from the deliberately buggy users and 3 that also affect `standard_user`.

## Bugs found

| User | ID | Defect |
|---|---|---|
| **standard_user** (affects everyone) | 17 | An **empty cart can be checked out**. A $0.00 order is accepted and "dispatched". |
| | 18 | Whitespace-only First/Last/ZIP (`"   "`) passes the required-field check. |
| | 19 | **Reset App State** empties the cart badge, but the product buttons keep saying "Remove" until you reload. |
| **problem_user** | 01 | Every product image is the same 404 placeholder (a dog photo). |
| | 02–04 | Sorting does nothing. **Add to cart does nothing** for 3 of 6 items (Bolt T-Shirt, Fleece Jacket, Red T-Shirt). Remove does nothing. |
| | 05 | Clicking a product opens a **different product** (e.g. Backpack opens Fleece Jacket). |
| | 06–07 | Typing a Last Name **overwrites First Name**. Last Name stays empty, so checkout can't be completed. |
| **error_user** | 08 | Sorting pops an alert "Sorting is broken!" and the list doesn't change. |
| | 09–10 | Add to cart fails for the same 3 items (JS error "Failed to add item to the cart"). Remove fails. |
| | 11 | Last Name **won't accept input**, yet Continue lets you through without it (validation bypass). |
| | 12 | **Finish does nothing.** The order never completes. |
| **performance_glitch_user** | 13 | Login takes about 5.1 s and each sort about 5.3 s, with no loading indicator. |
| **visual_user** | 14–16 | Product list shows **random prices** that change on every render (Backpack $85.89, then $29.99 in the cart). Backpack has the 404 image. The cart icon, two product titles and the last Add-to-cart button are out of place. |
| **locked_out_user** | n/a | Correctly refused, as designed. |

Evidence: screenshots in [docs/bugs/](docs/bugs/), plus a trace for every test in the HTML report (`npm run report`).

## UX: top 5 (screenshots and fixes in [docs/UX-REVIEW.md](docs/UX-REVIEW.md))
1. **Empty-cart checkout.** Add an empty state, disable Checkout, and block it on the server.
2. **Checkout form.** Every field turns red for one error, labels are placeholders only, errors come one at a time. Use persistent labels, inline per-field errors, and trim input.
3. **The cart can't change quantity**, and shows no thumbnails or subtotal. Add a stepper, images, a running total, and "added to cart" toasts.
4. **Mobile:** the price and Add to cart sit below the fold on every card, and sort is an unlabeled funnel. Use a compact card and a "Sort: …" label.
5. **Product data:** a "T-Shirt" is pictured as a sweatshirt, the copy reads like code, and "Reset App State" is in the shopper menu.

## Why this approach
- **Playwright + TypeScript.** Auto-waiting, traces and HTML reports make each failure easy to investigate. It runs headless in CI (a GitHub Actions workflow is included, scheduled weekly).
- **One contract, run against every user.** The same 10 shopper checks run for all 5 users who can log in, with `standard_user` as the reference. Known defects live in one register (`KNOWN_BUGS`) and are marked `test.fail()`, so the suite stays green but documents every bug. If Sauce Labs fixes one, the run goes red ("expected to fail but passed"). `npm run test:bugs` turns the register off to show the raw failures.
- **AI at build time, not at run time.** I used an AI coding agent to explore, triage and write tests. The tests themselves are deterministic code. A model in the test loop would be slower, cost money on every run, and could give a different verdict on the same build.
- **Layout checks by measuring positions**, not pixel snapshots. Snapshots depend on the operating system and font rendering, so they would break between my machine and CI. Measuring where elements are catches the visual_user defects on any platform.

## Where AI helped and where it got things wrong
**Helped:** Claude Code (an AI coding agent) wrote the exploration probes, which run the same journey as every user and dump JSON plus screenshots. It then read those dumps to propose the bug list, designed the user-matrix and known-bug pattern, wrote the page objects and the screenshot annotator, and diagnosed failures from Playwright's error files. That took me from nothing to 65 tests and 19 confirmed bugs in one sitting.

**Got wrong (all caught by checking evidence):**
1. **False bug.** Its first probe kept stale element handles and reported that *no* user's "Add to cart" button changes to "Remove". The cart-badge count disagreed, so I threw that out.
2. **Missed bug.** It timed the performance user's login as **39 ms** (it waited for the URL to change, not for the page to render). The real figure is about 5.1 s.
3. **Tests passing for the wrong reason.** The AI-written locator `getByRole('button')` also matched product links (they have `role=button`). Buggy-user tests then "failed as expected" because of a locator error, not the bug. This is the risk of expected-failure tests, so I added `SHOW_BUGS` and checked that each of the 19 expected failures fails on its own assertion.
4. **Wrong element and timing assumptions.** It clicked a `data-test` icon that sits under the real menu button, took screenshots before the page finished rendering, and labelled a test-ID dump one page off. One cart check never waited for the page to change. That passed 130 local runs but failed on the faster Linux CI runner, which the CI pipeline caught.

**Takeaway:** AI is very fast at exploring and writing tests, but it states wrong things with confidence. Every claim it makes needs evidence: a second signal, a forced failure, or a stress run (the suite passed 130 of 130 runs with retries off).
