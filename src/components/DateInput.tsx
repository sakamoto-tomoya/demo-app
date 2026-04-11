"use client";

import { useRef } from "react";

type DateInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

const CalendarIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export function DateInput({ className = "", ...props }: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="date"
        className={`${className} pr-10`}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => {
          try {
            inputRef.current?.showPicker();
          } catch {
            inputRef.current?.focus();
          }
        }}
        className="absolute right-0 top-0 flex h-full w-10 items-center justify-center rounded-r-lg text-[var(--muted)] hover:text-[var(--foreground)] focus:outline-none"
        aria-label="カレンダーを開く"
      >
        <CalendarIcon />
      </button>
    </div>
  );
}

// テキスト入力（type="text"）にカレンダーアイコンを付けるコンポーネント
export function DateTextInput({ className = "", ...props }: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className={`${className} pr-10`}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => inputRef.current?.focus()}
        className="absolute right-0 top-0 flex h-full w-10 items-center justify-center rounded-r-lg text-[var(--muted)] hover:text-[var(--foreground)] focus:outline-none"
        aria-label="日付入力欄にフォーカス"
      >
        <CalendarIcon />
      </button>
    </div>
  );
}
