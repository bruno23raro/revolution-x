'use client';

import * as React from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
  'max-w'?: string;
  'max-h'?: string;
}

interface DialogHeaderProps {
  children: React.ReactNode;
}

interface DialogTitleProps {
  children: React.ReactNode;
}

interface DialogDescriptionProps {
  children: React.ReactNode;
}

const DialogContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({
  open: false,
  onOpenChange: () => {},
});

function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange: onOpenChange || (() => {}) }}>
      {children}
    </DialogContext.Provider>
  );
}

function DialogTrigger({ children, ...props }: { children: React.ReactNode }) {
  const { onOpenChange } = React.useContext(DialogContext);

  return (
    <span
      onClick={() => onOpenChange(true)}
      style={{ cursor: 'pointer' }}
      {...props}
    >
      {children}
    </span>
  );
}

function DialogContent({ children, className, 'max-w': maxWidth, 'max-h': maxHeight }: DialogContentProps) {
  const { open, onOpenChange } = React.useContext(DialogContext);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        ref={contentRef}
        className={`rounded-lg border border-white/10 bg-[#08040F] shadow-lg ${maxWidth ? `max-w-${maxWidth}` : 'max-w-md'} ${maxHeight ? `max-h-${maxHeight}` : 'max-h-[90vh]'} w-full mx-4 overflow-y-auto ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

function DialogHeader({ children }: DialogHeaderProps) {
  return <div className="flex flex-col space-y-2.5 p-6">{children}</div>;
}

function DialogTitle({ children }: DialogTitleProps) {
  return <h2 className="text-lg font-semibold text-white leading-none tracking-tight">{children}</h2>;
}

function DialogDescription({ children }: DialogDescriptionProps) {
  return <p className="text-sm text-gray-400">{children}</p>;
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
};
export type { DialogProps, DialogContentProps, DialogHeaderProps, DialogTitleProps, DialogDescriptionProps };