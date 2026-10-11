"use server";

import { createClient } from "@/lib/supabase/server";

/** Writes an error the person saw into the error log. It never throws: reporting a problem must not cause another one. */
export async function reportError(input: { ref?: string; area?: string; path?: string; message: string; detail?: string; userAgent?: string }): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("report_error" as never, {
      p_ref: input.ref ?? null,
      p_area: input.area ?? null,
      p_path: input.path ?? null,
      p_message: input.message,
      p_detail: input.detail ?? null,
      p_ua: input.userAgent ?? null,
    } as never);
  } catch {
    // nothing else to do
  }
}
