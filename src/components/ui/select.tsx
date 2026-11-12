'use client';

import * as React from 'react';
import { useState } from 'react';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

interface SelectContentProps {
  children: React.ReactNode;
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
  onSelect?: () => void;
}

interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
}

interface SelectValueProps {
  placeholder?: string;
}

const SelectContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled?: boolean;
}>({
  value: '',
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
  disabled: false,
});

function Select({ value, onValueChange, disabled, children }: SelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <SelectContext.Provider value={{ value: value || '', onValueChange: onValueChange || (() => {}), open, setOpen, disabled }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

function SelectTrigger({ children, className }: SelectTriggerProps) {
  const { open, setOpen, disabled } = React.useContext(SelectContext);
  const { value, onValueChange } = React.useContext(SelectContext);

  return (
    <div
      className={`flex h-10 w-full items-center justify-between rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-white/5'} ${className ?? ''}`}
      onClick={() => !disabled && setOpen(!open)}
    >
      {children}
      <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function SelectValue({ placeholder }: SelectValueProps) {
  const { value, disabled, open, setOpen } = React.useContext(SelectContext);

  return (
    <span onClick={() => !disabled && setOpen(!open)} className="flex-1 block">
      {value || placeholder || 'Select...'}
    </span>
  );
}

function SelectContent({ children }: SelectContentProps) {
  const { open, setOpen } = React.useContext(SelectContext);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-white/10 bg-[#08040F] p-1 shadow-lg"
    >
      {children}
    </div>
  );
}

function SelectItem({ value, children, disabled, onSelect }: SelectItemProps) {
  const { onValueChange, setOpen, value: contextValue } = React.useContext(SelectContext);

  const handleClick = () => {
    if (!disabled) {
      onValueChange(value);
      setOpen(false);
      onSelect?.();
    }
  };

  return (
    <div
      className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-white/5 focus:bg-white/5 focus:text-white'} ${value ? 'font-semibold' : ''}`}
      onClick={handleClick}
      role="option"
      aria-selected={value === (contextValue || '')}
    >
      {children}
    </div>
  );
}

// Named exports for the trigger component pattern
const [SelectTriggerComponent, SelectValueComponent, SelectContentComponent, SelectItemComponent] = [SelectTrigger, SelectValue, SelectContent, SelectItem];

export { Select, SelectTrigger as SelectTrigger, SelectValue as SelectValue, SelectContent as SelectContent, SelectItem as SelectItem };
export type { SelectProps, SelectContentProps, SelectItemProps, SelectTriggerProps, SelectValueProps };