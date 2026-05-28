import { useState, useRef } from 'react';
import { mmSsToSeconds, secondsToMmSs } from '../utils/time';

interface Props {
  value: number | null;
  onChange: (seconds: number | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export default function TimeInput({ value, onChange, disabled, className = '', placeholder = 'm:ss' }: Props) {
  const [text, setText] = useState(value != null ? secondsToMmSs(value) : '');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleBlur = () => {
    if (text.trim() === '') {
      setError(false);
      onChange(null);
      return;
    }
    const seconds = mmSsToSeconds(text);
    if (seconds == null) {
      setError(true);
    } else {
      setError(false);
      setText(secondsToMmSs(seconds));
      onChange(seconds);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    setError(false);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder={placeholder}
      className={`border rounded px-2 py-1 text-sm font-mono w-20 ${
        error ? 'border-red-500 bg-red-50' : 'border-gray-300'
      } disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
    />
  );
}
