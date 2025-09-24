import { h, FunctionComponent } from "preact";
import { useCallback, useEffect, useRef } from "preact/hooks";

export const BaseModal: FunctionComponent<{
  formId?: string;
  title: string;
  onClose: () => void;
  onSubmit?: h.JSX.GenericEventHandler<HTMLFormElement>;
  onChange?: h.JSX.GenericEventHandler<HTMLFormElement>;
}> = ({ children, formId, onClose, onSubmit, onChange, title }) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle ESC key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('modal-backdrop')) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleBackdropClick);
    
    // Focus management
    const previouslyFocused = document.activeElement as HTMLElement;
    dialogRef.current?.focus();
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    return () => {
      // Cleanup
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleBackdropClick);
      document.body.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, [handleKeyDown, handleBackdropClick]);

  return (
    <div
      class="modal-backdrop fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-title`}
    >
      <div
        ref={dialogRef}
        class="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-xl min-w-[320px] max-w-[90vw] max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
        tabIndex={-1}
      >
        {/* Modal Header */}
        <div class="flex items-center justify-between p-6 border-b border-[hsl(var(--border))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
          <h2
            id={`${formId}-title`}
            class="text-lg font-semibold leading-none tracking-tight"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            class="inline-flex items-center justify-center rounded-md p-2 text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
            aria-label="Close modal"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.6129 5.2097C6.22061 4.90468 5.65338 4.93241 5.29289 5.29289C4.90237 5.68342 4.90237 6.31658 5.29289 6.70711L10.5858 12L5.29289 17.2929L5.2097 17.3871C4.90468 17.7794 4.93241 18.3466 5.29289 18.7071C5.68342 19.0976 6.31658 19.0976 6.70711 18.7071L12 13.4142L17.2929 18.7071L17.3871 18.7903C17.7794 19.0953 18.3466 19.0676 18.7071 18.7071C19.0976 18.3166 19.0976 17.6834 18.7071 17.2929L13.4142 12L18.7071 6.70711L18.7903 6.6129C19.0953 6.22061 19.0676 5.65338 18.7071 5.29289C18.3166 4.90237 17.6834 4.90237 17.2929 5.29289L12 10.5858L6.70711 5.29289L6.6129 5.2097Z"
              />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div class="p-6 bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))]">
          <form method="dialog" onSubmit={onSubmit} onChange={onChange} id={formId}>
            {children}
          </form>
        </div>
      </div>
    </div>
  );
};
