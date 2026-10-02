import { AuthProvider } from "@/components/auth";
import { Footer, Navbar } from "@/components/navigation";
import { EditorialHome } from "@/components/marketing/editorial-home";
import { publicMetadata } from "@/lib/marketing/metadata";
import "@/components/marketing/cinematic-public.css";
import "@/components/marketing/interactive-story.css";
import "@/components/marketing/public-light.css";

export const metadata = publicMetadata(
  "/",
  "Opryn — Teach Your Business Once",
  "Train every employee and AI agent from the same approved knowledge. Opryn is the training layer for your company.",
);

export default function Home() {
  return (
    <AuthProvider>
      <div className="knowledge-public-site opryn-public-editorial opryn-public-light">
        <Navbar />
        <EditorialHome />
        <Footer />
      </div>
    </AuthProvider>
  );
}
