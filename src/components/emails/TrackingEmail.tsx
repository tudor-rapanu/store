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

interface TrackingEmailProps {
  customerName: string;
  orderId: string;
  trackingUrl: string;
}

export default function TrackingEmail({
  customerName,
  orderId,
  trackingUrl,
}: TrackingEmailProps) {
  return (
    <Html>
      <Preview>Your Todd&apos;s Threads order has shipped</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>TODD&apos;S THREADS</Heading>

          <Text style={text}>Hi {customerName},</Text>

          <Text style={text}>
            Your order <strong>#{orderId}</strong> has shipped.
          </Text>

          <Button href={trackingUrl} style={button}>
            Track order
          </Button>

          <Hr style={hr} />

          <Text style={smallText}>
            Tracking details may take a little time to appear after the label is
            created.
          </Text>
          <Text style={smallText}>Todd&apos;s Threads | Series 01</Text>
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
