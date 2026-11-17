import { Card, CardContent } from "~/components/ui/card";
import { formatMoney } from "~/lib/analytics";

export function MoneyCard({
  label,
  amountCents,
  hint,
  emphasis,
}: {
  label: string;
  amountCents: number;
  hint: string;
  emphasis?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div
          className={
            emphasis
              ? "mt-2 text-3xl font-bold text-primary"
              : "mt-2 text-3xl font-bold"
          }
        >
          {formatMoney(amountCents)}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
