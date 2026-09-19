| **PRIME STUDIOS** — **EPISODEDETAIL OVERVIEW-TEST READ** *Why `EpisodeDetail.test.jsx`'s "explicit overview tab still shows the Overview body" fails. Verdict: **STALE/DEFECTIVE TEST**, not a regression in the component's `?tab=overview` path. The failure is order-dependent: the same test passes 5/5 when it runs first and fails 5/5 when any prior `EpisodeDetail` render precedes it.* |
| --- |

***Provenance:*** *filed under Task #1549 (Stage 0 diagnosis; waived from the locked sequence by Evoni 2026-09-18). **Rules nothing. Mints nothing. Fixes nothing.** Push, PR create and merge are NOT ruled and are not assumed — Rule 7 gates each separately.*

# EpisodeDetail Overview-Test Read

**Basis:** `origin/main` at `34b3da26fcab7ea740631e3109eb1ab702856435`.

```
$ git log -1 origin/main
commit 34b3da26fcab7ea740631e3109eb1ab702856435
Author: angelcreator113 <evonifoster@yahoo.com>
Date:   Sat Sep 19 10:05:23 2026 -0400

    feat(frontend): land episode on Checklist by default [skip-automerge] (#1546)

    Task: #1545
```

Basis is `34b3da26`, as the task required (`34b3da26` or later). ✔

**Author:** Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**FILENAME DISCREPANCY, DISCLOSED ON THE FACE.** This document is filed as
`EpisodeDetail_OverviewTest_Read_2026-09-20.md` because Task #1549 names that
exact path in its Files and Commit lines, and that name is the task's contract.
**The work was performed on 2026-09-19**, which is also the basis date above.
`/audit-file` rule 7 would otherwise date the filename 2026-09-19. **Recorded,
not corrected** — the filename is not re-minted, and a reader should take
**2026-09-19** as the date of every measurement below.

**A NOTE ON MEASUREMENT METHOD.** Task #1549 framed this as a static read and
offered "undeterminable statically" as an outcome. **The static read alone was
undeterminable** — see §4 and §5.1. This note therefore performed the runtime
check that settles it, using `npx vitest run` on the existing test file, which
is inside `/validate`'s own sanctioned toolset (`Bash(cd frontend && npx vitest
run:*)`). **No source file and no test file was edited. No application was
started. No host, AWS, database or Cognito contact.** The runs are reproducible
by anyone holding a clone plus `frontend/node_modules`.

---

# §0. Standing of every claim in this note

| § | Claim | Standing |
| --- | --- | --- |
| §1–§3 | The three tests' text, line numbers and mock setup | **MEASURED** — repo read at this basis |
| §4 | The component's per-tab load path and the loading gate | **MEASURED** — repo read at this basis |
| §5 | The test fails; it passes in isolation; it fails after any prior render | **MEASURED** — `npx vitest run` output pasted verbatim |
| §6 | Verdict: STALE/DEFECTIVE TEST, not a component regression | **MEASURED** — rests entirely on §5's order-dependence |
| §7 | The re-render-loop mechanism | **INFERRED from source**, file:line cited; **NOT instrumented**. §7.3 names the runtime check that would raise it to MEASURED. |

**§7's standing is not upgraded by §5.** §5 proves the verdict; §7 only offers
the mechanism, and a successor must not cite §7 as measured.

---

# §1. The failing test, quoted in full

`frontend/src/pages/EpisodeDetail.test.jsx:127-132`

```
127	  test('explicit overview tab still shows the Overview body', async () => {
128	    renderEpisodeDetail('/episodes/ep-1?tab=overview');
129	
130	    await waitFor(() => expect(screen.getByTestId('episode-overview')).toBeTruthy());
131	    expect(screen.queryByTestId('episode-checklist')).toBeNull();
132	  });
```

**Its render call** is the shared module-scope helper, `EpisodeDetail.test.jsx:100-106`:

```
100	const renderEpisodeDetail = (entry = '/episodes/ep-1') => render(
101	  <MemoryRouter initialEntries={[entry]}>
102	    <Routes>
103	      <Route path="/episodes/:episodeId" element={<EpisodeDetail />} />
104	    </Routes>
105	  </MemoryRouter>,
106	);
```

**Its mocks are all module-scope. The test body declares none of its own.** The
episode fetch is mocked at `EpisodeDetail.test.jsx:34-44`:

```
34	vi.mock('../services/episodeService', () => ({
35	  default: {
36	    getEpisode: vi.fn().mockResolvedValue({
37	      id: 'ep-1',
38	      title: 'Episode One',
39	      show_id: 'show-1',
40	      show: { id: 'show-1' },
41	    }),
42	    updateEpisode: vi.fn(),
43	  },
44	}));
```

**Does that mock resolve? YES, and it keeps resolving for the whole file.**
`mockResolvedValue` is set once at `:36` and is never cleared: the only reset in
the file is `EpisodeDetail.test.jsx:109-111`, which touches the `api` default
export and nothing else —

```
109	  beforeEach(() => {
110	    Object.values(api).forEach((fn) => fn?.mockReset?.());
111	  });
```

— and `frontend/vitest.config.js:19-22` sets no `mockReset`, `clearMocks`,
`restoreMocks` or `setupFiles`:

```
19	  test: {
20	    environment: 'jsdom',
21	    globals: true,
22	  },
```

**So the failing test's episode fetch is a resolved mock, identical to the one
the passing siblings use.** This rules out "the failing test doesn't resolve the
fetch the passing one does" — the hypothesis Task #1549 §5 offered as the
canonical STALE-TEST shape. That specific shape is **DISPROVED**; the verdict is
still STALE TEST, for the different reason at §6.

**The body it expects** is mocked at `EpisodeDetail.test.jsx:50-52`:

```
50	vi.mock('../components/Episodes/EpisodeOverviewTab', () => ({
51	  default: () => <div data-testid="episode-overview">Overview body</div>,
52	}));
```

---

# §2. The passing siblings, quoted in full

**The checklist-landing test (no `?tab`)** — `EpisodeDetail.test.jsx:120-125`:

```
120	  test('rendering with no tab shows the checklist body', async () => {
121	    renderEpisodeDetail();
122	
123	    await waitFor(() => expect(screen.getByTestId('episode-checklist')).toBeTruthy());
124	    expect(screen.queryByTestId('episode-overview')).toBeNull();
125	  });
```

**The explicit `?tab=checklist` test** — `EpisodeDetail.test.jsx:113-118`, quoted
because §5 uses it as a second predecessor:

```
113	  test('?tab=checklist renders the production checklist', async () => {
114	    renderEpisodeDetail('/episodes/ep-1?tab=checklist');
115	
116	    await waitFor(() => expect(screen.getByTestId('episode-checklist')).toBeTruthy());
117	    expect(screen.queryByTestId('episode-todo-overlays')).toBeNull();
118	  });
```

**Their body mock** — `EpisodeDetail.test.jsx:62-64`:

```
62	vi.mock('../components/Episodes/EpisodeProductionChecklist', () => ({
63	  default: () => <div data-testid="episode-checklist">Production checklist body</div>,
64	}));
```

---

# §3. Diff of the two setups

**There is no per-test setup difference to diff.** All three render tests use the
same helper at `:100`, declare no local mocks, await no additional promise, and
share one `beforeEach` at `:109-111` that resets only the `api` default export.
Item by item:

| Setup element | Failing test (`:127`) | Passing siblings (`:113`, `:120`) | Differs? |
| --- | --- | --- | --- |
| render call | `renderEpisodeDetail('…?tab=overview')` `:128` | `renderEpisodeDetail('…?tab=checklist')` `:114` / `renderEpisodeDetail()` `:121` | **query string only** |
| episode fetch mock | module-scope `:34-44`, resolved | module-scope `:34-44`, resolved | **no** |
| auth mock | module-scope `:26-28` | module-scope `:26-28` | **no** |
| toast mock | module-scope `:30-32` | module-scope `:30-32` | **no** |
| `beforeEach` | `:109-111` (`api` only) | `:109-111` (`api` only) | **no** |
| local `mockResolvedValue` | none | none | **no** |
| extra `await` | none | none | **no** |
| assertion shape | `waitFor(getByTestId(…))` then `queryByTestId(…)` null | identical shape | **no** |

**One asymmetry exists, and it is in the component, not the test.** The body the
failing test waits for is an **eager** import; the body the passing siblings wait
for is **lazy**, behind a `Suspense` boundary:

```
frontend/src/pages/EpisodeDetail.jsx
10	import EpisodeOverviewTab from '../components/Episodes/EpisodeOverviewTab';
21	const EpisodeProductionChecklist = lazy(() => import('../components/Episodes/EpisodeProductionChecklist'));
```

That asymmetry is not a *gating* difference (§4 shows neither path gates on the
other), but it is the one structural difference between the two waits, and §7.2
returns to it.

**Provenance of all three tests.** Both the failing test and the no-`?tab`
sibling were added in the **same commit**, `13a6c54492121b56fd1d4e07291fee67d392a815`
("land episode on Checklist by default", PR #1531, 2026-09-18) — the same commit
that changed the default tab. Neither test predates the other, so "the test's
setup went stale relative to a later component change" is **not available as an
explanation**: there was no later component change. `git log --oneline -8 --
frontend/src/pages/EpisodeDetail.jsx` shows `13a6c5449` as the newest commit
touching the component.

```
$ git show 13a6c5449 --stat
 frontend/src/pages/EpisodeDetail.jsx      |  4 ++--
 frontend/src/pages/EpisodeDetail.test.jsx | 16 +++++++++++++++-
 2 files changed, 17 insertions(+), 3 deletions(-)
```

The component half of that commit is two lines, both the same substitution:

```
-  const [activeTab, setActiveTabState] = useState(searchParams.get('tab') || 'overview');
+  const [activeTab, setActiveTabState] = useState(searchParams.get('tab') || 'checklist');
...
-    const initial = searchParams.get('tab') || 'overview';
+    const initial = searchParams.get('tab') || 'checklist';
```

**Neither line is reachable when `?tab=overview` is present** — both are the
`||` fallback, which `searchParams.get('tab') === 'overview'` short-circuits.

---

# §4. The component's load path, traced per tab

All line references are `frontend/src/pages/EpisodeDetail.jsx`.

**Where it reads the tab — `:64`, and again at `:132` and `:176`:**

```
64	  const [activeTab, setActiveTabState] = useState(searchParams.get('tab') || 'checklist');
65	  const [epSubTab, setEpSubTab] = useState(null);
...
131	  useEffect(() => {
132	    const initial = searchParams.get('tab') || 'checklist';
133	    const [main, sub] = resolveEpTab(initial);
134	    if (main !== initial) {
135	      setActiveTabState(main);
136	      if (sub) setEpSubTab(sub);
137	    } else {
138	      const epTab = EP_TABS.find(t => t.key === main);
139	      if (epTab?.subs && !epSubTab) setEpSubTab(epTab.subs[0].key);
140	    }
141	  }, []);
...
175	  useEffect(() => {
176	    const tab = searchParams.get('tab');
177	    if (tab) {
178	      const [main, sub] = resolveEpTab(tab);
179	      setActiveTabState(main);
180	      if (sub) setEpSubTab(sub);
181	    }
182	  }, [searchParams]);
```

**The tab identifier the body switch uses — `:118`:**

```
118	  const tabKey = epSubTab ? `${activeTab}.${epSubTab}` : activeTab;
```

**The mapping — `:98-113`.** `'checklist'` is remapped; `'overview'` is not in the
map and falls through `:112` unchanged:

```
 98	  const resolveEpTab = (tab) => {
 99	    const map = {
...
104	      'checklist': ['production', 'checklist'],
...
110	      'brief': ['overview', null],
111	    };
112	    return map[tab] || [tab, null];
113	  };
```

**Resolved `tabKey` per entry point, derived from the above:**

| Entry | `:64` initial `activeTab` | `:131` mount effect | `:175` URL-sync effect | `tabKey` (`:118`) | Body rendered |
| --- | --- | --- | --- | --- | --- |
| `?tab=overview` | `'overview'` | `resolveEpTab('overview')` → `['overview', null]`; `main === initial`, so the `else` at `:138` runs; `EP_TABS.find(key==='overview')` (`:81`) has **no `subs`**, so `epSubTab` stays `null` | `tab='overview'` → `setActiveTabState('overview')`, `sub` null so `epSubTab` untouched | **`'overview'`** | `:662` `EpisodeOverviewTab` |
| no `?tab` | `'checklist'` | `resolveEpTab('checklist')` → `['production','checklist']`; `main !== initial`, so `:135-136` set `activeTab='production'`, `epSubTab='checklist'` | `tab` is `null` → whole block skipped | **`'production.checklist'`** | `:834` `EpisodeProductionChecklist` |
| `?tab=checklist` | `'checklist'` | same as the row above | `tab='checklist'` → `['production','checklist']` → same values re-set | **`'production.checklist'`** | `:834` |

**Where it fetches the episode — `:190-207` and `:217-221`:**

```
190	  const fetchEpisode = useCallback(async () => {
191	    try {
192	      setLoading(true);
193	      setError(null);
194	      const data = await episodeService.getEpisode(episodeId);
195	      setEpisode(data);
196	    } catch (err) {
...
204	    } finally {
205	      setLoading(false);
206	    }
207	  }, [episodeId, navigate, toast]);
...
216	  // Episode loading
217	  useEffect(() => {
218	    if (episodeId) {
219	      fetchEpisode();
220	    }
221	  }, [episodeId, fetchEpisode]);
```

**What it renders while loading, and what gates the transition — `:462-486`:**

```
462	  if (authLoading || loading) {
463	    return (
464	      <div className="ed-page">
465	        <div className="ed-state">
466	          <div className="ed-spinner"></div>
467	          <p>Loading episode...</p>
468	        </div>
469	      </div>
470	    );
471	  }
472	
473	  if (error || !episode) {
474	    return (
...
478	          <h2>Episode Not Found</h2>
...
486	  }
```

**The gate, stated exactly.** The component leaves `Loading episode...` when
`authLoading === false && loading === false` (`:462`). It then shows
`episode-overview` when, additionally, `error` is falsy and `episode` is truthy
(`:473`) and `tabKey === 'overview'` (`:662`):

```
660	        <Suspense fallback={<div className="ed-loading"><div className="ed-spinner" /></div>}>
661	        {/* Overview Tab */}
662	        {tabKey === 'overview' && (
663	          <EpisodeOverviewTab
664	            episode={episode}
665	            show={episode.show}
666	            onUpdate={handleUpdateEpisode}
667	          />
668	        )}
```

and the checklist when `tabKey === 'production.checklist'` (`:834`):

```
834	        {tabKey === 'production.checklist' && (
835	          <EpisodeProductionChecklist
836	            episode={episode}
837	            showId={episode?.show_id || episode?.showId}
838	          />
839	        )}
```

**`authLoading` is `false` for every test** — `EpisodeDetail.test.jsx:26-28` mocks
`useAuth` to `{ isAuthenticated: true, loading: false }`.

## §4.1 What the trace establishes, and what it does not

**Establishes: no gate in the load path is conditioned on the tab.** Neither
`:462` nor `:473` reads `activeTab`, `epSubTab` or `tabKey`. `fetchEpisode`
(`:190`) and its effect (`:217-221`) contain no tab reference. The only two
tab-conditioned effects in the file are `:257-270` (guarded
`activeTab !== 'scenes'`) and `:273-303` (guarded `activeTab !== 'wardrobe'`);
**neither fires for `'overview'` or for `'production'`**, so neither can
distinguish the failing test from the passing ones.

**Does not establish which of the task's two outcomes holds.** A static read
shows the `?tab=overview` path is structurally sound and should render
`episode-overview`. It does not explain the observed failure at all, and by
itself would have to be recorded as **undeterminable**. §5 is the runtime check
that settles it.

---

# §5. The runtime check

All runs below are `npx vitest run` from `frontend/`, at this basis, against the
unmodified test file.

## §5.1 The failure, reproduced

```
$ cd frontend && npx vitest run src/pages/EpisodeDetail.test.jsx --reporter=verbose

 FAIL  src/pages/EpisodeDetail.test.jsx > EpisodeDetail — Track 6 CP14 module-scope helpers > explicit overview tab still shows the Overview body
TestingLibraryElementError: Unable to find an element by: [data-testid="episode-overview"]

Ignored nodes: comments, script, style
<body>
  <div>
    <div class="ed-page">
      <div class="ed-state">
        <div class="ed-spinner" />
        <p>
          Loading episode...
        </p>
      </div>
    </div>
  </div>
</body>
 ❯ src/pages/EpisodeDetail.test.jsx:130:11

 Test Files  1 failed (1)
      Tests  1 failed | 16 passed (17)
   Duration  2.21s
```

**The DOM at failure is the `:462-471` loading branch verbatim** — `ed-page` →
`ed-state` → `ed-spinner` + `Loading episode...`. The component never left
`loading === true` inside `waitFor`'s 1000 ms default window.

## §5.2 The same test, run alone: PASSES

```
$ cd frontend && npx vitest run src/pages/EpisodeDetail.test.jsx -t 'explicit overview tab still shows the Overview body'

 ✓ src/pages/EpisodeDetail.test.jsx  (17 tests | 16 skipped) 58ms

 Test Files  1 passed (1)
      Tests  1 passed | 16 skipped (17)
   Duration  1.17s
```

**Same component, same URL, same mocks, same assertions — passes in 58 ms.**

## §5.3 One predecessor is sufficient to make it fail

```
$ cd frontend && npx vitest run src/pages/EpisodeDetail.test.jsx -t 'shows the'
 FAIL  src/pages/EpisodeDetail.test.jsx > … > explicit overview tab still shows the Overview body
      Tests  1 failed | 1 passed | 15 skipped (17)

$ cd frontend && npx vitest run src/pages/EpisodeDetail.test.jsx -t 'production checklist$|explicit overview'
 FAIL  src/pages/EpisodeDetail.test.jsx > … > explicit overview tab still shows the Overview body
      Tests  1 failed | 1 passed | 15 skipped (17)
```

Either sibling alone, run first, is enough. By contrast the two checklist tests
run together both pass:

```
$ cd frontend && npx vitest run src/pages/EpisodeDetail.test.jsx -t 'checklist'
 ✓ src/pages/EpisodeDetail.test.jsx  (17 tests | 15 skipped) 87ms
      Tests  2 passed | 15 skipped (17)
```

## §5.4 Ten shuffled runs — the decisive measurement

```
$ cd frontend && for i in $(seq 1 10); do npx vitest run src/pages/EpisodeDetail.test.jsx \
    --sequence.shuffle --reporter=verbose -t 'checklist|overview'; done
```

Execution order and outcome, run by run (`OV` = the failing test under
examination; `CL1` = `?tab=checklist`; `CL2` = no-`?tab`):

| Run | 1st | 2nd | 3rd | OV position | OV result |
| --- | --- | --- | --- | --- | --- |
| 1 | ✓ OV | ✓ CL2 | ✓ CL1 | first | **PASS** |
| 2 | ✓ CL1 | ✓ CL2 | × OV | third | **FAIL** |
| 3 | ✓ CL1 | × OV | × CL2 | second | **FAIL** |
| 4 | ✓ CL1 | × OV | × CL2 | second | **FAIL** |
| 5 | ✓ OV | ✓ CL1 | ✓ CL2 | first | **PASS** |
| 6 | ✓ OV | ✓ CL1 | ✓ CL2 | first | **PASS** |
| 7 | ✓ OV | ✓ CL1 | ✓ CL2 | first | **PASS** |
| 8 | ✓ CL1 | ✓ CL2 | × OV | third | **FAIL** |
| 9 | ✓ CL2 | ✓ CL1 | × OV | third | **FAIL** |
| 10 | ✓ OV | ✓ CL2 | ✓ CL1 | first | **PASS** |

**5/5 PASS when the overview test runs first. 5/5 FAIL when any prior
`EpisodeDetail` render precedes it. No exceptions in ten runs.**

Two further readings from the same table:

1. **The failure is not confined to `?tab=overview`.** In runs 3 and 4 the
   *checklist* test (`CL2`) also fails, having run after the failed overview
   test. A checklist render is therefore not immune; it fails in the same way
   once it follows a failed render.
2. **The first render in a worker process always passes**, whichever tab it
   targets — `OV` in runs 1/5/6/7/10, `CL1` in runs 2/3/4/8, `CL2` in run 9.

---

# §6. The decision

## **VERDICT: STALE TEST** (more precisely: a defective, order-dependent test)

## **NOT a regression in the component's `?tab=overview` path.**

**The deciding evidence is §5.2 read against §5.1**, and it is confirmed at scale
by §5.4:

> `frontend/src/pages/EpisodeDetail.test.jsx:127-132`, unmodified, against
> `frontend/src/pages/EpisodeDetail.jsx` at `34b3da26`, unmodified, **passes**
> when it is the first test executed (§5.2, §5.4 runs 1/5/6/7/10) and **fails**
> when any prior `EpisodeDetail` render executed first (§5.1, §5.3, §5.4 runs
> 2/3/4/8/9).

**A component regression cannot be order-dependent.** The component source is
byte-identical in the passing and failing runs; only the order of test execution
within the worker differs. The component does leave the loading state for
`?tab=overview` and does render `episode-overview` — §5.2 is a direct
observation of it doing so.

**The REAL REGRESSION limb of Task #1549 §5 is therefore not met.** That limb
required "the component genuinely fails to leave the loading state for
`?tab=overview` while it succeeds for the checklist default", and named "the
component line that diverges by tab" as the citation it would need. **No such
line exists.** §4.1 establishes it directly: the loading gate at
`EpisodeDetail.jsx:462` and the episode gate at `:473` read no tab state, and the
only two tab-conditioned effects (`:257-270`, `:273-303`) are guarded on
`'scenes'` and `'wardrobe'` respectively, neither of which is reachable from any
of the three tests. §5.4 runs 3 and 4 close it from the other side: the checklist
default also fails, in the same position.

**The STALE TEST limb is met, but not in the shape Task #1549 predicted.** The
task's illustrative example — "the failing test doesn't resolve the same fetch
the passing one does" — is **DISPROVED** at §1: `getEpisode`'s
`mockResolvedValue` is set once at `EpisodeDetail.test.jsx:36`, is never reset
(`:109-111` resets only `api`; `vitest.config.js:19-22` sets no global
reset), and is shared identically by all three tests. §3's table records that
**no** per-test setup element differs except the query string. The defect is not
*which* mocks the failing test declares — it declares none — but that the test
file's shared module-scope mocks do not survive a second render within the same
worker process.

## §6.1 The narrower statement a successor may rely on

**MEASURED, and nothing beyond it:** the test at
`frontend/src/pages/EpisodeDetail.test.jsx:127-132` is order-dependent. Its
failure at `34b3da26` is caused by test-harness state carried between tests in
one worker, not by the `?tab=overview` branch of
`frontend/src/pages/EpisodeDetail.jsx`.

**NOT measured, and not asserted here:** that the component is free of defects on
this path in the browser; that the checklist tests are sound (§5.4 runs 3–4 show
they are not reliably passing either); that any particular fix is correct. **This
note recommends no fix — see §8.**

---

# §7. The mechanism — INFERRED from source, NOT instrumented

**Standing: INFERRED.** §6 does not depend on this section. A successor must not
cite §7 as MEASURED.

## §7.1 An unconditional render → effect → setState → render loop, created by the toast mock

Four source facts, each MEASURED, compose to an inference:

1. **The toast mock returns a new object on every call** —
   `EpisodeDetail.test.jsx:30-32`:

   ```
   30	vi.mock('../components/ToastContainer', () => ({
   31	  useToast: () => ({ showError: vi.fn() }),
   32	}));
   ```

2. **`useToast()` is called on every render of the component** —
   `EpisodeDetail.jsx:58`: `const toast = useToast();`

3. **`toast` is a dependency of `fetchEpisode`** — `EpisodeDetail.jsx:207`:
   `}, [episodeId, navigate, toast]);` — so a new `toast` reference produces a
   new `fetchEpisode` reference on every render.

4. **`fetchEpisode` is a dependency of the episode-loading effect** —
   `EpisodeDetail.jsx:221`: `}, [episodeId, fetchEpisode]);` — so that effect
   re-fires on **every** render, and its first statement is
   `setLoading(true)` at `EpisodeDetail.jsx:192`.

**Inference:** under this mock the component re-enters `loading === true` on
every render cycle, indefinitely. The `Loading episode...` branch at
`EpisodeDetail.jsx:462-471` is therefore not a state the component settles out
of; it is a state it re-enters, which is consistent with §5.1's DOM dump.

**This loop does not exist in the running application.** `useToast` is
`useContext(ToastContext)` (`frontend/src/components/ToastContainer.jsx:59-62`)
and the provider's value object is constructed at
`frontend/src/components/ToastContainer.jsx:42`:

```
42	    <ToastContext.Provider value={{ addToast, removeToast, showSuccess, showError, showWarning, showInfo }}>
```

That object literal is **not memoised**, so it is rebuilt whenever
`ToastProvider` itself re-renders — but `ToastProvider` re-renders only when its
own toast list changes, **not** when a consumer re-renders. The reference is
therefore stable between toasts in the real app, and unstable on every consumer
render only under the mock. **The instability is manufactured by
`EpisodeDetail.test.jsx:30-32`.**

**Recorded, not ruled:** `ToastContainer.jsx:42` being unmemoised is a latent
fragility — a real toast firing mid-load would, on this reading, re-trigger
`EpisodeDetail`'s episode fetch. **This note does not assess that, does not
measure it, and does not propose changing it.** It is noted so a successor
holding a fix mandate sees it.

## §7.2 Why the first render in a process survives the loop

**INFERRED, and weaker than §7.1.** `waitFor` samples the DOM from a
`MutationObserver` callback and a 50 ms interval, both of which run after the
synchronous `act` flush has completed. If a cycle commits the tab body and the
same flush re-enters `loading`, the sampler observes only the loading state. §3
recorded the one structural asymmetry — the checklist body is `lazy`
(`EpisodeDetail.jsx:21`) behind `Suspense` (`:660`) while the overview body is
eager (`:10`) — and a suspension does force React to yield between commits,
which would open a sampling window. **But §5.4 runs 3 and 4 show the lazy
checklist body failing too**, so suspension is not a sufficient explanation, and
the "first render in the process passes regardless of tab" result (§5.4 reading
2) points instead at cold-start timing in the worker. **This note does not
resolve which; it is not needed for §6, and it is not asserted.**

## §7.3 The runtime check that would raise §7.1 to MEASURED

**Spy on the call count of the episode fetch across a single render.** Assert
`episodeService.getEpisode` is called exactly once for one mount — under §7.1's
inference it is called unboundedly many times. Equivalently, stabilise the toast
mock (hoist one object outside the factory so `useToast` returns the same
reference on every call) and re-run the unmodified full file; §7.1 predicts all
three render tests then pass in file order.

**Both require editing `EpisodeDetail.test.jsx`, which Task #1549 forbids and
this note did not do.** They are named, not performed.

---

# §8. What this note does not do

- **Fixes nothing.** No source file, no test file, and no configuration file was
  edited. `git diff --stat` for anything outside this document is empty.
- **Changes no test and no source.** The runtime runs at §5 executed the
  repository's own test file, unmodified, through `npx vitest run`.
- **Rules nothing.** The verdict at §6 is a MEASURED finding, not a ruling. Only
  Evoni rules.
- **Recommends nothing beyond naming which of the two outcomes holds**, as Task
  #1549 §5 required. §7.3 names checks; it does not direct that they be run, and
  §7.1's `ToastContainer.jsx:42` observation is recorded, not actioned.
- **Mints nothing.** No FD number, no XK number, no PE number. FD numbers are
  minted only by a Fix Plan revision; XK by the Cross-Keystone Register via a
  ratifying revision; PE by `Session_PE_Roster.md`.
- **Opens no keystone and closes none.** F-AUTH-1's G3 standing is untouched;
  this is Stage 0 diagnosis, waived from the locked sequence by Evoni
  2026-09-18, and the sequence is unchanged.
- **Does not assert the test suite is otherwise sound.** §5.4 runs 3–4 show the
  two checklist tests failing in some orders. That is recorded, not
  investigated.
- **Makes no host, AWS, database or Cognito contact**, starts no application, and
  dispatches no workflow.

---

# §9. Validation

```
$ node scripts/validate-routes.js; echo "EXIT: $?"
1. Checking for unregistered route files...

2. Checking route handlers for missing error handling...
  ⚠  amberSessionRoutes.js: 2 of 4 async handlers may be missing try/catch
  ⚠  animatic.js: 6 of 6 async handlers may be missing try/catch
  ⚠  characterRegistry.js: 2 of 37 async handlers may be missing try/catch
  ⚠  episodeOrchestrationRoute.js: 1 of 1 async handlers may be missing try/catch
  ⚠  feedSchedulerRoutes.js: 1 of 6 async handlers may be missing try/catch
  ⚠  franchiseBrainRoutes.js: 1 of 16 async handlers may be missing try/catch
  ⚠  sceneSetRoutes.js: 1 of 59 async handlers may be missing try/catch
  ⚠  socialProfileRoutes.js: 1 of 39 async handlers may be missing try/catch
  ⚠  textureLayerRoutes.js: 1 of 5 async handlers may be missing try/catch
  ⚠  timelineData.js: 2 of 2 async handlers may be missing try/catch

3. Checking for broken local requires...

4. Checking for potentially missing model references...

─────────────────────────────────────────
Route files scanned: 132
Source files scanned: 707
Warnings: 10

EXIT: 0

$ bash scripts/lint-silent-catches.sh; echo "EXIT: $?"
Scanning for silent error handlers in src/routes/ and src/services/...


No silent error handlers found.
EXIT: 0

$ bash scripts/audit-cost-exposure.sh; echo "EXIT: $?"
Auditing for uncontrolled cost patterns...

1. Checking for ungated schedulers...

2. Checking for Claude API calls in continuous loops...
  HIGH API DENSITY: src/services/characterGenerationService.js has 5 Claude API call sites
  HIGH API DENSITY: src/services/feedScheduler.js has 5 Claude API call sites
  HIGH API DENSITY: src/services/promptCacheHelper.js has 4 Claude API call sites

3. Checking for AI budget configuration...
  OK: AI_DAILY_BUDGET_USD found in .env.example
.env.production.template

4. Checking feed scheduler gate...
  OK: Feed scheduler gated by FEED_SCHEDULER_ENABLED env var

─────────────────────────────────────────
No uncontrolled cost patterns found.
EXIT: 0

$ node scripts/check-root-junk.js; echo "EXIT: $?"
EXIT: 0
```

**All four EXIT: 0.** The 10 route warnings and the 3 API-density notes are
pre-existing at this basis and are not touched by this document.

**`node -c` NOT RUN — no backend file was touched.** **`npx eslint` NOT RUN — no
JavaScript file was touched.** **`cd frontend && npx vite build` NOT RUN — no
file under `frontend/src` was touched.** **`npm test` NOT RUN** — it needs
`TEST_DATABASE_URL` and Postgres, which a cloud session does not have; CI's
`Tests` job on the PR is the gate. **This document changes only
`docs/audit/`.**

---

# §10. Tails, re-derived at this basis

Instruments and their raw output, per H1 — re-derived, not carried from Amd30:

```
$ grep -ro 'FD-70' docs/audit/ | wc -l
178
$ grep -r 'XK-4' docs/audit/ | wc -l
78
$ grep -r 'PE #69' docs/audit/ | wc -l
76
$ ls docs/audit/v25_Owed_Index_Amd*_*.md | sed -E 's#^.*/v25_Owed_Index_Amd([0-9]+)_.*#\1 &#' | sort -n | tail -1 | cut -d' ' -f2-
docs/audit/v25_Owed_Index_Amd30_2026-09-01.md
```

**Note on the three instruments, carried from Amd30 because it is still live.**
The first is counted with `grep -o` (occurrences); the second and third with
`grep -r | wc -l` (matching lines). **They are not the same unit.**

**Amd30 predicted 56 / 34 / 34 once it landed. The tails now read 178 / 78 / 76.**
**This note does not reconcile that gap.** It is disclosed, not corrected: the
drift spans every document filed between Amd30's basis (`3681f5b6`, 2026-09-01)
and this one (`34b3da26`, 2026-09-19), and attributing it is the Owed Index
chain's work, not a standalone note's. **A successor should not read Amd30's
prediction as falsified by this line without doing that attribution.**

**This document's own contribution to the tails: ZERO.** It contains no
occurrence of `FD-70`, `XK-4` or `PE #69` outside the instrument block above,
and the instrument block's strings appear only inside the quoted commands. **A
successor re-deriving after this lands should read 178 / 78 / 76 unchanged.**

**Owed Index chain tail is unchanged at `Amd30`.** This note is **not** an
amendment to the chain and does not continue it.

---

# Footer

| Field | Value |
| --- | --- |
| **Type** | Evidence note — Stage 0 diagnosis, standalone |
| **Rules** | **NOTHING.** Only Evoni rules. |
| **Mints** | **NOTHING.** No FD, no XK, no PE. |
| **Closes** | **NOTHING.** No keystone, no finding, no item. |
| **Ships** | **NO CODE.** `docs/audit/` only. |
| **Host / AWS / DB / Cognito contact** | **NONE.** |
| **Application started** | **NO.** `npx vitest run` invocations against the existing, unmodified test file only (the runs reported at §5.1–§5.4, plus repeats of them); nothing served, nothing bound, no port opened. |
| **Basis** | `origin/main` at `34b3da26fcab7ea740631e3109eb1ab702856435` |
| **Measured on** | 2026-09-19 (filename carries 2026-09-20 per Task #1549 — see the face) |
| **Task** | #1549 |
| **Prod** | **FROZEN.** |
