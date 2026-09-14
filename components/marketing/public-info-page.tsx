import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth";
import { Navbar, Footer } from "@/components/navigation";

export function PublicInfoPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="knowledge-public-site">
        <Navbar />
        <main id="top" className="public-info-page">
          <header>
            <h1>{title}</h1>
            <p>{intro}</p>
          </header>
          {children}
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}
