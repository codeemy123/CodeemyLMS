import './globals.css';
import '@/styles/premium.css';
export const metadata = {
  title: 'CodeEmy · Learning workspace',
  description: 'CodeEmy Edutech learning management workspace',
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
