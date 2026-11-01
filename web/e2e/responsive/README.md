# Responsive audit

Drives every route of the web app at a fixed set of phone and tablet viewports, in the light and the dark theme, checks each page by
machine and writes screenshots and a report. It is the instrument for the phone, tablet and device audits (epic kantahe-dk8): every
auditor looks at the same screens at the same sizes, and a fix can be proved by running it again.

```sh
cd web
npm run e2e:responsive -- --allow-findings                 # the whole matrix, about 15 minutes; records a baseline
npm run e2e:responsive -- --baseline=/path/report.json     # a later run: findings the baseline does not have are marked "new"
npm run e2e:responsive -- --viewports=phone-390x844 --themes=light --routes=/library    # a part of it
npm run e2e:responsive:checks                              # the tests of the checks themselves (small pages, no server)
```

Once per machine: `npx playwright install chromium`. The run builds the server and `kantahe-fixtures`, starts the real server with
a scratch data folder and the Angular dev server (ports 18080 and 4300, the same as `npm run e2e`, so not at the same time), and
stops and removes everything afterwards. Nothing is written into the repository: the output goes to `$KANTAHE_AUDIT_OUT` or to
`kantahe-responsive` in the temp folder (the audit refuses a folder inside the repository), and only the live data of the scratch
server is looked at.

| Flag | Meaning |
|---|---|
| `--allow-findings` | do not fail on blockers; use it to record a baseline |
| `--baseline=FILE` | a `report.json` of an earlier run |
| `--viewports=a,b` | a whole name (`phone-390x844`) or a part (`390x844` gives the phone and its zoom variant) |
| `--themes=light` | only this theme |
| `--routes=/library,/me` | the states whose `route:state` contains one of these words (`/library:toast`, `/admin`) |
| `--workers=N` | browsers at a time, 1 to 8, default 4 |
| `--out=DIR` | where the report and the screenshots go |
| `--selftest` | adds `/selftest`, a page with a table 500 px wide: the run must fail and name it |

The run exits with a non-zero code when a **blocker** exists (and the flag above is not given). It also fails when the harness itself breaks
(a test that throws), which is different from a state it could not reach: that is a finding.

## What it leaves behind

* `report.md`: the findings by severity and check, one row per kind of element and state, with the viewports, a count and a link to
  the screenshot of an example. Read this first.
* `index.html`: a gallery of every screenshot by route and state, the border showing the worst finding.
* `report.json`: everything, with the stable id of each finding; this is the file to give as a baseline.
* `shots/`: one full-page PNG per state, viewport and theme, named after the state: `_library_many_phone-390x844_light.png`.

## The matrix

Phones in portrait 320x568, 360x640, 375x667, 390x844, 412x915, 430x932; phones in landscape 568x320, 667x375, 844x390, 915x412;
tablets in portrait 600x960, 744x1133, 768x1024, 810x1080, 820x1180, 834x1194, 1024x1366; tablets in landscape 960x600, 1024x768,
1080x810, 1180x820, 1194x834, 1366x1024; two desktops 1280x800 and 1920x1080 for reference. Every one at a device pixel ratio of 2, with
touch and the mobile flag on for phones and tablets, in the themes light and dark. Two of them (390x844 and 768x1024) are also run with the
text at 200% (`-zoom200`), the case of the operating system's large-text setting. It is in `matrix.ts`.

## The data

`seed.ts` fills the scratch server through its own API, the same on every run: 320 generated songs (MP3 and MIDI), four of them with a title
or an artist of 90 characters or a word of 45 letters with no place to break; a user Una with 60 favourites, three playlists (60 songs; a name
of 90 characters; empty), 54 entries of history (4 with a score), a queue of 30 and three devices (a laptop, a connected TV, an offline phone); a
user with an address of 60 characters; the administrator, who has nothing of their own, so that every page of theirs is also seen empty; and
one scratch account per worker for what changes while the audit runs (toasts, the player, codes). Every address ends in example.com.

## The routes and their states

`routes.ts` lists every route of `app.routes.ts` in the situations that matter: empty, many (the pages of 50 rows), one item, long text, an
error (the call is made to fail with a long message), a question or dialog open (the edit dialog, the delete and sign-out questions, the
playlist rename), a toast showing, the player idle, playing and on the score. To add a route or a state, add one line to `states()`:

```ts
at('/me/devices', 'list', 'user', '/me/devices', { after: ({ page }) => expect(page.locator('li.device').nth(2)).toBeVisible() }),
```

(route as `app.routes.ts` writes it, state name, who is signed in (`anon`, `user`, `admin`, `scratch`), the address, and optionally `before`, `after`,
`ready`, `core` and `ignore`). To add a viewport, add its size to `matrix.ts`.

## The checks

All are in `checks.ts` and tested by name in `checks.spec.ts` on small pages, each with a page that must be reported and one that must not.

| Check | Severity | Reports |
|---|---|---|
| horizontalOverflow | blocker on a core flow, else major | the page scrolls sideways (more than 1 px) |
| outsideViewport | blocker on a core flow, else major | an element sticks out of the window by more than 1 px; not inside something that scrolls sideways on purpose, not one parked wholly outside (a skip link), not what an ancestor with `overflow: hidden` cuts off so that the painted part fits (a title with an ellipsis; text cut off without one is clippedText); only the outermost element of a group |
| smallTargets | major | a button, link, field or other control under 44 px on either side; a checkbox counts with its label; a link in running text is exempt only when marked `data-inline-link`; disabled controls are not targets |
| tightTargets | major | two controls side by side or one above the other with a gap of 0.5 to 8 px (controls that touch are one group); while a modal dialog (`role=dialog aria-modal=true`) is open only the controls inside it count |
| clippedText | major | text cut off by `overflow: hidden` without `text-overflow: ellipsis` or a line clamp |
| overlap | major | a fixed or sticky element on top of a control that cannot be scrolled out from under it (at the top of the page for what is anchored in the upper half, at the end of the page for a fixed element in the lower half); dialogs are meant to cover |
| consoleErrors, failedRequests, brokenImages | minor | errors in the console, requests that failed (status 400 and up), an image that did not load |
| unreachable | blocker | the state could not be set up, so it was not checked; the screenshot shows how far it got |

The **core flows** are sign-in and set-up (`/setup`, `/login`, `/code`), the library, the queue and the player. The window size is told to the
checks from outside: a phone browser, and Chromium's emulation of one, makes the layout viewport as wide as a page that is too wide, so
`window.innerWidth` would agree with the page and hide the very problem.

A finding's **id** is `route:state|viewport|theme|check|selector`; the selector is built from tags, plain class names and the position among
siblings, never from an id with digits or a framework class, so that two runs of one build give the same ids. A check keeps at most 25 findings
for one state; the rest are counted in the summary, not listed.

## Layout tests of single bugs

A bug found by the audit gets a test that fails on the code that had it and passes when it is fixed. Write it in `layout.spec.ts`: it opens one
state of `routes.ts` at one viewport, exactly as the audit does (`openState`), and gives the test the findings of the checks:

```ts
test('/library many: the top bar fits inside the window at phone-320x568', async ({ browser }, info) => {
  const raw = await layout(browser, info, '/library:many', 'phone-320x568', (r) => r);
  none(raw, 'outsideViewport', 'div.top');
});
```

`layout(browser, info, 'route:state', 'viewport-name', look, theme?)` runs `look(findings, page)` (use `page` for measurements the checks do not make,
for example the bounding box of one element), `where(raw, check, selectorPart)` filters the findings and `none(...)` asserts that there are none, with
the selectors in the message. Name a test "route state: what at viewport". Run them with `npm run e2e:layout` (the same scratch server and data as the
audit; CI runs them too). A test that cannot fail proves nothing: after writing it, undo the fix and see it fail.

## What this is not

**Chromium emulates the size, the pixel ratio and touch of a device. It is not Safari and not an Android WebView.** It does not have the
dynamic toolbar of a phone browser, the safe areas of a notch, the on-screen keyboard that shrinks the window, iOS text-size rules or its
rubber-band scrolling, and fonts are the machine's. A clean run proves the layout, not the device. The audits therefore end with a real-device
check that only a person with the devices can do:

* **iPhone, Safari** (a small one and a large one, portrait and landscape): sign in; library with a long search; queue; Play here and the
  player in full screen; the score; Me → Devices; the keyboard open on the sign-in and the search fields (nothing hidden behind it); the
  notch and the home bar clear of the buttons; text size at the largest in Settings → Display.
* **Android phone, Chrome**: the same list; the back button and the address bar hiding on scroll; large text in system settings.
* **iPad Safari or an Android tablet**: portrait and landscape, split view if offered; the same list.

Each finding that comes out of a run is filed as its own bug with the id, the viewport, the screenshot and the real-device result.
