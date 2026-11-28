// Ecrãs V01 · Quero vender e V01b · Quero vender: conta sem acesso.
// Quem já tem loja não fica aqui: segue para o ecrã do estado da sua loja.
import { Link, Navigate } from 'react-router-dom';
import { AppHeader } from '@/components/paia/AppHeader';
import { PageShell } from '@/components/paia/PageShell';
import { Button } from '@/components/ui/button';
import { LoadError } from '@/features/catalog/components/LoadError';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn } from '@/lib/utils';
import {
  BackLink,
  cardClass,
  HOME_BY_KIND,
  kickerClass,
  SellerSkeleton,
  useMyProfile,
} from './components/seller-ui';
import { useMyStore } from './queries';

const h1Class = 'm-0 font-display text-display-xl font-bold text-ink uppercase';
const markClass = 'rounded-sm bg-brand px-1.5 text-ink [box-decoration-break:clone]';
const listClass = 'm-0 flex flex-col gap-1.5 pl-5 font-body text-body';

const STEPS = [
  ['Pede a tua loja', 'Nome, descrição, categoria e imagem. Leva poucos minutos.'],
  ['A equipa analisa', 'Sem documentos nem comprovativos. Avisamos-te quando houver resposta.'],
  ['Publica e vende', 'Depois de aprovada, publicas produtos e recebes pedidos.'],
] as const;

export function SellPage() {
  useDocumentTitle('Quero vender');
  const profile = useMyProfile();
  const store = useMyStore();

  const header = <AppHeader start={<BackLink to="/perfil" label="Voltar ao perfil" />} />;

  if (store.isError || profile.isError) {
    const failed = store.isError ? store : profile;
    return (
      <PageShell header={header}>
        <LoadError
          error={failed.error}
          retrying={failed.isFetching}
          onRetry={() => void failed.refetch()}
        />
      </PageShell>
    );
  }
  if (store.isPending || profile.isPending) {
    return (
      <PageShell header={header}>
        <SellerSkeleton />
      </PageShell>
    );
  }
  if (store.data) return <Navigate to={HOME_BY_KIND[store.data.kind]} replace />;

  if (profile.data.affiliation !== 'student') {
    return (
      <PageShell header={header} className="gap-5.5">
        <h1 className={h1Class}>
          Lojas só para <mark className={markClass}>estudantes</mark>
        </h1>
        <p className="m-0 font-body text-body-lg">
          No PAIÁ, só os estudantes da UGS podem abrir uma loja. A tua conta está registada como
          docente ou funcionário.
        </p>
        <section aria-labelledby="sem-acesso-pd" className={cn(cardClass, 'gap-2')}>
          <h2 id="sem-acesso-pd" className={kickerClass}>
            O que podes fazer
          </h2>
          <ul className={listClass}>
            <li>Comprar em todas as lojas da comunidade.</li>
            <li>Avaliar as compras e ajudar os vendedores a crescer.</li>
          </ul>
        </section>
        <div className="flex flex-col gap-3.5">
          <Button asChild variant="primary" className="w-full">
            <Link to="/lojas">Ver lojas</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full">
            <Link to="/perfil">Voltar ao perfil</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell header={header} className="gap-5.5">
      <h1 className={h1Class}>
        Vende à tua <mark className={markClass}>comunidade</mark>
      </h1>
      <p className="m-0 font-body text-body-lg">
        Abre a tua loja no PAIÁ e vende aos colegas, professores e funcionários da UGS, com entregas
        dentro da universidade.
      </p>
      <ol className="m-0 flex list-none flex-col gap-4 p-0">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-full border-2 border-ink bg-brand font-display text-[17px] leading-none font-bold text-ink"
            >
              {i + 1}
            </span>
            <div>
              <p className="m-0 font-body text-body font-bold">{title}</p>
              <p className="m-0 font-body text-caption font-medium text-ink-muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <section aria-labelledby="vender-regras" className={cn(cardClass, 'gap-2')}>
        <h2 id="vender-regras" className={kickerClass}>
          Antes de começares
        </h2>
        <ul className={listClass}>
          <li>Só estudantes podem ter loja, uma por conta.</li>
          <li>Vendes produtos já prontos a consumir ou a usar.</li>
          <li>O pagamento é combinado diretamente com cada comprador.</li>
        </ul>
      </section>
      <Button asChild variant="accent" className="w-full">
        <Link to="/vender/pedido">Pedir a minha loja</Link>
      </Button>
    </PageShell>
  );
}
