import { redirect } from "next/navigation";

export default function Home() {
  // Send users into the auth flow. The login page forwards already
  // authenticated users on to the dashboard.
  redirect("/login");
}
