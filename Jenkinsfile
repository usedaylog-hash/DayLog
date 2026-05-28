pipeline {
    agent any

    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
                dir('client') {
                    sh 'npm ci'
                }
                dir('server') {
                    sh 'npm ci'
                }
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Lint') {
            steps {
                echo 'Lint stage placeholder — will be implemented in DAY-28'
            }
        }

        stage('Test') {
            steps {
                echo 'Test stage placeholder — will be implemented in DAY-29'
            }
        }

        stage('Deploy') {
            steps {
                echo 'Deploy stage placeholder — will be implemented in DAY-30'
            }
        }
    }

    post {
        success {
            echo 'DayLog pipeline completed successfully.'
        }
        failure {
            echo 'DayLog pipeline failed.'
        }
        cleanup {
            cleanWs()
        }
    }
}
