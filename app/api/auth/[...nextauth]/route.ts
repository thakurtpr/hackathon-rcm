import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "admin@gmail.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Admin check
        if (credentials.email === "admin@gmail.com" && credentials.password === "admin") {
          return {
            id: "admin-1",
            name: "Admin User",
            email: "admin@gmail.com",
            role: "admin",
          };
        }

        // Student check
        if (credentials.email === "user@gmail.com" && credentials.password === "user") {
          return {
            id: "user-1",
            name: "Student User",
            email: "user@gmail.com",
            role: "student",
          };
        }

        return null;
      }
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'NEXTAUTH_SECRET',
  pages: {
    signIn: "/login",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
