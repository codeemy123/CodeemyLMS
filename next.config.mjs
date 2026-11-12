/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  // Public backend address, compiled into server rendering for Netlify deployments.
  env: { LMS_BACKEND_ORIGIN: process.env.LMS_BACKEND_ORIGIN || '' },
};

export default nextConfig;
