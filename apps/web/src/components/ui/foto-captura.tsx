'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fotos as fotosApi } from '@/lib/api';

type Estado = 'idle' | 'capturando' | 'preview' | 'enviando' | 'sucesso' | 'erro';

interface FotoCapturaProps {
  onSuccess: (fotoUrl: string) => void;
  label?: string;
}

export function FotoCaptura({ onSuccess, label = 'Tirar foto' }: FotoCapturaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [estado, setEstado] = useState<Estado>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [erro, setErro] = useState('');
  const [usarInput, setUsarInput] = useState(false);

  const pararStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => pararStream(), [pararStream]);

  const abrirCamera = useCallback(async () => {
    setErro('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setEstado('capturando');
    } catch {
      setUsarInput(true);
    }
  }, []);

  const tirarFoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        pararStream();
        setPreviewBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setEstado('preview');
      },
      'image/jpeg',
      0.92,
    );
  }, [pararStream]);

  const refazer = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setEstado('idle');
  }, [previewUrl]);

  const enviar = useCallback(async () => {
    if (!previewBlob) return;
    setEstado('enviando');
    try {
      const { fotoUrl } = await fotosApi.upload(previewBlob);
      setEstado('sucesso');
      onSuccess(fotoUrl);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao enviar foto');
      setEstado('erro');
    }
  }, [previewBlob, onSuccess]);

  const handleInputFoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
    setEstado('preview');
  }, []);

  if (usarInput) {
    return (
      <div className="space-y-3">
        {estado === 'preview' && previewUrl ? (
          <div className="space-y-3">
            <img src={previewUrl} alt="Preview" className="w-48 h-48 object-cover rounded-full mx-auto border-2" />
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={refazer}>Escolher outra</Button>
              <Button onClick={enviar}>
                Usar esta foto
              </Button>
            </div>
          </div>
        ) : (
          <label className="cursor-pointer flex flex-col items-center gap-2">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-dashed">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">{label}</span>
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleInputFoto} />
          </label>
        )}
        {erro && <p className="text-sm text-destructive text-center">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />

      {estado === 'idle' && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-48 h-48 rounded-full bg-muted flex items-center justify-center border-2 border-dashed">
            <Camera className="h-12 w-12 text-muted-foreground" />
          </div>
          <Button onClick={abrirCamera}>{label}</Button>
        </div>
      )}

      {estado === 'capturando' && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-48 h-48 rounded-full overflow-hidden border-2">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
          </div>
          <Button onClick={tirarFoto}>
            <Camera className="h-4 w-4 mr-2" />
            Tirar foto
          </Button>
        </div>
      )}

      {estado === 'preview' && previewUrl && (
        <div className="flex flex-col items-center gap-3">
          <img src={previewUrl} alt="Preview" className="w-48 h-48 object-cover rounded-full border-2" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={refazer}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tirar novamente
            </Button>
            <Button onClick={enviar}>
              <Check className="h-4 w-4 mr-2" />
              Usar esta foto
            </Button>
          </div>
        </div>
      )}

      {estado === 'enviando' && (
        <div className="flex flex-col items-center gap-3">
          {previewUrl && <img src={previewUrl} alt="Preview" className="w-48 h-48 object-cover rounded-full border-2 opacity-60" />}
          <p className="text-sm text-muted-foreground">Enviando...</p>
        </div>
      )}

      {estado === 'sucesso' && (
        <div className="flex flex-col items-center gap-3">
          {previewUrl && <img src={previewUrl} alt="Foto salva" className="w-48 h-48 object-cover rounded-full border-2 border-green-500" />}
          <p className="text-sm text-green-600 font-medium">Foto salva com sucesso!</p>
        </div>
      )}

      {estado === 'erro' && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-destructive">{erro}</p>
          <Button variant="outline" onClick={refazer}>Tentar novamente</Button>
        </div>
      )}
    </div>
  );
}
