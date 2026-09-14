import { NextResponse } from "next/server";
export function rejectCrossOrigin(request: Request) {
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return NextResponse.json(
      { error: "Please perform this action from Opryn." },
      { status: 403 },
    );
  return null;
}
