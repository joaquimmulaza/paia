# PAIÁ — Contexto do Produto para Agentes de Desenvolvimento

> **Documento de referência para Claude Code, Antigravity e Cursor**  
> **Versão:** 0.1  
> **Data:** 25 de novembro de 2026  
> **Estado:** definição do produto e preparação para o MVP  
> **Nome de trabalho:** PAIÁ

---

## 0. Instrução principal aos agentes

Lê este documento por inteiro antes de propor ou executar alterações.

Este ficheiro é a fonte de verdade inicial do produto. Distingue sempre:

1. **Decisões confirmadas:** não as alteres sem pedir autorização.
2. **Propostas/recomendações:** podes melhorá-las, mas explica o motivo.
3. **Questões em aberto:** não inventes respostas. Apresenta opções e recomenda uma.

### Forma de trabalhar

- Antes de escrever código, inspeciona o repositório, a estrutura existente, o `package.json`, as dependências, as variáveis de ambiente de exemplo, as migrações e os componentes existentes.
- Não assumas que o projeto está vazio. Não substituas uma stack ou arquitetura existente sem apresentar primeiro uma análise e pedir autorização.
- Se o repositório estiver vazio, apresenta uma proposta de arquitetura compatível com este contexto antes de criar a aplicação.
- Não inventes credenciais, IDs de projetos, URLs, dados institucionais, cursos, turmas, blocos ou salas da universidade.
- Não coloques segredos no código, no frontend, em commits ou neste ficheiro. Usa variáveis de ambiente e atualiza apenas ficheiros `.env.example` com nomes de variáveis e valores ilustrativos não secretos.
- Não executes migrações destrutivas, elimines dados, alteres produção ou publiques deployments sem autorização explícita.
- Implementa em passos pequenos e verificáveis. Inclui testes para regras de negócio e permissões.
- Mantém a interface em português de Angola (PT-AO), com moeda em kwanzas (`Kz`) e fuso horário `Africa/Luanda`.
- Não apresentes dados fictícios como dados reais da UGS. Dados de demonstração devem estar claramente identificados como exemplos.
- Se uma regra de negócio estiver indefinida e afetar o modelo de dados, pagamentos, segurança ou fluxo de pedidos, apresenta a questão antes de a fixar no código.

### Ciclo de trabalho esperado

1. **Auditoria:** descreve o estado atual do repositório e identifica o que já existe.
2. **Plano:** divide a tarefa em passos e identifica riscos/dependências.
3. **Implementação:** trabalha apenas no âmbito aprovado.
4. **Verificação:** executa testes, lint, typecheck e build disponíveis.
5. **Handoff:** resume ficheiros alterados, migrações, testes executados, limitações e próxima tarefa.
6. **Atualização do contexto:** propõe alterações a este `context.md` quando uma decisão de produto for confirmada. Não reescrevas decisões confirmadas silenciosamente.

Como o desenvolvimento será alternado entre Claude Code, Antigravity e Cursor, evita deixar trabalho parcialmente implementado sem documentar o estado. Apenas um agente deve fazer alterações de código na mesma branch de cada vez. Os outros podem analisar, rever ou propor melhorias, mas devem evitar alterações concorrentes.

---

## 1. Visão do produto

PAIÁ é um **marketplace digital multi-vendedor**, inicialmente direcionado à comunidade da Universidade Gregório Semedo (UGS), em Angola.

A plataforma centraliza produtos vendidos por estudantes — por exemplo, doces, salgados, snacks, yogurt, gelados, acessórios, roupas e outros artigos — para que os membros da comunidade possam descobrir o que está disponível sem depender de vendedores a percorrer presencialmente as salas para divulgar os seus produtos.

O problema principal a resolver é a **descoberta e o acesso aos produtos** dentro da comunidade universitária. O PAIÁ aproxima quem vende de quem compra e facilita a coordenação dos pedidos e da entrega dentro da universidade.

### Proposta de valor

- Para compradores: descobrir produtos e lojas da comunidade, consultar preços e disponibilidade e fazer pedidos de forma simples.
- Para vendedores: criar uma presença digital própria, divulgar produtos a toda a comunidade e gerir os pedidos num único lugar.
- Para a comunidade: tornar o comércio universitário mais acessível, organizado e fácil de descobrir.

### Mensagem de produto provisória

> Descobre o que a tua comunidade vende.

Esta frase é apenas uma direção inicial de copy, não um slogan final aprovado.

### Princípios do produto

1. **Comunidade primeiro:** o contexto universitário influencia a experiência, sobretudo a entrega e a descoberta.
2. **Mobile-first:** os principais utilizadores irão aceder através do telemóvel.
3. **Simples e rápido:** publicar um produto e fazer um pedido devem exigir poucos passos.
4. **Confiança:** vendedores precisam de aprovação; os utilizadores devem compreender o estado dos pedidos e quem está do outro lado.
5. **Privacidade por defeito:** dados académicos e informações de entrega não são informação pública.
6. **Multi-vendedor:** cada vendedor tem a sua própria loja dentro de uma montra comum.
7. **Evolução gradual:** começar com um MVP funcional; não construir funcionalidades complexas sem validação da necessidade.

---

## 2. Público e tipos de utilizador

### Mercado inicial

- Estudantes da UGS: podem comprar e solicitar a criação de uma loja para vender.
- Professores: podem comprar.
- Funcionários/colaboradores: podem comprar.
- Administradores da plataforma: gerem operações e moderação.

### Papéis

| Papel | Capacidades principais |
|---|---|
| Comprador | Explorar produtos e lojas, criar pedidos, acompanhar pedidos e avaliar compras concluídas. |
| Estudante vendedor | Todas as capacidades de comprador, mais gestão da sua loja, produtos e pedidos recebidos, depois de aprovado. |
| Professor/funcionário | Comprar e acompanhar os próprios pedidos. |
| Administrador | Gerir utilizadores, analisar pedidos de criação de lojas, aprovar/rejeitar/suspender vendedores, gerir categorias e moderar conteúdos/denúncias. |

**Uma conta pode comprar e vender.** Não criar contas separadas para comprador e vendedor. Um estudante começa como comprador e pode solicitar a ativação de uma loja.

No MVP, a possibilidade de vender está direcionada a estudantes. Professores e funcionários são compradores, salvo decisão futura em contrário.

---

## 3. Registo, perfis e vínculo à universidade

### Decisão confirmada: não implementar verificação institucional no MVP

Nesta primeira versão:

- Não exigir cartão de estudante, comprovativo de matrícula ou validação institucional para criar uma conta.
- Não implementar integração com sistemas internos da universidade.
- Os dados académicos são declarados pelo próprio utilizador.
- A verificação de vínculo à UGS fica para uma fase futura.

Isto **não elimina a aprovação de vendedores**. A aprovação da loja é uma regra distinta e obrigatória (ver secção 4).

### Registo comum

Campos previstos:

- Nome completo.
- E-mail.
- Número de telefone.
- Palavra-passe (gerida pelo serviço de autenticação; nunca armazenar palavras-passe em texto simples).
- Tipo de vínculo: estudante, professor ou funcionário/colaborador.

A confirmação de e-mail/telefone pode ser usada como validação de contacto, mas não deve ser apresentada como prova de vínculo à UGS.

### Dados académicos dos estudantes

Campos separados:

- Curso.
- Ano curricular (por exemplo, 1.º ano).
- Turno.
- Turma.

Estes campos devem ser solicitados no registo de estudante. A lista de opções ainda não foi fornecida; não inventar o catálogo oficial da UGS. Preparar a solução para que as opções possam ser configuradas/atualizadas sem alterar componentes de interface.

Para professores e funcionários, poderá existir um campo de departamento/serviço, mas a obrigatoriedade e o formulário final ainda estão por definir.

### Privacidade dos dados académicos

- Curso, ano, turno e turma não devem ser apresentados publicamente no perfil da loja.
- O número da sala não é um campo permanente do perfil: pode variar conforme a aula e deve ser indicado em cada pedido.
- O vendedor só deve receber os dados de localização necessários para executar o pedido que lhe foi atribuído.
- Não expor e-mail, telefone ou dados académicos publicamente por defeito.

---

## 4. Criação e aprovação de vendedores/lojas

### Decisão confirmada: a aprovação de vendedores é obrigatória

Um estudante pode criar uma conta e comprar imediatamente, mas **não pode publicar uma loja ou vender antes da aprovação de um administrador**.

Fluxo previsto:

1. O estudante seleciona «Quero vender» / «Criar a minha loja».
2. Preenche os dados da loja.
3. Submete o pedido de criação da loja.
4. A loja fica com estado `pending_approval`.
5. Um administrador analisa e aprova ou rejeita o pedido.
6. Apenas uma loja aprovada pode ficar pública e publicar produtos.

Estados mínimos da loja:

- `draft` — ainda não submetida.
- `pending_approval` — aguarda análise.
- `approved` — aprovada e autorizada a vender.
- `rejected` — candidatura rejeitada; deve guardar motivo interno ou mensagem ao candidato.
- `suspended` — loja temporariamente suspensa por decisão administrativa.

A aprovação é uma validação administrativa da candidatura à venda; **não é uma verificação institucional de matrícula**. Não exigir documentos de estudante no MVP, salvo decisão futura.

### Dados da loja

- Nome da loja.
- Identificador/slug único.
- Descrição.
- Imagem de perfil/logótipo.
- Imagem de capa (opcional).
- Categoria principal (ou categorias associadas, a definir).
- Proprietário.
- Estado de aprovação.
- Datas de criação, submissão e decisão.
- Administrador responsável pela decisão.

### Regras

- Uma conta de estudante pode ter, inicialmente, uma loja própria. Se houver necessidade de múltiplas lojas por pessoa, isso será uma decisão futura.
- O proprietário só gere a sua loja e os respetivos produtos/pedidos.
- Uma loja suspensa deixa de aceitar pedidos e deve deixar de aparecer como loja ativa.
- A administração deve poder consultar o histórico de decisões.
- Não confiar num campo `is_admin` ou `role` editável pelo cliente para atribuir permissões administrativas.

**Ponto ainda por definir:** critérios concretos usados pelo administrador para aprovar/rejeitar uma loja. Não inventar uma exigência documental. Propor uma checklist simples e submetê-la ao responsável pelo produto.

---

## 5. Produtos e catálogo

### Categorias iniciais ilustrativas

- Doces.
- Salgados.
- Snacks.
- Yogurt e bebidas.
- Gelados.
- Acessórios.
- Roupas e moda.
- Outros.

A lista final será configurável pela administração. Não restringir a estrutura de dados a estas categorias fixas.

### Campos previstos para um produto

- Nome.
- Descrição.
- Categoria.
- Uma ou várias fotografias.
- Preço em kwanzas (AOA/Kz).
- Quantidade disponível/stock.
- Estado de publicação/disponibilidade.
- Loja proprietária.

### Decisão confirmada: sem tempo de preparação

Os produtos anunciados já são produtos prontos para consumo ou utilização. Não incluir um campo obrigatório de tempo de preparação no modelo ou formulário de produto.

### Regras de catálogo

- Apenas lojas aprovadas podem publicar produtos.
- O vendedor só pode criar/editar/desativar produtos da sua loja.
- Um produto sem stock ou marcado indisponível não deve permitir novos pedidos.
- O preço deve ser guardado como valor numérico, nunca como texto formatado. A interface apresenta o valor em Kz.
- Guardar no pedido o preço unitário praticado no momento da compra, para que alterações futuras no catálogo não alterem pedidos antigos.
- Imagens devem ter validação de tipo/tamanho e armazenamento seguro.
- A administração deve conseguir ocultar/moderar um produto denunciado ou inadequado.

**Por definir:** se os produtos necessitam de aprovação individual antes de aparecerem no catálogo. Proposta inicial: aprovar a loja uma vez e permitir que o vendedor publique os seus produtos, mantendo poderes de moderação para a administração.

---

## 6. Descoberta e experiência do comprador

A página inicial deve funcionar como uma montra comum para todos os vendedores.

Áreas previstas:

- Pesquisa de produtos e lojas.
- Categorias.
- Produtos em destaque/mais recentes.
- Lojas disponíveis.
- Página de detalhe do produto.
- Página pública da loja.
- Pedidos e respetivo histórico.
- Perfil e definições.

Cada loja tem uma página própria, mas os produtos das lojas aprovadas podem ser descobertos na mesma experiência de marketplace.

### Página da loja

Pode apresentar:

- Nome, imagem e descrição da loja.
- Identificação de que é uma loja aprovada pelo PAIÁ.
- Catálogo de produtos.
- Categorias relevantes.
- Avaliações, quando existirem.

Não mostrar publicamente a turma, sala, e-mail ou outros dados pessoais do proprietário.

### Navegação mobile inicial (proposta)

- Início.
- Explorar.
- Lojas.
- Pedidos.
- Perfil.

A área de gestão da loja deve estar acessível ao vendedor autenticado, sem obrigar a ter outra conta ou aplicação.

---

## 7. Pedidos e entregas

### Regra de marketplace

Cada pedido pertence a uma loja/vendedor. Para o MVP, a abordagem mais simples é concluir um checkout por vendedor. Se o carrinho contiver produtos de várias lojas, deve ser decidido se a aplicação bloqueia a mistura ou divide o checkout em pedidos separados. Não implementar um comportamento ambíguo sem confirmar esta regra.

### Modalidades de entrega — decisão confirmada: as três disponíveis no MVP

1. **Entrega na sala:** o comprador indica o bloco/edifício e o número/nome da sala para aquele pedido.
2. **Ponto de encontro:** o comprador escreve livremente o local onde pretende encontrar o vendedor.
3. **Combinar com o vendedor:** comprador e vendedor combinam os detalhes diretamente após o pedido.

### Decisão confirmada: sem pontos de encontro pré-configurados pela administração

- Não criar um catálogo obrigatório de pontos de encontro gerido pela administração.
- O utilizador define o ponto de encontro através de texto livre.
- Não assumir que existe integração com mapas/GPS no MVP.

### Confirmação do local

O comprador indica a sua preferência. O vendedor deve poder confirmar ou propor uma alternativa antes de a entrega ser considerada combinada. O fluxo deve tornar claro para ambos qual é o local final acordado.

### Dados de entrega por pedido

Consoante a modalidade:

- Modalidade selecionada.
- Bloco/edifício (para entrega na sala).
- Sala (para entrega na sala).
- Descrição livre do ponto de encontro (para ponto de encontro).
- Horário ou período preferencial (a confirmar no desenho do fluxo).
- Observações adicionais (opcionais).
- Confirmação do vendedor ou proposta alternativa.

O endereço/sala não é guardado como endereço fixo do perfil, pois pode mudar conforme o horário e a aula do comprador.

### Ciclo de pedido proposto

Estados possíveis:

- `pending_seller` — enviado e a aguardar resposta do vendedor.
- `accepted` — aceite pelo vendedor.
- `rejected` — rejeitado pelo vendedor.
- `cancelled` — cancelado de acordo com as regras ainda a definir.
- `delivery_confirmation_pending` — aguarda confirmação/proposta de local ou modalidade.
- `ready_for_handover` — produto pronto para entrega/levantamento.
- `delivered` — vendedor indica que entregou.
- `completed` — comprador confirma receção/conclusão.

Os estados finais e a ordem exata devem ser validados durante o desenho dos fluxos. Evitar estados redundantes ou transições contraditórias.

### Regras relevantes

- O comprador acompanha apenas os seus pedidos.
- O vendedor acompanha apenas pedidos das suas lojas.
- Alterações de estado devem ficar registadas com data e autor.
- O comprador deve conseguir cancelar, mas as regras e os limites temporais ainda precisam de definição.
- O vendedor pode rejeitar um pedido, indicando motivo opcional.
- A avaliação só pode ser feita depois de um pedido concluído.
- A informação de entrega só é partilhada com o vendedor responsável pelo pedido.

### Pagamentos — ainda por confirmar

A direção inicial discutida foi não integrar pagamentos na primeira versão e deixar comprador/vendedor combinarem o pagamento diretamente. Esta decisão deve ser confirmada antes de modelar estados financeiros ou integrar gateways.

Não implementar pagamentos, comissões, carteira digital ou liquidação de valores sem requisito explícito.

---

## 8. Avaliações, confiança e moderação

Funcionalidades previstas:

- Avaliação de vendedor/loja após pedido concluído.
- Comentário opcional.
- Denúncia de produto, loja ou utilizador.
- Moderação administrativa.
- Suspensão de lojas quando necessário.

Regras propostas:

- Só compradores envolvidos num pedido concluído podem avaliar aquela compra/loja.
- Evitar avaliações duplicadas para o mesmo pedido.
- Uma denúncia não suspende automaticamente uma conta; deve gerar um registo para análise.
- A administração pode ocultar conteúdo e suspender lojas, guardando o motivo e o histórico da ação.

---

## 9. Administração

O painel administrativo deve permitir, pelo menos:

- Consultar utilizadores.
- Consultar e decidir pedidos de criação de lojas.
- Aprovar, rejeitar e suspender vendedores/lojas.
- Gerir categorias.
- Consultar/moderar produtos.
- Consultar pedidos para suporte e resolução de problemas.
- Consultar e tratar denúncias.

A criação do primeiro administrador (bootstrap) precisa de um procedimento seguro. Nunca permitir que um utilizador comum se promova a administrador através de um formulário ou alteração direta do perfil.

---

## 10. PWA e requisitos de experiência

### Decisão confirmada: a aplicação deve ser uma PWA

A experiência deve ser mobile-first e instalável no ecrã inicial, com comportamento semelhante a uma aplicação.

Requisitos pretendidos:

- Layout responsivo e otimizado para telemóvel.
- Manifesto PWA com nome, ícones, cores e modo de apresentação definidos depois da identidade visual.
- Service worker e cache dos recursos estáticos.
- Ecrã de fallback/offline para falta de ligação.
- Possibilidade de consultar de forma limitada conteúdos anteriormente carregados, quando for seguro.
- Pedidos, alterações de stock e outras operações transacionais exigem ligação à Internet.
- Não guardar dados pessoais ou respostas privadas de API em cache público.
- Notificações push são uma possibilidade futura; avaliar suporte e permissões antes de as prometer no MVP.

Não afirmar que a PWA terá funcionalidades nativas idênticas em todos os navegadores/dispositivos. Validar especialmente a experiência de instalação e notificações em Android e iOS.

---

## 11. Stack tecnológica

A stack abaixo é uma **recomendação inicial**, não uma decisão irrevogável. Primeiro auditar o repositório e confirmar se já existe uma stack.

| Camada | Preferência inicial |
|---|---|
| Frontend | React + Vite + TypeScript |
| Estilos | Tailwind CSS |
| Componentes | Sistema acessível e consistente, preferencialmente baseado em componentes reutilizáveis |
| Animações | Motion / Framer Motion, usadas com moderação |
| PWA | Vite PWA Plugin ou solução equivalente compatível com o projeto |
| Backend | Supabase |
| Base de dados | PostgreSQL (Supabase) |
| Autenticação | Supabase Auth |
| Ficheiros/imagens | Supabase Storage |
| Segurança de dados | Row Level Security (RLS), políticas testadas |
| Hosting | Vercel, caso se confirme adequado |

### Regras técnicas

- Usar TypeScript com tipos explícitos para entidades e estados críticos.
- Separar UI, lógica de domínio e acesso a dados.
- Evitar componentes monolíticos e duplicação de regras de negócio.
- Usar validação tanto no frontend como no backend.
- Utilizar migrations versionadas para a base de dados.
- Criar políticas RLS desde o início; não deixar a segurança para uma fase posterior.
- Nunca confiar em filtros do frontend como mecanismo de autorização.
- Usar transações ou funções server-side para operações sensíveis, como criação de pedidos e atualização de stock, evitando vendas acima do stock disponível.
- Guardar snapshots de nome/preço dos produtos nos itens do pedido quando necessário para preservar o histórico.
- Definir testes para acessos permitidos e negados, não apenas para o caminho feliz.

### Entidades de dados iniciais (proposta)

O esquema final deve ser revisto antes de criar migrations, mas considera estas entidades:

- `profiles` — dados pessoais e tipo de vínculo.
- `academic_options` ou tabelas equivalentes — cursos, anos, turnos e turmas configuráveis, se necessário.
- `stores` — lojas, proprietário e estado de aprovação.
- `store_review_events` — histórico de decisões administrativas, se necessário.
- `categories` — categorias de produtos.
- `products` — catálogo e stock.
- `product_images` — imagens, caso não sejam representadas por uma estrutura simples no produto.
- `orders` — comprador, loja, totais e estado.
- `order_items` — produtos, quantidades e snapshots de preço/nome.
- `order_delivery_details` — modalidade e detalhes de entrega específicos do pedido.
- `reviews` — avaliações associadas a pedidos concluídos.
- `reports` — denúncias e respetiva resolução.
- `notifications` — notificações internas, se entrarem no âmbito do MVP.
- tabela/claims segura de permissões administrativas — nunca editável pelo utilizador final.

Evitar criar tabelas para funcionalidades ainda não aprovadas. Justificar relações, índices, constraints, políticas RLS e estratégia de eliminação/arquivamento.

---

## 12. Identidade visual, branding e copy

### Estado atual: ainda não existe identidade visual aprovada

O nome de trabalho escolhido é **PAIÁ**. Ainda não foram escolhidos:

- Logótipo e símbolo.
- Paleta de cores.
- Tipografia.
- Linguagem visual.
- Design system.
- Slogan definitivo.
- Tom de voz final.

Não inventar uma identidade como se já tivesse sido aprovada. O agente de design deve explorar alternativas e apresentar uma recomendação fundamentada.

### Brief criativo

A marca deve transmitir:

- Juventude e energia universitária.
- Proximidade e comunidade.
- Confiança e facilidade de utilização.
- Comércio acessível e informal, mas organizado.
- Identidade angolana contemporânea, sem cair em clichés visuais.

Evitar:

- Aparência infantil ou excessivamente lúdica.
- Aspeto genérico de template de e-commerce.
- Excesso de cores e gradientes sem função.
- Uso automático da bandeira de Angola como solução de branding.
- Símbolos culturais ou significados linguísticos não validados.
- Estética visual que pareça uma cópia de marketplaces conhecidos.

### Trabalho pedido ao agente de branding/design

Antes de construir todas as páginas, criar **três direções visuais distintas** para PAIÁ. Para cada uma apresentar:

1. Ideia/conceito e personalidade.
2. Paleta com cores principais, secundárias, neutros, estados e respetivos códigos HEX.
3. Tipografia e hierarquia tipográfica.
4. Proposta de logótipo/símbolo e regras de utilização.
5. Estilo de fotografia/ilustração e iconografia.
6. Direção para cards, botões, campos, navegação e estados vazios.
7. Exemplos de copy para home, pesquisa, lojas, onboarding, pedidos e mensagens de estado.
8. Vantagens, riscos e adequação ao contexto universitário angolano.

No final, recomendar uma direção e explicar porquê. **Não fixar a identidade final nem propagar uma paleta por toda a aplicação sem validação do responsável pelo produto.**

### Copy e linguagem

- Usar português de Angola, claro, natural e próximo.
- Evitar português excessivamente formal ou expressões artificiais.
- Usar frases curtas e orientadas à ação.
- Preferir termos consistentes: «loja», «produto», «pedido», «vendedor», «comprador», «entrega» e «ponto de encontro».
- Usar `Kz` nos preços.
- Não afirmar que PAIÁ tem uma origem ou significado específico na língua/gíria angolana sem validação fiável.

Exemplos provisórios de microcopy (não finais):

- «O que procuras hoje?»
- «Descobre lojas da comunidade.»
- «Quero vender»
- «Criar a minha loja»
- «A tua loja está em análise.»
- «Pedido enviado ao vendedor.»
- «O vendedor confirmou o teu pedido.»
- «Combina um ponto de encontro.»
- «Ainda não tens pedidos.»

---

## 13. Âmbito do MVP

### Dentro do MVP

1. Autenticação e registo.
2. Perfis de estudante, professor e funcionário.
3. Campos académicos separados para estudantes.
4. Pedido de criação de loja.
5. Aprovação administrativa obrigatória para vendedores.
6. Gestão da loja e do catálogo.
7. Categorias e pesquisa básica.
8. Página inicial do marketplace.
9. Páginas individuais das lojas e produtos.
10. Criação e gestão de pedidos.
11. As três modalidades de entrega.
12. Painel administrativo básico.
13. Avaliações após pedidos concluídos (se o fluxo de conclusão estiver validado).
14. PWA responsiva e instalável.
15. RLS e testes de permissões desde o início.

### Fora do MVP, salvo decisão expressa

- Verificação institucional automática ou recolha obrigatória de comprovativos.
- Integração com sistemas internos da UGS.
- Pagamentos integrados, carteira ou escrow.
- Comissões automáticas e pagamentos a vendedores.
- Serviço de estafetas/logística própria.
- GPS ou tracking em tempo real.
- Chat interno completo.
- Recomendações com IA.
- Programa de fidelização, cupões ou subscrições.
- Expansão para outras universidades antes de validar a primeira comunidade.

---

## 14. Questões em aberto — não assumir silenciosamente

Estas são as decisões que ainda precisam de resposta. O agente deve agrupá-las por impacto e recomendar uma opção, em vez de bloquear todo o trabalho por detalhes secundários.

### Prioridade alta antes de implementar as regras afetadas

1. **Carrinho multi-loja:** um carrinho pode conter produtos de várias lojas? Se sim, o checkout deve criar pedidos separados por vendedor? Proposta: separar em pedidos independentes por loja.
2. **Pagamento no MVP:** confirmar se o pagamento é combinado diretamente entre comprador e vendedor, sem processamento pela plataforma. Definir se o método de pagamento é registado no pedido ou combinado fora do PAIÁ.
3. **Critérios de aprovação de lojas:** que informação analisa o administrador? Proposta: nome/descrição da loja, perfil do estudante e adequação básica, sem comprovativo institucional no MVP.
4. **Confirmação da entrega:** quem marca o pedido como entregue e quem o conclui? Proposta: vendedor marca como entregue e comprador confirma receção.
5. **Cancelamentos:** até que estado o comprador pode cancelar? O vendedor pode cancelar depois de aceitar? Que motivo deve ficar registado?
6. **Contacto entre comprador e vendedor:** o número de telefone fica oculto até o vendedor aceitar o pedido? Deve existir consentimento antes de partilhar contactos?
7. **Campos de entrega:** definir se horário preferencial é obrigatório e como funciona a contraproposta de local do vendedor.

### Prioridade média

8. Lista real de cursos, anos, turnos e turmas da UGS, quando estiver disponível.
9. Formulário de professores/funcionários e eventual campo de departamento.
10. Categorias iniciais definitivas.
11. Regras de stock: permitir quantidade ilimitada/sem controlo ou exigir stock numérico?
12. Aprovação individual de produtos ou apenas aprovação inicial da loja?
13. Nome final, slogan, logótipo, cores e tipografia após exploração de branding.
14. Política de privacidade, termos de utilização, regras de vendedores, devoluções e reclamações.

### Antes de lançamento público

15. Pesquisa de anterioridade e validação legal/comercial do nome PAIÁ, incluindo marcas e domínios.
16. Testes com vendedores e compradores reais na UGS.
17. Validação de segurança, acessibilidade, desempenho e instalação PWA em Android/iOS.
18. Definição do processo de suporte, denúncias e resposta a incidentes.

---

## 15. Plano recomendado para começar

### Etapa 0 — Auditoria e alinhamento

- Inspecionar o repositório e a stack.
- Identificar integrações existentes e estado da infraestrutura.
- Apresentar arquitetura proposta e riscos.
- Listar decisões bloqueadoras, sem começar a construir funcionalidades especulativas.

### Etapa 1 — Exploração de marca e UX

- Apresentar três direções visuais para PAIÁ.
- Propor arquitetura de informação e navegação.
- Desenhar fluxos de registo, pedido de loja, aprovação, publicação de produto, compra e entrega.
- Criar protótipos responsivos de baixa/média fidelidade.
- Validar a direção visual antes de desenvolver todas as páginas.

### Etapa 2 — Fundação técnica

- Configurar projeto e ambientes.
- Configurar Supabase e migrations.
- Implementar autenticação e perfis.
- Configurar RLS e testar acessos.
- Criar bootstrap seguro do primeiro administrador.

### Etapa 3 — Marketplace e lojas

- Aprovação de lojas.
- Categorias e produtos.
- Páginas de loja/produto.
- Pesquisa e descoberta.

### Etapa 4 — Pedidos e entregas

- Carrinho e checkout conforme regra multi-loja aprovada.
- Pedidos e transições de estado.
- Três modalidades de entrega.
- Confirmação de local e receção.

### Etapa 5 — Administração, PWA e piloto

- Moderação e denúncias.
- PWA, cache e experiência offline segura.
- Testes de permissões, fluxos e dispositivos.
- Piloto com um pequeno grupo de vendedores e compradores.
- Recolha de feedback e priorização da próxima versão.

---

## 16. Primeira tarefa para o agente que receber este documento

**Não comeces por gerar a aplicação inteira.**

Executa primeiro:

1. Audita o repositório e identifica o que já existe.
2. Compara a implementação existente com este contexto.
3. Apresenta uma arquitetura técnica recomendada, incluindo modelo de dados preliminar e estratégia RLS.
4. Identifica as decisões em aberto que bloqueiam a primeira implementação.
5. Prepara três direções de branding/design para PAIÁ, sem escolher unilateralmente a identidade final.
6. Propõe um plano de implementação incremental com entregáveis verificáveis.

A primeira resposta do agente deve ser um relatório de descoberta e plano de trabalho. Só depois de validado deve começar a alterar ficheiros ou criar migrations.

---

## 17. Registo de decisões

| Data | Decisão | Estado |
|---|---|---|
| 2026-11-25 | Modelo multi-vendedor com lojas próprias numa montra comum | Confirmado |
| 2026-11-25 | Mercado inicial direcionado à comunidade UGS | Confirmado |
| 2026-11-25 | Estudantes podem comprar e solicitar ativação como vendedores | Confirmado |
| 2026-11-25 | Professores e funcionários podem comprar | Confirmado |
| 2026-11-25 | Aprovação administrativa de vendedores/lojas é obrigatória | Confirmado |
| 2026-11-25 | Verificação institucional de vínculo à UGS fica fora do MVP | Confirmado |
| 2026-11-25 | Registo académico com curso, ano, turno e turma em campos separados | Confirmado |
| 2026-11-25 | PWA mobile-first | Confirmado |
| 2026-11-25 | Três modalidades de entrega desde o início | Confirmado |
| 2026-11-25 | Comprador define livremente o ponto de encontro | Confirmado |
| 2026-11-25 | Pontos de encontro não são pré-configurados pela administração | Confirmado |
| 2026-11-25 | Não incluir tempo de preparação no produto | Confirmado |
| 2026-11-25 | Nome de trabalho PAIÁ | Escolhido; validação de marca pendente |
| 2026-11-25 | Identidade visual, design system e copy final | Em aberto |
| 2026-11-25 | Stack técnica definitiva | Recomendada; confirmar após auditoria |
| 2026-11-25 | Apenas recursos gratuitos (planos free de Supabase, Vercel e serviços de e-mail) | Confirmado |
| 2026-11-25 | Sem CI remoto (GitHub Actions) por agora; verificação feita localmente (lint, typecheck, testes, build) | Confirmado |
| 2026-11-25 | Visitantes sem conta podem ver o catálogo (só leitura); é obrigatório entrar para fazer pedidos | Confirmado |
| 2026-11-25 | Logótipo «Orange Community Mark and PAIÁ Logo.png» aprovado para uso; paleta, tipografia e design system completos continuam em aberto | Confirmado |
| 2026-11-25 | Direção visual escolhida: **C · Cartaz** (papel #F7F4EE, azul-marinho #022147, laranja #FE5B03; Space Grotesk + DM Sans; contornos de 2 px e sombras sólidas deslocadas). Canvas de exploração: https://claude.ai/artifact/TqLa2Up1SzznTuwkPbWJCF. Design system v1 (tokens, brand book, logótipo; sem componentes ainda): https://claude.ai/artifact/UvUMapjmX7aSVuFZ8Zgk9W | Confirmado |
| 2026-11-25 | Design system **v2** aprovado e publicado no mesmo endereço: anel de foco (#1F5FBF em fundos claros, branco sobre ink, ink sobre brand; 3 px a 2 px), premido (desloca 4 px, sem sombra), hover só com rato, véu ink a 60 %, movimento 120/200 ms com prefers-reduced-motion, etiquetas 12 px, cantos 6/12/16 (+ pílula), Space Grotesk só 700. Nove componentes base com estados. Tokens prontos para servir de base à implementação. | Confirmado |
| 2026-11-25 | Design system **v2.1**: proposta «A aguardar» com contorno contínuo sem sombra (tracejado só para desativado), produto esgotado com preço em cinzento sem risco e adicionar desativado, contador da navegação em laranja com texto azul-marinho (vermelho só para erros e perigo), loja em destaque com sombra azul-marinho (laranja só na ação principal e no pedido em curso). Mantidos: botão de perigo claro com confirmação, pedido cancelado em cartão branco, campo com erro (cor + ícone + texto), rádio com ponto, fundo e negrito. Sem tokens novos. Novos componentes só quando os ecrãs os pedirem. | Confirmado |
| 2026-11-25 | Design system **v2.2**: peças dos ecrãs passam ao sistema (LinhaCarrinho com Quantidade, ModalidadeEntrega, TalaoAviso, ModoDenso com números/lista/interruptor, CarregarImagem, Tabela); Campo usa as três modalidades reais. Sem tokens novos. | Confirmado |
| 2026-11-25 | Aprovadas as recomendações pendentes: checklist de aprovação de lojas proposta em A01 (nome e descrição claros, produtos permitidos, imagens adequadas, contacto confirmado; sem documentos); horário preferencial opcional; stock sempre numérico com «Últimas N» (≤ 3); avaliações só quando existem; editar uma loja aprovada não exige nova aprovação (moderação posterior); sem aprovação individual de produtos; lista inicial de categorias da secção 5 mantida e configurável | Confirmado |
| 2026-11-25 | Email transacional: SMTP do Gmail com a conta do responsável (joaquimmulazadev@gmail.com). A palavra-passe de aplicação é criada e introduzida pelo responsável no painel do Supabase; nunca fica no repositório nem em ficheiros | Confirmado |
| 2026-11-25 | Ícone da aplicação (PWA) usa apenas o elemento gráfico do logótipo, sem a palavra PAIÁ | Confirmado |
| 2026-11-25 | Desenho técnico: docs/superpowers/specs/2026-11-25-paia-desenho-tecnico.md (revisto com as skills supabase-postgres-best-practices, data-modeling-discipline, auth-and-authorization, security-discipline e idempotency-and-side-effects; 18 correções na secção 21) | Aprovado |
| 2026-11-25 | Aprovadas as propostas do desenho técnico: pedidos sem resposta não expiram; local acordado só muda em «Aceite»; limites anti-abuso (10 checkouts/hora, 20 denúncias/dia); arquivo de registos com mais de 6 meses; avaliar Cloudflare Pages antes do lançamento público; eliminar conta a pedido pelo suporte com anonimização | Confirmado |
| 2026-11-25 | Frontend: shadcn/ui (Radix) restilizado com o visual Cartaz para a camada funcional; Tailwind v4 com @theme a partir dos tokens como única fonte de estilo; lucide-react, vaul, sonner, browser-image-compression; jsx-a11y, Testing Library e axe. O bundle.css do design system fica como referência visual | Confirmado |
| 2026-11-25 | Ecrãs: canvas «PAIÁ · Ecrãs» https://claude.ai/artifact/A7SP9jQzLiYYApzrY2Y6Sy. Lote 1 (Comprar, 13 ecrãs: C01–C13) desenhado com o design system v2.1. Opções por omissão até decisão: horário preferencial opcional; stock sempre numérico com «Últimas N» (≤ 3); avaliações só quando existem; blocos e salas como campos entre parênteses retos; dados académicos em texto livre. Lote 2 (Conta, K01–K07: entrar, criar conta com vínculo e dados académicos privados, perfil, notificações in-app, avaliar, estados vazios). Lote 3 (Vender, V01–V09: candidatura, painel e listas em modo denso, novo produto, aceitar/rejeitar com contraproposta, pronto/entregue/cancelar com motivo). Lote 4 (Administração desktop, A01–A06: candidaturas com checklist PROPOSTA a validar, lojas e suspensão, moderação de produtos, denúncias, categorias, suporte a pedidos). Lote 5 (Sistema, S01–S04: sem ligação, erro, instalar PWA com ícone por aprovar, a carregar). Os 39 ecrãs estão desenhados; a revisão do responsável está pendente. | Em revisão |
| 2026-11-25 | Turmas são uma lista independente (sem dependência de curso/ano/turno) | Confirmado |
| 2026-11-25 | Dados académicos no registo (curso, ano curricular, turno, turma) são campos de **texto livre** enquanto não houver listas oficiais da UGS: sem dropdowns nem placeholders que sugiram dados existentes. Guardar o texto tal como escrito; preparar o modelo para listas configuráveis no futuro (ex.: campo de texto + referência opcional a um item de lista, preenchida quando as listas existirem) | Confirmado |
| 2026-11-25 | Notificações internas (in-app) entram no MVP | Confirmado |
| 2026-11-25 | Acordo do local de entrega modelado à parte do estado do pedido (`agreement_status`: `buyer_proposed`, `seller_counter`, `agreed`); ciclo principal `pending_seller → accepted → ready_for_handover → delivered → completed`, com saídas `rejected` e `cancelled`; `ready_for_handover` exige local `agreed`; o estado `delivery_confirmation_pending` deixa de existir | Confirmado |
| 2026-11-25 | Pedido `delivered` sem confirmação do comprador conclui automaticamente ao fim de 2 dias | Confirmado |
| 2026-11-25 | Lei de Proteção de Dados Pessoais (Lei 22/11): análise adiada para antes do lançamento público | Adiado |
| 2026-11-25 | Carrinho pode ter produtos de várias lojas; o checkout cria um pedido independente por loja (agrupados por `checkout_group_id`) | Confirmado |
| 2026-11-25 | Pagamento combinado diretamente entre comprador e vendedor, fora do PAIÁ; o método de pagamento não é registado no pedido | Confirmado |
| 2026-11-25 | Cancelamento pelo comprador: permitido em qualquer estado antes de `delivered` (`pending_seller`, `accepted`, `ready_for_handover`), porque a entrega é dentro da universidade e o vendedor não tem custos com o pedido. Cancelamento pelo vendedor: só depois de aceitar e apenas quando o comprador não aparece ou desiste no momento da entrega, com motivo obrigatório. Antes de aceitar, o vendedor rejeita (`rejected`, motivo opcional). Em todos os casos o stock é reposto | Confirmado |
| 2026-11-25 | Contactos (telefone) partilhados entre comprador e vendedor apenas depois de o vendedor aceitar, e apenas no âmbito desse pedido | Confirmado |
| 2026-11-25 | Stock descontado na criação do pedido (na mesma transação) e reposto quando o pedido é rejeitado ou cancelado | Confirmado |

### Infraestrutura criada (2026-11-25)

- Supabase: projeto `paia`, ref `pkubomgkptdwlewgocqm`, região `sa-east-1` (São Paulo), organização em plano Free. Foi a região com menor latência medida a partir de Luanda; o Supabase não tem região em África. A palavra-passe da base de dados não foi guardada: o responsável deve defini-la em Dashboard → Project Settings → Database antes de `supabase link`.
- Vercel: projeto `paia` (plano Hobby), sem repositório ligado e sem deployments.
- Limites do plano Free a ter em conta: 500 MB de base de dados, 1 GB de Storage, pausa automática após 7 dias sem atividade, 2 projetos ativos por organização (o limite está agora atingido).

---

**Fim do contexto inicial do PAIÁ.**
