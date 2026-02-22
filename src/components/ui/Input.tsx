import type { InputHTMLAttributes } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export default function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  className = "",
  error,
  id,
  ...rest
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="font-semibold text-sm text-indigo/70"
        >
          {label}
          {required && <span className="text-primary ml-0.5">*</span>}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={`
          w-full rounded-xl border-2 border-secondary/20
          px-4 py-2.5
          bg-surface text-indigo
          placeholder:text-indigo/30
          focus:border-primary focus:outline-none
          transition-colors duration-200
          ${error ? "border-red-400" : ""}
        `}
        {...rest}
      />
      {error && (
        <span className="text-red-400 text-xs">{error}</span>
      )}
    </div>
  );
}
