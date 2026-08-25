import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Sidebar, type PreparedNavSection } from "@/components/Sidebar";
import { navigation } from "@/config/navigation";
import { allowedHrefs, getViewer, type Viewer } from "@/lib/viewer";

function prepareSections(viewer: Viewer): PreparedNavSection[] {
  const allowed = new Set(allowedHrefs(viewer));
  return navigation
    .map((section) => ({
      title: section.title,
      items: section.items
        .map((item) => ({
          label: item.label,
          href: item.href,
          unlocked: allowed.has(item.href),
          children: item.children,
          note: item.note,
        }))
        // Locked items stay visible with a lock icon, like Product Brain.
        .filter(() => true),
    }))
    .filter((section) => section.items.some((i) => i.unlocked));
}

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (viewer.status === "blocked") redirect("/no-access");

  // Read on the server, so it is replaced on every refresh — which makes
  // it a true statement about the data rather than about the clock.
  const renderedAt = new Date().toISOString();

  return (
    <div className="flex min-h-screen">
      <AutoRefresh />
      <Sidebar
        sections={prepareSections(viewer)}
        userLabel={viewer.name}
        userSub={viewer.email}
        badge={viewer.role}
        canSignOut
        dataAsOf={renderedAt}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
