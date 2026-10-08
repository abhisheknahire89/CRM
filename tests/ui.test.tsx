import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockPath = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import { ClaimDetailScreen } from "@/components/ClaimDetailScreen";
import { DealLedgerScreen } from "@/components/DealLedgerScreen";
import { QueueScreen } from "@/components/QueueScreen";
import { RevOpsScreen } from "@/components/RevOpsScreen";
import { RepositoryProvider } from "@/lib/useRepository";
import { LocalEvidenceRepository } from "@/services/localEvidenceRepository";

function renderWithRepo(ui: React.ReactElement) {
  const repo = new LocalEvidenceRepository();
  render(<RepositoryProvider repository={repo}>{ui}</RepositoryProvider>);
  return repo;
}

beforeEach(() => {
  mockPath = "/";
});

describe("Demo regression: Castellan always renders the canonical values", () => {
  it("Budget → SUPPORTED, Security → UNSUPPORTED, Procurement → CONTRADICTED, Close date → UNSUPPORTED, Forecast → Commit", async () => {
    renderWithRepo(<DealLedgerScreen dealId="castellan-freight" role="MANAGER" />);
    await screen.findByRole("heading", { name: "Castellan Freight" });

    const status = (id: string) => screen.getByTestId(`claim-card-${id}`).getAttribute("data-status");
    expect(status("BUDGET_CONFIRMED")).toBe("SUPPORTED");
    expect(status("SECURITY_COMPLETE")).toBe("UNSUPPORTED");
    expect(status("PROCUREMENT_DURATION")).toBe("CONTRADICTED");
    expect(status("CLOSE_DATE")).toBe("UNSUPPORTED");

    expect(screen.getByTestId("forecast")).toHaveTextContent("Commit");
    expect(screen.getByText("$186k")).toBeInTheDocument();
    expect(screen.getByText("15 Oct", { selector: "dd *, dd" })).toBeInTheDocument();
    expect(screen.getByTestId("forecast-statement")).toHaveTextContent("Forecast is still the manager's judgment.");

    const card = (id: string) => within(screen.getByTestId(`claim-card-${id}`));
    expect(card("BUDGET_CONFIRMED").getByText(/Budget for the rollout is approved for Q4\./)).toBeInTheDocument();
    expect(card("SECURITY_COMPLETE").getByText(/Security should be fine\./)).toBeInTheDocument();
    expect(card("PROCUREMENT_DURATION").getByText(/four weeks after receipt of the complete document set/)).toBeInTheDocument();
    expect(card("CLOSE_DATE").getByText(/No customer statement found in connected sources/)).toBeInTheDocument();
  });
});

describe("Screen 1: evidence queue", () => {
  it("lists deals needing attention with Castellan first and the one fully-supported deal hidden", async () => {
    renderWithRepo(<QueueScreen role="MANAGER" />);
    const rows = await screen.findAllByTestId(/queue-row-/);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveTextContent("Castellan Freight");
    expect(rows[0]).not.toHaveTextContent(/start here/i);
    expect(rows[0]).not.toHaveTextContent(/rep has/i);
    expect(rows[0]).toHaveTextContent("Review evidence");
    expect(screen.queryByText("Vantor Cargo")).not.toBeInTheDocument();
    expect(screen.getByText(/1 Commit \/ Best Case deal with every claim supported is not shown/)).toBeInTheDocument();
  });
});

describe("Screen 3: evidence detail (Procurement)", () => {
  it("shows both passages in sequence, and keeps extraction confidence separate from status", async () => {
    renderWithRepo(<ClaimDetailScreen dealId="castellan-freight" definitionId="PROCUREMENT_DURATION" role="MANAGER" />);
    await screen.findByRole("heading", { name: "Procurement takes two weeks" });

    const champion = within(screen.getByTestId("evidence-ex-cf-proc-champion"));
    expect(champion.getByText(/Procurement usually takes about two weeks\./)).toBeInTheDocument();
    expect(champion.getByText("Marcus Lindqvist")).toBeInTheDocument();
    expect(champion.getByTestId("meta-ex-cf-proc-champion")).toHaveTextContent("Marcus Lindqvist · Champion (proposed by AI) · customer context");
    expect(champion.getByText(/Superseded by later, more authoritative evidence/)).toBeInTheDocument();

    const email = within(screen.getByTestId("evidence-ex-cf-proc-email"));
    expect(email.getByText(/Our standard procurement review is four weeks after receipt of the complete document set\./)).toBeInTheDocument();
    expect(email.getByText("Hannah Brandt")).toBeInTheDocument();
    expect(email.getByTestId("meta-ex-cf-proc-email")).toHaveTextContent("Hannah Brandt · Procurement (proposed by AI) · accepted evidence");
    expect(email.getByText(/Accepted evidence — Procurement, rank 1 of 2/)).toBeInTheDocument();
    expect(champion.getByText(/Context only — Champion is not an accepted authority for Procurement/)).toBeInTheDocument();
    for (const label of ["Policy treatment"]) expect(screen.getAllByText(label).length).toBe(2);
    expect(screen.queryByText(/authority \(policy\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^sequence$/i)).not.toBeInTheDocument();

    // Business status + reason
    expect(screen.getByTestId("status-reason")).toHaveTextContent("Later, more authoritative procurement evidence disagrees");
    // Confidence is on the passages and in its own card: never merged into the status badge
    expect(screen.getByTestId("confidence-ex-cf-proc-champion")).toHaveTextContent("99%");
    expect(screen.getByTestId("confidence-ex-cf-proc-email")).toHaveTextContent("96%");
    const badges = document.querySelectorAll('[data-status="CONTRADICTED"]');
    badges.forEach((b) => expect(b.textContent).not.toMatch(/\d+%/));
    expect(screen.getByText(/Extraction confidence ≠ business status/)).toBeInTheDocument();
  });

  it("opens the source with the quote highlighted in its surrounding context", async () => {
    const user = userEvent.setup();
    renderWithRepo(<ClaimDetailScreen dealId="castellan-freight" definitionId="PROCUREMENT_DURATION" role="MANAGER" />);
    await user.click(await screen.findByRole("button", { name: "Open source for passage 1" }));
    const dialog = screen.getByRole("dialog", { name: "Source" });
    expect(within(dialog).getByTestId("source-text")).toHaveTextContent("Once legal is done, we send the document set across");
    expect(dialog.querySelector("mark")).toHaveTextContent("Procurement usually takes about two weeks.");
    expect(dialog).toHaveTextContent(/simulated in this prototype/);
  });

  it("empty-state: Close date explains absence of evidence in connected sources", async () => {
    renderWithRepo(<ClaimDetailScreen dealId="castellan-freight" definitionId="CLOSE_DATE" role="MANAGER" />);
    expect(await screen.findByTestId("empty-evidence")).toHaveTextContent("No customer statement found in connected sources");
  });
});

describe("Final refinements", () => {
  it("queue says 'Evidence review priority' and that it is not a win probability", async () => {
    renderWithRepo(<QueueScreen role="MANAGER" />);
    await screen.findAllByTestId(/queue-row-/);
    expect(screen.getAllByText("Evidence review priority").length).toBeGreaterThan(0);
    expect(screen.queryByText("Review priority")).not.toBeInTheDocument();
    expect(screen.getByTestId("priority-note")).toHaveTextContent("Evidence review priority reflects evidence status only — not a win probability.");
  });

  it("deal header uses the new name and note", async () => {
    renderWithRepo(<DealLedgerScreen dealId="castellan-freight" role="MANAGER" />);
    await screen.findByRole("heading", { name: "Castellan Freight" });
    expect(screen.getByText("Evidence review priority")).toBeInTheDocument();
    expect(screen.getByTestId("priority-note")).toHaveTextContent("not a win probability");
  });

  it("evidence detail leads with status, a one-line reason, the timeline and separate confidence", async () => {
    renderWithRepo(<ClaimDetailScreen dealId="castellan-freight" definitionId="PROCUREMENT_DURATION" role="MANAGER" />);
    await screen.findByRole("heading", { name: "Procurement takes two weeks" });
    expect(screen.getByTestId("status-headline")).toHaveTextContent("Later, more authoritative procurement evidence disagrees.");
    // the permanent tutorial strip is gone
    expect(screen.queryByLabelText("How this status was produced")).not.toBeInTheDocument();
    expect(screen.queryByText(/AI INTERPRETS · PROBABILISTIC/i)).not.toBeInTheDocument();
  });

  it("'How was this status determined?' is collapsed, and explains AI → policy → human when opened", async () => {
    const user = userEvent.setup();
    renderWithRepo(<ClaimDetailScreen dealId="castellan-freight" definitionId="PROCUREMENT_DURATION" role="MANAGER" />);
    const how = await screen.findByTestId("how-determined");
    expect(how).not.toHaveAttribute("open");
    await user.click(within(how).getByText("How was this status determined?"));
    expect(how).toHaveAttribute("open");
    expect(how).toHaveTextContent("1. AI interpretation");
    expect(how).toHaveTextContent("2. Deterministic policy");
    expect(how).toHaveTextContent("3. Human decision");
    expect(how).toHaveTextContent("computed the business status: CONTRADICTED");
  });

  it("rule metadata moved behind 'View rule details' and nothing was removed", async () => {
    const user = userEvent.setup();
    renderWithRepo(<ClaimDetailScreen dealId="castellan-freight" definitionId="PROCUREMENT_DURATION" role="MANAGER" />);
    const rule = await screen.findByTestId("rule-details");
    expect(rule).not.toHaveAttribute("open");
    await user.click(within(rule).getByText("View rule details"));
    expect(rule).toHaveAttribute("open");
    for (const t of ["Accepted authority", "Admissible evidence", "Freshness window", "Precedence", "Policy version", "Computed", "policy-v0.1-illustrative", "Later or more authoritative evidence wins"]) {
      expect(rule).toHaveTextContent(t);
    }
  });
});

describe("Presentation polish", () => {
  it("evidence detail: both passages come before the explainer; business status badge shown once at the top", async () => {
    renderWithRepo(<ClaimDetailScreen dealId="castellan-freight" definitionId="PROCUREMENT_DURATION" role="MANAGER" />);
    await screen.findByRole("heading", { name: "Procurement takes two weeks" });
    const champion = screen.getByTestId("evidence-ex-cf-proc-champion");
    const email = screen.getByTestId("evidence-ex-cf-proc-email");
    const how = screen.getByTestId("how-determined");
    const people = screen.getByLabelText("People decide");
    const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(champion, email)).toBe(true);
    expect(follows(email, how)).toBe(true);
    expect(follows(how, people)).toBe(true);
    // the Business status card carries the reason but no second badge
    const card = screen.getByTestId("status-reason").closest("section")!;
    expect(card.querySelector("[data-status]")).toBeNull();
    // the unique top badge
    expect(document.querySelectorAll("header [data-status=CONTRADICTED]")).toHaveLength(1);
  });

  it("rule details keep the version once, as policy-v0.1-illustrative", async () => {
    renderWithRepo(<ClaimDetailScreen dealId="castellan-freight" definitionId="PROCUREMENT_DURATION" role="MANAGER" />);
    const rule = await screen.findByTestId("rule-details");
    expect(rule).toHaveTextContent("policy-v0.1-illustrative");
    expect(rule).not.toHaveTextContent("(illustrative)");
  });

  it("confidence is explained once; the passages show only the number", async () => {
    renderWithRepo(<ClaimDetailScreen dealId="castellan-freight" definitionId="PROCUREMENT_DURATION" role="MANAGER" />);
    await screen.findByRole("heading", { name: "Procurement takes two weeks" });
    expect(screen.getAllByText(/how sure the model is/i)).toHaveLength(1);
    expect(screen.getByTestId("confidence-ex-cf-proc-champion")).toHaveTextContent("AI extraction confidence 99%");
  });

  it("the Castellan deal page: all four claims, no source-summary row, policy headline only, one-line channels", async () => {
    renderWithRepo(<DealLedgerScreen dealId="castellan-freight" role="MANAGER" />);
    await screen.findByRole("heading", { name: "Castellan Freight" });
    expect(screen.getAllByTestId(/^claim-card-/)).toHaveLength(4);
    expect(screen.queryByText("Source summary")).not.toBeInTheDocument();
    expect(screen.getByTestId("claim-card-PROCUREMENT_DURATION")).toHaveTextContent("Later, more authoritative procurement evidence disagrees.");
    expect(screen.getByTestId("claim-card-PROCUREMENT_DURATION")).not.toHaveTextContent("Hannah Brandt (Procurement) states");
    expect(screen.getByTestId("channels-line")).toHaveTextContent("CRM · Email · Calendar · Call recorder");
    // rep-response state lives on the deal page, not the queue
    expect(screen.getByText(/1 of 3 flags answered/)).toBeInTheDocument();
  });

  it("the rep dispute modal uses the agreed copy and does not imply the status changes", async () => {
    mockPath = "/rep/deals/castellan-freight/claims/PROCUREMENT_DURATION";
    const user = userEvent.setup();
    renderWithRepo(<ClaimDetailScreen dealId="castellan-freight" definitionId="PROCUREMENT_DURATION" role="REP" />);
    await user.click(await screen.findByRole("button", { name: "Dispute the reading" }));
    const dialog = screen.getByRole("dialog", { name: "Dispute the reading" });
    expect(dialog).toHaveTextContent("Your manager sees this beside the status.");
    expect(dialog).toHaveTextContent("Saved beside the status. The status itself is set by policy.");
  });
});

describe("Screen 4: human decision", () => {
  it("logs 'Keep Forecast = Commit' beside the claim, and Procurement remains CONTRADICTED", async () => {
    const user = userEvent.setup();
    renderWithRepo(<ClaimDetailScreen dealId="castellan-freight" definitionId="PROCUREMENT_DURATION" role="MANAGER" />);
    await user.click(await screen.findByRole("button", { name: "Log decision" }));

    const dialog = screen.getByRole("dialog", { name: "Log decision" });
    expect(within(dialog).getByLabelText(/Keep Forecast = Commit/)).toBeChecked();
    const reason = within(dialog).getByLabelText("Reason");
    expect(reason).toHaveValue("Procurement delay can be absorbed; waiting for updated customer timeline.");
    await user.click(within(dialog).getByRole("button", { name: "Log decision" }));

    const pair = await screen.findByTestId("status-vs-decision");
    await waitFor(() => expect(within(pair).getByTestId("decision-note")).toHaveTextContent("Keep Forecast = Commit"));
    expect(within(pair).getByTestId("decision-note")).toHaveTextContent("Procurement delay can be absorbed");
    expect(within(pair).getByTestId("decision-note")).toHaveTextContent("Daniel Reyes");
    expect(within(pair).getByText("Contradicted")).toBeInTheDocument();
    expect(screen.getByTestId("status-unchanged")).toHaveTextContent("Business status is still CONTRADICTED");
    expect(screen.getByTestId("status-reason")).toHaveTextContent("Later, more authoritative procurement evidence disagrees");
  });

  it("requires a reason", async () => {
    const user = userEvent.setup();
    renderWithRepo(<ClaimDetailScreen dealId="castellan-freight" definitionId="SECURITY_COMPLETE" role="MANAGER" />);
    await user.click(await screen.findByRole("button", { name: "Log decision" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Log decision" })).toBeDisabled();
  });

  it("the deal page shows the decision beside the deal while the forecast stays Commit", async () => {
    const repo = renderWithRepo(<DealLedgerScreen dealId="castellan-freight" role="MANAGER" />);
    await screen.findByRole("heading", { name: "Castellan Freight" });
    await repo.logDecision({ dealId: "castellan-freight", decisionType: "KEEP_FORECAST", value: "Commit", reason: "Customer deadline unchanged.", userId: "u-daniel" });
    expect(await screen.findByTestId("deal-decision")).toHaveTextContent("Keep Forecast = Commit");
    expect(screen.getByTestId("forecast")).toHaveTextContent("Commit");
    expect(screen.getByTestId("claim-card-PROCUREMENT_DURATION").getAttribute("data-status")).toBe("CONTRADICTED");
  });
});

describe("Screen 5: rep-first view", () => {
  beforeEach(() => {
    mockPath = "/rep/deals/castellan-freight/claims/SECURITY_COMPLETE";
  });

  it("the rep sees the flag first and can verify, dispute, attach and plan a CRM fix, all locally", async () => {
    const user = userEvent.setup();
    renderWithRepo(<ClaimDetailScreen dealId="castellan-freight" definitionId="PROCUREMENT_DURATION" role="REP" />);
    for (const name of ["I’ll verify with the customer", "Dispute the reading", "Add seller-supplied context", "I’ll correct the CRM myself"]) {
      expect(await screen.findByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "Log decision" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dispute the reading" }));
    const dialog = screen.getByRole("dialog", { name: "Dispute the reading" });
    await user.type(within(dialog).getByLabelText("What did the model get wrong?"), "Marcus was describing last year's process.");
    await user.click(within(dialog).getByRole("button", { name: "Log dispute" }));
    const note = await screen.findByTestId("decision-note");
    expect(note).toHaveTextContent("Disputes the reading");
    expect(note).toHaveTextContent("Maya Okafor");
    // a dispute is a human response: status unchanged
    expect(screen.getByTestId("status-unchanged")).toHaveTextContent("Business status is still CONTRADICTED");
  });

  it("seller-supplied context is labelled as such and Security stays UNSUPPORTED", async () => {
    const user = userEvent.setup();
    renderWithRepo(<ClaimDetailScreen dealId="castellan-freight" definitionId="SECURITY_COMPLETE" role="REP" />);
    await user.click(await screen.findByRole("button", { name: "Add seller-supplied context" }));
    const dialog = screen.getByRole("dialog", { name: "Add seller-supplied context" });
    expect(dialog).toHaveTextContent("Visible to your manager. It does not count as verified customer evidence until confirmed through a connected source.");
    await user.type(within(dialog).getByLabelText("Describe the context"), "Tomas confirmed by phone on 7 Oct that the review is done.");
    await user.click(within(dialog).getByRole("button", { name: "Add seller-supplied context" }));
    await waitFor(() => expect(screen.getAllByText(/Seller-supplied: not customer evidence/).length).toBe(2));
    expect(screen.getAllByText("Unsupported").length).toBeGreaterThan(0);
    expect(screen.queryByText("Supported")).not.toBeInTheDocument();
  });

  it("the rep queue shows only the rep's own flagged deals and the seeded response", async () => {
    mockPath = "/rep/";
    renderWithRepo(<QueueScreen role="REP" />);
    const rows = await screen.findAllByTestId(/queue-row-/);
    expect(rows.map((r) => r.getAttribute("data-testid"))).toEqual([
      "queue-row-castellan-freight",
      "queue-row-brightwater-logistics",
      "queue-row-ormond-health",
    ]);
    expect(rows[0]).not.toHaveTextContent(/rep has/i);
    expect(screen.getByText(/You see these flags first/)).toBeInTheDocument();
  });
});

describe("Screen 6: RevOps policy", () => {
  it("shows the four illustrative rules and says they are hypotheses", async () => {
    mockPath = "/revops/";
    renderWithRepo(<RevOpsScreen />);
    await screen.findByRole("heading", { name: "Evidence policy" });
    expect(screen.getByRole("note")).toHaveTextContent("Illustrative hypotheses");
    const val = (label: string) => (screen.getByLabelText(`Freshness window for ${label}, in days`) as HTMLInputElement).value;
    expect(val("Budget confirmed")).toBe("60");
    expect(val("Security complete")).toBe("90");
    expect(val("Procurement duration")).toBe("30");
    expect(val("Close date")).toBe("30");
    expect(screen.queryByText(/Not in V1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/not used on the demo/i)).not.toBeInTheDocument();
    expect(screen.getByText("More predefined claims")).toBeInTheDocument();
  });

  it("changing a freshness window recomputes the status shown for Castellan", async () => {
    const user = userEvent.setup();
    renderWithRepo(<RevOpsScreen />);
    const input = await screen.findByLabelText("Freshness window for Budget confirmed, in days");
    await user.clear(input);
    await user.type(input, "10");
    await user.tab();
    await waitFor(() => expect(screen.getByText("Policy changed from the illustrative defaults.")).toBeInTheDocument());
    const row = screen.getByRole("row", { name: /Budget confirmed/ });
    expect(within(row).getByText("Stale")).toBeInTheDocument();
  });
});
