// No providers needed while auth is disabled. Passthrough kept for stable imports.
export default function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
