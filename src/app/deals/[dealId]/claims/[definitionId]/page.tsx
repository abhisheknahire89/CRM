import { ClaimDetailScreen } from "@/components/ClaimDetailScreen";
import { demoClaimSeeds } from "@/data/demoData";

export function generateStaticParams() {
  return demoClaimSeeds.map((c) => ({ dealId: c.dealId, definitionId: c.definitionId }));
}

export default async function Page(props: PageProps<"/deals/[dealId]/claims/[definitionId]">) {
  const { dealId, definitionId } = await props.params;
  return <ClaimDetailScreen dealId={dealId} definitionId={definitionId} role="MANAGER" />;
}
