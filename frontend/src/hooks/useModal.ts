import { useState, useCallback } from 'react';

interface ModalState {
  open: boolean;
  title: string;
  message: string;
  type: 'alert' | 'confirm';
  onConfirm?: () => void;
}

export function useModal() {
  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: '',
    message: '',
    type: 'alert',
  });

  const alert = useCallback((message: string, title = 'Aviso') => {
    return new Promise<void>((resolve) => {
      setModal({
        open: true,
        title,
        message,
        type: 'alert',
        onConfirm: () => {
          setModal((prev) => ({ ...prev, open: false }));
          resolve();
        },
      });
    });
  }, []);

  const confirm = useCallback((message: string, title = 'Confirmar') => {
    return new Promise<boolean>((resolve) => {
      setModal({
        open: true,
        title,
        message,
        type: 'confirm',
        onConfirm: () => {
          setModal((prev) => ({ ...prev, open: false }));
          resolve(true);
        },
      });
    });
  }, []);

  const close = useCallback(() => {
    setModal((prev) => ({ ...prev, open: false }));
  }, []);

  return { modal, alert, confirm, close };
}
