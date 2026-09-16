variable "aws_region" {
  description = "Região da AWS para criar a infraestrutura"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "Tipo da instância EC2 (Recomendado t3.small no mínimo para build Docker)"
  type        = string
  default     = "t3.small"
}
