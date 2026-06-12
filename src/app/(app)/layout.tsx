import { Sidebar } from "@/components/Sidebar";
import { navigation } from "@/config/navigation";
import { requireSession } from "@/lib/session";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        sections={navigation}
        role={session.user.role}
        userName={session.user.name ?? "Signed in"}
        userEmail={session.user.email ?? ""}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
