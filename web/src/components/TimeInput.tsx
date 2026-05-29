import { useState, useRef } from 'react';
import { parseCentiseconds, centisecondsToDisplay } from '../utils/time';

interface Props {
  value: number | null;
  onChange: (centiseconds: number | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export default function TimeInput({ value, onChange, disabled, className = '', placeholder = 'm:ss.cc' }: Props) {
  const [text, setText] = useState(value != null ? centisecondsToDisplay(value) : '');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleBlur = () => {
    if (text.trim() === '') {
      setError(false);
      onChange(null);
      return;
    }
    const cs = parseCentiseconds(text);
    if (cs == null) {
      setError(true);
    } else {
      setError(false);
      setText(centisecondsToDisplay(cs));
      onChange(cs);
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
      className={`border rounded px-2 py-1 text-sm font-mono w-24 ${
        error ? 'border-red-500 bg-red-50' : 'border-gray-300'
      } disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
    />
  );
}
