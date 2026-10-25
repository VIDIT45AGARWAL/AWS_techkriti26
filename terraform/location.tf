# AWS Location Service place index for geocoding / reverse geocoding.
# Created manually on 2025-10-25 via CLI (name: civic-alert-places-prod,
# data source: Esri) — this file documents it for reproducibility.

resource "aws_location_place_index" "places" {
  index_name     = "civic-alert-places-prod"
  data_source    = "Esri"
  description    = "CivicAlert place index for geocoding and reverse geocoding"
}

output "location_index_name" {
  description = "Name of the AWS Location Service place index"
  value       = aws_location_place_index.places.index_name
}
