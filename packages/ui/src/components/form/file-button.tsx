import { useRef, type ReactNode } from 'react';
import { Button, type ButtonProps } from '../button/button';

export interface FileButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  readonly children: ReactNode;
  /** Media types and extensions the picker offers. */
  readonly accept: string;
  readonly onFile: (file: File) => void;
}

/** A button that opens the file picker; the chosen file is handed over at once. */
export function FileButton({ children, accept, onFile, ...button }: FileButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) {
            onFile(file);
          }
        }}
      />
      <Button
        {...button}
        onClick={() => {
          input.current?.click();
        }}
      >
        {children}
      </Button>
    </>
  );
}
