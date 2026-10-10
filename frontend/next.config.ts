import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `localhost` and `127.0.0.1` are the same machine and not the same origin,
   * and the dev server refuses a request for its own chunks from an origin it
   * was not started for. The page still renders, but every script comes back
   * 403 and nothing on it is interactive. Both names, because a README says
   * one and a browser's address bar remembers the other. Development only.
   */
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
