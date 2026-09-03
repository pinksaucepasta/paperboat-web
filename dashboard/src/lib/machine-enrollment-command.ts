export type MachineEnrollmentCommandPlatform = "unix" | "windows";

export function enrollmentCommand(
  token: string | undefined,
  serverURL: string | undefined,
  platform: MachineEnrollmentCommandPlatform,
  hostname: string,
) {
  if (!token || !serverURL) return "";

  // The release endpoint's enrollment parameter is a DNS label and is
  // intentionally canonicalized to lowercase before it is sent over HTTP.
  // Keep the generated command aligned with that contract even when a user
  // enters a mixed-case Windows hostname.
  const name = hostname.trim().toLowerCase();
  if (name && !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(name)) return "";

  const escaped = (value: string) => value.replace(/'/g, "''");
  const parameter = name ? `${name}-${token}` : token;
  if (platform === "unix") {
    return `curl -fsSL 'https://get.pprbt.dev/install?p=${escaped(parameter)}' | bash`;
  }

  const url = `https://get.pprbt.dev/install?p=${escaped(parameter)}`;
  // This is pasted into PowerShell. Do not wrap it in another double-quoted
  // `powershell -c`: the outer shell would expand $p and $env:TEMP before the
  // child parses the command, corrupting the bootstrap before it downloads.
  return `$p=Join-Path $env:TEMP 'pb.ps1';iwr '${url}' -OutFile $p;try{& $p}finally{rm $p -Force -ErrorAction SilentlyContinue}`;
}
