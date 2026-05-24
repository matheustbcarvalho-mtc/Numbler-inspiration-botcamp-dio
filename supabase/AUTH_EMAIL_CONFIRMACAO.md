# Erro: "Error sending confirmation email"

O cadastro falha porque o Supabase tenta enviar e-mail de confirmação e o envio não está configurado.

## Solução rápida (recomendada para testes / bootcamp)

1. [Supabase Dashboard](https://supabase.com/dashboard) → seu projeto
2. **Authentication** → **Providers** → **Email**
3. Desative **Confirm email** (ou "Enable email confirmations")
4. **Save**

Depois disso o usuário entra logo após criar a conta, sem link no e-mail.

## Se a conta já foi criada mas sem e-mail

1. **Authentication** → **Users**
2. Localize `mtc.mat.30@gmail.com`
3. Menu **⋯** → **Confirm user** (ou marque como confirmado)

## Produção (envio real de e-mail)

**Project Settings** → **Authentication** → **SMTP Settings**  
Configure servidor SMTP (Gmail, SendGrid, Resend, etc.) e teste o envio.
