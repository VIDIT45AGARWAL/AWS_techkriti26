# ──────────────────────────────────────────────
# Variables
# ──────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "civic-alert"
}

variable "ec2_instance_type" {
  description = "EC2 instance type for backend server"
  type        = string
  default     = "t3.medium"
}

variable "ec2_key_pair_name" {
  description = "Name of the EC2 key pair for SSH access"
  type        = string
  default     = "civicalert-key"
}

variable "ec2_ami_id" {
  description = "AMI ID for EC2 instance (Amazon Linux 2023)"
  type        = string
  default     = ""  # Will use data source if empty
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed for SSH access"
  type        = string
  default     = "0.0.0.0/0"  # Restrict in production!
}

variable "domain_name" {
  description = "Custom domain name for CloudFront (optional)"
  type        = string
  default     = ""
}

variable "bedrock_model_id" {
  description = "Amazon Bedrock model ID for AI triage"
  type        = string
  default     = "anthropic.claude-3-sonnet-20240229-v1:0"
}

variable "alert_email" {
  description = "Email address for SNS alert subscriptions"
  type        = string
  default     = ""
}

variable "github_repo_url" {
  description = "GitHub repository URL (HTTPS) for cloning backend code onto EC2"
  type        = string
  default     = "https://github.com/VIDIT45AGARWAL/AWS_techkriti26.git"
}
