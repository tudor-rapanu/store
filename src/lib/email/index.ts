import { Resend } from "resend";
import OrderConfirmationEmail from "@/components/emails/OrderConfirmation";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : undefined;

export async function sendOrderEmail(
  email: string,
  customerName: string,
  orderId: string,
  totalAmount: number,
  isBankTransfer: boolean,
  orderUrl?: string,
) {
  try {
    if (!resend) {
      console.warn("Skipping email send because RESEND_API_KEY is not configured.");
      return;
    }

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "no-reply@example.com",
      to: email, // If using onboarding@resend.dev, this MUST be the email associated with your Resend account
      subject: isBankTransfer
        ? `Action Required: Transfer Details for Order #${orderId}`
        : `Order Confirmed: Todd's Threads #${orderId}`,
      react: OrderConfirmationEmail({
        customerName,
        orderId,
        totalAmount,
        isBankTransfer,
        orderUrl,
      }),
    });

    if (error) console.error("Resend API Error:", error);
    return data;
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

export async function sendAdminOrderEmail({
  orderId,
  customerName,
  customerEmail,
  totalAmount,
  paymentMethod,
  adminOrderUrl,
}: {
  orderId: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  paymentMethod: "card" | "bank_transfer";
  adminOrderUrl?: string;
}) {
  try {
    if (!resend) {
      console.warn("Skipping admin email because RESEND_API_KEY is not configured.");
      return;
    }

    const adminEmail = process.env.ADMIN_EMAIL;

    if (!adminEmail) {
      console.warn("Skipping admin email because ADMIN_EMAIL is not configured.");
      return;
    }

    const formattedTotal = (totalAmount / 100).toFixed(2);
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "no-reply@example.com",
      to: adminEmail,
      subject: `New Order Created: Todd's Threads #${orderId}`,
      text: [
        `New order ${orderId} was created.`,
        `Customer: ${customerName}`,
        `Email: ${customerEmail}`,
        `Payment method: ${paymentMethod.replace("_", " ")}`,
        `Total: ${formattedTotal} RON`,
        adminOrderUrl ? `Admin link: ${adminOrderUrl}` : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    if (error) console.error("Resend Admin Email Error:", error);
    return data;
  } catch (error) {
    console.error("Failed to send admin order email:", error);
  }
}
