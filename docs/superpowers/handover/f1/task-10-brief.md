### Task 10: Estrutura da administração e ecrã Destaques (A07)

**Ficheiros:**
- Criar:
  - `src/features/admin/api.ts`, `AdminShell.tsx`, `RequireAdmin.tsx` e `FeaturesPage.tsx`;
  - os testes `tests/features/admin/RequireAdmin.test.tsx` e `FeaturesPage.test.tsx`.
- Modificar: `src/app/router.tsx` (`/admin` e `/admin/destaques`) e `src/features/auth/ProfilePage.tsx` (ligação «Administração», que só aparece quando `is_admin`).

**Interfaces:**
- Consome:
  - as funções de gestão da tarefa 3;
  - `getMyProfile()` (`is_admin`) de F0;
  - `listStores` da tarefa 4;
  - os componentes de `ui/`;
  - os quadros A07 aprovados na tarefa 5.
- Produz:
  - **Funções de `api.ts`**, que lançam `Error` com a mensagem PT-AO de `translateDbError`:
    - `listFeatures(): Promise<AdminFeature[]>`;
    - `saveFeature(v: { id?: string; storeId: string; position: number; startsAt: string | null; endsAt: string | null; note: string | null }): Promise<string>`;
    - `setFeatureActive(id: string, active: boolean)`;
    - `removeFeature(id: string)`;
    - `reorderFeatures(ids: string[])`.
  - **Tipo:** `AdminFeature = { id; storeId; storeName; storeSlug; storeStatus; source: 'admin' | 'paid'; position; startsAt: string | null; endsAt: string | null; isActive; note: string | null; isLive: boolean }`.
  - **Chaves de cache:** as consultas usam `['me', 'admin', …]`, para serem removidas ao mudar de utilizador.
  - **`<RequireAdmin>`:**
    - sem sessão, redireciona para `/entrar?voltar=…`;
    - com sessão sem `is_admin`, mostra «Não tens permissão para fazer isto.» e uma ligação para `/`.
    - É só para a experiência; a segurança está nas funções.
  - **`<AdminShell>`:**
    - a barra lateral `a-side` dos ecrãs A01–A06, com `nav aria-label="Administração"` e `aria-current="page"`;
    - nesta fase só tem o item «Destaques». Os outros itens entram com as suas fases.
  - **Rotas:** `/admin` redireciona para `/admin/destaques`.
  - **Datas:** são mostradas com `formatDateTime`. No formulário usam `input type="datetime-local"` interpretado em `Africa/Luanda`, e são enviadas em ISO com fuso.

- [ ] **Passo 1: testes que falham** (com a API simulada).
  - **`RequireAdmin`:**
    - sem sessão, redireciona para `/entrar?voltar=%2Fadmin%2Fdestaques`;
    - um utilizador comum vê «Não tens permissão para fazer isto.»;
    - um administrador vê a página.
  - **`FeaturesPage`, lista:**
    - mostra a lista com o estado de cada destaque («No ar», «Agendado», «Expirado», «Desligado»), calculado a partir de `isLive`, `isActive` e do período;
    - a coluna «Origem» diz «Administração».
  - **`FeaturesPage`, adicionar:**
    - abre o formulário;
    - a pesquisa de lojas usa `listStores({ q })`;
    - ao guardar, chama `saveFeature` e mostra «Destaque guardado.»;
    - com um fim antes do início, mostra «A data de fim tem de ser depois da data de início.» junto ao campo, antes de chamar a API;
    - o erro `FEATURE_EXISTS` da API aparece num `role="alert"`.
  - **`FeaturesPage`, ordem e estado:**
    - «Subir» no segundo destaque chama `reorderFeatures` com a nova ordem, e o foco fica no mesmo botão do item movido;
    - o interruptor «Ativo» (`role="switch"`, `aria-checked`) chama `setFeatureActive`.
  - **`FeaturesPage`, remover:** pede confirmação num `AlertDialog` («Remover destaque de <loja>?»), e só depois chama `removeFeature`.
  - **Perfil:** em K03, a ligação «Administração» só aparece com `is_admin`.
- [ ] **Passo 2:** `npm test -- admin`. Esperado: FAIL.
- [ ] **Passo 3:** instalar o `alert-dialog` e o `switch` do shadcn, restilizados como na tarefa 4 de F0. Construir os ecrãs com a copy aprovada na tarefa 5. `document.title`: «Destaques · Administração · PAIÁ».
- [ ] **Passo 4:** `npm test && npm run lint && npm run typecheck`. Esperado: PASS.
- [ ] **Passo 5:** fazer commit: `feat(admin): estrutura da administração e gestão de destaques`.

---

