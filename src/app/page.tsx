import { redirect } from "next/navigation";

// This is the absolute root; it redirects users to the default locale
export default function RootPage() {
  redirect("/en");
}
