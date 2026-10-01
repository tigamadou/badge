import { InputHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, ...props }, ref) => {
    const reactId = useId();
    const inputId = id ?? reactId;
    return (
      <div className={label ? "mb-4" : ""}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-3 py-2 border rounded-lg text-sm ${
            error ? "border-rose-400" : "border-slate-300"
          } focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
