pipeline {
  agent any

  stages {
    stage('Github Checkout') {
      steps {
        git branch: 'main',
        url: 'https://github.com/utej8553/typr-react-demo'
      }
    }

    stage('Build frontend image'){
      steps {
        sh 'docker build -t typr-react-demo/frontend .'
      }
    }
    stage('Build backend image'){
      steps {
        sh 'docker build -t typr-react-demo/backend .'
      }
    }
  }
}
