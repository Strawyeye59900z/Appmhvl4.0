import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/roles.enum';
import { LoginAdminDto } from './dto/login-admin.dto';
import { LoginFuncionarioDto } from './dto/login-funcionario.dto';
import { LoginMoradorDto } from './dto/login-morador.dto';
import { SetupSenhaFuncionarioDto, SetupSenhaMoradorDto } from './dto/setup-senha.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async loginAdmin(dto: LoginAdminDto) {
    const admin = await this.prisma.admin.findUnique({ where: { username: dto.username } });
    if (!admin) throw new UnauthorizedException('Credenciais inválidas');

    const valid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    return this.issueTokens(admin.id, Role.ADMIN);
  }

  async loginFuncionario(dto: LoginFuncionarioDto) {
    const func = await this.prisma.funcionario.findUnique({ where: { id: dto.funcionarioId } });
    if (!func || !func.ativo) throw new UnauthorizedException('Funcionário não encontrado');

    if (func.primeiroAcesso || !func.passwordHash) {
      return { primeiroAcesso: true };
    }

    const valid = await bcrypt.compare(dto.password, func.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    return this.issueTokens(func.id, Role.FUNCIONARIO);
  }

  async setupSenhaFuncionario(dto: SetupSenhaFuncionarioDto) {
    const func = await this.prisma.funcionario.findUnique({ where: { id: dto.funcionarioId } });
    if (!func || !func.ativo) throw new UnauthorizedException('Funcionário não encontrado');
    if (!func.primeiroAcesso) throw new BadRequestException('Senha já configurada');

    const passwordHash = await bcrypt.hash(dto.novaSenha, 10);
    await this.prisma.funcionario.update({
      where: { id: dto.funcionarioId },
      data: { passwordHash, primeiroAcesso: false },
    });

    return this.issueTokens(func.id, Role.FUNCIONARIO);
  }

  async loginMorador(dto: LoginMoradorDto) {
    const apt = await this.prisma.apartamento.findUnique({ where: { id: dto.apartamentoId } });
    if (!apt || !apt.ativo) throw new UnauthorizedException('Apartamento não encontrado');

    if (apt.primeiroAcesso || !apt.senhaHash) {
      return { primeiroAcesso: true };
    }

    const valid = await bcrypt.compare(dto.password, apt.senhaHash);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    return this.issueTokens(apt.id, Role.MORADOR);
  }

  async setupSenhaMorador(dto: SetupSenhaMoradorDto) {
    const apt = await this.prisma.apartamento.findUnique({ where: { id: dto.apartamentoId } });
    if (!apt || !apt.ativo) throw new UnauthorizedException('Apartamento não encontrado');
    if (!apt.primeiroAcesso) throw new BadRequestException('Senha já configurada');

    const senhaHash = await bcrypt.hash(dto.novaSenha, 10);
    await this.prisma.apartamento.update({
      where: { id: dto.apartamentoId },
      data: { senhaHash, primeiroAcesso: false },
    });

    return this.issueTokens(apt.id, Role.MORADOR);
  }

  async getFuncionariosAtivos() {
    return this.prisma.funcionario.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, fotoUrl: true },
      orderBy: { nome: 'asc' },
    });
  }

  issueTokens(sub: string, role: Role) {
    const accessToken = this.jwt.sign(
      { sub, role },
      { secret: this.config.getOrThrow('JWT_SECRET'), expiresIn: '15m' },
    );
    const refreshToken = this.jwt.sign(
      { sub, role },
      { secret: this.config.getOrThrow('JWT_REFRESH_SECRET'), expiresIn: '30d' },
    );
    return { accessToken, refreshToken };
  }

  verifyRefreshToken(token: string): { sub: string; role: Role } {
    try {
      return this.jwt.verify(token, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }
}
