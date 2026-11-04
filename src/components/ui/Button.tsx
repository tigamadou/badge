import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "positive" | "secondary" | "danger" | "link";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-navy text-white hover:bg-navy-hover",
  positive: "bg-turquoise text-navy hover:bg-turquoise-strong hover:text-white",
  secondary: "border border-slate-300 bg-white text-navy hover:bg-mist",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  link: "",
};

// Les variantes pleines ont fond et padding ; « link » n'a que le texte (couleur via className).
const baseClasses: Record<Variant, string> = {
  primary: "px-4 py-2 rounded-lg text-sm font-medium",
  positive: "px-4 py-2 rounded-lg text-sm font-medium",
  secondary: "px-4 py-2 rounded-lg text-sm font-medium",
  danger: "px-4 py-2 rounded-lg text-sm font-medium",
  link: "text-[13px] font-medium hover:underline",
};

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`relative ${baseClasses[variant]} transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          {/* opacity-0 (et non invisible) : la largeur reste stable et le nom accessible est lu */}
          <span className="opacity-0">{children}</span>
          <span
            aria-hidden="true"
            data-testid="button-spinner"
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
