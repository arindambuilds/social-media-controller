import { NextRequest, NextResponse } from "next/server";

const DEFAULT_LOCAL_API_ORIGIN = "http://localhost:4000";
const DEFAULT_PRODUCTION_API_ORIGIN = "https://social-media-controller.onrender.com";

function apiBaseUrl(): string {
  const raw = (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === "production"
      ? DEFAULT_PRODUCTION_API_ORIGIN
      : DEFAULT_LOCAL_API_ORIGIN)
  ).replace(/\/$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const upstream = await fetch(`${apiBaseUrl()}/dashboard/stats`, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const body = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return NextResponse.json(body, { status: upstream.status });
    }

    return NextResponse.json(body, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Stats service unavailable" },
      { status: 502 }
    );
  }
}
