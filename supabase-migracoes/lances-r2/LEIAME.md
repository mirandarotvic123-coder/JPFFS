# Lances no Cloudflare R2 — configuração (uma vez só)

Os vídeos de lance saem do Supabase Storage e passam a ficar no Cloudflare R2
(plano gratuito: 10 GB, download sem custo). Siga **nesta ordem**: o app novo
só pode subir pra produção depois dos passos 1 a 6.

## Cloudflare

1. **Criar conta e ativar o R2.** Em <https://dash.cloudflare.com>, crie a conta
   (grátis). No menu lateral, entre em **R2 Object Storage** e ative. A
   Cloudflare pede um cartão mesmo no plano gratuito. Não há cobrança enquanto o
   uso ficar dentro do gratuito (10 GB guardados, 1 milhão de envios e 10
   milhões de leituras por mês). A limpeza automática mantém abaixo de 8 GB.

2. **Criar o bucket.** R2 → **Create bucket** → nome `jpffs-lances` →
   localização automática → Create.

3. **Liberar o app no bucket (CORS).** Abra o bucket → **Settings** →
   **CORS Policy** → Add/Edit → cole:

   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["content-type", "range"],
       "ExposeHeaders": ["ETag", "Content-Length"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   O `*` é seguro aqui: o bucket é privado e só aceita links assinados pela
   Edge Function. Sem link assinado não se lê nem grava nada.

4. **Criar a chave de acesso.** Menu lateral **Storage & databases → R2 Object
   Storage** → na página Overview, role até o quadro **Account Details** (coluna
   da direita, embaixo) → botão **Manage API Tokens** → **Create Account API
   token** (o primeiro, "recommended"):
   - Token name: `jpffs-lances`
   - Permissions: **Object Read & Write**
   - Specify bucket(s): **Apply to specific buckets only** → `jpffs-lances`
   - TTL: **Forever**; Client IP filtering: deixe vazio
   - **Create Account API Token**. Na tela seguinte, copie o **Access Key ID** e
     o **Secret Access Key** (só aparece uma vez). O **Account ID** fica no
     mesmo quadro Account Details.

## Supabase (painel do projeto JPFFS)

5. **Secrets.** Edge Functions → **Secrets** → adicione:

   | Nome | Valor |
   |---|---|
   | `R2_ACCOUNT_ID` | Account ID do passo 4 |
   | `R2_ACCESS_KEY_ID` | Access Key ID do passo 4 |
   | `R2_SECRET_ACCESS_KEY` | Secret Access Key do passo 4 |
   | `R2_BUCKET` | `jpffs-lances` |

6. **SQL.** SQL Editor → cole e rode `supabase-migracoes/008-lances-r2.sql`.

7. **Função nova `lances-r2`.** Edge Functions → **Deploy a new function** →
   nome `lances-r2` → cole `supabase-migracoes/lances-r2/index.ts` → Deploy.
   Depois, em Settings da função, **desligue "Verify JWT with legacy secret"** →
   Save changes. O login dos usuários usa a chave nova (ECC) e seria recusado;
   a própria função confere o login pelo banco.

8. **Atualizar a `limpar-lances`.** Edge Functions → `limpar-lances` → Code →
   substitua pelo conteúdo de `supabase-migracoes/limpar-lances/index.ts` →
   Deploy. Rode o passo 6 **antes** deste: a função nova lê as colunas do 008.

## Depois

9. Subir o app (merge da branch + push pro `main`).
10. **Teste:** abra um link de câmera, grave um lance de teste e confira:
    - no Cloudflare: R2 → `jpffs-lances` deve mostrar o arquivo novo;
    - no Supabase:
      `select armazenamento, tamanho_bytes from lances order by criado_em desc limit 3;`
      deve mostrar `r2`;
    - na Galeria: "Ver" e "Baixar" funcionam.

Se aparecer `supabase` em vez de `r2`, o envio pro R2 falhou e o app usou o
plano B. Os detalhes aparecem no console do navegador da câmera e em Edge
Functions → `lances-r2` → Logs.
