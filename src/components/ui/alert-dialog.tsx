// Design system: Confirmação (a-box com role="alertdialog"), como no quadro A07.
//
// Caixa surface com contorno ink de 2 px, rounded-md e shadow-hard, sobre o véu
// `overlay`. O Radix dá `role="alertdialog"`, prende o foco lá dentro, começa no
// Cancelar (a ação segura), fecha com Esc e devolve o foco a quem a abriu.
import * as React from 'react';
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

function AlertDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay
        data-slot="alert-dialog-overlay"
        className="fixed inset-0 z-50 bg-overlay"
      />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2',
          'flex max-h-[calc(100dvh-32px)] flex-col overflow-y-auto',
          'rounded-md border-2 border-ink bg-surface text-ink shadow-hard',
          className,
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        'm-0 border-b-2 border-ink px-4 py-3 font-display text-price font-bold break-words',
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('m-0 font-body text-body text-ink', className)}
      {...props}
    />
  );
}

function AlertDialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-3 p-4', className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-wrap items-center gap-2.5', className)} {...props} />;
}

/** Fecha sem fazer nada. É o primeiro foco da caixa. */
function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      data-slot="alert-dialog-cancel"
      className={buttonVariants({ variant: 'link', size: 'sm', className })}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
};
