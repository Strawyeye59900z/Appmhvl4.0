"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, X, Camera, CheckCircle, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { moradores as moradoresApi, fotos as fotosApi } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { WhatsAppInput, formatWhatsApp, isWhatsAppValid } from "@/components/ui/whatsapp-input";

interface Morador {
  id: string;
  nome: string;
  whatsapp?: string;
  apartamento?: { numero: string };
}

interface NovaMoradorForm {
  nome: string;
  ddd: string;
  numero: string;
}

type EstadoFoto = "idle" | "capturando" | "preview" | "enviando" | "sucesso" | "erro";

export default function MoradoresPage() {
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [moradorFotos, setMoradorFotos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<NovaMoradorForm>({ nome: "", ddd: "", numero: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  // Photo capture state
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [estadoFoto, setEstadoFoto] = useState<EstadoFoto>("idle");
  const [erroFoto, setErroFoto] = useState("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ?? "http://localhost:3001";

  useEffect(() => {
    moradoresApi.meus()
      .then(setMoradores)
      .catch(() => setMoradores([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const carregarFotosMoradores = async () => {
      const fotos: Record<string, string> = {};
      for (const morador of moradores) {
        try {
          const res = await fetch(`${apiBase}/uploads/fotos/${morador.id}.jpg`, { method: "HEAD" });
          if (res.ok) {
            fotos[morador.id] = `/uploads/fotos/${morador.id}.jpg`;
          }
        } catch {}
      }
      setMoradorFotos(fotos);
    };

    if (moradores.length > 0) {
      carregarFotosMoradores();
    }
  }, [moradores, apiBase]);

  const pararStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => pararStream(), [pararStream]);

  const abrirCamera = useCallback(async () => {
    setErroFoto("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      streamRef.current = stream;
      setEstadoFoto("capturando");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err: any) {
      setErroFoto(`Erro ao abrir câmera: ${err?.message ?? "desconhecido"}`);
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
    canvas.getContext("2d")!.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        pararStream();
        setFotoBlob(blob);
        setFotoPreview(URL.createObjectURL(blob));
        setEstadoFoto("preview");
      },
      "image/jpeg",
      0.92,
    );
  }, [pararStream]);

  const refazerFoto = useCallback(() => {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoBlob(null);
    setFotoPreview(null);
    setEstadoFoto("idle");
  }, [fotoPreview]);

  async function handleCriarMorador(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.nome.trim()) {
      setError("Nome é obrigatório");
      return;
    }

    if (!isWhatsAppValid(form.ddd, form.numero)) {
      setError("WhatsApp inválido. Preencha o DDD (2 dígitos) e o número (8 ou 9 dígitos).");
      return;
    }

    if (!fotoBlob) {
      setError("Foto é obrigatória");
      return;
    }

    setSaving(true);
    try {
      const session = getSession();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"}/moradores`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.accessToken}`,
          },
          body: JSON.stringify({
            nome: form.nome.trim(),
            whatsapp: formatWhatsApp(form.ddd, form.numero),
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message ?? "Erro ao criar morador");
      }

      const novoMorador: Morador = await response.json();

      // Upload photo with the NEW morador's ID
      if (fotoBlob) {
        try {
          const formData = new FormData();
          formData.append("file", fotoBlob);

          const uploadResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"}/fotos/upload?moradorId=${novoMorador.id}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session?.accessToken}`,
              },
              body: formData,
            },
          );

          if (!uploadResponse.ok) {
            console.error("Erro ao enviar foto, mas morador foi criado");
          }
        } catch (err) {
          console.error("Erro ao fazer upload da foto:", err);
        }
      }

      setMoradores((prev) => [...prev, novoMorador]);
      // Check if photo was uploaded and add to moradorFotos
      setMoradorFotos((prev) => ({
        ...prev,
        [novoMorador.id]: `/uploads/fotos/${novoMorador.id}.jpg`,
      }));
      setForm({ nome: "", ddd: "", numero: "" });
      setFotoBlob(null);
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
      setFotoPreview(null);
      setEstadoFoto("idle");
      setShowAddForm(false);
    } catch (err: any) {
      setError(err.message ?? "Erro ao criar morador");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Moradores</h1>
          <p className="text-sm text-muted-foreground">Gerencie os moradores do seu apartamento</p>
        </div>
        <Button
          onClick={() => {
            setShowAddForm(true);
            setError("");
            setEstadoFoto("idle");
            setFotoBlob(null);
            setFotoPreview(null);
          }}
          className="inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Adicionar Morador
        </Button>
      </div>

      {moradores.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Nenhum morador cadastrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {moradores.map((morador) => (
            <Card key={morador.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="relative bg-muted h-40 flex items-center justify-center overflow-hidden">
                  {moradorFotos[morador.id] ? (
                    <img
                      src={`${apiBase}${moradorFotos[morador.id]}`}
                      alt={morador.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Camera className="h-8 w-8 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Sem foto</p>
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-sm">{morador.nome}</h3>
                    {morador.apartamento && (
                      <p className="text-xs text-muted-foreground">Apto {morador.apartamento.numero}</p>
                    )}
                  </div>

                  {moradorFotos[morador.id] && (
                    <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 w-fit text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Foto registrada
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !saving && setShowAddForm(false)} />
          <div className="relative bg-background rounded-lg border shadow-lg p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Adicionar Morador</h2>
              {!saving && (
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <form onSubmit={handleCriarMorador} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nome completo *</label>
                <Input
                  placeholder="João Silva"
                  value={form.nome}
                  onChange={(e) => { setForm({ ...form, nome: e.target.value }); setError(""); }}
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">WhatsApp *</label>
                <WhatsAppInput
                  ddd={form.ddd}
                  numero={form.numero}
                  onDddChange={(ddd) => { setForm({ ...form, ddd }); setError(""); }}
                  onNumeroChange={(numero) => { setForm({ ...form, numero }); setError(""); }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Foto do rosto *</label>
                <p className="text-xs text-muted-foreground">Esta é uma etapa obrigatória para completar o registro.</p>
                
                <canvas ref={canvasRef} className="hidden" />

                {estadoFoto === "capturando" && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative w-48 h-48 rounded-full overflow-hidden border-2 bg-black">
                      <video
                        ref={videoRef}
                        className="absolute inset-0 w-full h-full object-cover"
                        muted
                        playsInline
                        autoPlay
                      />
                    </div>
                    <Button type="button" onClick={tirarFoto}>
                      <Camera className="h-4 w-4 mr-2" />
                      Tirar foto
                    </Button>
                  </div>
                )}

                {estadoFoto === "idle" && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-48 h-48 rounded-full bg-muted flex items-center justify-center border-2 border-dashed">
                      <Camera className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <Button type="button" onClick={abrirCamera} disabled={saving}>
                      Abrir câmera
                    </Button>
                  </div>
                )}

                {estadoFoto === "preview" && fotoPreview && (
                  <div className="flex flex-col items-center gap-3">
                    <img src={fotoPreview} alt="Preview" className="w-48 h-48 object-cover rounded-full border-2" />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={refazerFoto} disabled={saving}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Tirar novamente
                      </Button>
                    </div>
                  </div>
                )}

                {erroFoto && <p className="text-sm text-destructive text-center">{erroFoto}</p>}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !form.nome.trim() || !isWhatsAppValid(form.ddd, form.numero) || !fotoBlob}
                >
                  {saving ? "Salvando..." : "Adicionar Morador"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
