// Design system: TalaoAviso (p-notice), para as mensagens passageiras.
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from 'lucide-react';

// Sem next-themes: o Cartaz só tem tema claro.
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-center"
      icons={{
        success: <CircleCheck aria-hidden="true" className="size-5 text-success" />,
        info: <Info aria-hidden="true" className="size-5 text-info" />,
        warning: <TriangleAlert aria-hidden="true" className="size-5 text-warning" />,
        error: <CircleAlert aria-hidden="true" className="size-5 text-danger" />,
        loading: (
          <LoaderCircle
            aria-hidden="true"
            className="size-5 animate-spin motion-reduce:animate-none"
          />
        ),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-start gap-2.5 px-3.5 py-3 border-2 border-ink rounded-md bg-surface text-ink shadow-hard font-body text-body',
          title: 'font-bold',
          description: 'text-caption font-medium text-ink-muted',
          actionButton:
            'ml-auto min-h-11 px-3.5 border-2 border-ink rounded-md bg-brand text-ink font-display font-bold',
          cancelButton:
            'min-h-11 px-3.5 border-2 border-ink rounded-md bg-surface text-ink font-display font-bold',
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
