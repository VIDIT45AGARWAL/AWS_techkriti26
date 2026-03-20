# ──────────────────────────────────────────────
# EC2 Instance — Backend Server
# ──────────────────────────────────────────────

# Get latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Security Group
resource "aws_security_group" "backend_sg" {
  name_prefix = "${var.project_name}-backend-"
  description = "Security group for CivicAlert backend server"

  # SSH
  ingress {
    description = "SSH access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  # HTTP
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # FastAPI (uvicorn)
  ingress {
    description = "FastAPI backend"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-backend-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# EC2 Instance
resource "aws_instance" "backend" {
  ami                    = var.ec2_ami_id != "" ? var.ec2_ami_id : data.aws_ami.amazon_linux.id
  instance_type          = var.ec2_instance_type
  key_name               = var.ec2_key_pair_name
  vpc_security_group_ids = [aws_security_group.backend_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    project_name    = var.project_name
    aws_region      = var.aws_region
    dynamodb_table  = aws_dynamodb_table.incidents.name
    sns_topic_police   = aws_sns_topic.police.arn
    sns_topic_fire     = aws_sns_topic.fire.arn
    sns_topic_medical  = aws_sns_topic.medical.arn
    sns_topic_disaster = aws_sns_topic.disaster.arn
    bedrock_model_id   = var.bedrock_model_id
    github_repo_url    = var.github_repo_url
  }))

  tags = {
    Name = "${var.project_name}-backend"
  }
}

# Elastic IP
resource "aws_eip" "backend_eip" {
  instance = aws_instance.backend.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-backend-eip"
  }
}
