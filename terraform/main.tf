resource "aws_security_group" "app_sg"{
	name = "app-server"
	ingress {
		from_port = 22
		to_port = 22
		protocol = "tcp"
		cidr_blocks = ["0.0.0.0/0"]
	}
	ingress {
		from_port = 3000
		to_port = 3000
		protocol = "tcp"
		cidr_blocks = ["0.0.0.0/0"]
	}
	ingress {
		from_port = 5000
		to_port = 5000
		protocol = "tcp"
		cidr_blocks = ["0.0.0.0/0"]
	}
	ingress {
		from_port = 80
		to_port = 80
		protocol = "tcp"
		cidr_blocks = ["0.0.0.0/0"]
	}
	egress{
		from_port = 0
		to_port = 0
		protocol = "-1"
		cidr_blocks = ["0.0.0.0/0"]
	}
}

resource "aws_ecr_repository" "frontend-repo"{
  name = "typr-frontend"
}
resource "aws_ecr_repository" "backend-repo" {
  name = "typr-backend"
}

resource "aws_instance" "typr-server"{
  ami = "ami-0236922087fa98b6e"
  instance_type = var.instance_type
  key_name = var.key_name
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  root_block_device {
    volume_size = 20
  }
  tags = {
    Name = "app-server"
  }
}

output "app-server_ip" {
  value = aws_instance.typr-server.public_ip
}
output "frontend_ecr_url"{
  value = aws_ecr_repository.frontend-repo.repository_url
}
output "backend_ecr_url"{
  value = aws_ecr_repository.backend-repo.repository_url
}

