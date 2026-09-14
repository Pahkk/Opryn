import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireAppContext } from "@/lib/app-context";
import { settingsSections } from "@/lib/settings-navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const context = await requireAppContext();
  const query = await searchParams;
  if (query.billing)
    redirect(
      `/app/settings/billing?billing=${encodeURIComponent(query.billing)}`,
    );
  return (
    <>
      {["account", "workspace"].map((group) => {
        const sections = settingsSections(context.isAdmin).filter(
          (item) => item.group === group,
        );
        return sections.length ? (
          <section key={group} className="settings-section">
            <h2 className="text-base font-semibold">
              {group === "account" ? "Your account" : context.organization.name}
            </h2>
            {sections.map((item) => (
              <Link
                key={item.id}
                href={`/app/settings/${item.id}`}
                className="settings-index-link"
              >
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
                <ArrowRight size={18} />
              </Link>
            ))}
          </section>
        ) : null;
      })}
    </>
  );
}
