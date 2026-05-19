import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

async function authHandler(
  req: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const params = await context.params;
  return handler(req, { params });
}

export { authHandler as GET, authHandler as POST };
