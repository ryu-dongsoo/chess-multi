# AWS EC2 체스 서버 배포 가이드

## 1. AWS 계정 생성 및 설정

### 1.1 AWS 계정 생성
1. [AWS Console](https://aws.amazon.com/) 접속
2. "계정 만들기" 클릭
3. 이메일, 비밀번호, 계정명 입력
4. 신용카드 정보 입력 (무료 티어 사용을 위해 필요)
5. 전화번호 인증 완료

### 1.2 무료 티어 확인
- AWS 무료 티어는 12개월간 유효
- t2.micro 인스턴스 750시간/월 무료
- 8GB EBS 스토리지 무료

## 2. EC2 인스턴스 생성

### 2.1 EC2 대시보드 접속
1. AWS Console 로그인
2. 검색창에 "EC2" 입력
3. EC2 서비스 선택

### 2.2 인스턴스 생성
1. "인스턴스 시작" 클릭
2. **인스턴스 이름**: `chess-server`
3. **애플리케이션 및 OS 이미지**: Ubuntu 22.04 LTS
4. **인스턴스 유형**: t2.micro (무료 사용 가능)
5. **키 페어**: "새 키 페어 생성" → 이름: `chess-key` → `.pem` 파일 다운로드

### 2.3 네트워크 설정
1. **보안 그룹**: "새 보안 그룹 생성"
2. **보안 그룹 이름**: `chess-security-group`
3. **설명**: `Chess server security group`

### 2.4 보안 그룹 규칙 추가
| 유형 | 프로토콜 | 포트 범위 | 소스 |
|------|----------|-----------|------|
| SSH | TCP | 22 | 내 IP |
| HTTP | TCP | 80 | 0.0.0.0/0 |
| HTTPS | TCP | 443 | 0.0.0.0/0 |
| 커스텀 TCP | TCP | 3000 | 0.0.0.0/0 |

### 2.5 스토리지 설정
- **크기**: 8GB (무료 티어)
- **볼륨 유형**: gp2

### 2.6 인스턴스 시작
1. "인스턴스 시작" 클릭
2. 인스턴스 상태가 "실행 중"이 될 때까지 대기

## 3. 서버 접속 및 환경 설정

### 3.1 SSH 접속
```bash
# 키 파일 권한 설정 (Windows의 경우 생략)
chmod 400 chess-key.pem

# SSH 접속
ssh -i chess-key.pem ubuntu@[퍼블릭 IP]
```

### 3.2 시스템 업데이트
```bash
sudo apt update
sudo apt upgrade -y
```

### 3.3 Node.js 설치
```bash
# Node.js 18.x 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 버전 확인
node --version
npm --version
```

### 3.4 PM2 설치 (프로세스 관리)
```bash
sudo npm install -g pm2
```

## 4. 프로젝트 배포

### 4.1 프로젝트 업로드 방법 1: Git 사용
```bash
# Git 설치
sudo apt install git -y

# 프로젝트 클론
git clone [your-github-repo-url]
cd [project-directory]

# 의존성 설치
npm install
```

### 4.2 프로젝트 업로드 방법 2: SCP 사용
```bash
# 로컬에서 실행
scp -i chess-key.pem -r ./C ubuntu@[퍼블릭 IP]:~/chess-server
```

### 4.3 서버 실행
```bash
# PM2로 서버 실행
pm2 start server.js --name "chess-server"

# PM2 상태 확인
pm2 status

# 로그 확인
pm2 logs chess-server
```

### 4.4 자동 시작 설정
```bash
# PM2 자동 시작 설정
pm2 startup
pm2 save
```

## 5. 방화벽 설정

### 5.1 UFW 방화벽 활성화
```bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3000
sudo ufw status
```

## 6. 도메인 연결 (선택사항)

### 6.1 Route 53으로 도메인 구매
1. AWS Console에서 Route 53 서비스 선택
2. "도메인 등록" 클릭
3. 원하는 도메인명 검색 및 구매

### 6.2 DNS 레코드 설정
1. Route 53에서 호스팅 영역 생성
2. A 레코드 추가:
   - **이름**: `@` 또는 `chess`
   - **값**: EC2 인스턴스의 퍼블릭 IP
   - **TTL**: 300

## 7. HTTPS 설정 (선택사항)

### 7.1 Certbot 설치
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 7.2 SSL 인증서 발급
```bash
sudo certbot --nginx -d your-domain.com
```

## 8. 모니터링 및 관리

### 8.1 PM2 명령어
```bash
# 서버 상태 확인
pm2 status

# 서버 재시작
pm2 restart chess-server

# 로그 확인
pm2 logs chess-server

# 서버 중지
pm2 stop chess-server

# 서버 삭제
pm2 delete chess-server
```

### 8.2 시스템 모니터링
```bash
# CPU 사용률 확인
htop

# 메모리 사용률 확인
free -h

# 디스크 사용률 확인
df -h
```

## 9. 백업 및 복구

### 9.1 데이터 백업
```bash
# 프로젝트 백업
tar -czf chess-backup-$(date +%Y%m%d).tar.gz ~/chess-server

# S3에 업로드 (선택사항)
aws s3 cp chess-backup-*.tar.gz s3://your-bucket/
```

## 10. 비용 관리

### 10.1 무료 티어 한도
- **EC2**: t2.micro 750시간/월
- **EBS**: 8GB 스토리지
- **데이터 전송**: 1GB/월

### 10.2 비용 알림 설정
1. AWS Billing Console 접속
2. "청구 알림" 설정
3. 월 $1 이상 사용 시 알림 설정

## 문제 해결

### 서버가 시작되지 않는 경우
```bash
# PM2 로그 확인
pm2 logs chess-server

# 포트 사용 확인
sudo netstat -tlnp | grep :3000

# 방화벽 상태 확인
sudo ufw status
```

### 연결이 안 되는 경우
1. AWS 보안 그룹에서 포트 3000 허용 확인
2. 서버 방화벽 설정 확인
3. 인스턴스 상태 확인

### 메모리 부족 시
```bash
# 스왑 메모리 추가
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## 완료 후 확인사항

1. ✅ EC2 인스턴스 실행 중
2. ✅ Node.js 설치 완료
3. ✅ 프로젝트 업로드 완료
4. ✅ PM2로 서버 실행 중
5. ✅ 포트 3000 접근 가능
6. ✅ WebSocket 연결 테스트 완료
7. ✅ 도메인 연결 (선택사항)
8. ✅ HTTPS 설정 (선택사항)

## 접속 URL
- **HTTP**: `http://[퍼블릭 IP]:3000`
- **도메인**: `http://your-domain.com:3000` (도메인 설정 시)
- **HTTPS**: `https://your-domain.com:3000` (SSL 설정 시) 