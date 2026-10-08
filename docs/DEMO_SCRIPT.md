# Demo script · 2–3 minutes · aligned with slide 5

**Product principle to land:** AI interprets. Policy computes. People decide.
**Setup:** `npm run dev` → open `http://localhost:3000/` (or the static export). Click **Reset demo** in the top bar first so the state is clean. Browser at 1440 px wide.
**Slide 5 link:** the "Live prototype →" button on slide 5 opens the manager's view of Castellan. This script starts one screen earlier, at the queue.

| # | Time | Do (route) | Say |
|---|---|---|---|
| **1** | 0:00 | **Manager opens the evidence queue.** (`/`) | "It's the weekly forecast review. Instead of asking every rep where each claim came from, the manager opens one list: Commit and Best Case deals where a deal-critical claim is unsupported or contradicted. Everything else stays out of the way." |
| **2** | 0:15 | **Castellan appears as priority.** Point to the highlighted row: $186k, Commit, 15 Oct, High. | "Castellan Freight, $186k, forecast Commit, closing the 15th. The CRM calls it healthy. The evidence says one claim supported, two unsupported, one contradicted." |
| **3** | 0:30 | **Open Castellan.** Click *Review evidence →*. (`/deals/castellan-freight/`) | |
| **4** | 0:35 | **Show the four claim statuses.** Read across the cards. | "Budget: **supported**. A CFO email on 17 September. Security: **unsupported**. Only a rep note says it's fine. Close date: **unsupported**. No customer has said 15 October. And Procurement: **contradicted**. Notice the banner: the forecast is still the manager's judgment, and unsupported does not mean wrong. It means the assumption is visible." |
| **5** | 1:00 | **Open Procurement.** Click *Inspect evidence →* on the red card. (`…/claims/PROCUREMENT_DURATION/`) | |
| **6** | 1:05 | **Show the Champion passage** (card 1). | "On a 22 September call the customer's champion said: 'Procurement usually takes about two weeks.' The model is 99% sure he said it. Speaker, role, time and a link to the call are all here." |
| **7** | 1:20 | **Show the later Procurement email** (card 2). Click *Open source ↗* to show the highlighted quote in context, then close it. | "Ten days later, procurement wrote: 'Our standard procurement review is four weeks after receipt of the complete document set.' Same claim, a more authoritative voice." |
| **8** | 1:40 | **Explain why status = CONTRADICTED.** Point to the one-line reason under the title and the *Business status* card, then *Extraction confidence*. (Optional: open *How was this status determined?* for AI → policy → human, or *View rule details*.) | "Policy, not the model, computes the status. RevOps's rule says procurement outranks the champion on this claim, and the email is later, so the claim is **contradicted**. And look: extraction confidence, 99 and 96, is a separate card. How sure the model is that it read the passage is not the same as whether the claim holds." |
| **9** | 2:00 | **Log the manager's decision.** Click *Log decision*. The default is *Keep Forecast = Commit*; the reason is prefilled. Click *Log decision*. | "The manager still owns the call. Keep Forecast = Commit, because the delay can be absorbed. That's a human decision, with a reason." |
| **10** | 2:20 | **Show: status remains CONTRADICTED.** Point to the pair: status on the left, the decision on the right, and the line *Status is still CONTRADICTED*. | "The decision sits beside the status. It never rewrites it. Next week, if the customer's timeline changes, the evidence will say so." |
| **11** | 2:35 | **Switch briefly to the rep view.** Click *Rep* in the top bar → *Castellan Freight*. Point to *Surfaced to you 7 Oct, 16:00* and, on the Security card, the rep's own response. | "And the rep saw all of this yesterday, before the manager did, and has already said she'll verify security with the customer. She can inspect the source, dispute the reading, or attach evidence. Nothing is written to the CRM and nothing goes to the customer." |

**Close (2:50), say verbatim:**

> “The system doesn't make the forecast call. It makes the evidence behind that call inspectable.”

---

## If you have 30 more seconds

* **RevOps** (`/revops/`): "RevOps owns a simple policy, not a rules engine. Watch: set Budget freshness to 10 days." The Castellan badge turns **Stale**. "Same evidence, same rule, deterministic result." Click *Restore defaults*.
* **Add seller-supplied context** (rep view, Security): add a phone note. It is labelled *seller-supplied* and Security stays **Unsupported**. "Reps can add what we can't see. It's visible to the manager, and it doesn't pass for verified customer evidence until a connected source confirms it."

## Likely questions, and the honest answers

| Question | Answer |
|---|---|
| *What if the model reads it wrong?* | Every card shows the exact quote, role and speaker, linked to the source. The rep can dispute in one step. We tune for precision first, and evaluate on a hand-labelled set before any pilot. |
| *Why isn't the status a score?* | Because a probability from a model is not an auditable business rule. The model extracts; a deterministic rule that RevOps can read decides. |
| *Does it change my CRM?* | No. V1 is read-only. Even the manager's decision is a record, not a write. |
| *Is this validated?* | No. There are no customer interviews yet, and Castellan and every quote are illustrative. The deck says so, and the plan starts with a historical audit to find out. |

*Reset between runs:* **Reset demo** in the top bar clears decisions, seller-supplied context and any policy change.
