# Domain & HTTPS Setup with Dokploy

Step-by-step guide for connecting a custom domain to the AusFuel web app hosted on the remote VPS (`150.107.73.209`) with HTTPS via Dokploy + Traefik.

---

## Prerequisites

- A registered domain (e.g. `ausfuel.com.au`)
- Access to your domain registrar's DNS management
- Access to the Dokploy dashboard for the VPS

---

## Step 1: Configure DNS Records

In your domain registrar's DNS management, create the following A records:

| Type | Name  | Value             |
| ---- | ----- | ----------------- |
| A    | `@`   | `150.107.73.209`  |
| A    | `www` | `150.107.73.209`  |

- `@` serves `yourdomain.com.au`
- `www` serves `www.yourdomain.com.au`

DNS propagation can take anywhere from a few minutes to 48 hours (usually under an hour). You can check progress with:

```bash
dig yourdomain.com.au
# or
nslookup yourdomain.com.au
```

---

## Step 2: Add Domain in Dokploy

1. Open the **Dokploy dashboard**
2. Navigate to your **AusFuel web app** project
3. Go to the **Networking** or **Domains** section
4. Click **Add Domain**
5. Enter your domain (e.g. `ausfuel.com.au`)
6. Save — Traefik will automatically configure routing

If you want both `yourdomain.com.au` and `www.yourdomain.com.au`, add them both as separate domains.

---

## Step 3: Enable HTTPS (Let's Encrypt)

Dokploy uses Traefik with built-in Let's Encrypt support:

1. In Dokploy, go to **Settings** → **Certificates** (or **Traefik Settings**)
2. Enable **Let's Encrypt**
3. Enter your email address (for certificate expiry notifications)
4. Save

Traefik will automatically:

- Provision an SSL certificate for each domain you added
- Redirect HTTP → HTTPS
- Renew certificates before expiry (Let's Encrypt certs last 90 days, auto-renewed at 60 days)

The first certificate provisioning happens when Traefik receives the first HTTPS request — it can take 10-30 seconds for that initial request.

---

## Step 4: Set the ORIGIN Environment Variable

SvelteKit needs to know its canonical origin for correct URL generation.

In your Dokploy app's **Environment Variables** section, add:

```
ORIGIN=https://yourdomain.com.au
```

Redeploy the app after adding this variable.

---

## Step 5: Update Capacitor Config (Native App)

Once the domain is live with HTTPS, update `capacitor.config.ts`:

```ts
server: {
    url: 'https://yourdomain.com.au',
    cleartext: false
}
```

Changes to Capacitor config require rebuilding the native apps (iOS/Android) and submitting to the app stores.

---

## Troubleshooting

### Domain doesn't resolve

- Verify DNS records are correct in your registrar
- Check propagation with `dig` or [whatsmydns.net](https://whatsmydns.net)
- Wait — propagation can take up to 48 hours

### HTTPS not working (cert error)

- Confirm Let's Encrypt is enabled in Dokploy settings
- Make sure port **443** is open on the VPS firewall
- Check Traefik logs in Dokploy for certificate errors
- Let's Encrypt has rate limits: 5 duplicate certificates per week. Don't repeatedly delete/re-add domains

### HTTP not redirecting to HTTPS

- Traefik should handle this automatically when Let's Encrypt is enabled
- Check the domain configuration in Dokploy — ensure HTTPS/SSL is toggled on

### App shows wrong URLs or redirect errors

- Confirm the `ORIGIN` env var is set to `https://yourdomain.com.au` (note: **https**, not http)
- Restart/redeploy the app after changing env vars

### Can't reach the server at all

- Verify the VPS is running: `ping 150.107.73.209`
- Check that ports **80** (HTTP) and **443** (HTTPS) are open on the VPS firewall
- Check Dokploy agent status on the VPS
