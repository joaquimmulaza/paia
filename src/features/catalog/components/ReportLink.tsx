// Design system: Botão link (p-btn--link), em ink-muted, para as denúncias.
import { comingSoon } from '@/components/paia/ComingSoon';
import { Button } from '@/components/ui/button';

/** As denúncias chegam em F4; até lá, o aviso «Disponível em breve». */
export function ReportLink({ kind }: { kind: 'produto' | 'loja' }) {
  return (
    <Button variant="link" size="sm" className="self-start text-ink-muted" onClick={comingSoon}>
      {kind === 'produto' ? 'Denunciar produto' : 'Denunciar loja'}
    </Button>
  );
}
