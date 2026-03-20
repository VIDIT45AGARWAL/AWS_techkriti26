# ──────────────────────────────────────────────
# DynamoDB — Incidents Table
# ──────────────────────────────────────────────

resource "aws_dynamodb_table" "incidents" {
  name         = "${var.project_name}-incidents-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "incident_id"
  range_key    = "timestamp"

  attribute {
    name = "incident_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "department"
    type = "S"
  }

  attribute {
    name = "severity"
    type = "S"
  }

  # GSI: Query by department
  global_secondary_index {
    name            = "department-index"
    hash_key        = "department"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  # GSI: Query by severity
  global_secondary_index {
    name            = "severity-index"
    hash_key        = "severity"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-incidents"
  }
}
