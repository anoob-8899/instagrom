import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SearchPageContent } from "@/components/search/SearchPageContent";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  return <SearchPageContent currentUser={currentUser} />;
}
