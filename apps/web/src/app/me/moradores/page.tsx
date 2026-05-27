'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Camera, Plus, Clock, CheckCircle, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { moradores as moradoresApi, fotos as fotosApi, encomendas as encomendasApi } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { WhatsAppInput, formatWhatsApp, isWhatsAppValid } from '@/components/ui/whatsapp-input';

interface Morador {
  id: string;
  nome: string;
  whatsapp?: string;
  fotoUrl?: string;
  apartamento?: { numero: string };
}

interface Encomenda {
  id: string;
  descricao?: string;
  status: 'PENDENTE' | 'RETIRADA' | 'DEVOLVIDA';
  createdAt: string;
}

interface Reserva {
  id: string;
  dataInicio: string;
  dataFim: string;
  local: string;
  status: string;
}

interface NovaMoradorForm {
  nome: string;
  ddd: string;
  numero: string;
}

type EstadoFoto = 'idle' | 'capturando' | 'preview' | 'enviando' | 'sucesso' | 'erro';

export default function MoradoresPage() {
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);

  const [carouselIndex, setCarouselIndex] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<NovaMoradorForm>({ nome: '', ddd: '', numero: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Photo capture state
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [estadoFoto, setEstadoFoto] = useState<EstadoFoto>('idle');
  const [erroFoto, setErroFoto] = useState('');
  const [editingMoradorId, setEditingMoradorId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3001';
  const session = getSession();

  useEffect(() => {
    Promise.all([
      moradoresApi.meus().then(setMoradores).catch(() => setMoradores([])),
      encomendasApi.minhas().then(setEncomendas).catch(() => setEncomendas([])),
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/reservas/minhas`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` },
      }).then(r => r.ok ? r.json() : []).then(setReservas).catch(() => setReservas([])),
    ]).finally(() => setLoading(false));
  }, [session?.accessToken]);

  const pararStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => pararStream(), [pararStream]);

  const abrirCamera = useCallback(async () => {
    setErroFoto('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      streamRef.current = stream;
      setEstadoFoto('capturando');
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err: any) {
      setErroFoto(`Erro ao abrir câmera: ${err?.message ?? 'desconhecido'}`);
    }
  }, []);

  const tirarFoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        pararStream();
        setFotoBlob(blob);
        setFotoPreview(URL.createObjectURL(blob));
        setEstadoFoto('preview');
      },
      'image/jpeg',
      0.92,
    );
  }, [pararStream]);

  const refazerFoto = useCallback(() => {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoBlob(null);
    setFotoPreview(null);
    setEstadoFoto('idle');
  }, [fotoPreview]);

  const enviarFoto = useCallback(async (moradorId: string) => {
    if (!fotoBlob) return;
    setEstadoFoto('enviando');

    try {
      const formData = new FormData();
      formData.append('file', fotoBlob);

      const uploadResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/fotos/upload?moradorId=${moradorId}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.accessToken}` },
          body: formData,
        },
      );

      if (!uploadResponse.ok) throw new Error('Erro ao enviar foto');

      setMoradores(prev =>
        prev.map(m => (m.id === moradorId ? { ...m, fotoUrl: `/uploads/fotos/${moradorId}.jpg?t=${Date.now()}` } : m))
      );

      setEstadoFoto('sucesso');
      setTimeout(() => {
        setFotoBlob(null);
        setFotoPreview(null);
        setEstadoFoto('idle');
        setEditingMoradorId(null);
      }, 1500);
    } catch (err: any) {
      setErroFoto(err.message ?? 'Erro ao enviar foto');
      setEstadoFoto('erro');
    }
  }, [fotoBlob, session?.accessToken]);

  async function handleCriarMorador(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.nome.trim()) {
      setError('Nome é obrigatório');
      return;
    }

    if (!isWhatsAppValid(form.ddd, form.numero)) {
      setError('WhatsApp inválido');
      return;
    }

    if (!fotoBlob) {
      setError('Foto é obrigatória');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/moradores`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.accessToken}`,
          },
          body: JSON.stringify({
            nome: form.nome.trim(),
            whatsapp: formatWhatsApp(form.ddd, form.numero),
          }),
        },
      );

      if (!response.ok) throw new Error('Erro ao criar morador');

      const novoMorador: Morador = await response.json();

      // Upload photo
      if (fotoBlob) {
        const formData = new FormData();
        formData.append('file', fotoBlob);

        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/fotos/upload?moradorId=${novoMorador.id}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${session?.accessToken}` },
            body: formData,
          },
        );
      }

      setMoradores(prev => [...prev, { ...novoMorador, fotoUrl: `/uploads/fotos/${novoMorador.id}.jpg` }]);
      setForm({ nome: '', ddd: '', numero: '' });
      setFotoBlob(null);
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
      setFotoPreview(null);
      setEstadoFoto('idle');
      setShowAddForm(false);
    } catch (err: any) {
      setError(err.message ?? 'Erro ao criar morador');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p>Carregando...</p></div>;
  }

  const morador = moradores[carouselIndex];
  const pendentes = encomendas.filter(e => e.status === 'PENDENTE');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Carrossel Central */}
      <div className="lg:col-span-2 space-y-4">
        {editingMoradorId ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Editar Foto de {moradores.find(m => m.id === editingMoradorId)?.nome}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {estadoFoto === 'idle' && (
                <Button onClick={abrirCamera} className="w-full" variant="outline">
                  <Camera className="h-4 w-4 mr-2" />
                  Abrir Câmera
                </Button>
              )}

              {estadoFoto === 'capturando' && (
                <div className="space-y-4">
                  <video ref={videoRef} className="w-full rounded-lg bg-black" />
                  <Button onClick={tirarFoto} className="w-full">Tirar Foto</Button>
                </div>
              )}

              {estadoFoto === 'preview' && (
                <div className="space-y-4">
                  {fotoPreview && <img src={fotoPreview} alt="Preview" className="w-full rounded-lg" />}
                  <div className="flex gap-2">
                    <Button onClick={refazerFoto} variant="outline" className="flex-1">
                      Refazer
                    </Button>
                    <Button onClick={() => enviarFoto(editingMoradorId)} className="flex-1">
                      Confirmar
                    </Button>
                  </div>
                </div>
              )}

              {estadoFoto === 'enviando' && (
                <p className="text-center text-sm text-muted-foreground">Enviando foto...</p>
              )}

              {estadoFoto === 'sucesso' && (
                <p className="text-center text-sm text-green-600">✓ Foto enviada com sucesso!</p>
              )}

              {erroFoto && <p className="text-sm text-red-600">{erroFoto}</p>}

              <Button onClick={() => setEditingMoradorId(null)} variant="ghost" className="w-full">
                Cancelar
              </Button>
            </CardContent>
          </Card>
        ) : morador ? (
          <>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="aspect-square rounded-lg overflow-hidden bg-slate-100">
                  {morador.fotoUrl ? (
                    <img src={morador.fotoUrl} alt={morador.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      Sem foto
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold">{morador.nome}</h3>
                  {morador.whatsapp && <p className="text-sm text-muted-foreground">{morador.whatsapp}</p>}
                </div>

                <Button onClick={() => setEditingMoradorId(morador.id)} className="w-full" variant="outline">
                  <Camera className="h-4 w-4 mr-2" />
                  Editar Foto
                </Button>
              </CardContent>
            </Card>

            {/* Navegação */}
            <div className="flex gap-2 justify-between">
              <Button
                onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 1))}
                disabled={carouselIndex === 0}
                variant="outline"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="text-sm text-muted-foreground self-center">
                {carouselIndex + 1} de {moradores.length}
              </span>

              <Button
                onClick={() => setCarouselIndex(Math.min(moradores.length - 1, carouselIndex + 1))}
                disabled={carouselIndex === moradores.length - 1}
                variant="outline"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button onClick={() => setShowAddForm(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Morador
            </Button>
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Nenhum morador registrado</p>
              <Button onClick={() => setShowAddForm(true)} className="mt-4 w-full">
                Adicionar Morador
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Modal de novo morador */}
        {showAddForm && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Novo Morador</CardTitle>
              <button onClick={() => setShowAddForm(false)}>
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCriarMorador} className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Nome</label>
                  <Input
                    value={form.nome}
                    onChange={e => setForm({ ...form, nome: e.target.value })}
                    placeholder="Nome completo"
                  />
                </div>

                <WhatsAppInput
                  ddd={form.ddd}
                  numero={form.numero}
                  onChangeDDD={ddd => setForm({ ...form, ddd })}
                  onChangeNumero={numero => setForm({ ...form, numero })}
                />

                {/* Photo Capture */}
                {estadoFoto === 'idle' && (
                  <Button onClick={abrirCamera} type="button" className="w-full" variant="outline">
                    <Camera className="h-4 w-4 mr-2" />
                    Tirar Foto
                  </Button>
                )}

                {estadoFoto === 'capturando' && (
                  <div className="space-y-2">
                    <video ref={videoRef} className="w-full rounded-lg bg-black" />
                    <Button onClick={tirarFoto} type="button" className="w-full">
                      Capturar
                    </Button>
                  </div>
                )}

                {estadoFoto === 'preview' && fotoPreview && (
                  <div className="space-y-2">
                    <img src={fotoPreview} alt="Preview" className="w-full rounded-lg" />
                    <div className="flex gap-2">
                      <Button onClick={refazerFoto} type="button" variant="outline" className="flex-1">
                        Refazer
                      </Button>
                      <Button type="submit" className="flex-1" disabled={saving}>
                        {saving ? 'Salvando...' : 'Confirmar'}
                      </Button>
                    </div>
                  </div>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar: Encomendas e Reservas */}
      <div className="space-y-4">
        {/* Encomendas Pendentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-amber-600" />
              Encomendas Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma encomenda</p>
            ) : (
              <div className="space-y-2">
                {pendentes.map(enc => (
                  <div key={enc.id} className="p-2 bg-amber-50 rounded text-sm border border-amber-200">
                    <p className="font-medium">{enc.descricao || 'Sem descrição'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(enc.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximas Reservas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              Próximas Reservas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reservas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma reserva</p>
            ) : (
              <div className="space-y-2">
                {reservas.slice(0, 3).map(res => (
                  <div key={res.id} className="p-2 bg-blue-50 rounded text-sm border border-blue-200">
                    <p className="font-medium">{res.local}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(res.dataInicio).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
