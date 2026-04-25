import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isLoading) onConfirm();
      if (e.key === 'Escape') onCancel();
    },
    [onConfirm, onCancel, isLoading]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="fixed z-50 bg-white rounded-2xl shadow-2xl w-[92vw] max-w-sm p-5 space-y-4"
            style={{ left: '50%', top: '45%', transform: 'translate(-50%, -50%)' }}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onKeyDown={handleKeyDown}
            tabIndex={-1}
            autoFocus
          >
            <div className="flex items-center gap-3">
              {variant === 'destructive' && (
                <div className="size-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="size-5 text-red-600" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-sm text-slate-500 mt-1">{description}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={onCancel} className="flex-1" disabled={isLoading}>
                {cancelLabel}
              </Button>
              <Button
                variant={variant === 'destructive' ? 'destructive' : 'default'}
                onClick={onConfirm}
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : confirmLabel}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
