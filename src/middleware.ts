export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/chat/:path*", "/api/chat/:path*", "/api/grants/:path*", "/api/ingest/:path*"],
};
