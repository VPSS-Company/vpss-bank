
export default async function handler() {
  return new Response(
    JSON.stringify({
      success: true,
      message: "VPSS BANK backend is working!"
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}
