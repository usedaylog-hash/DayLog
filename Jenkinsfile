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
                dir('client') {
                    sh 'npm run lint'
                }
                dir('server') {
                    sh 'npm run lint'
                }
            }
        }

        stage('Typecheck') {
            steps {
                dir('client') {
                    sh 'npm run typecheck'
                }
                dir('server') {
                    sh 'npm run typecheck'
                }
            }
        }

        stage('Test') {
            steps {
                dir('server') {
                    sh 'CI=true npm test'
                }
                dir('client') {
                    sh 'CI=true npm test'
                }
            }
            post {
                always {
                    junit testResults: '**/test-results/junit.xml', allowEmptyResults: true
                }
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
            node('') {
                cleanWs()
            }
        }
    }
}
