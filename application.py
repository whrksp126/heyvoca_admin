# application.py - AWS Elastic Beanstalk 진입점
from app import create_app

# EB는 기본적으로 'application' 객체를 찾습니다
application = create_app()

if __name__ == '__main__':
    application.run(debug=False)

