# Deploy lên VPS (Ubuntu)

Stack: Docker Compose chạy `postgres + api + web + nginx + certbot`. Một VPS 2 vCPU / 4GB RAM đủ chạy mượt cho giai đoạn đầu (tới ~50k visit/tháng).

---

## 1. Chuẩn bị VPS

```bash
# SSH vào VPS với user sudo, cài docker:
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
exit  # logout rồi ssh lại để group có hiệu lực

# Verify:
docker --version
docker compose version
```

## 2. Trỏ DNS

Tại nhà cung cấp domain (vd Tenten, Namecheap, Cloudflare), tạo:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A    | @    | `<VPS_PUBLIC_IP>` | 300 |
| A    | www  | `<VPS_PUBLIC_IP>` | 300 |

Đợi 5–15 phút rồi kiểm tra: `dig yourdomain.com +short`.

## 3. Pull repo + cấu hình env

```bash
git clone https://github.com/<your-account>/micro_tools.git dealvault
cd dealvault

cp deploy/.env.prod.example .env.prod
nano .env.prod   # điền DB_PASSWORD, ADMIN_API_KEY, GEMINI_API_KEY, ACCESSTRADE_*, SITE_URL...
```

Sửa `deploy/nginx.conf`: thay `<YOUR_DOMAIN>` bằng domain thật (2 chỗ trong khối `server 80`).

## 4. Build + chạy (chưa có SSL)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build postgres api web nginx
```

Kiểm tra:
```bash
docker compose -f docker-compose.prod.yml ps          # tất cả phải healthy/running
curl http://yourdomain.com/api/v1/tools               # phải trả JSON
curl http://yourdomain.com                            # phải trả HTML trang chủ
```

Nếu API trả empty array `[]` → seed dữ liệu mẫu một lần:
```bash
docker compose -f docker-compose.prod.yml exec api node prisma/seed.js
```

## 5. Cấp SSL với Let's Encrypt

```bash
# Tạo dummy cert để nginx start được khi mount volume cert rỗng:
mkdir -p deploy/certbot/conf/live/yourdomain.com
docker run --rm -v "$(pwd)/deploy/certbot/conf:/etc/letsencrypt" alpine \
  sh -c "apk add --no-cache openssl && \
         openssl req -x509 -nodes -newkey rsa:2048 \
           -days 1 \
           -keyout /etc/letsencrypt/live/yourdomain.com/privkey.pem \
           -out /etc/letsencrypt/live/yourdomain.com/fullchain.pem \
           -subj '/CN=localhost'"

# Reload nginx
docker compose -f docker-compose.prod.yml restart nginx

# Lấy cert thật:
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  --email your@email.com --agree-tos --no-eff-email \
  -d yourdomain.com -d www.yourdomain.com
```

Bật khối `server 443` trong `deploy/nginx.conf` (uncomment), uncomment dòng `return 301 https...` trong khối `server 80`, rồi:

```bash
docker compose -f docker-compose.prod.yml restart nginx certbot
```

Test: https://yourdomain.com → ✅ khoá xanh.

## 6. Sau khi go-live

- **Crawler**: chạy mỗi 6h theo `CRAWLER_CRON`. Kiểm tra log:
  ```bash
  docker compose -f docker-compose.prod.yml logs -f api | grep Crawler
  ```
- **Trigger crawl ngay**:
  ```bash
  curl -X POST https://yourdomain.com/api/v1/admin/crawler/run \
    -H "x-admin-key: <ADMIN_API_KEY>"
  ```
- **Backup DB hàng ngày**:
  ```bash
  docker compose -f docker-compose.prod.yml exec -T postgres \
    pg_dump -U $DB_USER $DB_NAME | gzip > backup-$(date +%F).sql.gz
  ```
  (Đẩy lên cron + sync sang S3/Backblaze để an toàn.)

## 7. Update code

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build api web
```

Migration tự apply khi container `api` start (do `CMD` đã chạy `prisma migrate deploy`).

---

## Troubleshooting nhanh

| Triệu chứng | Cách xử |
|---|---|
| `Permission denied` khi docker | `sudo usermod -aG docker $USER && newgrp docker` |
| Nginx 502 | `docker compose logs api web` — service chưa healthy |
| Certbot fail | Check DNS A record + port 80 mở firewall (`ufw allow 80,443/tcp`) |
| Migration fail | `docker compose exec api npx prisma migrate status` |
| Trang trắng nhưng API ok | Check `.env.prod` → `SITE_URL` đúng + `API_BASE_URL` trỏ vào `http://api:4000/api/v1` (internal docker network) |
