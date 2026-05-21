pipeline {
  agent any

  environment {
    SCANNER_HOME = tool 'sonar-scanner'

    AWS_REGION = 'us-east-1'

    ECR_REGISTRY = '237024526028.dkr.ecr.us-east-1.amazonaws.com'

    APP_SERVER_IP = '54.237.35.24'

    FRONTEND_ECR = '237024526028.dkr.ecr.us-east-1.amazonaws.com/typr-frontend'

    BACKEND_ECR = '237024526028.dkr.ecr.us-east-1.amazonaws.com/typr-backend'
  }

  stages {

    stage('Github Checkout') {
      steps {
        git branch: 'main',
        url: 'https://github.com/utej8553/typr-react-demo'
      }
    }

    stage('SonarQube analysis') {
      steps {
        withSonarQubeEnv('sonar-scanner') {
          sh '''
            $SCANNER_HOME/bin/sonar-scanner
          '''
        }
      }
    }

    stage('Build frontend image') {
      steps {
        sh 'docker build -t typr-react-demo/frontend ./frontend'
      }
    }

    stage('Build backend image') {
      steps {
        sh 'docker build -t typr-react-demo/backend ./backend'
      }
    }

    stage('Trivy Scan Frontend') {
      steps {
        sh 'trivy image typr-react-demo/frontend'
      }
    }

    stage('Trivy Scan Backend') {
      steps {
        sh 'trivy image typr-react-demo/backend'
      }
    }

    stage('Login to ECR') {
    steps {
        withCredentials([
            [$class: 'AmazonWebServicesCredentialsBinding',
            credentialsId: 'aws-admin-access-key']
        ]) {
            sh '''
                aws ecr get-login-password --region $AWS_REGION | \
                docker login --username AWS --password-stdin 237024526028.dkr.ecr.us-east-1.amazonaws.com
            '''
        }
    }
}

    stage('Tag frontend image') {
      steps {
        sh '''
          docker tag typr-react-demo/frontend:latest $FRONTEND_ECR:latest
        '''
      }
    }

    stage('Push frontend image') {
      steps {
        sh '''
          docker push $FRONTEND_ECR:latest
        '''
      }
    }

    stage('Tag backend image') {
      steps {
        sh '''
          docker tag typr-react-demo/backend:latest $BACKEND_ECR:latest
        '''
      }
    }

    stage('Push backend image') {
      steps {
        sh '''
          docker push $BACKEND_ECR:latest
        '''
      }
    }

    stage('Deploy to App server'){
  steps {
    sh '''
    ssh -o StrictHostKeyChecking=no \
    -i /var/lib/jenkins/demo-key.pem \
    ubuntu@$APP_SERVER_IP << EOF

    cd app

    aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin 237024526028.dkr.ecr.us-east-1.amazonaws.com

    docker-compose pull

    docker-compose down

    docker-compose up -d

    docker ps

    EOF
    '''
  }
}
  }
}
