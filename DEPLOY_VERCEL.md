# Publicar na Vercel

O site `numbler-inspiration-botcamp-dio.vercel.app` só mostra o botão **3 Scatters (50)** depois que a Vercel servir o código novo do GitHub.

## Se o botão não aparece após `git push`

1. Abra [vercel.com](https://vercel.com) → projeto **numbler-inspiration-botcamp-dio**.
2. **Settings → Git**: confirme o repositório  
   `matheustbcarvalho-mtc/Numbler-inspiration-botcamp-dio` e branch **main**.
3. **Deployments** → no último deploy, veja se o commit é `68a3a74` ou mais novo.
4. Se estiver antigo: **Redeploy** → **Redeploy with existing Build Cache** desligado.
5. Ou **Import Project** de novo apontando para esse repositório.

## Variáveis de ambiente (opcional)

Se o build usar `SUPABASE_URL` e `SUPABASE_ANON_KEY`, adicione também:

- `DEALER_SCATTER_BUY_EMAILS` = `matheus.tbcarvalho@gmail.com`

O `generate-config.js` preserva e-mails já listados no `config.js` do repositório.

## Conferir após o deploy

- `https://numbler-inspiration-botcamp-dio.vercel.app/index.html` deve conter `btn-buy-scatters`.
- `https://numbler-inspiration-botcamp-dio.vercel.app/config.js` deve conter `DEALER_SCATTER_BUY_EMAILS`.

No jogo: login → **Ctrl+F5** → botão **3 Scatters (50)** entre GIRAR e AUTO.
