'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Plus, X, CheckCircle, Clock, Trash2 } from 'lucide-react';
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

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<NovaMoradorForm>({ nome: '', ddd: '', numero: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    const canvas = canvasRef.current || document.createElement('canvas');
    if (!video) return;

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
        prev.map(m => (m.id === moradorId ? { ...m, fotoUrl: `/uploads/fotos/${moradorId}.jpg?t=${Date.now()}` } : m)),
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
    return <div className="flex items-center justify-center min-h-screen"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  return (
    <div className="p-4">
      {moradores.length === 0 ? (
        <p className="text-muted-foreground text-center">Nenhum morador registrado</p>
      ) : (
        <ul className="space-y-4">
          {moradores.map(morador => (
            <li key={morador.id} className="flex items-center gap-4 p-4 border rounded">
              <div className="w-16 h-16 rounded overflow-hidden bg-slate-100 flex items-center justify-center">
                {morador.fotoUrl ? (
                  <img src={`${apiBase}${morador.fotoUrl}`} alt={morador.nome} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-muted-foreground">Sem foto</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-medium">{morador.nome}</h3>
                {morador.whatsapp && <p className="text-sm text-muted-foreground">{morador.whatsapp}</p>}
              </div>
              <Button onClick={() => setEditingMoradorId(morador.id)} variant="outline" size="sm">
                <Camera className="h-4 w-4 mr-1" />Foto
              </Button>
              <Button onClick={() => excluirMorador(morador.id)} variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />Excluir
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button onClick={() => setShowAddForm(true)} className="w-full mt-4" size="sm">
        <Plus className="h-4 w-4 mr-1" />Adicionar Morador
      </Button>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
