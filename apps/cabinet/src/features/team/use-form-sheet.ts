import { useState } from 'react';

/**
 * Open state of a sheet or dialog with a form. What was typed survives closing it by
 * mistake; once the form is saved, the next opening starts afresh (pass `key` to it).
 */
export function useFormSheet() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  const [saved, setSaved] = useState(false);
  return {
    open,
    key,
    show: () => {
      if (saved) {
        setKey((current) => current + 1);
        setSaved(false);
      }
      setOpen(true);
    },
    setOpen,
    /** Closes after saving, so the form is fresh next time. */
    done: () => {
      setOpen(false);
      setSaved(true);
    },
  };
}
