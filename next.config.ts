import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/sanctuary-web', destination: '/sanctuary-web/index.html' },
      { source: '/sanctuary-web/rooms/KRX/:ticker', destination: '/sanctuary-web/index.html' },
    ];
  },
  async headers() {
    return [
      { source: '/sanctuary-web/unity/Build/:file*.gz', headers: [{ key: 'Content-Encoding', value: 'gzip' }] },
      { source: '/sanctuary-web/unity/Build/unity.wasm.gz', headers: [{ key: 'Content-Type', value: 'application/wasm' }] },
      { source: '/sanctuary-web/unity/Build/unity.framework.js.gz', headers: [{ key: 'Content-Type', value: 'application/javascript' }] },
      { source: '/sanctuary-web/unity/Build/unity.data.gz', headers: [{ key: 'Content-Type', value: 'application/octet-stream' }] },
    ];
  },
};

export default nextConfig;
