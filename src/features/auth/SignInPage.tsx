// Ecrã K01 · Entrar.
import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useDocumentTitle } from '@/lib/use-document-title';
import { signIn } from './api';
import { AuthErrorAlert, errorMessage } from './AuthErrorAlert';
import { safeRedirect } from './redirect';
import { signInSchema, type SignInInput } from './schemas';

export function SignInPage() {
  useDocumentTitle('Entrar');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const sending = useRef(false);
  const forgotNoteId = useId();

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (sending.current) return;
    sending.current = true;
    setServerError(null);
    try {
      await signIn(values);
      navigate(safeRedirect(params.get('voltar')), { replace: true });
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      sending.current = false;
    }
  });

  const submitting = form.formState.isSubmitting;

  return (
    <PageShell header={<AppHeader back="/" />} className="gap-5.5">
      <img src="/logo.png" alt="PAIÁ" className="block h-10 w-auto self-start mix-blend-multiply" />
      <h1 className="m-0 font-display text-display-xl font-bold text-ink uppercase">
        Entra no <mark className="rounded-sm bg-brand px-1.5 text-ink">PAIÁ</mark>
      </h1>
      <p className="m-0 font-body text-body-lg">Compra e vende dentro da comunidade da UGS.</p>

      <Form {...form}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="nome@exemplo.ao"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Palavra-passe</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className="pr-24"
                      {...field}
                    />
                  </FormControl>
                  <Button
                    variant="link"
                    size="sm"
                    aria-label={showPassword ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1 right-1 min-w-11 text-ink"
                  >
                    {showPassword ? 'Esconder' : 'Mostrar'}
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="-mt-1.5 flex flex-wrap items-center gap-x-2">
            {/* Sem destino nesta fase: fica focável (aria-disabled) para a nota ser lida. */}
            <Button
              variant="link"
              size="sm"
              aria-disabled="true"
              aria-describedby={forgotNoteId}
              onClick={(event) => event.preventDefault()}
            >
              Esqueci-me da palavra-passe
            </Button>
            <p id={forgotNoteId} className="m-0 font-body text-small font-medium text-ink-muted">
              Disponível em breve
            </p>
          </div>

          <AuthErrorAlert message={serverError} />
          <Button type="submit" variant="primary" loading={submitting} className="w-full">
            {submitting ? 'A entrar…' : 'Entrar'}
          </Button>
        </form>
      </Form>

      <div className="flex flex-col items-stretch gap-3">
        <p className="m-0 text-center font-body text-caption font-medium text-ink-muted">
          Ainda não tens conta?
        </p>
        <Button asChild variant="secondary" className="w-full">
          <Link to="/criar-conta">Criar conta</Link>
        </Button>
        <Button asChild variant="link" className="self-center">
          <Link to="/">Continuar sem conta</Link>
        </Button>
      </div>
    </PageShell>
  );
}
