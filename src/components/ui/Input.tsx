import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, ...props }, ref) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        ref={ref}
        className={`w-full px-3 py-2 border rounded-lg text-sm ${
          error ? "border-rose-400" : "border-slate-200"
        } focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-rose-500">{error}</p>}
    </div>
  )
);

Input.displayName = "Input";
