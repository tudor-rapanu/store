import { readFile } from "fs/promises";
import path from "path";

export async function GET() {
  const logo = await readFile(path.join(process.cwd(), "public/tt-logo.svg"));

  return new Response(logo, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
