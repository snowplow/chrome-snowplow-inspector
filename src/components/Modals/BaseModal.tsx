import { h, type FunctionComponent } from "preact";
import { useEffect, useRef } from "preact/hooks";

export const BaseModal: FunctionComponent<{
  formId?: string;
  title: string;
  onClose: () => void;
  onSubmit?: h.JSX.GenericEventHandler<HTMLFormElement>;
  onChange?: h.JSX.GenericEventHandler<HTMLFormElement>;
}> = ({ children, formId, onClose, onSubmit, onChange, title }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    return () => dialogRef.current?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClick={({ currentTarget, target }) =>
        target === currentTarget && onClose()
      }
    >
      <form method="dialog" onSubmit={onSubmit} onChange={onChange} id={formId}>
        <header>
          <p>{title}</p>
          <button class="close" type="button" onClick={() => onClose()}>
            <svg viewBox="0 0 24 24">
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M6.6129 5.2097C6.22061 4.90468 5.65338 4.93241 5.29289 5.29289C4.90237 5.68342 4.90237 6.31658 5.29289 6.70711L10.5858 12L5.29289 17.2929L5.2097 17.3871C4.90468 17.7794 4.93241 18.3466 5.29289 18.7071C5.68342 19.0976 6.31658 19.0976 6.70711 18.7071L12 13.4142L17.2929 18.7071L17.3871 18.7903C17.7794 19.0953 18.3466 19.0676 18.7071 18.7071C19.0976 18.3166 19.0976 17.6834 18.7071 17.2929L13.4142 12L18.7071 6.70711L18.7903 6.6129C19.0953 6.22061 19.0676 5.65338 18.7071 5.29289C18.3166 4.90237 17.6834 4.90237 17.2929 5.29289L12 10.5858L6.70711 5.29289L6.6129 5.2097Z"
              />
            </svg>
          </button>
        </header>
        {children}
      </form>
    </dialog>
  );
};
