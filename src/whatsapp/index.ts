import axios from "axios";
import FormData from "form-data";

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERSION = "v25.0";

interface SendMessageResponse {
  messaging_product: string;
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
}

function assertCreds() {
  if (!WHATSAPP_TOKEN) {
    throw new Error("No Whatsapp token defined");
  }

  if (!PHONE_NUMBER_ID) {
    throw new Error("No Phone Number ID defined");
  }
}

async function sendTextMessage(to: string, message: string) {
  assertCreds();
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
    console.error(
      "Error enviando mensaje:",
      (error as any).response.data.error || error,
    );
  }
}

async function sendTemplateMessage(to: string) {
  assertCreds();
  try {
    const url = `https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}/messages`;

    const data = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: "hello_world", language: { code: "en_US" } },
    };

    const response = await axios.post<SendMessageResponse>(url, data, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Mensaje enviado con éxito:", response.data.messages[0].id);
  } catch (error) {
    console.error(
      "Error enviando mensaje:",
      (error as any).response.data.error || error,
    );
  }
}

async function uploadMedia(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  assertCreds();
  const url = `https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}/media`;

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append("file", buffer, { filename, contentType: mimeType });

  const response = await axios.post<{ id: string }>(url, form, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      ...form.getHeaders(),
    },
  });

  return response.data.id;
}

async function sendDocument(to: string, mediaId: string, filename: string, caption?: string) {
  assertCreds();
  try {
    const url = `https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}/messages`;

    const data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "document",
      document: { id: mediaId, filename, caption },
    };

    const response = await axios.post<SendMessageResponse>(url, data, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Documento enviado con éxito:", response.data.messages[0].id);
  } catch (error) {
    console.error(
      "Error enviando documento:",
      (error as any).response?.data?.error || error,
    );
  }
}

async function downloadMedia(mediaId: string): Promise<Buffer> {
  assertCreds();
  const { data: meta } = await axios.get<{ url: string }>(
    `https://graph.facebook.com/${VERSION}/${mediaId}`,
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
  );

  const { data } = await axios.get<ArrayBuffer>(meta.url, {
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    responseType: "arraybuffer",
  });

  return Buffer.from(data);
}

export const whatsapp = {
  sendTextMessage,
  sendTemplateMessage,
  uploadMedia,
  sendDocument,
  downloadMedia,
};
