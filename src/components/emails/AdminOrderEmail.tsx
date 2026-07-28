import {
  Body,
  Button,
  Container,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface AdminOrderEmailProps {
  orderId: string;
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  paymentMethod: "card" | "bank_transfer";
  adminOrderUrl?: string;
}

export default function AdminOrderEmail({
  orderId,
  customerName,
  customerEmail,
  totalAmount,
  paymentMethod,
  adminOrderUrl,
}: AdminOrderEmailProps) {
  const formattedTotal = (totalAmount / 100).toFixed(2);

  return (
    <Html>
      <Preview>New Todd&apos;s Threads order {orderId}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>NEW ORDER</Heading>

          <Text style={text}>
            Order <strong>#{orderId}</strong> was created.
          </Text>

          <Container style={detailsBox}>
            <Text style={detailText}>
              <strong>Customer:</strong> {customerName}
            </Text>
            <Text style={detailText}>
              <strong>Email:</strong> {customerEmail}
            </Text>
            <Text style={detailText}>
              <strong>Payment:</strong> {paymentMethod.replace("_", " ")}
            </Text>
            <Text style={detailText}>
              <strong>Total:</strong> {formattedTotal} RON
            </Text>
          </Container>

          {adminOrderUrl && (
            <Button href={adminOrderUrl} style={button}>
              Open admin order
            </Button>
          )}

          <Hr style={hr} />

          <Text style={smallText}>Todd&apos;s Threads admin notification</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#ffffff",
  fontFamily: "Helvetica, Arial, sans-serif",
};
const container = {
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "600px",
};
const h1 = {
  fontSize: "24px",
  fontWeight: "900",
  letterSpacing: "2px",
  textTransform: "uppercase" as const,
};
const text = {
  color: "#000000",
  fontSize: "14px",
  lineHeight: "24px",
};
const detailsBox = {
  backgroundColor: "#f8fafc",
  border: "1px solid #000000",
  padding: "16px",
  marginTop: "24px",
};
const detailText = {
  color: "#000000",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 8px",
};
const button = {
  backgroundColor: "#000000",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "12px",
  fontWeight: "700",
  letterSpacing: "1px",
  margin: "20px 0",
  padding: "14px 18px",
  textDecoration: "none",
  textTransform: "uppercase" as const,
};
const hr = {
  borderColor: "#000000",
  margin: "32px 0",
};
const smallText = {
  color: "#64748b",
  fontSize: "12px",
  lineHeight: "20px",
};
