export function ClientsError({ error }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-start justify-center p-8">
      <div className="max-w-md rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
        <h2 className="text-base font-semibold">Something went wrong in Client Directory</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Reload
          </button>
          <a
            href="/dashboard"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground"
          >
            Dashboard home
          </a>
        </div>
      </div>
    </div>
  );
}
