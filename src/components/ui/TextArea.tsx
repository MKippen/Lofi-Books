import type { TextareaHTMLAttributes } from "react";

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}

export default function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  className = "",
  required,
  id,
  ...rest
}: TextAreaProps) {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={textareaId}
          className="font-semibold text-sm text-indigo/70"
        >
          {label}
          {required && <span className="text-primary ml-0.5">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        required={required}
        className={`
          w-full rounded-xl border-2 border-secondary/20
          px-4 py-2.5
          bg-surface text-indigo
          placeholder:text-indigo/30
          focus:border-primary focus:outline-none
          transition-colors duration-200
          resize-y
        `}
        {...rest}
      />
    </div>
  );
}
