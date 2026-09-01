import { TunnelDetail } from "./tunnel-detail";

export default async function TunnelDetailPage({ params }: { params: Promise<{ id: string }> }): Promise<React.ReactElement> {
  const { id } = await params;
  return <TunnelDetail tunnelID={id} />;
}
