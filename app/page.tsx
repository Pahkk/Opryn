import { AuthProvider } from "@/components/auth";
import { Footer, Navbar } from "@/components/navigation";
import { StoryHome } from "@/components/marketing/story-home";
import { publicMetadata } from "@/lib/marketing/metadata";

export const metadata = publicMetadata(
  "/",
  "Opryn — Teach Your Business Once",
  "Turn company processes, policies, and answers into approved operational knowledge for your people and connected AI.",
);

export default function Home() {
  return (
    <AuthProvider>
      <div className="knowledge-public-site">
        <Navbar />
        <StoryHome />
        <Footer />
      </div>
    </AuthProvider>
  );
}
