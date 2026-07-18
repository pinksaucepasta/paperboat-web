import { normalizeUserCode } from "@/lib/auth-return";
import { DeviceAuthorization } from "./device-authorization";

export default async function CLIAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const code = normalizeUserCode((await searchParams).code);
  return <DeviceAuthorization code={code} />;
}
