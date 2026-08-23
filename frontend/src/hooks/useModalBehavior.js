import { useEffect, useRef } from 'react';

// Stack of open overlays so Escape only closes the topmost one (e.g. the
// Account Details modal opened above the account detail view).
const stack = [];

/**
 * Shared behavior for modal overlays: Escape closes the topmost modal, and the
 * page behind is scroll-locked while any modal is open.
 */
export default function useModalBehavior(onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const entry = closeRef;
    stack.push(entry);
    const onKey = (e) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === entry && typeof entry.current === 'function') {
        entry.current();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = stack.indexOf(entry);
      if (i !== -1) stack.splice(i, 1);
      if (stack.length === 0) document.body.style.overflow = '';
    };
  }, []);
}
