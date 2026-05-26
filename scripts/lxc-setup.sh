#!/bin/bash

# =============================================================================
# LXC Setup Script — Etapas 2+3 (Prisma + Auth)
#
# Este script automatiza:
# 1. Verificação de pré-requisitos (PostgreSQL, Redis, Node.js, Git)
# 2. Clone do repo
# 3. Configuração do .env
# 4. npm install
# 5. Prisma generate + migrate
# 6. Build + seed
# 7. Testes
# 8. Health check
#
# Uso: bash lxc-setup.sh
# =============================================================================

set -e  # Exit on error

echo "======================================================================"
echo "  Condomínio App 2.0 — LXC Setup (Etapas 2+3)"
echo "======================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    exit 1
}

# =============================================================================
# STEP 1: Check Prerequisites
# =============================================================================

echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js not found. Install with: sudo apt install -y nodejs npm"
fi
log_info "Node.js: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    log_error "npm not found. Install with: sudo apt install -y npm"
fi
log_info "npm: $(npm --version)"

# Check Git
if ! command -v git &> /dev/null; then
    log_error "Git not found. Install with: sudo apt install -y git"
fi
log_info "Git: $(git --version)"

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    log_warn "PostgreSQL client not found. Install with: sudo apt install -y postgresql-client"
    log_warn "Make sure PostgreSQL server is running on this or another host."
else
    log_info "PostgreSQL client: $(psql --version)"
fi

# Check Redis
if ! command -v redis-cli &> /dev/null; then
    log_warn "Redis client not found. Install with: sudo apt install -y redis-tools"
    log_warn "Make sure Redis server is running on this or another host."
else
    log_info "Redis client: $(redis-cli --version)"
fi

echo ""

# =============================================================================
# STEP 2: Clone Repository
# =============================================================================

echo -e "${YELLOW}Step 2: Cloning repository...${NC}"
echo ""

# Ask for clone destination
read -p "Enter clone destination directory [~/Condominio-app]: " CLONE_DIR
CLONE_DIR=${CLONE_DIR:-~/Condominio-app}

# Expand ~
CLONE_DIR=$(eval echo "$CLONE_DIR")

# Check if already exists
if [ -d "$CLONE_DIR/.git" ]; then
    log_warn "Directory already exists: $CLONE_DIR"
    read -p "Pull latest changes? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$CLONE_DIR"
        git pull origin main
        log_info "Pulled latest changes"
    fi
else
    git clone https://github.com/Strawyeye59900z/Appmhvl4.0.git "$CLONE_DIR"
    log_info "Repository cloned to $CLONE_DIR"
fi

cd "$CLONE_DIR"
log_info "Working directory: $(pwd)"
echo ""

# =============================================================================
# STEP 3: Configure .env
# =============================================================================

echo -e "${YELLOW}Step 3: Configuring .env...${NC}"
echo ""

if [ ! -f .env ]; then
    log_info "Creating .env from template..."
    cp .env.example .env
    log_info "Template copied to .env"
else
    log_warn ".env already exists"
    read -p "Overwrite with template? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp .env.example .env
        log_info "Template copied"
    fi
fi

echo ""
echo "⚠️  Please edit .env with your values:"
echo "   nano .env"
echo ""
echo "Key values to set:"
echo "   DATABASE_URL     → PostgreSQL connection string"
echo "   JWT_SECRET       → Generate: openssl rand -base64 32"
echo "   JWT_REFRESH_SECRET → Generate: openssl rand -base64 32"
echo "   REDIS_HOST       → localhost (or remote host)"
echo "   REDIS_PORT       → 6379"
echo "   API_PORT         → 3001"
echo "   APP_SECRET       → Generate: openssl rand -base64 32"
echo ""

read -p "Press Enter after .env is configured... "
echo ""

# Verify .env has required keys
if ! grep -q "DATABASE_URL" .env; then
    log_error ".env is missing DATABASE_URL"
fi
log_info ".env configured"
echo ""

# =============================================================================
# STEP 4: Install Dependencies
# =============================================================================

echo -e "${YELLOW}Step 4: Installing dependencies...${NC}"
echo ""

npm install
log_info "Dependencies installed"
echo ""

# =============================================================================
# STEP 5: Prisma Setup
# =============================================================================

echo -e "${YELLOW}Step 5: Prisma setup (generate + migrate)...${NC}"
echo ""

log_info "Generating Prisma Client..."
npm run prisma:generate
log_info "Prisma Client generated"
echo ""

log_info "Running migration..."
npm run prisma:migrate:dev -- --name init
log_info "Migration completed"
echo ""

# =============================================================================
# STEP 6: Build & Seed
# =============================================================================

echo -e "${YELLOW}Step 6: Building API...${NC}"
echo ""

npm run build -w @condominio/api
log_info "API built successfully"
echo ""

echo -e "${YELLOW}Step 6b: Seeding database...${NC}"
echo ""

npm run seed -w @condominio/api
log_info "Database seeded"
echo ""

# =============================================================================
# STEP 7: Run Tests
# =============================================================================

echo -e "${YELLOW}Step 7: Running tests...${NC}"
echo ""

npm run test -w @condominio/api
log_info "Tests completed"
echo ""

# =============================================================================
# STEP 8: Health Check (Optional)
# =============================================================================

echo -e "${YELLOW}Step 8: Starting API for health check (20 seconds)...${NC}"
echo ""

log_warn "Starting API in background..."
npm run start:dev -w @condominio/api &
API_PID=$!
sleep 5

log_warn "Testing health endpoint..."
if curl -s http://localhost:3001/api/v1/health | grep -q "database"; then
    log_info "Health check passed ✓"
    curl -s http://localhost:3001/api/v1/health | jq .
else
    log_warn "Health check failed or API not responding yet"
fi

echo ""
sleep 3
kill $API_PID 2>/dev/null || true
log_info "API stopped"
echo ""

# =============================================================================
# SUMMARY
# =============================================================================

echo "======================================================================"
echo -e "${GREEN}  Setup Complete!${NC}"
echo "======================================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Start the API:"
echo "   cd $CLONE_DIR"
echo "   npm run start:dev -w @condominio/api"
echo ""
echo "2. In another terminal, test endpoints:"
echo "   curl http://localhost:3001/api/v1/health"
echo "   curl -X POST http://localhost:3001/api/v1/auth/admin \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"username\":\"admin\",\"password\":\"admin123\"}'"
echo ""
echo "3. Admin login credentials:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "4. When done testing, press Ctrl+C to stop the API"
echo ""
echo "======================================================================"
