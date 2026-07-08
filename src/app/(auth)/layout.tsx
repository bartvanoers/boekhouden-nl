/**
 * Layout voor de auth-schermen (login, setup): gecentreerde card zonder
 * app-navigatie. Rustig en professioneel, in lijn met de rest van de app.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold tracking-tight">Boekhouden</h1>
          <p className="text-xs text-muted-foreground">Administratie</p>
        </div>
        {children}
      </div>
    </div>
  );
}
