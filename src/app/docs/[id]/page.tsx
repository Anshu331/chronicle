import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { DocumentPageClient } from "@/components/editor/document-page-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  return (
    <>
      <AppHeader />
      <DocumentPageClient documentId={id} userId={session.user.id} />
    </>
  );
}
