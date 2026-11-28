# F2 · Vender: desenho

> Data: 2026-11-28. Estado: **à espera da aprovação do responsável**.
> Fontes: `context.md` §4, §5 e §9; desenho técnico (`2026-11-25-paia-desenho-tecnico.md`) §6, §8, §9, §11 e §19; `docs/ESTADO.md` (pontos adiados do F2).
> Ecrãs: canvas https://claude.ai/artifact/A7SP9jQzLiYYApzrY2Y6Sy, página «Lote 3 · Vender» (V01–V06 e as variantes V01b, V02b, V02c, V03b, V04b, V05b e V06b), «Lote 2 · Conta» (K03c) e «Lote 4 · Administração» (A01 e A01b).

## 1. Intenção

Um estudante da UGS pede uma loja. A administração aprova ou recusa. Depois de aprovada, o estudante publica os seus produtos com fotos, preço e stock, e eles aparecem no catálogo público do F1.

Hoje o catálogo online está vazio, porque o remoto não tem o seed. **O F2 é o que permite pôr produtos reais no PAIÁ** e começar o piloto com vendedores.

**Sucesso:**
- uma estudante cria a loja pelo telemóvel em poucos minutos;
- o admin decide em A01;
- a loja publica o primeiro produto com fotos;
- o produto aparece em C01–C05 sem intervenção técnica.

## 2. Objetivos, fora de âmbito e anti-objetivos

**Objetivos**
- Candidatura (V01, V02, V03, V03b), com rascunho, envio, recusa com mensagem e reenvio.
- Decisão do admin (A01, A01b), com a lista de verificação e o histórico em `store_decisions`.
- Painel da loja (V04b), edição da loja (V02c), estados no perfil (K03c).
- Produtos: criar, editar, publicar ou ocultar, stock, apagar (V05, V05b, V06, V06b).
- Fotos: até 5 por produto, logótipo e capa da loja, com compressão no telemóvel (WebP, ≤1600 px, sem EXIF) e políticas de Storage.

**Fora de âmbito (vêm noutras fases)**
- Pedidos, carrinho, notificações e o sino: F3.
- Suspensão de lojas, moderação de produtos, denúncias e categorias: F4.
- O V04 completo (pedidos e avaliações) fica para o F3 e o F4. O F2 mostra o V04b.

**Anti-objetivos**
- Pedir documentos de estudante.
- Aprovar produto a produto.
- Deixar o cliente mudar o `status` da loja ou as colunas de moderação.
- Imagens com dados pessoais escondidos (EXIF ou GPS).
- Qualquer custo além dos planos gratuitos.

## 3. Regras de produto

As regras marcadas «(proposta)» são escolhas minhas. O responsável pode trocá-las ao aprovar este documento.

1. **Só estudantes têm loja, uma por conta** (context §4). Docentes e funcionários não veem «A minha loja». Quem abre `/vender` diretamente vê o V01b.
2. **O endereço da loja é criado a partir do nome** (decisão do responsável, 2026-11-28). O vendedor não o escreve.
   - Conversão: minúsculas, sem acentos (`unaccent`). Cada sequência de caracteres que não seja letra ou número vira um `-`. Os hífenes das pontas saem. No máximo 40 caracteres, cortados sem deixar hífen no fim.
   - Se o endereço já existir, acrescenta `-2`, `-3`, … ao endereço-base (que é cortado para caber nos 40).
   - Se o resultado tiver menos de 3 caracteres, por exemplo um nome feito só de símbolos, o endereço fica `loja-` mais 4 letras ao acaso.
   - O endereço é recalculado quando o nome muda, enquanto a loja estiver em `draft`, `pending_approval` ou `rejected`. **Depois de aprovada, fica fixo** (proposta), para não quebrar as ligações partilhadas.
   - É gerado no servidor, dentro da mesma transação que guarda a loja. O formulário mostra uma pré-visualização calculada pelo mesmo algoritmo no cliente, mas a verdade é a do servidor.
3. **Rascunho** (`draft`): «Guardar rascunho» guarda sem validar os campos obrigatórios. «Enviar para análise» valida tudo e passa a loja a `pending_approval`.
4. **Durante a análise, o pedido só se lê** (V03b; proposta). Não há «retirar pedido».
5. **Recusa:** a mensagem é obrigatória. A loja passa a `rejected`. O vendedor corrige e volta a enviar, sem limite de tentativas.
6. **A resposta aparece em Perfil e no V03** (K03c). As notificações na aplicação chegam no F3. Nessa altura, `admin_decide_store` passa também a escrever a notificação (`store_approved` ou `store_rejected`).
7. **Editar uma loja aprovada não volta a análise** (desenho técnico §6). Os campos editáveis são nome, descrição, categoria, logótipo e capa.
8. **Lista de verificação da aprovação** (A01; proposta a confirmar, context §4). São 4 itens:
   - o nome e a descrição dizem o que a loja vende;
   - a categoria e os produtos são permitidos;
   - as imagens são adequadas e não mostram dados pessoais;
   - a conta é de estudante e o email está confirmado.

   A lista é guardada em `store_decisions.checklist`. Não bloqueia a decisão.
9. **Campos obrigatórios para enviar:**
   - nome: 3 a 40 caracteres, normalizado como no F1;
   - descrição: 10 a 500 caracteres;
   - categoria;
   - logótipo.

   A capa é opcional.
10. **Produtos:**
    - nome: 3 a 80 caracteres;
    - descrição: opcional, até 1000 caracteres;
    - categoria;
    - preço: inteiro, de 1 a 10 000 000 Kz;
    - stock: inteiro, 0 ou mais;
    - fotos: 1 a 5 para publicar. A posição 0 é a principal.

    Só uma loja `approved` cria ou edita produtos. «Publicar na loja» corresponde a `is_published`. Com stock 0, o produto aparece como esgotado.
11. **Apagar um produto** apaga as fotos (ficheiros e linhas). No F2 é sempre possível. No F3, um produto que já teve pedidos só se pode ocultar (proposta).
12. **Fotos:** JPG, PNG ou WebP de origem, até 2 MB depois da compressão, validados também no bucket. SVG não é aceite.

## 4. Abordagens consideradas

| | A. Tudo por RPC | B. Misto: loja por RPC, produtos por RLS **(recomendada)** | C. Tudo por escrita direta com RLS e triggers |
|---|---|---|---|
| Loja | `save_my_store`, `submit_store` | `save_my_store`, `submit_store` | insert/update direto; um trigger gera o endereço |
| Produtos | `save_product`, `delete_product` | insert/update/delete direto, com RLS e triggers de invariantes | igual a B |
| Prós | Um só caminho, fácil de testar com pgTAP | Segue o desenho técnico (§9), que já define as RLS de escrita de produtos; menos código; o endereço e o estado ficam fechados no servidor | Menos funções |
| Contras | Contraria a matriz de RLS do desenho técnico; muito código repetido | Dois estilos | Gerar o endereço com colisões num trigger é frágil (corrida → erro 23505 sem nova tentativa); o estado da loja ficava exposto a updates |

**Escolha: B.** A loja tem regras que só o servidor deve decidir: o endereço, as transições de estado e o perfil de estudante. Por isso, a loja passa por RPCs `SECURITY DEFINER`, com bloqueio da linha e a mesma disciplina do F1 (advisory lock, erros com código).

Os produtos são CRUD simples de dono. A RLS já desenhada chega, e triggers impõem as invariantes:
- só lojas aprovadas;
- as colunas `moderation_*` não se mudam;
- o contador `published_products_count` é recalculado (já existe no F1).

## 5. Desenho técnico resumido

**Migração** `20261128000000_f2_vender.sql`, que só acrescenta:
- **Tabela `store_decisions`:** colunas de §6 do desenho técnico, só de acrescentar.
- **Funções:**
  - `store_slug_base(name)`, `IMMUTABLE`, sobre `unaccent`;
  - `next_free_store_slug(base, store_id)`.
- **RPCs:**
  - `save_my_store(name, description, category_id, logo_path, cover_path)` cria ou atualiza a loja do próprio, com `owner_id = auth.uid()`. Exige `affiliation = 'student'`. Recalcula o endereço fora de `approved`.
  - `submit_store()` valida os campos e faz `draft|rejected → pending_approval`, com `submitted_at`.
  - `get_my_store()` devolve todas as colunas da loja do próprio.
  - `admin_decide_store(store_id, decision, message, checklist)` é guardada por estado: só a partir de `pending_approval`. Uma decisão repetida ou concorrente devolve `ALREADY_DECIDED` com o estado atual, o que dá o aviso de A01b.
  - `admin_list_store_applications(status, cursor)` pagina por cursor.
- **RLS:**
  - `stores`: SELECT do dono sobre a própria loja, decidido de forma explícita, como pede o ponto adiado do F1. O SELECT público continua só para `approved`.
  - `products` e `product_images`: INSERT, UPDATE e DELETE do dono quando a loja está `approved`. O dono lê os próprios produtos ocultos.
  - `store_decisions`: o dono lê só `decision`, `message` e `created_at`. O `admin_id` não é exposto ao vendedor.
- **Storage:** buckets `store-media` e `product-media` (§11 do desenho técnico).
  - Escrita só no caminho cujo `store_id` é do `auth.uid()`.
  - Tipos MIME e o limite de 2 MB definidos no bucket.
  - O admin pode apagar.
- **pgTAP** cobre:
  - cada transição permitida e cada transição recusada;
  - não-estudante recusado;
  - endereço com acentos, espaços, colisões (`-2`, `-3`), nome só de símbolos, e endereço fixo depois de aprovada;
  - RLS de cada papel;
  - políticas de Storage;
  - repetição de `admin_decide_store`.

**Cliente**
- `src/features/seller/`: candidatura, painel, produtos e fotos.
- `src/features/admin/`: A01 dentro do AdminShell do F1, com Candidaturas e Destaques no menu.
- `browser-image-compression` para as fotos.
- **Ordem com as imagens:** o caminho do Storage precisa do `store_id`. Por isso, ao escolher a primeira imagem, o cliente chama `save_my_store` com o que já estiver escrito. Isso cria o rascunho sem aviso e só depois envia o ficheiro. O mesmo vale para as fotos de um produto novo: o produto é criado oculto, as fotos são enviadas e o produto é publicado no fim.
- Limpar a cache de mutações quando o utilizador muda (ponto adiado do F1).
- Rotas: `/vender`, `/vender/loja`, `/vender/produtos`, `/vender/produtos/novo`, `/vender/produtos/:id` e `/admin/candidaturas`.

**Testes**
- Vitest: a função de endereço no cliente, com os mesmos casos do pgTAP; os formulários.
- Ponta a ponta com axe: candidatura → aprovação → produto publicado visível em C03.
- `npm run verify` duas vezes no fim.

## 6. O que fica para quem constrói

Fica para o plano e para os implementadores:
- os nomes exatos dos ficheiros e componentes;
- a ordem das tarefas;
- a forma de mostrar o progresso do envio das fotos;
- o texto dos erros que o canvas não fixa, no mesmo tom de V02b e V06b.

## 7. Decisões que o responsável confirma ao aprovar

1. O endereço fica fixo depois de a loja ser aprovada.
2. Durante a análise, o pedido só se lê.
3. A lista de verificação com 4 itens (regra 8).
4. Apagar produtos no F2; no F3, só ocultar os que já tiveram pedidos.
5. Os limites dos campos (regras 9 e 10).
