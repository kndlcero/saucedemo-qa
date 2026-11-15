/** Public demo credentials, printed on the saucedemo.com login page. */
export const PASSWORD = 'secret_sauce';

export const USERS = [
  'standard_user',
  'problem_user',
  'performance_glitch_user',
  'error_user',
  'visual_user',
] as const;
export type User = (typeof USERS)[number];

/** The real catalogue as served to standard_user (our source of truth / oracle). */
export const CATALOG = [
  { name: 'Sauce Labs Backpack', price: 29.99 },
  { name: 'Sauce Labs Bike Light', price: 9.99 },
  { name: 'Sauce Labs Bolt T-Shirt', price: 15.99 },
  { name: 'Sauce Labs Fleece Jacket', price: 49.99 },
  { name: 'Sauce Labs Onesie', price: 7.99 },
  { name: 'Test.allTheThings() T-Shirt (Red)', price: 15.99 },
];

/**
 * Known-bug register. Every functional check runs against every user; where a
 * user is *known* to break a check, the test is marked `test.fail()` with the
 * bug ID. That keeps the suite green while documenting each bug, and if Sauce
 * Labs ever fixes one, Playwright reports "expected to fail but passed" so the
 * register gets updated instead of silently rotting.
 */
export const KNOWN_BUGS: Record<string, Partial<Record<User, string>>> = {
  'product images load':          { problem_user: 'BUG-01', visual_user: 'BUG-14' },
  'sorting reorders the list':    { problem_user: 'BUG-02', error_user: 'BUG-08' },
  'every item can be added':      { problem_user: 'BUG-03', error_user: 'BUG-09' },
  'items can be removed':         { problem_user: 'BUG-04', error_user: 'BUG-10' },
  'product link opens that item': { problem_user: 'BUG-05' },
  'listed price matches cart':    { visual_user: 'BUG-15' },
  'checkout form keeps input':    { problem_user: 'BUG-06', error_user: 'BUG-11' },
  'order can be completed':       { problem_user: 'BUG-07', error_user: 'BUG-12' },
  'pages respond within 2s':      { performance_glitch_user: 'BUG-13' },
  'layout matches standard':      { visual_user: 'BUG-16' },
};
