# ──────────────────────────────────────────────
# CivicAlert — Terraform Configuration
# ──────────────────────────────────────────────

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment for remote state (recommended for teams)
  # backend "s3" {
  #   bucket  = "civicalert-terraform-state"
  #   key     = "infrastructure/terraform.tfstate"
  #   region  = "ap-south-1"
  #   encrypt = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "CivicAlert"
      Team        = "Segionpex"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
