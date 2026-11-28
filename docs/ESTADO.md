# PAIÁ: estado do trabalho

> **Este ficheiro é a memória comum entre agentes** (Cursor, Antigravity, Claude Code). Cada agente atualiza-o **no fim de cada tarefa, no mesmo commit da tarefa**, como descreve o [`AGENTS.md`](../AGENTS.md). Não reescrevas linhas antigas: se uma decisão mudar, acrescenta uma linha nova que a substitui.
>
> **Última atualização:** 2026-11-28, com o F2 · Vender em `main` e online em https://paia-ugs.vercel.app (Supabase remoto com F0, F1 e F2).

## Agora

- **Fase atual:** F2 · Vender, **em revisão** no branch `f2-vender`: as 8 tarefas estão feitas (ver abaixo). Falta a revisão final do branch (`code-review` nível `high` e `security-review`), uma vaga de correções e a decisão do responsável sobre o merge. Desenho aprovado (`docs/superpowers/specs/2026-11-28-f2-vender-design.md`) e plano escrito. O âmbito está no spec, secção 19: candidatura, decisão do admin, painel, produtos e envio de imagens (ecrãs V01–V06, A01, C06).
- **Tarefa seguinte:** revisão final do branch `f2-vender` contra `main`, uma vaga de correções e `npm run verify`. Depois, e só com autorização explícita do responsável, o merge em `main` e a aplicação da migração `20261128000000_f2_vender.sql` no Supabase remoto (**o remoto ainda não a recebeu**; está em F0+F1). O plano está em `docs/superpowers/plans/2026-11-28-f2-vender.md`.
- **Trabalho a meio:** nenhum.
- **Branches:**
  - `main` tem F0 e F1;
  - `f2-vender` tem o F2 completo, em revisão, sem push nem merge;
  - `f0-fundacao` e `f1-catalogo` estão já juntos em `main` e não se escreve mais neles.

## Online (produção)

- **Site:** https://paia-ugs.vercel.app (Vercel, projeto `paia`, equipa `joaquim-mulazas-projects`), escolhido pelo responsável em 2026-11-28. `paia.vercel.app` pertence a um projeto de outra conta; o endereço automático `paia-dun.vercel.app` continua a funcionar.
- **Deploy:** o repositório `joaquimmulaza/paia` está ligado à Vercel por Git (2026-11-28). Cada push para `main` faz deploy de produção; os outros branches fazem deploys de pré-visualização.
- **Variáveis na Vercel:** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (a chave pública anon), em production e preview. Nenhuma chave secreta.
- **`vercel.json`:** Vite, `npm run build`, `dist`, e rewrite de todas as rotas para `index.html` (SPA).
- **Supabase remoto `paia` (`pkubomgkptdwlewgocqm`):** F0 e F1 aplicados em 2026-11-27, **sem o seed** (só as 8 categorias da migração). O catálogo online está vazio até F2.
  - O histórico remoto de migrações está alinhado com os ficheiros (`20261125000000_f0_base`, `20261126000000_f1_catalogo`), por isso `supabase db push` só aplica migrações novas.
  - Na aplicação houve uma correção de transporte (`f1_fix_unicode`): repôs os caracteres Unicode de `normalize_text` e `normalize_multiline`. O código das 23 funções, as políticas, os grants por coluna, as colunas e as categorias são iguais ao local (comparado por md5). Única diferença: o remoto dá também EXECUTE ao `service_role` nas funções `public` (predefinição do Supabase).
  - Avisos de segurança do Supabase: só os esperados (tabelas fechadas sem políticas, `admin_users` e `store_features`; funções SECURITY DEFINER que verificam `is_admin` ou só devolvem colunas públicas).
  - Administradores: 1 (a conta do responsável, desde 2026-11-28).
- **Confirmação de email:** ligada no remoto (o local não a tem). Decisão do responsável (2026-11-28): SMTP do Gmail (smtp.gmail.com:587, palavra-passe de aplicação, cerca de 500 emails por dia) em vez do SMTP do Supabase (2 por hora). A palavra-passe é posta pelo responsável no painel e nunca vai para ficheiros. Mais tarde, com domínio próprio: Resend ou Brevo autenticado.
- **Painel do Supabase (2026-11-28):** SMTP do Gmail do PAIÁ ligado pelo responsável; Site URL e Redirect URLs em `https://paia-ugs.vercel.app`. Testado: o email de recuperação chegou e a ligação abre o `paia-ugs`.

## Fases

| Fase                 | Estado         | Plano                                                       |
| -------------------- | -------------- | ----------------------------------------------------------- |
| F0 · Fundação        | Feita, em main | `docs/superpowers/plans/2026-11-25-f0-fundacao.md`          |
| F1 · Catálogo        | Feita, em main | `docs/superpowers/plans/2026-11-26-f1-catalogo.md`          |
| F2 · Vender          | Feita, em main e online | `docs/superpowers/plans/2026-11-28-f2-vender.md`            |
| F3 · Pedidos         | Por planear    | —                                                           |
| F4 · Confiança       | Por planear    | —                                                           |
| F5 · PWA e piloto    | Por planear    | —                                                           |

## Tarefas feitas

### F0 · Fundação (`49bb46a..b48c556`)

| Tarefa                                              | Commits                     |
| --------------------------------------------------- | --------------------------- |
| 1. Repositório, esqueleto e qualidade               | `d6ce3b9`, `da141e2`        |
| 2. Tokens do Cartaz e tema Tailwind                 | `97bd185`, `3b4ab46`        |
| 3. Formatação, telefone e erros                     | `6d2ee68`                   |
| 4. Componentes shadcn/ui com o visual Cartaz        | `ab7a556`, `1295cb1`        |
| 5. Supabase local, migração base e RLS testada      | `3e81d26`, `3101a0a`, `a85ee70` |
| 6. Cliente Supabase, schemas e autenticação         | `19b0550`, `19a3063`        |
| 7. Ecrãs Entrar (K01), Criar conta (K02), Perfil (K03) | `d622957`, `c1d9b51`     |
| 8. Verificação completa, ponta a ponta e axe        | `acf2be0`                   |
| Revisão final e correções                           | `b48c556`                   |

### F1 · Catálogo (`c1de97a..f7c4cf4`)

Os hashes são os de `main`; o branch `f1-catalogo` tem os mesmos commits com outros hashes.

| Tarefa                                                         | Commits                |
| -------------------------------------------------------------- | ---------------------- |
| 1. Esquema do catálogo, RLS e leitura pública                  | `617b0af`, `9463004`   |
| 2. Pesquisa, páginas de detalhe, Storage e dados ilustrativos  | `7e11631`              |
| 3. Destaques de lojas geridos pela administração               | `d6b89df`, `c27ea3e`   |
| 4. Camada de dados do catálogo                                 | `148bf22`              |
| 5. Desenhos novos no Claude Design (A07, C01b, X01)            | sem commit; aprovados pelo responsável em 2026-11-27 |
| 6. Componentes do catálogo                                     | `f553880`, `33737fc`   |
| 7. Ecrãs Início (C01) e Lojas (C05)                            | `b212ef3`              |
| 8. Explorar (C02) e Sem resultados (K07)                       | `05a2ce9`, `fc076a3`   |
| 9. Produto (C03) e Loja (C04)                                  | `d599df1`, `05bb16b`   |
| 10. Administração e ecrã Destaques (A07)                       | `475ef29`, `d27106e`   |
| 11. Ponta a ponta, acessibilidade e verificação                | `ce49132`, `5d20a5b`   |
| Revisão final e correções                                      | `a349ced`, `134b9c5`, `1dd55b4` |
| Estados, avisos e ligação «Administração» desenhados (A07b, A07c, K03b) e alinhados | `f7c4cf4` |

Última verificação completa: `npm run verify` com os 10 passos a passar: 476 testes Vitest, 344 pgTAP e 13 ponta a ponta, com axe sem violações.

### F2 · Vender (branch `f2-vender`, em revisão)

| Tarefa                                                          | Commits                          |
| --------------------------------------------------------------- | -------------------------------- |
| 1. Loja do vendedor no servidor (endereço, rascunho, envio)     | `270fa03`, `eb42477`             |
| 2. Decisão das candidaturas pela administração                  | `384c006`, `52bba0a`             |
| 3. Produtos, fotos e Storage do vendedor                        | `b980216`, `68dba36`, `800cc00`  |
| 4. Camada de dados do vendedor                                  | `1de78b1`                        |
| 5. Candidatura de loja (V01–V03, K03c)                          | `10dfe3e`, `593934c`             |
| 6. Painel da loja e gestão de produtos (V04b–V06b)              | `a3f97d2`, `a01865d`, `3ea4771`  |
| 7. Candidaturas na administração (A01)                          | `b302cad`, `a700601`, `a46b584`  |
| 8. Ponta a ponta, seed, acessibilidade, README e verificação    | `ca04441`                        |
| Revisão final (code-review high + security-review) e correções  | `ecfb45c`, `89bf9ec`             |

Rotas novas: `/vender`, `/vender/pedido`, `/vender/estado`, `/vender/pedido/ver`, `/vender/loja`, `/vender/loja/editar`, `/vender/produtos`, `/vender/produtos/novo`, `/vender/produtos/:id` e `/admin/candidaturas`. Migração nova: `supabase/migrations/20261128000000_f2_vender.sql`. O `seed.sql` ganhou uma estudante sem loja (`sara@exemplo.test`) e o logótipo (um caminho, sem ficheiro) da loja pendente.

Pontos do F1 que o F2 resolveu:

- a política SELECT do dono em `stores` foi decidida explicitamente (o dono vê a sua loja e os seus produtos; o catálogo público não lhe mostra os ocultos por engano);
- a cache é limpa quando o utilizador muda (`queryClient.clear()`);
- o carregamento de fotos está feito: políticas de escrita no Storage por caminho da loja e compressão no cliente com `browser-image-compression`.

Última verificação completa (em `89bf9ec`): `npm run verify` com os 10 passos a passar, duas vezes seguidas: 694 testes Vitest, 569 pgTAP e 14 ponta a ponta, com axe sem violações. A revisão final do branch deu «pronto para merge» depois das correções.

Testes estabilizados: os `findBy`/`waitFor` do Testing Library esperam até 10 s (`configure({ asyncUtilTimeout: 10_000 })` em `tests/setup.ts`) em vez de 1 s, porque a suite inteira em paralelo ultrapassava o segundo em `FeaturesPage`, `routes` («terminar sessão») e `session-cache`. O limite de cada teste ponta a ponta passou de 30 s para 60 s, e o axe espera que os avisos (sonner) saiam do ecrã.

## Decisões

Estas são as decisões tomadas durante a execução que não estavam nos planos e que continuam a valer. As decisões de produto do responsável estão no `context.md` §17.

### Gerais

- Ruling: `.gitattributes` com `* text=auto eol=lf` — mantém o Prettier estável no Windows.
- Ruling: as portas locais do Supabase são 553xx, não as predefinidas 543xx — outro projeto local usa as predefinidas.
- Ruling: o `supabase/config.jsonc` (formato da CLI 3.4) substitui o `config.toml`.
- Ruling: `edge_runtime` está desligado localmente — a imagem estava corrompida; volta a ligar com a primeira Edge Function.
- Ruling: zod 4 em vez do zod 3 do plano — o zod 3 tinha um aviso de segurança alto sem correção.
- Ruling: o que não estiver desenhado (ecrã, estado, aviso ou texto) é desenhado primeiro no Claude Design, no canvas dos ecrãs, e só depois implementado — regra do responsável; os estados do A07 que tinham ido para o código sem desenho foram desenhados depois (A07b, A07c, K03b) e o código alinhado.
- Ruling: `.claude/` fica fora do ESLint e do Prettier — as worktrees que a app cria lá dentro partiam o `npm run verify`.
- Ruling: o React fica no 18.3; os componentes shadcn podem ser escritos à mão quando a CLI os não oferece para React 18.
- Ruling: os testes e2e correm com `workers: 1` e repõem exatamente o estado do seed no fim — a instabilidade do e2e custaria cada `verify` seguinte.
- Ruling: o `Button` tem `type="button"` por omissão — os formulários têm de passar `type="submit"`.

### Base de dados

- Ruling: o trigger `private.prevent_privileged_columns` impede mudar `id`, `affiliation`, `terms_accepted_at` e `created_at` em `profiles` — segunda barreira, pedida pelo spec §9.
- Ruling: `cascade` em `profiles → auth.users` e `academic_info → profiles`; `restrict` em `admin_users.user_id` e `created_by` — a eliminação de conta é feita pelo suporte (spec §20.7).
- Ruling: FK composta `(user_id, affiliation)` para que só estudantes tenham `academic_info`.
- Ruling: `revoke execute` global por omissão, `auto_expose_new_tables = false` e grants explícitos, incluindo para o `service_role`.
- Ruling: o texto é normalizado por trigger (espaços e caracteres invisíveis); as descrições mantêm as quebras de linha, com a normalização feita linha a linha.
- Ruling: as políticas RLS do catálogo estão inline e encadeadas por colunas com grant, sem funções auxiliares definer — o schema `private` fica fechado.
- Ruling: uma categoria escondida esconde só o mosaico e o filtro; os produtos continuam visíveis, com a categoria a `null` — a UI aceita categoria `null`.
- Ruling: `INVALID_CURSOR` tem uma mensagem PT-AO; um 22P02 (id que não é UUID) nas RPC do catálogo é tratado como `NOT_FOUND` dentro de `run()` do catálogo, não no `translateDbError` partilhado.
- Ruling: criar um destaque para uma loja cujo destaque ativo já terminou desliga o terminado na mesma transação e insere o novo; um destaque no ar ou agendado continua a dar `FEATURE_EXISTS`.
- Ruling: o formulário de A07 não envia posição; a base põe o destaque novo no fim. Guardar, ligar e ordenar usam o mesmo trinco consultivo (`hashtext('public.store_features:admin_position')`).
- Ruling: reordenar envia o conjunto completo dos destaques ativos da administração; em `NOT_FOUND`, a UI volta a ler a lista e mostra «A lista mudou. Atualizámos a ordem; tenta outra vez.».

### Interface

- Ruling: o `formatKz` usa U+00A0 como separador de milhares e as datas usam `dateStyle: 'short'` (ano com 2 dígitos) — falta a decisão do responsável (ver abaixo).
- Ruling: o logótipo PNG original está copiado para `public/logo.png` — um recorte transparente e otimizado fica para o F5.
- Ruling: o cartão «A minha loja» do perfil só aparece a estudantes (`context.md` §4).
- Ruling: as imagens dos cartões têm `alt=""` (o título ao lado dá-lhes nome); a página do produto mantém um `alt` descritivo.
- Ruling: os botões de quantidade têm 44 px de altura — a regra dos alvos de toque prevalece sobre os 40 px do ecrã.
- Ruling: C03 (produto) nunca mostra a navegação inferior; o «Voltar» do cabeçalho chega.
- Ruling: um `?categoria=` desconhecido em C04 é tratado como «Tudo».
- Ruling: depois de «Procurar em tudo», o foco vai para o texto do número de resultados.
- Ruling: A07 tem um quinto estado, «Loja não aprovada», para um destaque ativo e no período de uma loja que deixou de estar aprovada; as linhas inativas mostram «— Sem ordem» sem setas — falta a confirmação do responsável.
- Ruling: A07 recalcula o estado a cada 60 s com `useNow` (`src/lib/use-now.ts`).
- Ruling: o contador da nota (280 caracteres) normaliza como a base, mas é mais estrito se houver espaços Unicode raros.
- Ruling: o cliente faz `removeQueries(['me'])` quando o utilizador muda, e as chaves da administração incluem o id do utilizador.

### F2 · Vender

- Ruling: `submit_my_store()` sem parâmetro (o desenho técnico tinha `submit_store(store_id)`) — uma loja por conta torna o id redundante — custo: renomear uma RPC.
- Ruling: sem notificações no F2; `admin_decide_store` passa a escrevê-las no F3 — custo: acrescentar o insert no F3.
- Ruling: o endereço da loja só é recalculado quando a base do nome muda; a ordem dos bloqueios é sempre advisory lock → linha da loja — custo: deadlock se uma função futura a inverter.
- Ruling: a categoria de uma loja ou de um produto tem de estar visível, exceto a que já tem — custo: uma regra a mais.
- Ruling: `store_decisions` só aceita SELECT e INSERT, também para `service_role` (só acrescenta) — custo: nenhum.
- Ruling: `admin_decide_store` recebe `p_expected_submitted_at` (protege contra ecrãs desatualizados), recusa a própria loja e guarda o UPDATE pelo estado; o A01 envia o envio que o admin analisou, não o da última leitura — custo: nenhum.
- Ruling: os triggers de fotos, caminhos e categorias ignoram `postgres`, `supabase_admin` e `service_role` (o seed e os testes do F1 inserem produtos publicados sem fotos); `authenticated` é sempre verificado. Uma função SECURITY DEFINER futura que escreva produtos tem de voltar a verificar estas regras (há um comentário na migração) — custo: SQL feito como `postgres` pode criar produtos publicados sem foto.
- Ruling: as funções públicas do catálogo (`search_products`, `get_product`, `get_store`) filtram com `is_listed_product`, para o dono não ver os seus produtos ocultos no catálogo — custo: uma pesquisa por linha (aceitável à escala do campus).
- Ruling: `media_select_owner` e `media_delete_owner` usam `can_delete_media` (só o dono da loja, em draft, rejected ou approved); apagar um produto apaga também os ficheiros das fotos — custo: uma loja suspensa não limpa ficheiros até ao F4.
- Ruling: `listMyProducts`, `getMyProduct` e `countMyProducts` filtram por `store_id`; 0 linhas afetadas em `updateProduct`/`deleteProduct` dá `notAllowed` — custo: mensagem genérica.
- Ruling: a loja suspensa mostra só «A tua loja está suspensa. Fala com a equipa do PAIÁ.» — o F4 desenha o resto — custo: texto a rever no F4.
- Ruling: as fotos de um produto novo esperam no telemóvel até haver nome, preço e stock válidos e sobem ao guardar — custo: sair sem guardar perde-as.
- Ruling: o A01 mostra até 50 candidaturas por separador, sem «Carregar mais», e o histórico tem só a submissão atual — custo: paginação e uma tabela de eventos se o piloto crescer.
- Ruling: `asyncUtilTimeout` de 10 s no Testing Library e 60 s por teste no Playwright, para a suite não falhar sob carga — custo: uma falha real demora mais a aparecer.
- Ruling: a compressão de imagens corre sem web worker (`useWebWorker: false`), para não descarregar código de um CDN externo — custo: a compressão bloqueia um pouco a interface em fotos grandes.

## Pontos adiados

### Resolvidos no F2 (as linhas da secção «Para o F2» abaixo são as antigas)

- Política SELECT do dono em `stores`: decidida explicitamente no F2.
- Cache limpa quando o utilizador muda: feito.
- Carregamento de fotos (Storage + compressão): feito.

### Para o F2 (Vender)

- Uma nova política SELECT em `stores` para o dono ou o admin alarga a visibilidade dos produtos, através da política inline. É preciso decidi-lo explicitamente.
- A cache de mutações não é limpa quando o utilizador muda (necessário quando houver mutações do utilizador).
- O carregamento de fotografias (políticas de escrita do Storage, `browser-image-compression`) tem de estar pronto antes do lançamento público.
- A ligação entre `kind` e `*_option_id` nos dados académicos não é imposta; não há histórico de quem deu o papel de administrador.

### Do F2, para mais tarde

- Verificar à mão no Safari/iOS: o canvas do Safari pode não gerar WebP; só depois disso o bucket pode passar a aceitar só `image/webp`.
- Ficheiros órfãos no Storage (Trocar/Remover imagem, envios interrompidos, uploads sem limite por produto): rever à mão no piloto e criar uma limpeza.
- Menores registados na revisão final e sem urgência: regex do caminho de `product_images` mais solta do que a do Storage; `updated_at` dos produtos legível por `authenticated`; corrida rara entre juntar uma foto e reordenar (erro genérico); foco de «Tentar outra vez» no envio de imagens; navegação inferior no V05 que o canvas não tem; texto de categoria vazia por confirmar; testes em falta (duplo clique, edição de loja recusada, TOKEN_REFRESHED).

### Para o F3 (Pedidos)

- A quantidade em C03 não está limitada ao stock (fazer junto com o carrinho).
- O carrinho, o contador, a folha C06 e o sino das notificações ainda dizem «Disponível em breve».

### Antes do piloto ou do lançamento público

- Confirmação de email no registo e CAPTCHA (hoje a enumeração de emails no registo é aceite em desenvolvimento).
- Carregamento por rota (o bundle tem mais de 700 kB) e um índice de trigramas para a pesquisa, quando o catálogo crescer.
- Logótipo recortado e transparente; ícones da PWA.
- Análise da Lei 22/11 e textos legais (Termos, Política de privacidade).

### Menores, sem fase marcada

- `search_key` é uma RPC pública e é `IMMUTABLE` sobre `unaccent`. Se um dia houver um índice sobre ela, é preciso registar esse risco.
- Corrida no foco depois de um `NOT_FOUND` ao reordenar em A07. O interruptor volta a ter foco depois de uma falha.
- No e2e, uma RPC de reordenação que falha aparece primeiro como um timeout de 20 s.
- A verificação de diferenças nos tokens e nos tipos compara a árvore de trabalho com o índice; a pré-verificação aceita `VAR=""`.

## Decisões pendentes do responsável

### Pendente do responsável (F2)

- **Datas «Hoje/Ontem» ou absolutas:** o V03 e o A01 do canvas mostram «Hoje/Ontem»; o código mostra datas absolutas (`formatDateTime`), como no F1. Decidir junto com o formato de datas abaixo.
- **Ordem dos separadores no A01:** o A01 e o A01b do canvas têm ordens diferentes. Está implementado «Por analisar / Recusadas / Aprovadas», como no A01b. Confirmar.
- **Checklist de aprovação:** a lista de 4 itens do A01 é uma proposta do desenho, só informativa (não impede aprovar). Confirmar os itens e se deve ser obrigatória.
- **Textos novos do F2:** a folha «X02 · Textos novos do F2» no canvas (página Lote 3) lista todos os microtextos que a implementação acrescentou. Rever e mudar no canvas o que quiseres.
- **Supabase remoto:** a migração `20261128000000_f2_vender.sql` foi aplicada no remoto em 2026-11-28, com autorização do responsável (versão alinhada no histórico; as 45 funções, as políticas e os grants por coluna são iguais ao local, comparados por md5). O seed nunca vai para o remoto.

### Anteriores

- O separador de milhares do Kz (U+00A0 ou U+202F) e o ano com 2 ou 4 dígitos nas datas.
- O estado «Loja não aprovada» e «— Sem ordem» em A07, e os microtextos novos de A07 (por exemplo «Escolhe uma loja da lista.», «A nota pode ter até 280 caracteres.», «Indica uma data e hora válidas.»).
- O email real do responsável que está no `context.md`.
- A revisão dos 39 ecrãs no canvas (estado «Em revisão» no `context.md`).

## Registo detalhado (só Claude Code)

O Claude Code guarda também um ledger por plano em `.superpowers/sdd/<data>-<fase>/progress.md`, com as revisões e os briefs. O git ignora-o e ele só existe no computador onde o trabalho foi feito. Este ficheiro resume o que importa desse ledger; não precisas dele para continuar.
