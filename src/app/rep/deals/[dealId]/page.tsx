import { DealLedgerScreen } from "@/components/DealLedgerScreen";
import { demoDeals } from "@/data/demoData";

export function generateStaticParams() {
  return demoDeals.map((d) => ({ dealId: d.id }));
}

export default async function Page(props: PageProps<"/rep/deals/[dealId]">) {
  const { dealId } = await props.params;
  return <DealLedgerScreen dealId={dealId} role="REP" />;
}
