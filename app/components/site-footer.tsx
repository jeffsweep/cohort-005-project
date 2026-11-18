export function SiteFooter({ year }: { year: number }) {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
        © {year} Cadence
      </div>
    </footer>
  );
}
