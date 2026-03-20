# ──────────────────────────────────────────────
# SNS Topics — Department Alert Dispatch
# ──────────────────────────────────────────────

resource "aws_sns_topic" "police" {
  name = "${var.project_name}-police-alerts-${var.environment}"

  tags = {
    Name       = "Police Alerts"
    Department = "Police"
  }
}

resource "aws_sns_topic" "fire" {
  name = "${var.project_name}-fire-alerts-${var.environment}"

  tags = {
    Name       = "Fire Department Alerts"
    Department = "Fire"
  }
}

resource "aws_sns_topic" "medical" {
  name = "${var.project_name}-medical-alerts-${var.environment}"

  tags = {
    Name       = "Medical Emergency Alerts"
    Department = "Medical"
  }
}

resource "aws_sns_topic" "disaster" {
  name = "${var.project_name}-disaster-alerts-${var.environment}"

  tags = {
    Name       = "Disaster Response Alerts"
    Department = "Disaster"
  }
}

# ─── Email Subscriptions (optional) ───

resource "aws_sns_topic_subscription" "police_email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.police.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_sns_topic_subscription" "fire_email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.fire.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_sns_topic_subscription" "medical_email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.medical.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_sns_topic_subscription" "disaster_email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.disaster.arn
  protocol  = "email"
  endpoint  = var.alert_email
}
