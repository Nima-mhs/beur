import { Link } from "@/i18n/navigation";

type LogoProps = {
  variant?: "wordmark" | "icon";
  className?: string;
  tone?: "dark" | "light";
};

export function LogoMark({ tone = "dark", className = "" }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <span
      className={`inline-flex flex-col items-center justify-center text-center leading-none rounded-full bg-ink border border-gold/60 ${className}`}
      style={{ width: "3rem", height: "3rem" }}
      aria-hidden
    >
      <span className="text-[8px] font-bold tracking-[0.15em] text-gold">BEUR</span>
      <span className="my-[3px] block h-px w-5 bg-gold/70" />
      <span className="text-[7px] font-light tracking-[0.25em] text-gold/80">SEASON</span>
    </span>
  );
}

export function Logo({ variant = "wordmark", tone = "light", className = "" }: LogoProps) {
  const textColor = tone === "dark" ? "text-gold" : "text-ink";

  return (
    <Link href="/" className={`inline-flex items-center gap-3 ${className}`} aria-label="BEUR SEASON">
      <LogoMark tone={tone} />
      {variant === "wordmark" && (
        <span className={`flex flex-col leading-tight ${textColor}`}>
          <span className="text-lg tracking-[0.12em]">
            <span className="font-bold">BEUR</span>{" "}
            <span className="font-light">SEASON</span>
          </span>
          <span className="text-[10px] font-light uppercase tracking-label opacity-70">
            Beauty Your Season
          </span>
        </span>
      )}
    </Link>
  );
}
