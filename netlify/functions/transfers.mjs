
export default async function handler(request) {
  if (request.method !== "GET") {
    return Response.json(
      { success: false, error: "Method not allowed." },
      { status: 405 }
    );
  }

  const url = process.env.SHEETY_TRANSFERS_URL;
  const auth = process.env.SHEETY_AUTH_HEADER;

  if (!url) {
    return Response.json(
      { success: false, error: "Transfers API is not configured." },
      { status: 500 }
    );
  }

  try {
    const headers = { Accept: "application/json" };

    if (auth) {
      headers.Authorization = auth;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      return Response.json(
        { success: false, error: "Could not retrieve transfers." },
        { status: 502 }
      );
    }

    const data = await response.json();

    return Response.json({
      success: true,
      transfers: data.transfers || []
    });
  } catch {
    return Response.json(
      { success: false, error: "Unable to connect to the records service." },
      { status: 502 }
    );
  }
}
