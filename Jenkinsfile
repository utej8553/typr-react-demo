pipeline {
  agent any

  stages {
    stage('Github Checkout') {
      steps {
        git branch: 'main',
        url: 'https://github.com/utej8553/typr-react-demo'
      }
    }

    stage('Build check') {
      steps {
        echo 'Pipeline working successfully'
      }
    }
  }
}
