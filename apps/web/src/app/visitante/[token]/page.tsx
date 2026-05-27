'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { visitantes as visitantesApi } from '@/lib/api';
import { Camera, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TIPO_LABEL: Record<string, string> = {
  PERSONAL: 'Personal Trainer',
  FUNCIONARIO_TEMP: 'Funcionário Temporário',
};

export default function VisitantePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [estado, setEstado] = useState<'validando' | 'invalido' | 'ja_usado' | 'pronto' | 'concluido'>('validando');
  const [info, setInfo] = useState<{ nome: string; tipo: string; moradorNome: string; validoAte: string } | null>(null);

  // Captura
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturaEstado, setCapturaEstado] = useState<'idle' | 'capturando' | 'preview' | 'enviando' | 'erro'>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [usarInput, setUsarInput] = useState(false);
  const [capturaErro, setCapturaErro] = useState('');

  const pararStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => pararStream(), [pararStream]);

  useEffect(() => {
    visitantesApi.tokenInfo(token)
      .then((data) => {
        setInfo(data);
        setEstado('pronto');
      })
      .catch((err: Error) => {
        if (err.message?.includes('já registrada')) setEstado('ja_usado');
        else setEstado('invalido');
      });
  }, [token]);

  const abrirCamera = useCallback(async () => {
    setCapturaErro('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setCapturaEstado('capturando');
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err: any) {
      if (['NotAllowedError', 'NotFoundError', 'NotReadableError'].includes(err?.name)) {
        setUsarInput(true);
      } else {
        setCapturaErro(`Erro ao abrir câmera: ${err?.message ?? 'desconhecido'}`);
      }
    }
  }, []);

  const tirarFoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      pararStream();
      setPreviewBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setCapturaEstado('preview');
    }, 'image/jpeg', 0.92);
  }, [pararStream]);

  const refazer = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setCapturaEstado('idle');
  }, [previewUrl]);

  const enviar = useCallback(async () => {
    if (!previewBlob) return;
    setCapturaEstado('enviando');
    try {
      await visitantesApi.registrarFoto(token, previewBlob);
      setEstado('concluido');
    } catch (err: any) {
      setCapturaErro(err.message ?? 'Erro ao enviar foto');
      setCapturaEstado('erro');
    }
  }, [previewBlob, token]);

  const handleInputFoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCapturaEstado('preview');
  }, []);

  if (estado === 'validando') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Verificando link...</p>
      </div>
    );
  }

  if (estado === 'invalido') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-xl font-semibold text-destructive">Link inválido ou expirado</p>
          <p className="text-sm text-muted-foreground">Solicite um novo link ao morador.</p>
        </div>
      </div>
    );
  }

  if (estado === 'ja_usado') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-xl font-semibold">Foto já registrada</p>
          <p className="text-sm text-muted-foreground">Seu acesso facial já está cadastrado. Contate o morador se precisar atualizar.</p>
        </div>
      </div>
    );
  }

  if (estado === 'concluido') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-xl font-semibold">Foto registrada com sucesso!</p>
          <p className="text-sm text-muted-foreground">Seu acesso facial será ativado em breve.</p>
        </div>
      </div>
    );
  }

  const validoAteFormatado = info ? new Date(info.validoAte).toLocaleDateString('pt-BR') : '';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 space-y-6">
      <div className="text-center space-y-1">
        <p className="text-2xl font-bold">Olá, {info?.nome}!</p>
        <p className="text-muted-foreground">
          Você foi convidado como <strong>{TIPO_LABEL[info?.tipo ?? ''] ?? info?.tipo}</strong> por <strong>{info?.moradorNome}</strong>.
        </p>
        <p className="text-sm text-muted-foreground">Acesso válido até {validoAteFormatado}.</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <canvas ref={canvasRef} className="hidden" />

        {usarInput ? (
          <div className="space-y-3">
            {capturaEstado === 'preview' && previewUrl ? (
              <div className="space-y-3">
                <img src={previewUrl} alt="Preview" className="w-40 h-40 object-cover rounded-full mx-auto border-2" />
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={refazer}>Escolher outra</Button>
                  <Button onClick={enviar}>Usar esta foto</Button>
                </div>
              </div>
            ) : capturaEstado === 'enviando' ? (
              <p className="text-center text-muted-foreground">Enviando...</p>
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-dashed">
                  <Camera className="h-8 w-8 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">Selecionar foto</span>
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleInputFoto} />
              </label>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className={capturaEstado === 'capturando' ? 'flex flex-col items-center gap-3' : 'hidden'}>
              <div className="relative w-40 h-40 rounded-full overflow-hidden border-2 bg-black">
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline autoPlay />
              </div>
              <Button onClick={tirarFoto}><Camera className="h-4 w-4 mr-2" /> Tirar foto</Button>
            </div>

            {capturaEstado === 'idle' && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-40 h-40 rounded-full bg-muted flex items-center justify-center border-2 border-dashed">
                  <Camera className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-sm text-center text-muted-foreground">Tire uma foto do seu rosto para registrar seu acesso</p>
                <Button onClick={abrirCamera}>Abrir câmera</Button>
              </div>
            )}

            {capturaEstado === 'preview' && previewUrl && (
              <div className="flex flex-col items-center gap-3">
                <img src={previewUrl} alt="Preview" className="w-40 h-40 object-cover rounded-full border-2" />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={refazer}><RefreshCw className="h-4 w-4 mr-2" /> Tirar novamente</Button>
                  <Button onClick={enviar}><Check className="h-4 w-4 mr-2" /> Usar esta foto</Button>
                </div>
              </div>
            )}

            {capturaEstado === 'enviando' && (
              <p className="text-center text-muted-foreground">Enviando...</p>
            )}

            {capturaEstado === 'erro' && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-destructive">{capturaErro}</p>
                <Button variant="outline" onClick={refazer}>Tentar novamente</Button>
              </div>
            )}
          </div>
        )}

        {capturaErro && capturaEstado !== 'erro' && (
          <p className="text-sm text-destructive text-center">{capturaErro}</p>
        )}
      </div>
    </div>
  );
}
