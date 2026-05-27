'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Package, Clock, CheckCircle, RotateCcw, CalendarDays, Camera, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { encomendas as encomendasApi, fotos as fotosApi, moradores as moradoresApi, reservas as reservasApi } from '@/lib/api';
import { getSession } from '@/lib/auth';

interface Morador {
  id: string;
  nome: string;
  fotoUrl?: string;
}

interface Encomenda {
  id: string;
  descricao: string | null;
  status: 'PENDENTE' | 'RETIRADA' | 'DEVOLVIDA';
  createdAt: string;
  retiradoEm: string | null;
  morador: { id: string; nome: string };
  funcionario: { id: string; nome: string };
}

interface Reserva {
  id: string;
  data: string;
  horaInicio: string | null;
  horaFim: string | null;
  observacao: string | null;
  espacoReserva: { id: string; nome: string; tipo: string };
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'PENDENTE') return <Clock className="h-5 w-5 text-amber-500" />;
  if (status === 'RETIRADA') return <CheckCircle className="h-5 w-5 text-green-500" />;
  return <RotateCcw className="h-5 w-5 text-muted-foreground" />;
}

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Aguardando retirada',
  RETIRADA: 'Retirada',
  DEVOLVIDA: 'Devolvida',
};

export default function MePage() {
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrossel de moradores
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [editandoFotoMorador, setEditandoFotoMorador] = useState<string | null>(null);
  const [fotoCapturaMorador, setFotoCapturaMorador] = useState<Blob | null>(null);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const videoCarouselRef = useRef<HTMLVideoElement>(null);
  const canvasCarouselRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    Promise.all([
      moradoresApi.meus().then(setMoradores).catch(() => setMoradores([])),
      encomendasApi.minhas().then(setEncomendas).catch(() => setEncomendas([])),
      reservasApi.minhas().then(setReservas).catch(() => setReservas([])),
    ]).finally(() => setLoading(false));
  }, []);

  const pararStreamMorador = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraAtiva(false);
  }, []);

  const abrirCameraMorador = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setCameraAtiva(true);
      requestAnimationFrame(() => {
        if (videoCarouselRef.current) {
          videoCarouselRef.current.srcObject = stream;
          videoCarouselRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      console.error('Erro ao abrir câmera:', err);
    }
  }, []);

  const tirarFotoMorador = useCallback(() => {
    const video = videoCarouselRef.current;
    const canvas = canvasCarouselRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        pararStreamMorador();
        setFotoCapturaMorador(blob);
      },
      'image/jpeg',
      0.92,
    );
  }, [pararStreamMorador]);

  const confirmarFotoMorador = useCallback(async () => {
    if (!editandoFotoMorador || !fotoCapturaMorador) return;

    try {
      const formData = new FormData();
      formData.append('file', fotoCapturaMorador);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/fotos/upload?moradorId=${editandoFotoMorador}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${getSession()?.accessToken}` },
          body: formData,
        },
      );

      if (res.ok) {
        setMoradores(prev =>
          prev.map(m =>
            m.id === editandoFotoMorador
              ? { ...m, fotoUrl: `/uploads/fotos/${editandoFotoMorador}.jpg?t=${Date.now()}` }
              : m,
          ),
        );
        setEditandoFotoMorador(null);
        setFotoCapturaMorador(null);
      }
    } catch (err) {
      console.error('Erro ao enviar foto:', err);
    }
  }, [editandoFotoMorador, fotoCapturaMorador]);

  const pendentes = encomendas.filter((e) => e.status === 'PENDENTE');
  const historico = encomendas.filter((e) => e.status !== 'PENDENTE');

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const proximasReservas = reservas.filter((r) => new Date(r.data) >= hoje);

  function formatData(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function formatDataReserva(iso: string) {
    return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC', dateStyle: 'short' });
  }

  function formatHora(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toISOString().substring(11, 16);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/10">
        <p className="text-muted-foreground animate-pulse">Carregando painel...</p>
      </div>
    );
  }

  const moradorAtual = moradores[carouselIndex];
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3001';

  return (
    <div className="min-h-screen bg-muted/10 p-4 lg:p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Coluna Central/Esquerda (Carrossel de Moradores) */}
        <div className="lg:col-span-2 flex flex-col justify-start space-y-6">
          <div className="flex items-center justify-between pb-2 border-b">
            <h1 className="text-2xl font-bold tracking-tight">Moradores do Apartamento</h1>
            <Link href="/me/moradores">
              <Button variant="outline" size="sm">
                Gerenciar Moradores
              </Button>
            </Link>
          </div>

          {!editandoFotoMorador && moradores.length > 0 && (
            <Card className="overflow-hidden border-2 shadow-md">
              <CardContent className="p-6 space-y-6">
                <div className="relative aspect-square max-w-md mx-auto rounded-xl overflow-hidden bg-slate-100 border shadow-inner group">
                  {moradorAtual?.fotoUrl ? (
                    <img
                      src={`${apiBase}${moradorAtual.fotoUrl}`}
                      alt={moradorAtual.nome}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <Camera className="h-16 w-16 stroke-1 text-muted-foreground/60 animate-pulse" />
                      <span className="text-sm font-medium">Sem foto facial cadastrada</span>
                    </div>
                  )}
                </div>

                <div className="space-y-4 max-w-md mx-auto">
                  <div className="text-center">
                    <h3 className="text-xl font-bold tracking-tight text-foreground">{moradorAtual?.nome}</h3>
                    <p className="text-sm text-muted-foreground mt-1">Acesso facial ativo</p>
                  </div>
                  
                  <Button
                    onClick={() => {
                      setEditandoFotoMorador(moradorAtual?.id || null);
                      abrirCameraMorador();
                    }}
                    className="w-full"
                    variant="outline"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Atualizar Foto Facial
                  </Button>
                </div>

                {moradores.length > 1 && (
                  <div className="flex gap-4 justify-between items-center max-w-md mx-auto pt-2 border-t">
                    <Button
                      onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 1))}
                      disabled={carouselIndex === 0}
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>

                    <span className="text-sm font-semibold text-muted-foreground">
                      {carouselIndex + 1} de {moradores.length}
                    </span>

                    <Button
                      onClick={() => setCarouselIndex(Math.min(moradores.length - 1, carouselIndex + 1))}
                      disabled={carouselIndex === moradores.length - 1}
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Edição de Foto do Morador */}
          {editandoFotoMorador && (
            <Card className="border-2 shadow-md max-w-md mx-auto w-full">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Atualizar Foto Facial</CardTitle>
                <CardDescription>Tire uma foto nítida e bem iluminada para o reconhecimento facial</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!fotoCapturaMorador ? (
                  <div className="space-y-4">
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-black border">
                      <video
                        ref={videoCarouselRef}
                        className="w-full h-full object-cover scale-x-[-1]"
                        style={{ display: streamRef.current ? 'block' : 'none' }}
                      />
                      {!streamRef.current && (
                        <div className="w-full h-full flex items-center justify-center">
                          <Button onClick={abrirCameraMorador} className="px-6">
                            <Camera className="h-4 w-4 mr-2" />
                            Ativar Câmera
                          </Button>
                        </div>
                      )}
                    </div>
                    {streamRef.current && (
                      <Button onClick={tirarFotoMorador} className="w-full py-6 text-base font-semibold" size="lg">
                        Tirar Foto
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 border">
                      <img
                        src={URL.createObjectURL(fotoCapturaMorador)}
                        alt="Preview da foto tirada"
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => {
                          setFotoCapturaMorador(null);
                          abrirCameraMorador();
                        }}
                        variant="outline"
                        className="flex-1"
                      >
                        Tirar outra
                      </Button>
                      <Button onClick={confirmarFotoMorador} className="flex-1">
                        Salvar Foto
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => {
                    setEditandoFotoMorador(null);
                    setFotoCapturaMorador(null);
                    pararStreamMorador();
                  }}
                  variant="ghost"
                  className="w-full"
                >
                  Cancelar
                </Button>
              </CardContent>
            </Card>
          )}

          {moradores.length === 0 && (
            <Card className="border-dashed border-2 py-12 text-center">
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">Nenhum morador cadastrado neste apartamento.</p>
                <Link href="/me/moradores">
                  <Button>Cadastrar Primeiro Morador</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna Lateral Direita (Reservas e Encomendas) */}
        <div className="space-y-6">
          
          {/* Próximas Reservas */}
          <Card className="shadow-sm border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary stroke-[2]" />
                Próximas Reservas
              </CardTitle>
              <Link href="/me/reservas">
                <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80 px-2">
                  Ver todas <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {proximasReservas.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma reserva futura agendada.
                </div>
              ) : (
                <div className="space-y-3">
                  {proximasReservas.slice(0, 4).map((res) => {
                    const horaInicio = formatHora(res.horaInicio);
                    const horaFim = formatHora(res.horaFim);
                    return (
                      <div key={res.id} className="p-3 bg-muted/40 rounded-lg border flex flex-col gap-1 hover:bg-muted/65 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-foreground">{res.espacoReserva.nome}</span>
                          <Badge variant="outline" className="text-[10px] py-0.5 px-1.5 uppercase font-bold shrink-0">
                            {res.espacoReserva.tipo === 'DIARIO' ? 'Diário' : 'Por hora'}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDataReserva(res.data)}
                          {horaInicio && ` · ${horaInicio} às ${horaFim}`}
                        </span>
                        {res.observacao && (
                          <span className="text-xs text-muted-foreground/80 italic mt-0.5 truncate">
                            "{res.observacao}"
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Encomendas */}
          <Card className="shadow-sm border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary stroke-[2]" />
                Encomendas
              </CardTitle>
              {pendentes.length > 0 && (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-2 py-0.5 text-xs animate-bounce">
                  {pendentes.length} pendente{pendentes.length > 1 ? 's' : ''}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              
              {/* Pendentes */}
              {pendentes.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block">
                    Aguardando Retirada
                  </span>
                  {pendentes.map((enc) => (
                    <div key={enc.id} className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 flex items-start gap-3">
                      <StatusIcon status={enc.status} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-amber-950 dark:text-amber-300 truncate">
                          {enc.morador.nome}
                        </p>
                        {enc.descricao && (
                          <p className="text-xs text-amber-900/80 dark:text-amber-400 mt-0.5 truncate">{enc.descricao}</p>
                        )}
                        <p className="text-[10px] text-amber-800/70 dark:text-amber-500 mt-1 font-medium">
                          Recebida em {formatData(enc.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Histórico Recente */}
              {historico.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    Retiradas Recentemente
                  </span>
                  {historico.slice(0, 3).map((enc) => (
                    <div key={enc.id} className="p-3 bg-muted/40 rounded-lg border flex items-start gap-3 hover:bg-muted/65 transition-colors">
                      <StatusIcon status={enc.status} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {enc.morador.nome}
                        </p>
                        {enc.descricao && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{enc.descricao}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/80 mt-1">
                          {enc.retiradoEm
                            ? `Retirada em ${formatData(enc.retiradoEm)}`
                            : `Recebida em ${formatData(enc.createdAt)}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {encomendas.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma encomenda registrada.
                </div>
              )}

            </CardContent>
          </Card>

        </div>

      </div>
      <canvas ref={canvasCarouselRef} className="hidden" />
    </div>
  );
}
