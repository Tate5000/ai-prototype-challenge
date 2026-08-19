import { AuthView } from "@neondatabase/auth-ui";

export default async function AuthPage({
  params,
}: {
  params: Promise<{ pathname: string }>;
}) {
  const { pathname } = await params;
  return (
    <main className="flex grow flex-col items-center justify-center gap-3 p-4">
      <AuthView pathname={pathname} />
    </main>
  );
}
