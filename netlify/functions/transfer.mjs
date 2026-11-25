
export default async function handler(request) {
  if (request.method !== "POST") {
    return Response.json(
      { success: false, error: "Method not allowed." },
      { status: 405 }
    );
  }

  const key = process.env.DEMO_TRANSFER_KEY;
  const suppliedKey = request.headers.get("x-demo-key");

  if (!key || suppliedKey !== key) {
    return Response.json(
      { success: false, error: "Demo access denied." },
      { status: 401 }
    );
  }

  const membersUrl = process.env.SHEETY_MEMBERS_URL;
  const transfersUrl = process.env.SHEETY_TRANSFERS_URL;
  const auth = process.env.SHEETY_AUTH_HEADER;

  if (!membersUrl || !transfersUrl) {
    return Response.json(
      { success: false, error: "Sheety is not configured." },
      { status: 500 }
    );
  }

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };

  if (auth) headers.Authorization = auth;

  let sender;
  let recipient;
  let oldSenderBalance;
  let oldRecipientBalance;

  try {
    const body = await request.json();

    const senderId = String(body.senderId || "").trim();
    const recipientId = String(body.recipientId || "").trim();
    const amount = Number(body.amount);
    const note = String(body.note || "").trim().slice(0, 100);

    if (
      !senderId ||
      !recipientId ||
      senderId === recipientId ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 100000
    ) {
      return Response.json(
        { success: false, error: "Invalid transfer details." },
        { status: 400 }
      );
    }

    const membersResponse = await fetch(membersUrl, { headers });

    if (!membersResponse.ok) {
      throw new Error("Could not load members.");
    }

    const membersData = await membersResponse.json();
    const members = membersData.members || [];

    sender = members.find(
      member => String(member.memberId) === senderId
    );

    recipient = members.find(
      member => String(member.memberId) === recipientId
    );

    if (!sender || !recipient) {
      return Response.json(
        { success: false, error: "Demo member not found." },
        { status: 404 }
      );
    }

    oldSenderBalance = Number(sender.sampleBalance);
    oldRecipientBalance = Number(recipient.sampleBalance);

    if (
      !Number.isFinite(oldSenderBalance) ||
      !Number.isFinite(oldRecipientBalance)
    ) {
      throw new Error("Invalid demo balances.");
    }

    if (oldSenderBalance < amount) {
      return Response.json(
        { success: false, error: "Insufficient demo balance." },
        { status: 400 }
      );
    }

    const newSenderBalance = oldSenderBalance - amount;
    const newRecipientBalance = oldRecipientBalance + amount;

    if (!sender.id || !recipient.id) {
      throw new Error("Member row IDs are missing.");
    }

    const updateMember = async (member, balance) => {
      const url = `${membersUrl.replace(/\/$/, "")}/${member.id}`;

      const response = await fetch(url, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          member: { sampleBalance: balance }
        })
      });

      if (!response.ok) {
        throw new Error("Could not update demo balance.");
      }
    };

    await updateMember(sender, newSenderBalance);

    try {
      await updateMember(recipient, newRecipientBalance);
    } catch (error) {
      await updateMember(sender, oldSenderBalance).catch(() => {});
      throw error;
    }

    const transfer = {
      transferRef: "DEMO-" + Date.now(),
      senderId,
      recipientId,
      amount,
      note,
      date: new Date().toISOString()
    };

    const recordResponse = await fetch(transfersUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ transfer })
    });

    if (!recordResponse.ok) {
      await Promise.allSettled([
        updateMember(sender, oldSenderBalance),
        updateMember(recipient, oldRecipientBalance)
      ]);

      throw new Error("Could not save transfer record.");
    }

    return Response.json({
      success: true,
      message: "Demo transfer completed.",
      transfer,
      balances: {
        sender: newSenderBalance,
        recipient: newRecipientBalance
      }
    });

  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message || "Demo transfer failed."
      },
      { status: 500 }
    );
  }
}
