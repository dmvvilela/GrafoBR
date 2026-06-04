/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // v1 is fully static. When all per-politician pages are SSG you can enable:
  //   output: "export",
  // (leave off while iterating so dev server / future API routes stay easy).
};

export default nextConfig;
