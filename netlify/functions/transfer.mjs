import { getSession } from "./auth.mjs";

export default async function handler(request) {
  if (request.method !== "POST") {
    return Response.json(
      { success: false, error: "Method not allowed." },
      { status: 405 }
    );
  }

  const session = getSession(request);

  if (!session) {
    return Response.json(
      { success: false, error: "Please sign in first." },
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

  let sender;
  let recipient;
  let oldSenderBalance;
  let oldRecipientBalance;
  let senderUpdated = false;
  let recipientUpdated = false;

  try {
    const body = await request.json();

    const senderId = String(body.senderId || "").trim();
    const recipientId = String(body.recipientId || "").trim();
    const amount = Number(body.amount);
    const note = String(body.note || "").trim().slice(0, 80);

    if (
      !senderId ||
      !recipientId ||
      senderId === recipientId ||
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      amount > 50000
    ) {
      return Response.json(
        { success: false, error: "Invalid transfer details." },
        { status: 400 }
      );
    }

    const membersResponse = await fetch(membersUrl, { headers });

    if (!membersResponse.ok) {
      throw new Error("Could not load demo members.");
    }

    const membersData = await membersResponse.json();
    const members = membersData.members || [];

    sender = members.find(
      m => String(m.memberId) === senderId
    );

    recipient = members.find(
      m => String(m.memberId) === recipientId
    );

    if (!sender || !recipient) {
      return Response.json(
        { success: false, error: "Demo member not found." },
        { status: 404 }
      );
    }

    // The logged-in username must own the sending account.
    if (
      String(sender.username || "").toLowerCase() !==
      String(session.username).toLowerCase()
    ) {
      return Response.json(
        { success: false, error: "You cannot transfer from another member's account." },
        { status: 403 }
      );
    }

    oldSenderBalance = Number(sender.sampleBalance);
    oldRecipientBalance = Number(recipient.sampleBalance);

    if (
      !Number.isFinite(oldSenderBalance) ||
      !Number.isFinite(oldRecipientBalance) ||
      !sender.id ||
      !recipient.id
    ) {
      throw new Error("Invalid demo member records.");
    }

    if (oldSenderBalance < amount) {
      return Response.json(
        { success: false, error: "Insufficient demo balance." },
        { status: 400 }
      );
    }

    const newSenderBalance = oldSenderBalance - amount;
    const newRecipientBalance = oldRecipientBalance + amount;

    await updateMember(sender, newSenderBalance);
    senderUpdated = true;

    await updateMember(recipient, newRecipientBalance);
    recipientUpdated = true;

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
      throw new Error("Could not save transfer record.");
    }

    return Response.json({
      success: true,
      message: "Fictional demo transfer completed.",
      transfer,
      balances: {
        sender: newSenderBalance,
        recipient: newRecipientBalance
      }
    });

  } catch (error) {
    // Best-effort rollback if a later step fails.
    const rollback = [];

    if (senderUpdated) {
      rollback.push(updateMember(sender, oldSenderBalance));
    }

    if (recipientUpdated) {
      rollback.push(updateMember(recipient, oldRecipientBalance));
    }

    await Promise.allSettled(rollback);

    return Response.json(
      {
        success: false,
        error: error.message || "Demo transfer failed."
      },
      { status: 500 }
    );
  }
}
