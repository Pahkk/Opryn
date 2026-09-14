import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_ACCOUNT_SETTINGS,
  type AccountSettings,
} from "@/lib/account-settings";

export const getAccountSettings = cache(
  async (userId: string): Promise<AccountSettings> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("account_settings")
      .select(
        "display_name,timezone,timezone_overridden,locale,density,motion,notify_questions,notify_reviews,notify_answers,avatar_path,avatar_hidden,revision",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (error)
      throw new Error(
        "Your account settings could not be loaded. Please try again.",
      );
    return data ? (data as AccountSettings) : { ...DEFAULT_ACCOUNT_SETTINGS };
  },
);
