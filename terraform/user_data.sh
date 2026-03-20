#!/bin/bash
# ──────────────────────────────────────────────
# CivicAlert Backend Bootstrap Script
# Runs on EC2 first boot via user_data
# ──────────────────────────────────────────────
set -euo pipefail

exec > /var/log/civicalert-bootstrap.log 2>&1
echo "=== CivicAlert Bootstrap Started: $(date) ==="

# Update system
dnf update -y

# Install Python 3.11 and git
dnf install -y python3.11 python3.11-pip git nginx

# Create app user
useradd -r -s /bin/false civicalert || true

# Clone or create app directory
mkdir -p /opt/civicalert
cd /opt/civicalert

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Clone the application code
git clone ${github_repo_url} /tmp/civicalert-repo
cp -r /tmp/civicalert-repo/backend/* /opt/civicalert/
rm -rf /tmp/civicalert-repo

# Install dependencies
pip install --upgrade pip
pip install -r /opt/civicalert/requirements.txt

# Create environment file
cat > /opt/civicalert/.env << 'ENVEOF'
AWS_REGION=${aws_region}
USE_MOCK=false
BEDROCK_MODEL_ID=${bedrock_model_id}
SNS_TOPIC_POLICE=${sns_topic_police}
SNS_TOPIC_FIRE=${sns_topic_fire}
SNS_TOPIC_MEDICAL=${sns_topic_medical}
SNS_TOPIC_DISASTER=${sns_topic_disaster}
DYNAMODB_TABLE=${dynamodb_table}
ENVEOF

# Create systemd service
cat > /etc/systemd/system/civicalert.service << 'SVCEOF'
[Unit]
Description=CivicAlert FastAPI Backend
After=network.target

[Service]
Type=simple
User=civicalert
WorkingDirectory=/opt/civicalert
EnvironmentFile=/opt/civicalert/.env
ExecStart=/opt/civicalert/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

# Configure nginx as reverse proxy
cat > /etc/nginx/conf.d/civicalert.conf << 'NGXEOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
NGXEOF

# Set permissions
chown -R civicalert:civicalert /opt/civicalert

# Enable and start services
systemctl daemon-reload
systemctl enable civicalert
systemctl start civicalert
systemctl enable nginx
systemctl restart nginx

echo "=== CivicAlert Bootstrap Complete: $(date) ==="
