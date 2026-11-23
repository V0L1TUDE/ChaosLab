# ChaosLab — Production Deployment Guide

This guide details the complete, step-by-step process for deploying the **ChaosLab** website and API to an AWS EC2 virtual machine (or any standard Ubuntu/Linux compute instance) without relying on managed PaaS platforms like Vercel, Render, or Firebase.

---

## 1. Production Architecture Overview

```
                          [ Internet / Browsers ]
                                     │
                                (HTTPS : 443)
                                     ▼
                            ┌─────────────────┐
                            │   Nginx Proxy   │ (TLS Termination, Security Headers,
                            └────────┬────────┘  Static Buffering, Port 80 -> 443)
                                     │
                             (HTTP : 127.0.0.1:3000)
                                     ▼
                            ┌─────────────────┐
                            │ Node.js Server  │ (Express, Auth Session, Storage Manager)
                            │   (systemd)     │
                            └────┬───────┬────┘
                                 │       │
             (Local Read/Write)  │       │  (AWS SDK v3 / HTTPS API)
                                 ▼       ▼
                       ┌───────────┐   ┌───────────────┐
                       │ SQLite DB │   │ AWS S3 Bucket │ (Object Storage for
                       │ (.db file)│   │ (Uploads)     │  Presentation PDFs)
                       └───────────┘   └───────────────┘
```

### Why this architecture?
- **Full Control & Transparency:** Satisfies course requirements by demonstrating manual web server configuration, TLS certificate renewal, reverse proxying, system service isolation, and environment isolation.
- **No Vendor Lock-in:** The entire stack runs on a standard Linux VM (`Ubuntu 24.04 LTS`).
- **Security:** Node.js listens strictly on internal localhost (`127.0.0.1:3000`). Public web traffic only interacts with Nginx.

---

## 2. Server Provisioning & Initial Setup

### Step 2.1: Launch compute instance
1. Launch an AWS EC2 instance (e.g., `t3.micro` or `t3.small` running **Ubuntu 24.04 LTS**).
2. Allocate an **Elastic IP** and associate it with the EC2 instance so the IP address remains fixed across restarts.
3. Configure Security Group rules:
   - **SSH (22):** Allowed from your IP only.
   - **HTTP (80):** Allowed from `0.0.0.0/0`.
   - **HTTPS (443):** Allowed from `0.0.0.0/0`.

### Step 2.2: System preparation & user creation
SSH into your server and install required system packages:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx sqlite3 certbot python3-certbot-nginx

# Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node version
node -v # Should display v22.x.x
```

Create a dedicated system user `chaoslab` with no login shell for security:

```bash
sudo useradd --system --create-home --shell /bin/bash chaoslab
sudo mkdir -p /srv/chaoslab
sudo chown -R chaoslab:chaoslab /srv/chaoslab
```

---

## 3. Application Setup

### Step 3.1: Deploy codebase to server
Switch to the `chaoslab` service directory and clone your repository:

```bash
cd /srv/chaoslab
sudo -u chaoslab git clone https://github.com/YOUR_GITHUB_USERNAME/ChaosLab.git .
sudo -u chaoslab npm install --production
```

### Step 3.2: Configure production environment variables
Create `/srv/chaoslab/.env` (owned exclusively by `chaoslab:chaoslab` with permissions `600`):

```bash
sudo touch /srv/chaoslab/.env
sudo chown chaoslab:chaoslab /srv/chaoslab/.env
sudo chmod 600 /srv/chaoslab/.env
```

Populate `/srv/chaoslab/.env` with production settings:

```ini
PORT=3000
NODE_ENV=production
SESSION_SECRET=generate-a-long-random-secret-key-here-min-32-chars
ADMIN_USERNAME=admin
ADMIN_PASSWORD=SetAStrongRandomPasswordHere!

# Storage Configuration (AWS S3)
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-chaoslab-uploads-bucket
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX────────
```

*Note: If `AWS_*` credentials are omitted, the server automatically defaults to local disk storage in `/srv/chaoslab/uploads/`.*

---

## 4. Continuous Process Management (systemd)

To keep Node.js running continuously and restart automatically on server reboots or crashes:

1. Copy the systemd service unit template:
   ```bash
   sudo cp /srv/chaoslab/deploy/systemd/chaoslab.service.example /etc/systemd/system/chaoslab.service
   ```

2. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable chaoslab
   sudo systemctl start chaoslab
   ```

3. Verify service status and logs:
   ```bash
   sudo systemctl status chaoslab
   sudo journalctl -u chaoslab -f
   ```

---

## 5. Domain, Reverse Proxy (Nginx) & HTTPS Setup

### Step 5.1: DNS Configuration
Point your domain or subdomain's **A record** (e.g. `chaoslab.yourdomain.com`) to your server's Elastic IP.

### Step 5.2: Nginx Reverse Proxy Setup
1. Copy the Nginx site configuration:
   ```bash
   sudo cp /srv/chaoslab/deploy/nginx/chaoslab.conf.example /etc/nginx/sites-available/chaoslab
   ```
2. Edit `/etc/nginx/sites-available/chaoslab` and replace `chaoslab.example.org` with your domain name.
3. Enable the configuration and restart Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/chaoslab /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### Step 5.3: Automated HTTPS via Let's Encrypt (Certbot)
Obtain a free SSL/TLS certificate and enable automatic HTTP-to-HTTPS redirect:

```bash
sudo certbot --nginx -d chaoslab.yourdomain.com
```

Certbot automatically edits the Nginx configuration and configures a daily renewal timer (`systemctl status certbot.timer`).

> **Certificate expiry trap (learned the hard way).** If `nginx -t` fails on a fresh server because the
> template references certificate files that don't exist yet, it's tempting to run
> `certbot certonly --standalone` after stopping Nginx. **Don't leave it that way:** that records
> `authenticator = standalone` in `/etc/letsencrypt/renewal/<domain>.conf`, and every automatic renewal
> afterwards fails because Nginx owns port 80. Let's Encrypt certificates last 90 days, so the site then
> breaks with an expired certificate. After the first issuance, switch renewal to the Nginx plugin:
>
> ```bash
> sudo certbot certonly --nginx -d chaoslab.yourdomain.com --force-renewal
> sudo systemctl reload nginx
> sudo certbot renew --dry-run     # must end with "all simulated renewals succeeded"
> ```
>
> If the site ever shows a certificate warning, check `sudo certbot certificates` first.

---

## 6. AWS S3 Storage Integration

1. **Create S3 Bucket:** In AWS Console, create a bucket (e.g., `chaoslab-uploads-bucket`). Block all public access.
2. **Create IAM Policy:** Attach an inline policy allowing minimum required permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
         "Resource": [
           "arn:aws:s3:::chaoslab-uploads-bucket",
           "arn:aws:s3:::chaoslab-uploads-bucket/*"
         ]
       }
     ]
   }
   ```
3. Add the IAM access key and secret to `/srv/chaoslab/.env` and restart the app (`sudo systemctl restart chaoslab`).

---

## 7. Automated Backups

1. Copy the backup script to system binaries:
   ```bash
   sudo cp /srv/chaoslab/deploy/backup/backup-chaoslab.sh.example /usr/local/bin/backup-chaoslab.sh
   sudo chmod +x /usr/local/bin/backup-chaoslab.sh
   ```

2. Schedule daily execution at 2:00 AM via root crontab:
   ```bash
   sudo crontab -e
   ```
   Add line:
   ```cron
   0 2 * * * /usr/local/bin/backup-chaoslab.sh >> /var/log/chaoslab-backup.log 2>&1
   ```

---

## 8. Maintenance & Update Deployment Workflow

To deploy code updates after pushing changes to your Git repository:

```bash
cd /srv/chaoslab
sudo -u chaoslab git pull origin main
sudo -u chaoslab npm install --production
sudo systemctl restart chaoslab
```

---

## 9. Professor Demonstration Verification Checklist

Before presenting your deployed instance:
1. Verify `https://chaoslab.yourdomain.com/ChaosLab/` loads with a valid SSL padlock.
2. Verify Admin Login at `/ChaosLab/admin/login/`.
3. Publish a new presentation version with a sample PDF.
4. Verify original `v1` remains active alongside `v2`.
5. Check backend logs: `sudo journalctl -u chaoslab -n 20`.
