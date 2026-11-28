# F3 · Pedidos: desenho

> Data: 2026-11-28. Estado: **aprovado pelo responsável em 2026-11-28**, com as respostas à revisão do desenho incluídas.
> Fontes: `context.md` §7 e §17; desenho técnico (`2026-11-25-paia-desenho-tecnico.md`) §5–§9, §12, §13 e §19; `docs/ESTADO.md` (pontos adiados do F2 e do F3); desenho do F2 (`2026-11-28-f2-vender-design.md`).
> Ecrãs: canvas https://claude.ai/artifact/A7SP9jQzLiYYApzrY2Y6Sy, «Lote 1 · Comprar» (C06–C13), «Lote 2 · Conta» (K04, K06), «Lote 3 · Vender» (V04, V07–V09) e «Lote 5 · Sistema» (S02). As peças em falta (secção 6) são desenhadas no canvas antes de serem construídas.

## 1. Intenção

Com o F2, o PAIÁ tem lojas e produtos reais, mas ninguém consegue comprar. **O F3 fecha o ciclo:** o comprador junta produtos de uma ou mais lojas, diz onde e quando os quer receber, e cada vendedor aceita, combina o local, entrega e o pedido conclui. O pagamento continua fora do PAIÁ (context §17).

**Sucesso:**
- um estudante faz um pedido pelo telemóvel em menos de um minuto, a partir do carrinho;
- o vendedor sabe que tem um pedido novo sem recarregar a página (sino e contador);
- comprador e vendedor sabem sempre qual é o local combinado e o passo seguinte;
- nenhum pedido fica com stock errado, duplicado ou sem histórico;
- quem pediu a recuperação da palavra-passe consegue escolher uma nova.

## 2. Objetivos, fora de âmbito e anti-objetivos

**Objetivos**
- Carrinho no servidor, com várias lojas (C07) e a folha «Entrar para comprar» para visitantes (C06).
- Checkout com uma entrega por loja e um pedido por loja (C08), confirmação (C09) e erro de stock (S02).
- Ciclo completo do pedido (desenho técnico §7): aceitar, rejeitar, cancelar (comprador e vendedor), pronto, entregue, confirmar receção e conclusão automática ao fim de 2 dias.
- Acordo de local: proposta do comprador, confirmação ou contraproposta do vendedor, resposta do comprador e histórico.
- Contactos (telefone) da outra parte só nos estados `accepted`, `ready_for_handover` e `delivered`.
- Pedidos do comprador (C10, C11–C13, K06) e do vendedor (V04 completo nos pedidos, V07–V09).
- Notificações na aplicação (K04), com o sino e o contador por Realtime, incluindo as de `admin_decide_store` (ruling do F2).
- Recuperação da palavra-passe: o ecrã para escolher a nova palavra-passe depois do email (pedido do responsável, 2026-11-28).

**Fora de âmbito**
- Avaliações (K05), «Tive um problema», denúncias, moderação e suspensão de lojas: F4. No F3, «Avaliar esta compra» e «Tive um problema» mostram «Disponível em breve».
- Notificações push, email sobre pedidos, pagamentos, comissões: fora do MVP.
- A06 (suporte a pedidos na administração): F4.

**Anti-objetivos**
- Stock negativo, pedidos duplicados por duplo toque ou dois checkouts que se bloqueiam.
- O vendedor ver o telefone do comprador antes de aceitar, ou alguém ver pedidos que não são seus.
- Estados mudados pelo cliente sem passar pelas funções do servidor.
- Mostrar uma ação que não funciona sem o aviso «Disponível em breve».
- Qualquer custo fora dos planos gratuitos.

## 3. Regras de produto

As regras marcadas «(proposta)» são escolhas minhas; o responsável pode trocá-las ao aprovar.

1. **Carrinho multi-loja** (confirmado): um pedido por loja, juntos num `checkout_group`. O total por loja e o total geral aparecem no C07 e no C08.
2. **Só se compra a lojas aprovadas e produtos visíveis** (publicados, não ocultos, loja `approved`).
   - O checkout é do carrinho inteiro, tudo ou nada (proposta): não há checkout de só algumas lojas.
   - Um produto que deixou de estar à venda, ou com menos stock do que a quantidade, aparece marcado no C07, com «Remover» ou «Ficar com N». Enquanto houver uma linha assim, «Continuar para a entrega» fica desativado, com o motivo (desenho novo, secção 6).
   - **Preço mudado** (decisão do responsável, 2026-11-28): o C08 envia o total por loja que mostrou. Se o preço de um produto tiver mudado, o servidor recusa o checkout inteiro com `PRICE_CHANGED` (com o produto) e nada é criado. O comprador vê «O preço de [produto] mudou. Revê o total e envia outra vez.» e o carrinho mostra o preço novo.
   - Se mudar entre o C08 e o envio, o servidor recusa o checkout inteiro (`OUT_OF_STOCK` ou `PRODUCT_UNAVAILABLE`, com o produto), nada é criado e o S02 leva de volta ao carrinho.
3. **Não se compra à própria loja** (proposta): o botão «Adicionar» não aparece nos produtos da própria loja e o servidor recusa com `OWN_STORE`.
4. **Quantidade:** de 1 até ao stock atual (resolve o ponto adiado do F1 em C03). O servidor volta a validar no checkout.
5. **Modalidades de entrega** (confirmado): sala (bloco e sala obrigatórios), ponto de encontro (texto livre obrigatório), combinar com o vendedor (sem local). Observações opcionais, até 280 caracteres (proposta). Bloco e sala até 40 caracteres, ponto de encontro até 120 (proposta).
6. **«Quando?»** (decisão de 2026-11-28, opção «só hoje»):
   - guarda-se uma hora real, `preferred_at timestamptz`, ou `null` para «O mais cedo possível»;
   - o seletor oferece «O mais cedo possível», as próximas meias-horas de hoje (a primeira com pelo menos 30 minutos de folga; até 6 opções, sem passar da meia-noite) e «Escolher outra hora» (um campo de hora, hoje, mais tarde do que agora);
   - o servidor aceita `preferred_at` entre agora e o fim do dia de hoje em `Africa/Luanda`; fora disso dá `INVALID_TIME`;
   - mostra-se «Hoje, 12:00», «Ontem, 12:00» ou a data curta, sempre em `Africa/Luanda`;
   - as propostas de local (comprador ou vendedor) usam o mesmo campo e as mesmas regras;
   - **hora já passada** (proposta): os pedidos não expiram, por isso uma hora pedida pode ficar no passado. Nesse caso não se pode confirmar a proposta tal como está. O V08/V09 e o C11 mostram «A hora pedida já passou» e só oferecem «Propor outro». O servidor recusa a confirmação com `INVALID_TIME`.
7. **Ciclo do pedido** (confirmado, desenho técnico §7): `pending_seller → accepted → ready_for_handover → delivered → completed`, com as saídas `rejected` (vendedor, antes de aceitar, motivo opcional) e `cancelled` (comprador até antes de `delivered`; vendedor só depois de aceitar, com motivo obrigatório `buyer_no_show` ou `buyer_gave_up`). Rejeitar e cancelar repõem o stock.
8. **Acordo de local** (confirmado):
   - ao aceitar, o vendedor confirma o local (`agreed`) ou propõe outro (`seller_counter`); com «Combinar com o vendedor» tem de propor;
   - depois de aceitar, uma proposta do comprador (`buyer_proposed`) é confirmada pelo vendedor com `confirm_location` (desenho técnico §7: «ao aceitar ou depois»), ou o vendedor contrapõe com `propose_location`;
   - em `pending_seller`, o comprador pode mudar a sua proposta (proposta minha);
   - o comprador aceita a contraproposta (`agreed`) ou propõe outro (`buyer_proposed`), e assim sucessivamente;
   - `mark_ready` exige `agreed`;
   - mudar o local já combinado só em `accepted` (confirmado) e reabre a negociação; em `ready_for_handover` ou depois, o local fica fixo;
   - uma proposta igual à última não cria nada de novo.
9. **Pedido sem resposta não expira** (confirmado). O V04 e o V07 destacam os pedidos novos com mais de 2 horas.
10. **Conclusão automática** (confirmado): `delivered` há mais de 2 dias passa a `completed` com `completed_by = 'auto'`, por um job `pg_cron` de hora a hora; notifica os dois.
11. **Contactos** (confirmado): o nome e o telefone da outra parte só pela função `get_order_contacts`, só nos estados `accepted`, `ready_for_handover` e `delivered`. Antes de aceitar, o vendedor vê só o primeiro nome e a inicial (`buyer_display_name`), os produtos e os dados de entrega.
12. **Limite anti-abuso** (confirmado): 10 checkouts por hora por comprador; o 11.º dá `RATE_LIMITED`.
13. **Produtos com pedidos não se apagam** (confirmado no F2): só se ocultam. O V06b mostra a razão quando o servidor recusa com `PRODUCT_HAS_ORDERS` (texto novo, secção 6).
14. **Notificações** (confirmado): criadas na mesma transação da ação, uma por destinatário. Tipos da secção 12 do desenho técnico, mais `store_approved` e `store_rejected` vindas de `admin_decide_store`. Tocar numa notificação marca-a como lida e abre o pedido ou a loja. «Marcar como lidas» marca todas.
15. **Código do pedido:** 6 caracteres de um alfabeto sem ambiguidade (sem `0`, `O`, `1`, `I`, `L`), único; os ecrãs mostram `#` mais os 6 (o canvas mostra 4 por espaço).
16. **Recuperação da palavra-passe** (o responsável acrescentou `https://paia-ugs.vercel.app/recuperar` às Redirect URLs do Supabase remoto em 2026-11-28; em local testa-se com o Mailpit): «Esqueci-me da palavra-passe» (K01) pede o email e envia a ligação; a ligação abre `/recuperar` (rota nova), onde se escolhe a nova palavra-passe (mínimo de 8 caracteres, como no K02). A resposta é sempre a mesma, exista ou não a conta, para não revelar emails.

## 4. Abordagens consideradas

| | A. Funções do servidor com uma transição central **(escolhida)** | B. Escrita direta com RLS e triggers | C. Como A, mas conclusão «preguiçosa» na leitura |
|---|---|---|---|
| Ciclo | RPC `SECURITY DEFINER` finas à volta de `private.transition_order` | updates diretos em `orders`; triggers validam as transições | igual a A |
| Conclusão automática | `pg_cron` de hora a hora | igual a A | cada leitura conclui os pedidos vencidos |
| Prós | segue o desenho técnico §7–§8 já aprovado; bloqueio, evento, stock e notificação numa só transação; idempotência por estado | menos funções | não depende do `pg_cron` |
| Contras | mais SQL para testar | regras espalhadas por triggers; difícil de garantir stock e notificações juntos; o cliente vê demasiadas colunas | escritas dentro de leituras; o vendedor não recebe a notificação na hora certa |

**Escolha: A** (o responsável deixou a forma de construir ao agente, 2026-11-28). O `pg_cron` existe no plano gratuito e na stack local. Se o projeto remoto estiver em pausa, a conclusão atrasa e é feita quando volta (desenho técnico §17).

## 5. Desenho técnico resumido

**Migração** `20261129000000_f3_pedidos.sql`, que só acrescenta (o nome final segue a data do dia em que for escrita):

- **Tabelas** do desenho técnico §6: `cart_items`, `checkout_groups`, `orders`, `order_items`, `order_delivery_details`, `delivery_proposals`, `order_events`, `notifications`, com os CHECK das invariantes de §6. Diferença: `preferred_time text` passa a `preferred_at timestamptz` (em `order_delivery_details` e `time_at` em `delivery_proposals`).
- **Chaves estrangeiras:** `order_items.product_id` com `on delete restrict` (regra 13); `orders.store_id` e `orders.buyer_id` com `restrict`; `cart_items` com `cascade` para o produto e o perfil.
- **Esquema `private`:** `transition_order(order_id, to_status, actor_role, data)` com `select … for update`, a tabela de transições, o evento, as notificações e a reposição de stock; `restock(order_id)`; `notify(...)`; `new_order_code()`; o limite de checkouts.
- **RPC públicas** (desenho técnico §8): `add_to_cart`, `set_cart_quantity`, `remove_from_cart`, `get_my_cart`; `create_checkout(request_id, deliveries jsonb)`; `accept_order`, `reject_order`, `cancel_order_as_buyer`, `cancel_order_as_seller`, `propose_location`, `agree_location` (comprador), `confirm_location` (vendedor), `mark_ready`, `mark_delivered`, `confirm_received`; `get_order_contacts`; `list_my_orders(filter, cursor)`, `get_my_order(code)`, `list_store_orders(filter, cursor)`, `get_store_order(code)`, `count_store_orders()` (para o V04); `list_my_notifications(cursor)`, `count_unread_notifications()`, `mark_notifications_read(ids)` (com `ids` nulo para todas); `private.auto_complete_delivered_orders()` agendada pelo `pg_cron`.
- **`admin_decide_store`:** passa a inserir a notificação `store_approved` ou `store_rejected` (função recriada com `create or replace`, o resto igual).
- **RLS:** ligada em todas as tabelas novas. Leitura direta só em `notifications` (o próprio, para o Realtime) e `cart_items` (o próprio); tudo o resto por RPC. Grants por coluna explícitos; `anon` sem nada.
- **Realtime:** `notifications` entra na publicação `supabase_realtime`.
- **Erros novos** (código estável → texto PT-AO em `src/lib/errors.ts`): `OUT_OF_STOCK`, `PRODUCT_UNAVAILABLE`, `OWN_STORE`, `CART_EMPTY`, `INVALID_DELIVERY`, `INVALID_TIME`, `INVALID_TRANSITION`, `LOCATION_NOT_AGREED`, `LOCATION_LOCKED`, `REASON_REQUIRED`, `RATE_LIMITED`, `PRODUCT_HAS_ORDERS`, `PRICE_CHANGED`.
- **pgTAP** cobre: cada transição permitida e recusada; idempotência (mesmo `request_id`, transição repetida, proposta repetida); stock no checkout, na rejeição e no cancelamento; dois checkouts concorrentes do último item (um ganha, o outro `OUT_OF_STOCK`); `NOT_FOUND` para pedidos alheios; contactos por estado; RLS e grants de cada papel; notificações criadas em cada ação; a conclusão automática; o limite de checkouts; apagar um produto com pedidos.

**Cliente**
- `src/features/cart/` (C06–C09, S02), `src/features/orders/` (C10–C13, K06), `src/features/seller/` ganha os pedidos (V04, V07–V09), `src/features/notifications/` (K04, sino e contador), `src/features/auth/` ganha a recuperação.
- O `checkout` gera o `request_id` (`crypto.randomUUID()`) quando o C08 abre e reutiliza-o em cada tentativa, para o duplo toque e as repetições não criarem pedidos.
- O contador da navegação «Pedidos» soma o que precisa do comprador (contraproposta por responder, entregue por confirmar); o contador do sino é o das não lidas. Ambos se atualizam quando chega uma notificação por Realtime.
- **Rotas:** `/carrinho`, `/checkout/entrega`, `/pedidos/enviados/:grupo`, `/pedidos`, `/pedidos/:codigo`, `/notificacoes`, `/vender/pedidos`, `/vender/pedidos/:codigo`, `/recuperar`. Os pedidos do vendedor ficam em `/vender/...` como no F2 (e não em `/minha-loja/...` do desenho técnico §5).
- Os botões «Adicionar ao carrinho», o carrinho e o sino do cabeçalho e «Pedidos recebidos» do V04b deixam de mostrar «Disponível em breve».

**Testes**
- Vitest: o seletor de horas (fusos, meia-noite), a formatação «Hoje/Ontem», os formulários de entrega e de proposta, os ecrãs com Testing Library.
- Ponta a ponta com axe: comprador com 2 lojas no carrinho → checkout → vendedor aceita com contraproposta → comprador aceita → pronto → entregue → confirmar; e um fluxo de cancelamento. Recuperação da palavra-passe com o Mailpit local.
- `npm run verify` duas vezes no fim.

## 6. Desenhos em falta (primeira tarefa do plano)

São desenhados no canvas, com o design system v2.2, e aprovados pelo responsável antes de serem construídos:

1. **Folha «Propor outro local»** (comprador no C11 e vendedor ao mudar o local no V09): modalidade, campos, «Quando?», mensagem. Mais o estado do V09 com uma proposta nova do comprador («Confirmar local» / «Propor outro») e o estado «A hora pedida já passou».
2. **Confirmações** de cancelar (comprador, C11), de rejeitar com motivo opcional (V08) e de cancelar com motivo obrigatório (V09).
3. **Linha do carrinho indisponível ou com stock a menos** (C07).
4. **Sino com contador** no cabeçalho e o contador de «Pedidos» na navegação (o C10 já o mostra).
5. **V04 com pedidos**: «Precisa de ti» com o destaque dos pedidos com mais de 2 horas.
6. **Recuperação da palavra-passe**: K01b (pedir a ligação, com a confirmação «Se houver uma conta com este email, enviámos uma ligação.») e K01c (nova palavra-passe, sucesso e ligação expirada).
7. **Folha X03 · Textos novos do F3**, como a X02 do F2, com todos os microtextos novos (erros da secção 5, `PRODUCT_HAS_ORDERS` no V06b).

## 7. O que fica para quem constrói

- Os nomes exatos dos ficheiros, componentes e funções auxiliares.
- A ordem das tarefas, depois da tarefa 1 (desenhos) e da migração.
- A forma exata dos argumentos `jsonb` das propostas.
- O alfabeto e o comprimento final do código, desde que cumpram a regra 15.

## 8. Decisões que o responsável confirma ao aprovar

1. Não se compra à própria loja (regra 3).
2. Os limites de texto da entrega (regra 5).
3. «Quando?» só para hoje, com hora real guardada (regra 6).
4. O código com 6 caracteres mostrado inteiro (regra 15).
5. A recuperação da palavra-passe no F3, com a rota `/recuperar` (regra 16).
