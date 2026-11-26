import { z } from 'zod';
import { normalizePhone } from '@/lib/phone';

const MSG = {
  email: 'Indica um email válido.',
  password: 'Pelo menos 8 caracteres.',
  passwordRequired: 'Indica a tua palavra-passe.',
  name: 'Escreve o teu nome completo.',
  tooLong: 'Demasiado longo.',
  phone: 'Indica um número angolano com 9 algarismos, a começar por 9.',
  terms: 'Tens de aceitar os Termos e a Política de privacidade.',
  affiliation: 'Escolhe o teu vínculo à UGS.',
  course: 'Indica o teu curso.',
  curricularYear: 'Indica o teu ano curricular.',
  shift: 'Indica o teu turno.',
  classGroup: 'Indica a tua turma.',
} as const;

const AFFILIATIONS = ['student', 'teacher', 'staff'] as const;
export type Affiliation = (typeof AFFILIATIONS)[number];

const email = z.string().trim().toLowerCase().email(MSG.email);

const academicText = (required: string, max: number) =>
  z.string().trim().min(1, required).max(max, MSG.tooLong);

const academicSchema = z.object({
  course: academicText(MSG.course, 80),
  curricularYear: academicText(MSG.curricularYear, 20),
  shift: academicText(MSG.shift, 20),
  classGroup: academicText(MSG.classGroup, 20),
});

export type Academic = z.infer<typeof academicSchema>;

/** Campos em bruto (antes de validar). Os dados académicos são validados só para estudantes. */
const signUpBase = z.object({
  fullName: z.string().trim().min(2, MSG.name).max(120, MSG.tooLong),
  email,
  phone: z.string().trim(),
  password: z.string().min(8, MSG.password),
  affiliation: z.enum(AFFILIATIONS, { errorMap: () => ({ message: MSG.affiliation }) }),
  academic: z.unknown().optional(),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: MSG.terms }) }),
});

export const signUpSchema = signUpBase
  .superRefine((value, ctx) => {
    if (normalizePhone(value.phone) === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['phone'], message: MSG.phone });
    }
    if (value.affiliation !== 'student') return;
    const raw = (
      typeof value.academic === 'object' && value.academic !== null ? value.academic : {}
    ) as Record<string, unknown>;
    const parsed = academicSchema.safeParse({
      course: raw.course ?? '',
      curricularYear: raw.curricularYear ?? '',
      shift: raw.shift ?? '',
      classGroup: raw.classGroup ?? '',
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ ...issue, path: ['academic', ...issue.path] });
      }
    }
  })
  .transform((value) => {
    const { academic, phone, ...rest } = value;
    const out = { ...rest, phone: normalizePhone(phone) as string };
    if (value.affiliation !== 'student') return out;
    return { ...out, academic: academicSchema.parse(academic) };
  });

/** Resultado validado de `signUpSchema.parse`. Só estudantes têm `academic`. */
export type SignUpInput = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  affiliation: Affiliation;
  academic?: Academic;
  termsAccepted: true;
};

/** Valores do formulário (react-hook-form): `academic` está sempre presente, com strings. */
export type SignUpFormValues = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  affiliation: Affiliation;
  academic: Academic;
  termsAccepted: boolean;
};

export const signInSchema = z.object({
  email,
  password: z.string().min(1, MSG.passwordRequired),
});

export type SignInInput = z.infer<typeof signInSchema>;
