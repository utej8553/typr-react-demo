pipeline {
  agent any
  tools {
    sonarQube 'sonar-scanner'
  }
  environment {
    SCANNER_HOME = tool 'sonar-scanner'
  }
  stages {
    stage('Github Checkout') {
      steps {
        git branch: 'main',
        url: 'https://github.com/utej8553/typr-react-demo'
      }
    }

    stage('SnonarQube analysis') {
      steps {
        withSonarQubeEnv('sonar') {
          sh '''
            $SCANNER_HOME/bin/sonar-scanner
          '''
        }
      }
    }

    stage('Build frontend image'){
      steps {
        sh 'docker build -t typr-react-demo/frontend ./frontend'
      }
    }
    stage('Build backend image'){
      steps {
        sh 'docker build -t typr-react-demo/backend ./backend'
      }
    }

    stage('Trivy Scan Frontend'){
      steps {
        sh 'trivy image typr-react-demo/frontend'
      }
    }
    stage('Trivy Scan Backend'){
      steps {
        sh 'trivy image typr-react-demo/backend'
      }
    }
  }
}
