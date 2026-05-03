import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERSION = "v25.0";

interface SendMessageResponse {
  messaging_product: string;
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
}

async function sendWhatsAppMessage(to: string, message: string) {
  try {
    const url = `https://graph.facebook.com/${VERSION}/${PHONE_NUMBER_ID}/messages`;

    // Plantilla
    const dataPlantilla = {
      messaging_product: "whatsapp",
      to, // Formato: 573001234567
      type: "template",
      text: {
        preview_url: false,
        body: message,
      },
      template: {
        name: "hello_world",
        language: {
          code: "en_US",
        },
      },
    };

    const data = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        body: message,
      },
    };

    // {
    //   "to": "573157332828",
    // "template": {
    //   "name": "hello_world",
    //   "language": {
    //     "code": "en_US"
    //   }
    // }
    // }

    const response = await axios.post<SendMessageResponse>(url, data, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Mensaje enviado con éxito:", response.data.messages[0].id);
  } catch (error) {
    console.error("Error enviando mensaje:", error);
    console.log("@@error", (error as any).response.data.error);
  }
}

// Ejemplo de uso
// sendWhatsAppMessage('57310XXXXXXX', '¡Hola! Soy tu bot de inventario.');
//
async function main() {
  await sendWhatsAppMessage(
    "+573157332828",
    "¡Hola! Soy tu bot de inventario.",
  );
}

main();
