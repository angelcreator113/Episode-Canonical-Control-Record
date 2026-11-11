| **PRIME STUDIOS** **F-AUTH-1 — LOGOUT REVOCATION RULING (OPTION (b) WITH (d))** *Rules how the finding in `F-AUTH-1_LogoutRevocation_Read_2026-09-20.md` is disposed of: logout revokes the session's refresh token at Cognito, and the access-token lifetime is shortened afterwards. Mints nothing. Implements nothing.* |
| --- |

**Document version**

v1.0 — **RULES OPTION (b) WITH (d).** `POST /logout` is to revoke the
session's own Cognito refresh token (`RevokeToken`), answer success once the
browser's copies are cleared, and log a Cognito failure loudly. The access
and ID token lifetime is to become 15 minutes, changed only after (b) ships
and after silent refresh on expiry is proved on dev. The dev site is in
scope. **Mints nothing. Authorizes the implementation task; implements
none of it. Changes no Cognito setting.**

**Basis:** `origin/main` at `885ff2abee005969d9500ed4e9bca3acf18ca567`,
2026-11-11. That commit is the one that files the options note this ruling
answers. No host, AWS, database, or Cognito contact was made to write this
document.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Ruling. Rules one matter, on Evoni's word.** The seven questions at the
end of `F-AUTH-1_LogoutRevocation_Options_2026-11-11.md` are answered at §3.
No FD, XK, or PE number is minted. Production's freeze is lifted
(`F-Deploy-1_Fix_Plan_v1.56.md`); this ruling changes nothing in production
by itself.

*Authoring note: written by hand to the form of the register's existing
rulings (for example `F-AUTH-1_Tier5_DevTokenCarrier_Ruling_2026-09-05.md`).
An agent session cannot invoke `/audit-file`.*

---

# §1. What is being ruled, and against which prior documents

`F-AUTH-1_LogoutRevocation_Read_2026-09-20.md` measured that a Cognito
access token and a Cognito refresh token both survive `POST /logout`, and
recommended nothing.

`F-AUTH-1_LogoutRevocation_Options_2026-11-11.md` (filed by PR #3796, on
`main` at this basis) re-measured that at `38db45d7`, stated the exposure,
set out options (a) to (d), and closed with seven questions for Evoni. Its
recommendation was the author's and ruled nothing.

This document records Evoni's answers to those seven questions. It is the
disposition the options note asked for.

# §2. What the ruling rests on

**The code facts** are the options note's, MEASURED at `38db45d7`, and are
not repeated here. The files it cites are unchanged between that commit and
this basis:

```
$ git diff --stat 38db45d7f658199a3f45bc039173d41128358c4d 885ff2abee005969d9500ed4e9bca3acf18ca567 -- src frontend/src ecosystem.config.js package.json
```

MEASURED (no output: nothing under `src`, `frontend/src`, or the two root
files differs). The only change between the two commits is the options note
itself.

**The app client's settings** are Evoni's own readings, ATTESTED:

| Field | Value | Read |
|---|---|---|
| Access token expiration | 1 hour | console, 2026-11-10 |
| ID token expiration | 1 hour | console, 2026-11-10 |
| Refresh token expiration | 30 days | console, 2026-11-10 |
| Client secret | none | console, 2026-11-10 |
| Enable token revocation | **ticked** | the app client's Edit page, 2026-11-11 |

The last row closes the caution the options note carried in its §2: on
2026-11-10 the setting had been read from a panel that lists what is on, and
the Edit page had not been checked. No session read any of these values, and
no pool or client identifier is recorded here.

**The finding, reproduced live on dev before any change** (2026-11-11).
Evoni ran the two browser-console snippets from issue #3797's "Step 8a" on
the dev site with the code then deployed there. ATTESTED, as she reported
it: frontend build `index-BcrdyrBP.js`; the first snippet printed
`held (not shown)`; logout through the app completed without a page reload;
the second printed `refresh after logout: 200`. The dev box's nginx access
log for the same minute, read by an agent session (time, method, path and
status only), agrees:

```
dev commit: 91fbf65
12:26:08 POST /api/v1/auth/logout 200
12:26:15 POST /api/v1/auth/refresh 200
```

A refresh token held before logout was exchanged for a new access token
seven seconds after it. No token was printed, logged or written to a file.
This is the before-state the implementation is measured against.

# §3. The ruling

Evoni's answers, given in the session on 2026-11-11, as she wrote them:

> Ruling on #3796's questions: 1) (b) with (d). 2) RevokeToken, this session
> only. 3) Success once the browser's copies are cleared; log the Cognito
> failure loudly. 4) 15 minutes for access and ID tokens, changed only after
> (b) ships and after you prove on dev that the frontend refreshes silently
> on expiry. 5) N/A. 6) Confirmed: Enable token revocation is [ticked / not
> ticked], read today. 7) In scope.

Item 6 reached the session with its bracket unfilled. Asked which, Evoni
answered **"Ticked"**. The ruling is recorded with that answer.

Set against the options note's questions:

1. **Disposition: (b) with (d).** Logout revokes the refresh token at
   Cognito, and the access-token lifetime is shortened. Option (a), accept
   and document, is not taken. Option (c), a denylist by `jti`, is not
   taken.
2. **The call: `RevokeToken`, this session only.** Logout ends the session
   whose refresh token the browser held. It does not sign the user out of
   other devices; `GlobalSignOut` is not used. The frontend therefore sends
   its refresh token to `/logout`.
3. **When Cognito cannot be reached:** `/logout` answers success once the
   browser's copies are cleared, and the Cognito failure is logged loudly.
4. **The lifetime: 15 minutes** for access and ID tokens. The change to the
   app client is made **only after (b) ships and after it is proved on dev
   that the frontend refreshes silently on expiry.** It is Evoni's change,
   in the Cognito console.
5. **Not applicable.** No denylist store is chosen, because (c) is not
   taken.
6. **Confirmed: "Enable token revocation" is ticked,** read by Evoni on
   2026-11-11.
7. **The dev site is in scope.** It shares the pool and client, so what is
   ruled here applies to it as it does to production.

**What remains after this ruling is carried out.** A copy of an access or
ID token made before logout stays accepted until it expires: up to 1 hour
until the lifetime change, and up to 15 minutes after it. That residual is
ruled, not overlooked. A copy of the refresh token stops working at logout.

**Two further decisions Evoni gave with the implementation task** (issue
#3797, 2026-11-11), recorded here because they bound the same change:

- The `/logout` response is unchanged. It gains no field saying whether the
  Cognito revocation succeeded.
- The work is inside the locked sequence, as F-AUTH-1.

# §4. What this ruling does not do

- **Implements nothing.** No code is changed by this document. The change
  is issue #3797's.
- **Changes no Cognito setting.** The 15-minute lifetime is Evoni's console
  change, at the point §3 item 4 states, and not before.
- **Does not rule (c).** A server-side denylist is not adopted. If immediate
  refusal of a copied access token is wanted later, that is a new ruling.
- **Does not rule how the copy could be made.** Token theft itself (a script
  in the page, a shared computer) is outside the finding and outside this
  ruling.
- **Does not mint** an FD, XK, or PE number.
- **Does not edit** `F-AUTH-1_LogoutRevocation_Read_2026-09-20.md`,
  `F-AUTH-1_LogoutRevocation_Options_2026-11-11.md`,
  `F-AUTH-1_Fix_Plan_v2.77.md`, or any other filed document. All stay as
  they are.
- **Does not close the finding.** It is disposed of when (b) has shipped,
  silent refresh is proved on dev, and the lifetime is changed; each of
  those is recorded where it happens.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Recorded 2026-11-11. Basis `origin/main` at `885ff2abe`. Rules option (b)
with (d); the implementation is issue #3797. Mints nothing. No AWS or
Cognito call issued to write it. Task: #3794.*
