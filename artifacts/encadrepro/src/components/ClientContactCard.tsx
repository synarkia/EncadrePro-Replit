import { Mail, Phone, MapPin } from "lucide-react";

type Props = {
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  email?: string | null;
  telephone?: string | null;
};

export function ClientContactCard({ adresse, code_postal, ville, email, telephone }: Props) {
  const addrLines: string[] = [];
  if (adresse) addrLines.push(...adresse.split("\n").filter(Boolean));
  const cityLine = [code_postal, ville].filter(Boolean).join(" ").trim();
  if (cityLine) addrLines.push(cityLine);

  const hasAddress = addrLines.length > 0;
  const hasEmail = !!email;
  const hasPhone = !!telephone;

  if (!hasAddress && !hasEmail && !hasPhone) return null;

  return (
    <div className="glass-panel rounded-xl border border-border/40 p-4 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Coordonnées du client
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hasAddress && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="leading-snug">
              {addrLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
        )}
        {hasEmail && (
          <div className="flex items-start gap-2">
            <Mail className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <a
              href={`mailto:${email}`}
              className="text-foreground hover:text-primary hover:underline transition-colors break-all"
            >
              {email}
            </a>
          </div>
        )}
        {hasPhone && (
          <div className="flex items-start gap-2">
            <Phone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <a
              href={`tel:${telephone}`}
              className="text-foreground hover:text-primary hover:underline transition-colors"
            >
              {telephone}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
