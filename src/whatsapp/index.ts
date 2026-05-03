import axios from "axios";

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERSION = "v25.0";

interface SendMessageResponse {
  messaging_product: string;
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
}

async function sendTextMessage(to: string, message: string) {
  try {
    const url = `https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}/messages`;

    const data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        body: message,
      },
    };

    const response = await axios.post<SendMessageResponse>(url, data, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Mensaje enviado con éxito:", response.data.messages[0].id);
  } catch (error) {
    console.error("Error enviando mensaje:", error);
  }
}

export const whatsapp = {
  sendTextMessage
}
