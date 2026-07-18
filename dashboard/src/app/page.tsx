import { redirect } from "next/navigation";

/** The console lives under /dashboard; the marketing root just forwards there. */
export default function RootPage() {
  redirect("/dashboard");
}
