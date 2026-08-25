# Finding - authorization and short factual tokens do not survive the relay

| | |
|---|---|
| **Purpose** | Records five observed instances in which short authorization or factual standing reached the collaboration but was not recoverable from the local conversation/session record. |
| **Basis** | `main` at `2deaa48513bf1dbfd8c4641db986b3b5208501dc`, confirmed by `git ls-remote origin refs/heads/main`; current-session transcript and session-store behavior observed through 2026-08-25. |
| **Standing** | Operating-environment finding. **Mints nothing.** No FD, XK, or PE. Changes no gate, disposition, owner, severity, or prior authorization. |
| **Scope** | This collaboration environment and these five observed instances only. No claim about other users, clients, relays, or sessions. |
| **Authority note** | Local record reads only. No AWS call, host contact, workflow dispatch, or infrastructure operation. Prod **FROZEN**. |

---

## 1. The asymmetry

Substantive work survives through durable artifacts. Once content is committed,
`git show <authority>:<path>` can recover exactly what was written at that
basis. The repository supplies identity, ordering, and content independently of
the conversational relay.

**Authorization and short factual standing have no equivalent recovery path.**
They can govern an action when received, then disappear from the local session
store or transcript available to the next turn. A later reader can recover the
resulting document but cannot recover whether the missing token authorized the
action that produced it.

That is the finding: **content survives the relay through Git; authorization
and short factual statements do not reliably survive in the local conversation
record.** The difference is not message importance. It is whether a separate
durable record exists.

---

## 2. Five observed instances

Evoni identified five instances from the collaboration in which a short token
was received but not durably recoverable by the executing side:

| # | Token or event | Failure shape |
|---|---|---|
| 1 | `2` | An ordinal depended on the immediately preceding option list. The token did not carry the item it selected. |
| 2 | `go` | Scope was supplied by inference from nearby context. The inferred scope was not a durable authorization record. |
| 3 | `run it` | A pronoun referred to a previously named operation. Once separated from that antecedent, it named no operation. |
| 4 | the read authorization | Authorization for the bounded read reached the collaboration but did not remain independently recoverable in the local record. |
| 5 | the ownership attestation | `I control all three accounts` reached the conversation but was absent from the local session-store search. |

The fifth instance is independently disclosed in
`F-AUTH-1_PE64_Identity_Ownership_Resolution_2026-08-25.md` section 4. That
document quotes the attestation forward from Evoni's in-channel confirmation
and records the retrieval gap as provenance.

The first four are carried here from Evoni's explicit enumeration of the five
instances. **The absent tokens cannot prove their own former presence.** This
document therefore does not represent a successful local lookup as evidence
for them, and it does not reconstruct their scope from surrounding text.

At this basis, a targeted read of the current local transcript found zero
matching user-message records for the short tokens and authorization terms.
That result establishes present nonrecoverability from that record. It does not
independently establish the original messages' wording; Evoni's enumeration is
the source for instances 1-4.

---

## 3. Why inference is not recovery

An ordinal, imperative, or pronoun can be unambiguous to participants in the
moment. That does not make it self-describing after relay loss.

The `go` instance is the sharpest form: the executing side supplied scope by
inference. Even if the inferred operation matched Evoni's intent, **a correct
guess is not an authorization record**. It cannot be audited later, and a
different guess would have had the same evidentiary standing.

The same applies to `2` and `run it`. Their antecedents may have been clear in
the live exchange. Once the token is absent or detached from that exchange,
neither the ordinal nor the pronoun identifies what was authorized.

The ownership attestation shows the factual version of the same defect. Its
truth did not depend on authorization wording, but the fact was load-bearing
and still vanished from the searchable local store. It had to be supplied and
confirmed again, then quoted into a durable artifact.

---

## 4. Remedy - self-describing authorization, fail closed on absence

Two rules follow from the mechanism.

### 4.1 Name the item in full

Authorization must name the authorized item or operation in full. **A pronoun,
ordinal, or bare imperative is not sufficient authorization standing.**

This is a record rule, not a claim that short replies are unintelligible in
ordinary conversation. The requirement exists because this environment has
demonstrated that the context needed to expand them may not survive.

### 4.2 Absence means absent, not inferred consent

**If an authorization token is not present in the available record, treat
authorization as absent.** Do not reconstruct it from the action that followed,
from a likely antecedent, from a completed artifact, or from the fact that the
inference later proved correct.

The remedy is to ask again with the full item named. Reconfirmation creates
standing for the next action; it does not retroactively manufacture a missing
record.

For short factual statements, the parallel remedy is to quote the exact fact
into the durable artifact that relies on it and disclose any retrieval gap as
provenance. That is what the ownership-resolution document does.

---

## 5. Distinct from content recovery

Git recovery answers **what content exists at a named basis**. It does not
answer **who authorized the operation, what scope they authorized, or whether a
short factual premise was actually supplied before the operation**.

The completed artifact is therefore not evidence of consent to create it. A
commit, PR, or merged document may prove that content survived while the
authorization standing that preceded it remains unrecoverable.

This asymmetry is why the remedy cannot be "check Git." Git is the durable
content channel. The missing object belongs to conversational standing.

---

## 6. Bound

**This is a property observed in the current operating environment, not a
property of the register and not a general claim about other collaborations.**
It may not generalize to another user's workflow, another client, another relay,
or another session-store implementation.

Five instances are not a rate. No sampling was performed, and no completeness
claim is made about this or any prior session.

The local transcript's zero matching user-message records is a recoverability
measurement at drafting time, not proof that the original events never reached
the live conversation.

---

## 7. What this document does not do

- Does not retroactively grant, broaden, withdraw, or reinterpret authorization.
- Does not treat inferred scope as consent.
- Does not amend any register entry or prior finding.
- Does not prescribe behavior for other users or operating environments.
- Does not claim the five instances are a complete population or a rate.
- Does not make or imply a `PE #65` decision.
- Does not mint an FD, XK, or PE number.

---

## Version block

| Field | Value |
|---|---|
| Document | `docs/audit/Finding_Authorization_Relay_Loss_2026-08-25.md` |
| Date | 2026-08-25 |
| Basis | `main` at `2deaa48513bf1dbfd8c4641db986b3b5208501dc` |
| Population | Five observed instances enumerated by Evoni |
| Durable corroboration | Ownership-attestation retrieval bound in `F-AUTH-1_PE64_Identity_Ownership_Resolution_2026-08-25.md` section 4 |
| Mints | Nothing |
| Operations performed | Local transcript/session-record reads only |

---

*Recorded 2026-08-25. Basis `main` at `2deaa485`. Operating-environment observation only. No live infrastructure contact.*