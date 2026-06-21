import {
  Html,
  Body,
  Container,
  Text,
  Heading,
  Hr,
  Preview,
} from "@react-email/components";

interface OrderConfirmationProps {
  customerName: string;
  orderId: string;
  totalAmount: number;
  isBankTransfer: boolean;
  orderUrl?: string;
}

export default function OrderConfirmationEmail({
  customerName,
  orderId,
  totalAmount,
  isBankTransfer,
  orderUrl,
}: OrderConfirmationProps) {
  const formattedTotal = (totalAmount / 100).toFixed(2);

  return (
    <Html>
      <Preview>Your Series 01 order confirmation</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>TODD&apos;S THREADS</Heading>

          <Text style={text}>Hi {customerName},</Text>

          <Text style={text}>
            We&apos;ve received your order <strong>#{orderId}</strong>.
          </Text>

          {isBankTransfer ? (
            <Container style={alertBox}>
              <Text style={alertText}>
                <strong>ACTION REQUIRED:</strong> Your order is pending. Please
                transfer {formattedTotal} RON to our account to complete the
                purchase. Order will ship upon fund clearance.
              </Text>
            </Container>
          ) : (
            <Text style={text}>
              Payment successful. We are prepping your items for shipment.
            </Text>
          )}

          <Hr style={hr} />

          <Text style={footer}>TOTAL: {formattedTotal} RON</Text>

          {orderUrl && (
            <Text style={text}>
              You can view your order status here:{" "}
              <a href={orderUrl}>View order</a>
            </Text>
          )}

          <Text style={smallText}>Todd&apos;s Threads | Series 01</Text>
        </Container>
      </Body>
    </Html>
  );
}

// Inline styles (Standard practice for robust email rendering)
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
const alertBox = {
  backgroundColor: "#f8fafc",
  border: "1px solid #000000",
  padding: "16px",
  marginTop: "24px",
};
const alertText = {
  color: "#000000",
  fontSize: "13px",
  lineHeight: "20px",
};
const hr = {
  borderColor: "#000000",
  margin: "32px 0",
};
const footer = {
  fontSize: "16px",
  fontWeight: "bold",
  letterSpacing: "1px",
};
const smallText = {
  color: "#64748b",
  fontSize: "12px",
  marginTop: "32px",
};
