import { createHmac, timingSafeEqual } from "node:crypto";

export function getSession(request) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)vpss_session=([^;]+)/);

  if (!match) return null;

  try {
    const token = match[1];
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [payload, signature] = parts;

    const expected = createHmac("sha256", secret)
      .update(payload)
      .digest("base64url");

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return null;
    }

    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    );

    if (!session.username || session.expires < Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
