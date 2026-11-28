// V06b · Apagar produto: confirmação no alert-dialog do F1 (role="alertdialog", foco preso,
// começa no Cancelar, Esc fecha). Apaga a linha e depois os ficheiros das fotos.
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AuthErrorAlert, errorMessage } from '@/features/auth/AuthErrorAlert';
import { useDeleteProduct } from '../queries';

type DeleteProductDialogProps = {
  productId: string;
  name: string;
  /** Os caminhos das fotos guardadas, para os ficheiros saírem do Storage. */
  imagePaths: string[];
  onDeleted: () => void;
};

export function DeleteProductDialog({
  productId,
  name,
  imagePaths,
  onDeleted,
}: DeleteProductDialogProps) {
  const [open, setOpen] = useState(false);
  const remove = useDeleteProduct();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (remove.isPending) return;
        if (next) remove.reset();
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="link" className="self-center text-danger active:text-danger">
          Apagar produto
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Apagar «{name}»?</AlertDialogTitle>
        <AlertDialogBody>
          <AlertDialogDescription>
            O produto e as fotos saem da loja e não podes desfazer. Se só queres pausar a venda,
            desliga «Publicar na loja».
          </AlertDialogDescription>
          <AuthErrorAlert message={remove.isError ? errorMessage(remove.error) : null} />
          <AlertDialogFooter className="flex-col items-stretch">
            <Button
              variant="danger"
              className="w-full"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate({ id: productId, imagePaths }, { onSuccess: () => onDeleted() })
              }
            >
              {remove.isPending ? 'A apagar…' : 'Apagar produto'}
            </Button>
            {/* O Cancelar do F1 é um link; aqui, como no V06b, um botão secundário. */}
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary" className="w-full" disabled={remove.isPending}>
                Cancelar
              </Button>
            </AlertDialogPrimitive.Cancel>
          </AlertDialogFooter>
        </AlertDialogBody>
      </AlertDialogContent>
    </AlertDialog>
  );
}
