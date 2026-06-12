import { redirect } from "next/navigation";
import {
  Sidebar,
  type PreparedNavSection,
} from "@/components/Sidebar";
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
        }))
        // Members see locked items (with a lock icon, like Product
        // Brain); guests only see what their link unlocks.
        .filter((item) => viewer.kind === "member" || item.unlocked),
    }))
    .filter((section) => section.items.some((i) => i.unlocked));
}

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (viewer.kind === "member" && viewer.status !== "approved") {
    redirect("/pending");
  }

  const isMember = viewer.kind === "member";

  return (
    <div className="flex min-h-screen">
      <Sidebar
        sections={prepareSections(viewer)}
        userLabel={isMember ? viewer.name : "Guest"}
        userSub={isMember ? viewer.email : `Shared link · ${viewer.label}`}
        badge={isMember ? viewer.role : "guest"}
        canSignOut={isMember}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
