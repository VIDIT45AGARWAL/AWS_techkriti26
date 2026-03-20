# ──────────────────────────────────────────────
# IAM — EC2 Role & Policies
# ──────────────────────────────────────────────

# Trust policy for EC2
data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

# IAM Role
resource "aws_iam_role" "ec2_role" {
  name               = "${var.project_name}-ec2-role-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json

  tags = {
    Name = "${var.project_name}-ec2-role"
  }
}

# DynamoDB access policy
data "aws_iam_policy_document" "dynamodb_access" {
  statement {
    sid    = "DynamoDBAccess"
    effect = "Allow"
    actions = [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
    ]
    resources = [
      aws_dynamodb_table.incidents.arn,
      "${aws_dynamodb_table.incidents.arn}/index/*",
    ]
  }
}

resource "aws_iam_role_policy" "dynamodb" {
  name   = "dynamodb-access"
  role   = aws_iam_role.ec2_role.id
  policy = data.aws_iam_policy_document.dynamodb_access.json
}

# SNS publish policy
data "aws_iam_policy_document" "sns_publish" {
  statement {
    sid    = "SNSPublish"
    effect = "Allow"
    actions = [
      "sns:Publish",
      "sns:ListTopics",
    ]
    resources = [
      aws_sns_topic.police.arn,
      aws_sns_topic.fire.arn,
      aws_sns_topic.medical.arn,
      aws_sns_topic.disaster.arn,
    ]
  }
}

resource "aws_iam_role_policy" "sns" {
  name   = "sns-publish"
  role   = aws_iam_role.ec2_role.id
  policy = data.aws_iam_policy_document.sns_publish.json
}

# Transcribe access policy
data "aws_iam_policy_document" "transcribe_access" {
  statement {
    sid    = "TranscribeAccess"
    effect = "Allow"
    actions = [
      "transcribe:StartTranscriptionJob",
      "transcribe:GetTranscriptionJob",
      "transcribe:StartStreamTranscription",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "transcribe" {
  name   = "transcribe-access"
  role   = aws_iam_role.ec2_role.id
  policy = data.aws_iam_policy_document.transcribe_access.json
}

# Bedrock access policy
data "aws_iam_policy_document" "bedrock_access" {
  statement {
    sid    = "BedrockAccess"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "bedrock" {
  name   = "bedrock-access"
  role   = aws_iam_role.ec2_role.id
  policy = data.aws_iam_policy_document.bedrock_access.json
}

# Location Service access policy
data "aws_iam_policy_document" "location_access" {
  statement {
    sid    = "LocationAccess"
    effect = "Allow"
    actions = [
      "geo:SearchPlaceIndexForPosition",
      "geo:SearchPlaceIndexForText",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "location" {
  name   = "location-access"
  role   = aws_iam_role.ec2_role.id
  policy = data.aws_iam_policy_document.location_access.json
}

# Instance Profile
resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-ec2-profile-${var.environment}"
  role = aws_iam_role.ec2_role.name
}
