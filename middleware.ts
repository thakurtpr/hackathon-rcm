import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = { 
  matcher: [
    "/dashboard/:path*", 
    "/onboarding/:path*", 
    "/admin/:path*",
    "/scholarships/:path*",
    "/assessment/:path*",
    "/application/:path*"
  ] 
};
