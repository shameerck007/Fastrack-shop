"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendOrderMessage } from "@/lib/actions/order-messages";
import type { OrderMessage } from "@/types/database";

export default function OrderChat({
  orderId,
  currentUserId,
  otherPartyLabel,
  initialMessages,
}: {
  orderId: string;
  currentUserId: string;
  otherPartyLabel: string;
  initialMessages: OrderMessage[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // See RiderLocationMap for why the session must be awaited before
    // subscribing — otherwise the realtime socket connects as anon and
    // RLS drops every event.
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`order-chat-${orderId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
          (payload) => {
            const next = payload.new as OrderMessage;
            setMessages((prev) => (prev.some((m) => m.id === next.id) ? prev : [...prev, next]));
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [orderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setError(null);
    setDraft("");
    startTransition(async () => {
      try {
        await sendOrderMessage(orderId, body);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send message.");
      }
    });
  }

  return (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-4 py-2 text-sm font-medium">Chat with {otherPartyLabel}</div>

      <div className="flex max-h-64 min-h-[8rem] flex-col gap-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-neutral-400">No messages yet — say hello 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-1.5 text-sm ${
                    mine ? "bg-blue-700 text-white" : "bg-neutral-100 text-neutral-800"
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-neutral-100 p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          maxLength={1000}
          className="flex-1 rounded-full border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="rounded-full bg-blue-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          Send
        </button>
      </form>
      {error && <p className="px-4 pb-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
