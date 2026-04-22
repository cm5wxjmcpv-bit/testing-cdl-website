# CDL ELDT Training Website — Full System Reference Blueprint

## 1) Full Repository File Inventory

### 1.1 Root folder structure

```
/workspace/2026-training-website
├── CNAME
├── README.md
├── admin.html
├── app.js
├── config.js
├── index.html
├── modules.html
├── player.html
└── test.html
```

### 1.2 File-by-file inventory

1. `index.html` — HTML file with inline CSS + inline JavaScript for student login UI and login action orchestration.
2. `modules.html` — HTML file with inline CSS + inline JavaScript for module dashboard, progress cards, test unlock state, cache handling.
3. `player.html` — HTML file with inline CSS + inline JavaScript for YouTube module playback, anti-skip enforcement, active-time tracking, module completion logging.
4. `test.html` — HTML file with inline CSS + inline JavaScript for final test lock/unlock checks, quiz generation, scoring, score logging.
5. `admin.html` — HTML file with inline CSS + inline JavaScript for admin login, student list retrieval, add/edit/delete student management.
6. `config.js` — JavaScript configuration constants: `APP_SCRIPT_URL`, compatibility alias, demo users, module metadata, required watch percent.
7. `app.js` — Google Apps Script backend handlers and Google Sheets data functions (`doGet`, `doPost`, status/test logging, student/admin management).
8. `README.md` — setup and expected Google Sheet header documentation.
9. `CNAME` — custom GitHub Pages domain.

### 1.3 Declared key files requested in analysis prompt

- `index.html` (login): **present**.
- `modules.html` (dashboard): **present**.
- `player.html` (video player): **present**.
- `test.html` (quiz): **present**.
- `config.js`: **present**.
- `app.js`: **present** (contains Google Apps Script backend code, not browser helper functions).
- Admin page(s): `admin.html`.
- JSON/data files: no standalone `.json` files; data is embedded in JS constants and inline arrays.

---

## 2) System Architecture (As Implemented)

## 2.1 Hosting and runtime split

- Frontend pages are static files (`*.html`, `config.js`) intended for GitHub Pages hosting. 
- Backend logic exists as Google Apps Script-style code in `app.js` (functions such as `doGet`, `doPost`, `SpreadsheetApp` usage). 
- Data persistence is Google Sheets, identified by `SPREADSHEET_ID` and specific tab names in backend constants.

## 2.2 Frontend ↔ backend communication model

- Frontend pages reference `APP_SCRIPT_URL` from `config.js` for all network interactions (`admin.html` directly uses `fetch(APP_SCRIPT_URL...)`; other pages call helper functions like `apiGetStatus`, `apiLogModule`, etc.).
- Backend expects either:
  - GET with `action` query parameter, or
  - POST with JSON body containing `action`.

## 2.3 API URL storage and usage

- API URL is hardcoded in `config.js` as `APP_SCRIPT_URL`.
- `SHEETS_API_URL` is set equal to `APP_SCRIPT_URL` for compatibility.
- `admin.html` uses `APP_SCRIPT_URL` directly in `fetch` calls.

## 2.4 Authentication/session handling behavior

- Login page calls `login(u,p)` and checks returned boolean.
- Auth checks on protected pages call `requireAuth()`.
- Logout button calls `logout()`.
- Query parsing in player calls `qs("m")`.
- Test unlock uses `allModulesComplete(status)`.

**Critical runtime observation:** `login`, `requireAuth`, `logout`, `qs`, `apiGetStatus`, `apiLogModule`, `apiLogTest`, and `allModulesComplete` are referenced by frontend pages but are **not defined in `config.js` or this repository’s `app.js` file**.

**UNCERTAIN — NEEDS VERIFICATION:** Either:
1) a missing frontend helper file was not committed, or
2) `app.js` in repo is not the same `app.js` served to frontend, or
3) runtime currently fails in browser where these identifiers are called.

---

## 3) End-to-End Data Flow Mapping

## 3.1 Login Flow (`index.html`)

1. User enters username/password and clicks **Sign In** or presses Enter.
2. `doLogin()` validates non-empty input.
3. `doLogin()` validates `typeof login === "function"`; if not function, shows `Login system not loaded.`
4. Loading state enabled (`setLoginLoading(true)`): disables controls, shows button spinner and overlay.
5. Calls `await login(u,p)`.
6. If result is falsy:
   - disable loading,
   - show `Invalid username or password.`
7. If truthy:
   - redirects browser to `modules.html`.
8. On thrown error:
   - disable loading,
   - show `Login error.` and log to console.

Expected API call is indirect via missing `login` helper; not visible in repo frontend code.

## 3.2 Module Progress Flow (`modules.html` + backend `app.js`)

Frontend flow:
1. `requireAuth()` returns username.
2. Status cache key: `cdl_status_<username>` in `sessionStorage`.
3. Initial render:
   - loading shell module cards shown,
   - if cached status exists, render cached values immediately,
   - then always attempt live refresh via `loadFreshStatus()`.
4. `loadFreshStatus()` calls `apiGetStatus(username)`.
5. If API response missing/`ok` false: status message shows API error text.
6. If API response valid:
   - normalized via `normalizeStatus()`,
   - written to sessionStorage,
   - UI updates module completion badges, totals, progress bar, test lock/unlock.
7. On API throw:
   - if cache exists, keep cached display and show refresh failure text,
   - else show generic load error.

Backend flow (`getStatus_` / `logModule_`):
1. `getStatus_(username)` calls `ensureUserRow_(username)` which creates row if missing.
2. Reads row values and maps `m1..m10` to boolean based on string literal `"complete"`.
3. Returns object `{ok, username, modules, testComplete, testScore}`.
4. `logModule_(username, moduleId)` validates `moduleId` in `1..10`, writes `"complete"` into module column, updates `updatedAt`, flushes, returns fresh `getStatus_` payload.

Cross-device reload behavior:
- Because completion state is stored in Google Sheets `Status` tab, fetching status from any device/browser for same username retrieves persisted values.
- Session storage is only page-session cache optimization; persistence source is backend Sheets.

## 3.3 Video Player Behavior (`player.html`)

1. `moduleId = Number(qs("m"))`.
2. Selected module = `MODULES.find(x => x.id === moduleId) || MODULES[0]` fallback.
3. YouTube iframe API creates player with `videoId = mod.youtubeId`, controls enabled, keyboard shortcuts disabled, fullscreen enabled.
4. Watch metrics tracked:
   - `duration`,
   - `maxWatched` (furthest validated position),
   - `validPlaySeconds` (active time credited only when visible + focused + natural progression),
   - `logged` (completion already sent).

Anti-skip and anti-speed behavior:
- Playback rate forcibly reset to `1` when detected otherwise.
- Forward seek beyond `maxWatched + 0.75s` triggers correction:
  - pause,
  - seek back to `maxWatched`,
  - replay (if not logged).
- Guard interval runs every `150ms` (`detectAndCorrectSkip`).
- Progress interval runs every `250ms` (`progressLoop`).

Completion rule:
- `pct() = maxWatched / duration`.
- `requiredWatchPercent() = REQUIRED_WATCH_PERCENT || 0.9`.
- `requiredActiveSeconds() = min(duration * requiredWatchPercent, max(0, duration - 10))`.
- Completion eligible only if both are true:
  - watched percent threshold met,
  - valid active seconds threshold met.

Completion logging:
1. `maybeComplete()` triggers `completeModule()` once eligible.
2. `completeModule()` stops timers, sets logging UI text.
3. Calls `apiLogModule(username, mod.id)`.
4. If API returns `ok:false` or throws:
   - `logged` reset false,
   - timers restarted,
   - error message shown.
5. If success:
   - status text -> `Complete`,
   - done message -> logged, return to modules.

## 3.4 Test/Quiz Flow (`test.html` + backend `app.js`)

Unlock logic:
1. On page load, calls `apiGetStatus(username)`.
2. If response not ok: lock panel shows error.
3. If `allModulesComplete(status)` false: remains locked with `Finish all modules first.`
4. If true: hides lock card, shows quiz card, renders 25 questions.

Question source:
- In-page constant `QUESTION_BANK` with 25 question objects.
- `QUESTIONS` set from `getRandomQuestions(QUESTION_BANK,25)`.
- Randomization uses `Array.sort(() => Math.random() - 0.5)`.

Evaluation:
1. Submit collects one radio answer per question.
2. Requires all answered; otherwise displays unanswered count.
3. Counts correct where selected index equals `correctIndex`.
4. Score = rounded percentage.
5. Pass = score `>= 80` (`PASSING_SCORE`).

Result storage:
1. Sends `apiLogTest(username, passed, score)`.
2. Backend `logTest_` writes:
   - `testComplete`: `"complete"` when pass true else empty string,
   - `testScore`: numeric score or empty,
   - `updatedAt`: current date.
3. Returns updated status object.

Retake behavior:
- Generates new randomized `QUESTIONS`, rerenders form, clears radio inputs, clears result, scrolls to top.

---

## 4) API Contract Documentation (All Observed Endpoints)

Base URL: `APP_SCRIPT_URL` (from `config.js`).

## 4.1 GET endpoints (`doGet` dispatcher)

### Endpoint: `?action=getStatus&username=<username>`
- Method: GET
- Params: `action=getStatus`, `username`
- Request format: query string
- Backend handler: `getStatus_(username)`
- Returns JSON shape:
```json
{
  "ok": true,
  "username": "student1",
  "modules": {
    "m1": false,
    "m2": false,
    "m3": false,
    "m4": false,
    "m5": false,
    "m6": false,
    "m7": false,
    "m8": false,
    "m9": false,
    "m10": false
  },
  "testComplete": false,
  "testScore": ""
}
```
- Error shape:
```json
{"ok":false,"error":"..."}
```

### Endpoint: `?action=testLogModule&username=<username>&moduleId=<id>`
- Method: GET
- Params: `action=testLogModule`, optional `username` default `student1`, optional `moduleId` default `1`
- Request format: query string
- Backend handler: `logModule_(username,moduleId)`
- Return: same shape as `getStatus_`.

### Endpoint: `?action=adminLogin&username=<username>&password=<password>`
- Method: GET
- Params: `action=adminLogin`, `username`, `password`
- Request format: query string
- Backend handler: `adminLogin_`
- Returns:
```json
{"ok":true,"username":"AdminOriginalCase"}
```
or
```json
{"ok":false,"error":"Invalid admin login"}
```

### Endpoint: `?action=listStudents`
- Method: GET
- Params: `action=listStudents`
- Request format: query string
- Backend handler: `listStudents_`
- Returns:
```json
{
  "ok": true,
  "students": [
    {
      "username": "student1",
      "password": "1234",
      "updatedAt": "...",
      "testScore": 84
    }
  ]
}
```

### Endpoint: `?action=validateLogin&username=<username>&password=<password>`
- Method: GET
- Params: `action=validateLogin`, `username`, `password`
- Request format: query string
- Backend handler: `validateLogin_`
- Returns:
```json
{"ok":true,"username":"StoredCaseUsername"}
```
or
```json
{"ok":false,"error":"Invalid username or password"}
```

## 4.2 POST endpoints (`doPost` dispatcher)

Body format for all POST actions: raw JSON string in request body.

### Endpoint: action `logModule`
- Method: POST
- Body:
```json
{"action":"logModule","username":"student1","moduleId":1}
```
- Backend handler: `logModule_`
- Returns: status object shape from `getStatus_`.

### Endpoint: action `logTest`
- Method: POST
- Body:
```json
{"action":"logTest","username":"student1","complete":true,"score":88}
```
- Backend handler: `logTest_`
- Returns: status object shape from `getStatus_`.

### Endpoint: action `addStudent`
- Method: POST
- Body:
```json
{"action":"addStudent","username":"newuser","password":"pw"}
```
- Returns:
```json
{"ok":true}
```
or
```json
{"ok":false,"error":"Student already exists"}
```

### Endpoint: action `updateStudent`
- Method: POST
- Body:
```json
{"action":"updateStudent","username":"old","newUsername":"new","password":"pw"}
```
- Returns `{"ok":true}` or error.

### Endpoint: action `deleteStudent`
- Method: POST
- Body:
```json
{"action":"deleteStudent","username":"student1"}
```
- Returns `{"ok":true}` or error.

### Unknown action responses
- Both GET and POST default to:
```json
{"ok":false,"error":"Unknown action"}
```

---

## 5) Function-by-Function Breakdown (All JavaScript Functions)

## 5.1 `index.html` inline functions

### `setLoginLoading(isLoading)`
- Trigger: called by `doLogin()` before/after async login.
- Input: boolean-like `isLoading`.
- Return: none.
- Side effects:
  - disables/enables login button and input fields,
  - toggles spinner display,
  - toggles button text (`Sign In` / `Signing In…`),
  - toggles overlay display and aria-hidden.

### `doLogin()`
- Trigger: button click and Enter key handlers on username/password fields.
- Inputs: none (reads DOM field values).
- Return: Promise (async), no explicit return value.
- Side effects:
  - validates inputs and helper availability,
  - calls external `login(u,p)`,
  - updates error message element,
  - redirects to `modules.html` on success.

Event handlers:
- `#btn.onclick = doLogin`.
- keydown Enter on `#u` and `#p` calls `doLogin()`.

## 5.2 `modules.html` inline functions

### `makeEmptyStatus()`
- Trigger: called by normalization helpers.
- Inputs: none.
- Return: default status object with `ok:true`, username, `modules` object keys based on `MODULES`, `testComplete:false`, `testScore:""`.
- Side effects: none.

### `normalizeStatus(status)`
- Trigger: cache read/write and render path.
- Inputs: unknown status object.
- Return: normalized status object with expected keys.
- Side effects: none.

### `safeReadCache()`
- Trigger: initialization and error fallback.
- Inputs: none.
- Return: parsed/normalized cached status or `null` on missing/parse failure.
- Side effects: reads `sessionStorage`.

### `safeWriteCache(status)`
- Trigger: after successful live API fetch.
- Inputs: status object.
- Return: none.
- Side effects: writes normalized status JSON into `sessionStorage` under `CACHE_KEY`.

### `allModulesDone(status)`
- Trigger: render logic for test unlock.
- Inputs: status object.
- Return: boolean true if every configured `MODULES` id has truthy `status.modules["m<id>"]`.
- Side effects: none.

### `showProgressLoading(show)`
- Trigger: render and loading/error flows.
- Inputs: boolean `show`.
- Return: none.
- Side effects: toggles `loading-hidden` class on progress loading/content blocks.

### `render(status, sourceText)`
- Trigger: cached render, live render, fallback render.
- Inputs:
  - `status` object,
  - optional `sourceText` status line.
- Return: none.
- Side effects:
  - clears and rebuilds module cards,
  - computes completed/remaining/percent,
  - updates counts, progress bar and text,
  - updates final test badge/button lock state,
  - updates test info line,
  - updates status source text,
  - hides progress loading spinner.

### `renderLoadingShell()`
- Trigger: init startup before data available.
- Inputs: none.
- Return: none.
- Side effects:
  - renders module cards with `Loading` badges,
  - zeroes progress and counts,
  - sets test card to locked/checking state,
  - shows progress loading spinner.

### `loadFreshStatus()` (async)
- Trigger: invoked in init IIFE.
- Inputs: none.
- Return: Promise.
- Side effects:
  - calls `apiGetStatus(username)`,
  - handles API ok/not-ok/throw branches,
  - writes cache on success,
  - updates status message and render,
  - falls back to cached render on error.

### `(function init(){ ... })()`
- Trigger: immediate execution when script loads.
- Inputs: none.
- Return: none.
- Side effects:
  - renders loading shell,
  - attempts cached status pre-render,
  - sets initial status text,
  - triggers live fetch.

## 5.3 `player.html` inline functions

### `clamp(n,min,max)`
- Utility numeric clamp.

### `formatSeconds(sec)`
- Converts seconds to `m:ss` or `h:mm:ss` string.

### `pct()`
- Returns watched fraction `maxWatched/duration` else 0.

### `requiredWatchPercent()`
- Returns `REQUIRED_WATCH_PERCENT` constant or fallback `0.9`.

### `requiredActiveSeconds()`
- Returns `min(duration * requiredWatchPercent, max(0,duration - 10))`.

### `completionReady()`
- Returns true when both watch-percent and active-seconds criteria met.

### `isVisibleForCredit()`
- Returns true when tab visible and window focused.

### `updateUI()`
- Updates rule text, progress text, progress bar width, status text (`Complete`/`Eligible for Completion`/`In Progress`), and completion guidance text.

### `completeModule()`
- Guarded by `logged` flag.
- Sets logging state, stops timers, updates UI to logging text.
- Calls `apiLogModule(username, mod.id)`.
- Handles success and failure branches, including timer restart on logging failure.

### `maybeComplete()`
- Calls `completeModule()` when not logged and `completionReady()` true.

### `enforcePlaybackRate()`
- Attempts to force YouTube playback rate to `1`.

### `performSeekCorrection(targetTime)`
- Prevents re-entrant corrections.
- Temporarily suppresses guard checks.
- Pauses player, seeks to target, resumes playback unless logged.

### `detectAndCorrectSkip()`
- Periodic guard.
- If player state is playing/paused/buffering/ended and currentTime is ahead of `maxWatched + tolerance`, performs seek correction and updates UI.

### `progressLoop()`
- Main periodic accounting loop.
- Measures elapsed wall time (clamped), reads player state/time, enforces rate, detects skip, increments `maxWatched`, credits active seconds only when visible/focused and playback movement looks natural, handles ended state edge case, updates UI, attempts completion.

### `startTimers()`
- Stops existing timers, resets `lastWallTime`, starts `progressLoop` interval (250ms) and skip guard interval (150ms).

### `stopTimers()`
- Clears and nulls both interval handles.

### `onYouTubeIframeAPIReady()`
- Global callback consumed by YouTube API.
- Instantiates `YT.Player` with selected module video.
- `onReady`: initializes duration/time markers, enforces rate, updates UI, starts timers.
- `onStateChange`: skip detection and ended handling.
- `onPlaybackRateChange`: playback-rate enforcement.

Event listeners:
- `visibilitychange`, `focus`, `blur` -> `updateUI`.
- `beforeunload` -> `stopTimers`.

## 5.4 `test.html` inline functions

### `getRandomQuestions(bank,count)`
- Returns shuffled shallow copy slice of requested count.

### `renderQuestions()`
- Clears quiz form and renders each question and its options as radio groups.

### `getSelections()`
- Reads selected radio value for each question index.
- Returns numeric array with `null` for unanswered entries.

### Async IIFE `(async () => { ... })()`
- Calls `apiGetStatus(username)`.
- If API error: shows lock error text.
- If modules incomplete: shows locked message.
- Else renders questions and reveals test panel.

### `submitBtn.onclick = async () => { ... }`
- Validates all answered.
- Calculates correct count, percent score, pass boolean.
- Calls `apiLogTest(username, passed, score)`.
- Handles logging error/success message.

### `retakeBtn.onclick = () => { ... }`
- Re-randomizes questions, rerenders, clears selection/results, smooth-scrolls top.

## 5.5 `admin.html` inline functions

### `adminLogin()`
- Reads admin username/password fields.
- Sends GET `action=adminLogin` request.
- On failure shows `Login failed`.
- On success hides login card, shows admin panel, calls `loadStudents()`.

### `loadStudents()`
- GET `action=listStudents`.
- Stores `data.students || []` in global `students`.
- Calls `renderStudents()`.

### `renderStudents()`
- Clears `#studentList` table body.
- Builds table row for each student with username/password/testScore and edit/delete buttons.

### `filterStudents()`
- Reads search query lowercase.
- Iterates table rows and toggles row display based on substring match against row text.

### `addStudent()`
- Reads new username/password.
- POST `action:addStudent` JSON.
- Shows success/failure message.
- Reloads student list on success.

### `editStudent(user,pass)`
- Prompt dialogs for new username and password.
- If either missing, returns.
- POST `action:updateStudent` JSON.
- After request promise resolves, calls `loadStudents()` (response content not checked).

### `deleteStudent(user)`
- Confirms deletion prompt.
- POST `action:deleteStudent` JSON.
- After request promise resolves, calls `loadStudents()`.

Global state:
- `let students = []` used across load/render/filter.

## 5.6 `app.js` backend functions (Google Apps Script)

### HTTP entrypoints
- `doGet(e)` — dispatch by `action` query param.
- `doPost(e)` — parse JSON body, dispatch by `action` field.

### Sheet helpers
- `getSheetByName_(name)`
- `getHeaders_(sh)`
- `requireHeader_(headers,name)`
- `getStatusSheet_()`
- `getStudentsSheet_()`
- `getAdminsSheet_()`

### Status row lifecycle
- `ensureUserRow_(username)` creates status row if absent (width at least 14 columns) and returns row number.

### Status retrieval/update
- `getStatus_(username)`
- `logModule_(username,moduleId)`
- `logTest_(username,complete,score)`

### Auth
- `adminLogin_(username,password)` validates against `Admins` sheet.
- `validateLogin_(username,password)` validates against `Students` sheet.

### Student admin operations
- `listStudents_()` merges `Students` sheet rows with test score from `Status` sheet map.
- `addStudent_(username,password)` adds student and ensures status row.
- `updateStudent_(username,newUsername,password)` updates student row, ensures status row for new username.
- `deleteStudent_(username)` removes row from Students sheet.

### Response helper
- `json_(obj)` returns JSON `TextOutput` with JSON MIME type.

---

## 6) State Management

## 6.1 Frontend persistent/transient state

- `sessionStorage` key per user in modules page: `cdl_status_<username>`.
- Cached object stores normalized status shape with module booleans + test fields.
- Other pages primarily use in-memory runtime variables (`player.html` timers/counters; `test.html` selected question set; `admin.html` students array).

## 6.2 UI-state coupling

- Dashboard (`modules.html`) state drives:
  - module badge complete/not,
  - progress percentage and counts,
  - final test lock/unlock UI,
  - status source message (live/cached/error).
- Player state drives:
  - progress text and bar,
  - status text transitions,
  - completion log messaging.
- Test state drives:
  - locked vs visible quiz card,
  - result feedback text.

## 6.3 Backend state (Google Sheets)

- Authoritative completion/test state in `Status` sheet.
- Credential storage in `Students` and `Admins` sheets.
- `updatedAt` timestamps written on module/test logging and student update/add.

---

## 7) Sensitive / Do-Not-Break Areas

1. `Status` sheet header contract (`m1..m10`, `testComplete`, `testScore`, `updatedAt`) because backend functions use exact header names and `requireHeader_` for writes.
2. `logModule_` module id guard `1..10`; values outside range throw.
3. Literal completion marker string: backend interprets only lowercase-equal `"complete"` as completed.
4. Player anti-skip gates:
   - forward jump correction threshold,
   - active-time requirement,
   - visibility/focus credit requirement,
   - playback-rate enforcement.
5. Test unlock dependency: all modules must be complete boolean true.
6. Hardcoded tab names: `Status`, `Students`, `Admins`.
7. Hardcoded spreadsheet id in backend.
8. Frontend dependency on missing helper functions (`requireAuth`, API wrappers, etc.). Any deployment without these definitions is sensitive/fragile.

ELDT/compliance tie points in code:
- 90% required watch threshold shown and enforced in player/dashboard.
- Final test locked until module completion condition passes.

---

## 8) Configuration Points — SAFE vs RISKY

## 8.1 Safe-to-edit (content/config constants)

1. `config.js` `MODULES` array entries (title/youtubeId/id) — impacts displayed modules and player source.
2. `config.js` `APP_SCRIPT_URL` — switches backend endpoint target.
3. `config.js` `REQUIRED_WATCH_PERCENT` — modifies threshold used by player and shown in UI logic.
4. UI text content in HTML templates (labels, headings, helper text).
5. `test.html` question bank content and passing score constants.

## 8.2 Risky/high-impact edits

1. Changing module ID ranges without aligning backend `m1..m10` assumptions.
2. Renaming sheet headers or tab names.
3. Altering completion marker string conventions in backend.
4. Modifying anti-skip timing constants without full validation.
5. Changing API action names or request shapes between frontend/backend.
6. Editing auth helper references without confirming where helper implementations exist.

---

## 9) Known Risks and Failure Points

1. **Frontend helper gap risk:** missing definitions for core functions used by multiple pages (`login`, `requireAuth`, API wrappers). Potential hard runtime failure.
2. **Module count mismatch risk:** frontend config currently defines 7 modules; backend status model supports/logs `m1..m10`. This can create unused tracked fields and potential future mismatch logic.
3. **Google Sheets latency/rate limits:** async writes (`appendRow`, `setValue`, flush) and reads can delay UI updates or fail intermittently.
4. **No robust retry strategy:** most frontend API failures show message only; no exponential retries.
5. **Admin credential transport risk:** admin login uses GET query string including password.
6. **Admin UI error handling asymmetry:** `editStudent` and `deleteStudent` do not inspect returned `ok`/`error` before refreshing.
7. **Randomization method bias:** quiz shuffle via `sort(() => Math.random()-0.5)` is non-uniform.
8. **Player edge cases:** YouTube API timing/state discrepancies can trigger repeated seek corrections; completion depends on focus/visibility and may not credit background playback.
9. **Status auto-row creation:** `getStatus_` creates missing user row automatically; typo usernames may generate unintended records.

---

## 10) Explicit Uncertainties Requiring Verification

1. **UNCERTAIN — NEEDS VERIFICATION:** where frontend auth/API helper functions are defined (`login`, `requireAuth`, `logout`, `qs`, `apiGetStatus`, `apiLogModule`, `apiLogTest`, `allModulesComplete`).
2. **UNCERTAIN — NEEDS VERIFICATION:** whether repository `app.js` is intended for Apps Script deployment only (separate runtime artifact) while frontend should load another client-side `app.js`.
3. **UNCERTAIN — NEEDS VERIFICATION:** production Google Sheet exact headers and whether all required headers are present exactly as expected by backend functions.
4. **UNCERTAIN — NEEDS VERIFICATION:** production CORS/browser behavior for POST to Apps Script endpoint with raw JSON body.

