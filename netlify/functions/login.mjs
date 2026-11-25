import { createHmac, timingSafeEqual } from "node:crypto";

function sign(value, secret) {
  return createHmac("sha256", secret)
    .update(value)
    .digest("base64url");
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return Response.json(
      { success: false, error: "Method not allowed." },
      { status: 405 }
    );
  }

  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    return Response.json(
      { success: false, error: "Login is not configured." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    let authenticated = false;

    for (let i = 1; i <= 3; i++) {
      const savedUser = process.env[`DEMO_USER_${i}`];
      const savedPass = process.env[`DEMO_PASS_${i}`];

      if (
        savedUser &&
        savedPass &&
        safeEqual(username, savedUser) &&
        safeEqual(password, savedPass)
      ) {
        authenticated = true;
        break;
      }
    }

    if (!authenticated) {
      return Response.json(
        { success: false, error: "Incorrect demo username or password." },
        { status: 401 }
      );
    }

    const payload = Buffer.from(JSON.stringify({
      username,
      expires: Date.now() + 8 * 60 * 60 * 1000
    })).toString("base64url");

    const token = payload + "." + sign(payload, secret);

    return Response.json(
      { success: true, username },
      {
        headers: {
          "Set-Cookie":
            `vpss_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`
        }
      }
    );

  } catch {
    return Response.json(
      { success: false, error: "Invalid login request." },
      { status: 400 }
    );
  }
}
