// Ecrã K02 · Criar conta.
import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useRef, useState } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn, focusRing } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/use-document-title';
import { signUp } from './api';
import { AuthErrorAlert, errorMessage } from './AuthErrorAlert';
import { AFFILIATION_LABEL } from './labels';
import { signUpSchema, type Affiliation, type SignUpFormValues, type SignUpInput } from './schemas';

const AFFILIATION_OPTIONS: ReadonlyArray<{ value: Affiliation; label: string }> = (
  ['student', 'teacher', 'staff'] as const
).map((value) => ({ value, label: AFFILIATION_LABEL[value] }));

const ACADEMIC_FIELDS = {
  course: { label: 'Curso', maxLength: 80 },
  curricularYear: { label: 'Ano curricular', maxLength: 20 },
  shift: { label: 'Turno', maxLength: 20 },
  classGroup: { label: 'Turma', maxLength: 20 },
} as const;

type AcademicKey = keyof typeof ACADEMIC_FIELDS;

export function SignUpPage() {
  useDocumentTitle('Criar conta');
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const sending = useRef(false);
  const affiliationLabelId = useId();
  const academicHeadingId = useId();
  const academicHelpId = useId();
  const academicNoteId = useId();

  const form = useForm<SignUpFormValues, unknown, SignUpInput>({
    // O schema aceita `academic` como unknown (só é validado para estudantes); o formulário tem-no sempre.
    resolver: zodResolver(signUpSchema) as Resolver<SignUpFormValues, unknown, SignUpInput>,
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      affiliation: 'student',
      academic: { course: '', curricularYear: '', shift: '', classGroup: '' },
      termsAccepted: false,
    },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: true,
  });

  const affiliation = useWatch({ control: form.control, name: 'affiliation' });

  const onSubmit = form.handleSubmit(async (values) => {
    if (sending.current) return;
    sending.current = true;
    setServerError(null);
    try {
      await signUp(values);
      navigate('/perfil', { replace: true });
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      sending.current = false;
    }
  });

  const submitting = form.formState.isSubmitting;

  const academicField = (key: AcademicKey) => (
    <FormField
      control={form.control}
      name={`academic.${key}`}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{ACADEMIC_FIELDS[key].label}</FormLabel>
          <FormControl>
            <Input
              type="text"
              autoComplete="off"
              maxLength={ACADEMIC_FIELDS[key].maxLength}
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <PageShell header={<AppHeader back="/entrar" title="Criar conta" />} className="gap-5">
      <p className="m-0 font-body text-body-lg">
        Uma só conta para comprar e, se fores estudante, para pedires a tua loja.
      </p>

      <Form {...form}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome completo</FormLabel>
                <FormControl>
                  <Input autoComplete="name" maxLength={120} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="9XX XXX XXX"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Só é partilhado com o vendedor depois de ele aceitar um pedido teu.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Palavra-passe</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                {/* O erro repete a ajuda; com erro, mostra-se só uma vez. */}
                {!fieldState.error && <FormDescription>Pelo menos 8 caracteres.</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="affiliation"
            render={({ field }) => (
              <FormItem>
                <span
                  id={affiliationLabelId}
                  className="mb-1.5 font-display text-label font-bold text-ink uppercase"
                >
                  Na UGS, és
                </span>
                <FormControl>
                  <RadioGroup
                    aria-labelledby={affiliationLabelId}
                    value={field.value}
                    onValueChange={(value) => field.onChange(value as Affiliation)}
                    name={field.name}
                  >
                    {AFFILIATION_OPTIONS.map((option) => (
                      <RadioGroupItem key={option.value} value={option.value}>
                        {option.label}
                      </RadioGroupItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {affiliation === 'student' && (
            <section
              role="group"
              aria-labelledby={academicHeadingId}
              aria-describedby={`${academicHelpId} ${academicNoteId}`}
              className="flex flex-col gap-3.5 rounded-lg border-2 border-ink bg-surface p-4"
            >
              <h2
                id={academicHeadingId}
                className="m-0 font-display text-label font-bold text-ink uppercase"
              >
                Dados académicos
              </h2>
              <p id={academicHelpId} className="m-0 font-body text-caption font-medium text-ink">
                Escreve como aparece no teu horário ou na tua inscrição.
              </p>
              {academicField('course')}
              <div className="grid grid-cols-2 gap-3">
                {academicField('curricularYear')}
                {academicField('shift')}
              </div>
              {academicField('classGroup')}
              <p
                id={academicNoteId}
                className="m-0 font-body text-small font-medium text-ink-muted"
              >
                Não aparecem no teu perfil nem na tua loja. Não pedimos comprovativo de matrícula.
              </p>
            </section>
          )}

          <FormField
            control={form.control}
            name="termsAccepted"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-start gap-2.5">
                  <FormControl>
                    <Checkbox
                      ref={field.ref}
                      name={field.name}
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                      onBlur={field.onBlur}
                      className="mt-px"
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer font-body text-caption font-medium text-ink normal-case select-auto">
                    Aceito os Termos de utilização e a Política de privacidade.
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <AuthErrorAlert message={serverError} />
          <Button type="submit" variant="primary" loading={submitting} className="w-full">
            {submitting ? 'A criar a conta…' : 'Criar conta'}
          </Button>
        </form>
      </Form>

      <p className="m-0 text-center font-body text-caption font-medium text-ink-muted">
        Já tens conta?{' '}
        <Link
          to="/entrar"
          className={cn(
            'rounded-sm font-bold text-brand-text underline underline-offset-3',
            focusRing,
          )}
        >
          Entrar
        </Link>
      </p>
    </PageShell>
  );
}
