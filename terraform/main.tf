terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  # ATENÇÃO: Descomente e configure o backend S3 abaixo se for usar para produção
  # backend "s3" {
  #   bucket = "meu-bucket-terraform-state-vlibras"
  #   key    = "terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region
}

# Gerar uma chave privada localmente no Terraform
resource "tls_private_key" "deployer_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

# Criar a chave SSH na AWS a partir da chave pública gerada
resource "aws_key_pair" "deployer_key" {
  key_name   = "vlibras-deploy-key"
  public_key = tls_private_key.deployer_key.public_key_openssh
}

# Criar o Security Group (Firewall)
resource "aws_security_group" "vlibras_sg" {
  name        = "vlibras_security_group"
  description = "Permitir SSH, HTTP e portas da aplicacao"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "App Port"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Evolution API Port"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "vlibras_sg"
  }
}

# AMI mais recente do Ubuntu 22.04 LTS
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

# Instância EC2
resource "aws_instance" "vlibras_server" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  key_name      = aws_key_pair.deployer_key.key_name
  
  vpc_security_group_ids = [aws_security_group.vlibras_sg.id]

  # Root disk: 20GB (para caber as imagens Docker e o build)
  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  # Script de inicialização (Roda como root no primeiro boot)
  user_data = <<-EOF
              #!/bin/bash
              apt-get update -y
              
              # Instalar dependências básicas
              apt-get install -y ca-certificates curl gnupg git
              
              # Instalar Docker
              install -m 0755 -d /etc/apt/keyrings
              curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
              chmod a+r /etc/apt/keyrings/docker.gpg
              echo \
                "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
                "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
                tee /etc/apt/sources.list.d/docker.list > /dev/null
              
              apt-get update -y
              apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
              
              # Instalar Docker Compose (standalone)
              curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
              chmod +x /usr/local/bin/docker-compose
              
              # Adicionar o usuário ubuntu ao grupo docker
              usermod -aG docker ubuntu
              
              # Clonar o repositório (opcional aqui, pois a pipeline fará isso também, mas ajuda no setup inicial)
              cd /home/ubuntu
              if [ ! -d "vlibras-whatsapp" ]; then
                # Se for repo privado, o git clone falhará sem chave. A pipeline resolve isso depois.
                git clone https://github.com/neriidev/vlibras-whatsapp.git || true
                chown -R ubuntu:ubuntu vlibras-whatsapp || true
              fi
              EOF

  tags = {
    Name = "vlibras-whatsapp-server"
  }
}
