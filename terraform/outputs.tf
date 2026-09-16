output "ec2_public_ip" {
  description = "Endereço IP público da instância EC2"
  value       = aws_instance.vlibras_server.public_ip
}

output "ssh_command" {
  description = "Comando SSH para acessar a máquina"
  value       = "ssh -i <sua_chave_privada.pem> ubuntu@${aws_instance.vlibras_server.public_ip}"
}
