import type { IconType } from "react-icons";
import { BsOpenai } from "react-icons/bs";
import { CgTwilio } from "react-icons/cg";
import { FaGithub, FaMicrosoft, FaSalesforce, FaSlack } from "react-icons/fa6";
import {
  SiClaude,
  SiConfluence,
  SiGmail,
  SiGoogledocs,
  SiGoogledrive,
  SiHubspot,
  SiNotion,
  SiQuickbooks,
  SiShopify,
} from "react-icons/si";
import { Braces, MessageSquareText, Phone } from "lucide-react";

const providerIcons: Record<string, IconType> = {
  google_drive: SiGoogledrive,
  google_docs: SiGoogledocs,
  slack: FaSlack,
  teams: FaMicrosoft,
  gmail: SiGmail,
  github: FaGithub,
  notion: SiNotion,
  confluence: SiConfluence,
  hubspot: SiHubspot,
  salesforce: FaSalesforce,
  shopify: SiShopify,
  quickbooks: SiQuickbooks,
  twilio: CgTwilio,
  chatgpt: BsOpenai,
  claude: SiClaude,
};

const providerColors: Record<string, string> = {
  google_drive: "#4285f4",
  google_docs: "#4285f4",
  slack: "#611f69",
  teams: "#6264a7",
  gmail: "#ea4335",
  github: "#24292f",
  notion: "#111111",
  confluence: "#1868db",
  hubspot: "#ff5c35",
  salesforce: "#0d9dda",
  shopify: "#64943e",
  quickbooks: "#2ca01c",
  twilio: "#f22f46",
  chatgpt: "#111111",
  claude: "#d97757",
};

export function ProviderLogo({ id, name }: { id: string; name: string }) {
  const Icon = providerIcons[id];
  const Fallback =
    id === "twilio"
      ? Phone
      : id === "custom_agent"
        ? Braces
        : MessageSquareText;

  return (
    <span
      className="grid size-11 shrink-0 place-items-center rounded-[13px] border border-[#dce4ee] bg-white text-xl shadow-[0_5px_16px_rgba(7,27,61,.05)]"
      style={{ color: providerColors[id] ?? "#146bff" }}
      aria-hidden="true"
    >
      {Icon ? (
        <Icon />
      ) : id.startsWith("custom_") ? (
        <span className="text-xs font-extrabold tracking-[-.03em]">
          {name.slice(0, 2).toUpperCase()}
        </span>
      ) : (
        <Fallback size={19} strokeWidth={1.9} />
      )}
    </span>
  );
}
