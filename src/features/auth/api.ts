import { MESSAGES, isKnownDbCode, translateAuthError, translateDbError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import type { Affiliation, SignInInput, SignUpInput } from './schemas';

/** Perfil do próprio utilizador (`get_my_profile()`). Para professores e funcionários os dados académicos são null. */
export interface MyProfile {
  fullName: string;
  phone: string;
  affiliation: Affiliation;
  course: string | null;
  curricularYear: string | null;
  shift: string | null;
  classGroup: string | null;
  isAdmin: boolean;
}

interface AuthLikeError {
  message?: string;
  code?: string;
}

/** O GoTrue pode devolver a mensagem do trigger tal e qual; se for um código conhecido, traduz-se como erro da base de dados. */
function translateSignUpError(err: AuthLikeError): string {
  return isKnownDbCode(err.message) ? translateDbError(err.message) : translateAuthError(err);
}

/** Corre uma chamada ao Auth; qualquer falha (incluindo rede) vira `Error(mensagem PT-AO)`. Nada técnico sai daqui. */
async function run(
  call: () => PromiseLike<{ error: AuthLikeError | null }>,
  translate: (err: AuthLikeError) => string = translateAuthError,
): Promise<void> {
  let error: AuthLikeError | null;
  try {
    ({ error } = await call());
  } catch {
    throw new Error(MESSAGES.generic);
  }
  if (error) throw new Error(translate(error));
}

export async function signUp(input: SignUpInput): Promise<void> {
  const isStudent = input.affiliation === 'student' && input.academic !== undefined;
  const data: Record<string, unknown> = {
    full_name: input.fullName,
    phone: input.phone,
    affiliation: input.affiliation,
    terms_accepted: true,
  };
  if (isStudent && input.academic) {
    data.academic = {
      course: input.academic.course,
      curricular_year: input.academic.curricularYear,
      shift: input.academic.shift,
      class_group: input.academic.classGroup,
    };
  }
  await run(
    () => supabase.auth.signUp({ email: input.email, password: input.password, options: { data } }),
    translateSignUpError,
  );
}

export async function signIn(input: SignInInput): Promise<void> {
  await run(() =>
    supabase.auth.signInWithPassword({ email: input.email, password: input.password }),
  );
}

export async function signOut(scope: 'local' | 'global'): Promise<void> {
  await run(() => supabase.auth.signOut({ scope }));
}

/** Lança `Error` (não encontrado) se a função não devolver linha; nunca devolve null. */
export async function getMyProfile(): Promise<MyProfile> {
  let result;
  try {
    result = await supabase.rpc('get_my_profile');
  } catch {
    throw new Error(MESSAGES.generic);
  }
  if (result.error) throw new Error(translateDbError(result.error.message));
  const row = result.data?.[0];
  if (!row) throw new Error(MESSAGES.notFound);
  const academic = row as unknown as {
    course: string | null;
    curricular_year: string | null;
    shift: string | null;
    class_group: string | null;
  };
  return {
    fullName: row.full_name,
    phone: row.phone,
    affiliation: row.affiliation,
    course: academic.course,
    curricularYear: academic.curricular_year,
    shift: academic.shift,
    classGroup: academic.class_group,
    isAdmin: row.is_admin,
  };
}
