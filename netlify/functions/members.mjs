import { getSession } from "./auth.mjs";

export default async function handler(request) {
  if (request.method !== "GET") {
    return Response.json(
      { success: false, error: "Method not allowed." },
      { status: 405 }
    );
  }

  if (!getSession(request)) {
    return Response.json(
      { success: false, error: "Please sign in first." },
      { status: 401 }
    );
  }

  const url = process.env.SHEETY_MEMBERS_URL;
  const auth = process.env.SHEETY_AUTH_HEADER;

  if (!url) {
    return Response.json(
      { success: false, error: "Members API is not configured." },
      { status: 500 }
    );
  }

  try {
    const headers = { Accept: "application/json" };
    if (auth) headers.Authorization = auth;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      return Response.json(
        { success: false, error: "Could not retrieve member records." },
        { status: 502 }
      );
    }

    const data = await response.json();

    return Response.json({
      success: true,
      members: data.members || []
    });
  } catch {
    return Response.json(
      { success: false, error: "Unable to connect to records service." },
      { status: 502 }
    );
  }
}
