import { Controller, Post, Get, Body, Req, Res, HttpCode, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginAdminDto } from './dto/login-admin.dto';
import { LoginFuncionarioDto } from './dto/login-funcionario.dto';
import { LoginMoradorDto } from './dto/login-morador.dto';
import { SetupSenhaFuncionarioDto, SetupSenhaMoradorDto } from './dto/setup-senha.dto';

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('funcionarios')
  getFuncionarios() {
    return this.auth.getFuncionariosAtivos();
  }

  @Post('admin')
  @HttpCode(200)
  async loginAdmin(@Body() dto: LoginAdminDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.loginAdmin(dto);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, COOKIE_OPTS);
    return { accessToken: tokens.accessToken };
  }

  @Post('funcionario')
  @HttpCode(200)
  async loginFuncionario(@Body() dto: LoginFuncionarioDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.loginFuncionario(dto);
    if ('primeiroAcesso' in result) return result;
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS);
    return { accessToken: result.accessToken };
  }

  @Post('funcionario/setup')
  @HttpCode(200)
  async setupFuncionario(@Body() dto: SetupSenhaFuncionarioDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.setupSenhaFuncionario(dto);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, COOKIE_OPTS);
    return { accessToken: tokens.accessToken };
  }

  @Post('morador')
  @HttpCode(200)
  async loginMorador(@Body() dto: LoginMoradorDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.loginMorador(dto);
    if ('primeiroAcesso' in result) return result;
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS);
    return { accessToken: result.accessToken };
  }

  @Post('morador/setup')
  @HttpCode(200)
  async setupMorador(@Body() dto: SetupSenhaMoradorDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.setupSenhaMorador(dto);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, COOKIE_OPTS);
    return { accessToken: tokens.accessToken };
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('Refresh token ausente');
    const payload = this.auth.verifyRefreshToken(token);
    const { accessToken, refreshToken } = this.auth.issueTokens(payload.sub, payload.role);
    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTS);
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_COOKIE);
    return { ok: true };
  }
}
