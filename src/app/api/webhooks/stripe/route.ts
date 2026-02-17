import { NextResponse, type NextRequest } from "next/server";

import { handleWebhookEvent } from "@/lib/services/stripe-service";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  try {
    await handleWebhookEvent(payload, signature);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
