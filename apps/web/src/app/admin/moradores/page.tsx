'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Trash2, RotateCcw, Plus, Camera, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { moradores as moradoresApi, apartamentos as apartamentosApi, fotos as fotosApi } from '@/lib/api';
import { parseApartamento } from '@/lib/parse-apartamento';

interface Morador {
  id: string;
  nome: string;
  whatsapp: string | null;
  fotoUrl: string | null;
  ativo: boolean;
  apartamento: { id: string; numero: string; bloco: string | null };
}

interface Apartamento {
  id: string;
  numero: string;
  bloco: string | null;
}

// ── Componente de captura de foto (para uso do admin, envia via endpoint admin) ──

function AdminFotoCaptura({
  pessoaId,
  tipo,
  onSuccess,
}: {
  pessoaId: string;
  tipo: 'MORADOR' | 'FUNCIONARIO';
  onSuccess: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [estado, setEstado] = useState<'idle' | 'capturando' | 'preview' | 'enviando' | 'sucesso' | 'erro'>('idle');
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setEstado('capturando');
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
        setErro(`Erro ao abrir câmera: ${err?.message ?? err?.name ?? 'desconhecido'}`);
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
      setEstado('preview');
    }, 'image/jpeg', 0.92);
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
      await fotosApi.uploadAdmin(previewBlob, pessoaId, tipo);
      setEstado('sucesso');
      onSuccess();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao enviar foto');
      setEstado('erro');
    }
  }, [previewBlob, pessoaId, tipo, onSuccess]);

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
            <img src={previewUrl} alt="Preview" className="w-40 h-40 object-cover rounded-full mx-auto border-2" />
            <div className="flex gap-2 justify-center">
              <Button type="button" variant="outline" onClick={refazer}>Escolher outra</Button>
              <Button type="button" onClick={enviar}>Usar esta foto</Button>
            </div>
          </div>
        ) : estado === 'enviando' ? (
          <p className="text-sm text-muted-foreground text-center">Enviando...</p>
        ) : estado === 'sucesso' ? (
          <p className="text-sm text-green-600 font-medium text-center">Foto salva!</p>
        ) : (
          <label className="cursor-pointer flex flex-col items-center gap-2">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-dashed">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">Selecionar foto</span>
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

      <div className={estado === 'capturando' ? 'flex flex-col items-center gap-3' : 'hidden'}>
        <div className="relative w-40 h-40 rounded-full overflow-hidden border-2 bg-black">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline autoPlay />
        </div>
        <Button type="button" onClick={tirarFoto}>
          <Camera className="h-4 w-4 mr-2" /> Tirar foto
        </Button>
      </div>

      {estado === 'idle' && (
        <div className="flex flex-col items-center gap-3">
          <div className="w-40 h-40 rounded-full bg-muted flex items-center justify-center border-2 border-dashed">
            <Camera className="h-10 w-10 text-muted-foreground" />
          </div>
          <Button type="button" onClick={abrirCamera}>Abrir câmera</Button>
        </div>
      )}

      {estado === 'preview' && previewUrl && (
        <div className="flex flex-col items-center gap-3">
          <img src={previewUrl} alt="Preview" className="w-40 h-40 object-cover rounded-full border-2" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={refazer}>
              <RefreshCw className="h-4 w-4 mr-2" /> Tirar novamente
            </Button>
            <Button type="button" onClick={enviar}>
              <Check className="h-4 w-4 mr-2" /> Usar esta foto
            </Button>
          </div>
        </div>
      )}

      {estado === 'enviando' && (
        <div className="flex flex-col items-center gap-3">
          {previewUrl && <img src={previewUrl} alt="Preview" className="w-40 h-40 object-cover rounded-full border-2 opacity-60" />}
          <p className="text-sm text-muted-foreground">Enviando...</p>
        </div>
      )}

      {estado === 'sucesso' && (
        <div className="flex flex-col items-center gap-3">
          {previewUrl && <img src={previewUrl} alt="Foto" className="w-40 h-40 object-cover rounded-full border-2 border-green-500" />}
          <p className="text-sm text-green-600 font-medium">Foto salva!</p>
        </div>
      )}

      {estado === 'erro' && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-destructive">{erro}</p>
          <Button type="button" variant="outline" onClick={refazer}>Tentar novamente</Button>
        </div>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function MoradoresPage() {
  const [lista, setLista] = useState<Morador[]>([]);
  const [apartamentos, setApartamentos] = useState<Apartamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [apartamentoId, setApartamentoId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [moradorCriado, setMoradorCriado] = useState<Morador | null>(null);
  const [etapa, setEtapa] = useState<'dados' | 'foto'>('dados');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const [m, a] = await Promise.all([moradoresApi.list(), apartamentosApi.list(true)]);
      setLista(m);
      setApartamentos(a);
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao carregar');
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function handleRemover(id: string, nomeMorador: string) {
    if (!confirm(`Remover morador "${nomeMorador}"?`)) return;
    setErro('');
    try {
      await moradoresApi.remove(id);
      await carregar();
    } catch (err: any) {
      setErro(err.message ?? 'Erro ao remover morador');
    }
  }

  function abrirModal() {
    setNome(''); setWhatsapp(''); setApartamentoId(''); setErroForm('');
    setMoradorCriado(null); setEtapa('dados');
    setModalAberto(true);
  }

  async function handleSalvarDados(e: React.FormEvent) {
    e.preventDefault();
    setErroForm('');
    setSalvando(true);
    try {
      const m = await moradoresApi.create({ nome, whatsapp: whatsapp || undefined, apartamentoId });
      setMoradorCriado(m);
      setEtapa('foto');
    } catch (err: any) {
      setErroForm(err.message ?? 'Erro ao salvar morador');
    } finally {
      setSalvando(false);
    }
  }

  const handleFotoSalva = useCallback(async () => {
    await carregar();
    setModalAberto(false);
  }, [carregar]);

  function formatApt(apt: { numero: string; bloco: string | null }) {
    return apt.bloco ? `${apt.bloco} - ${apt.numero}` : apt.numero;
  }

  const moradoresPorAndar = lista.reduce<Record<string, Morador[]>>((acc, m) => {
    const { floorNo } = parseApartamento(m.apartamento.numero);
    const key = floorNo > 0 ? `Andar ${floorNo}` : 'Sem andar';
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  const andares = Object.keys(moradoresPorAndar).sort((a, b) => {
    if (a === 'Sem andar') return 1;
    if (b === 'Sem andar') return -1;
    return parseInt(a.replace('Andar ', '')) - parseInt(b.replace('Andar ', ''));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Moradores</h1>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={abrirModal}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar morador
          </Button>
          <Button variant="ghost" size="icon" onClick={carregar} title="Atualizar">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!loading && erro && <p className="text-sm text-destructive">{erro}</p>}
      {!loading && !erro && lista.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum morador cadastrado.</p>
      )}

      {!loading && lista.length > 0 && (
        <div className="space-y-6">
          <span className="text-sm text-muted-foreground">
            {lista.length} {lista.length === 1 ? 'morador' : 'moradores'}
          </span>
          {andares.map((andar) => (
            <div key={andar} className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {andar} — {moradoresPorAndar[andar].length} {moradoresPorAndar[andar].length === 1 ? 'morador' : 'moradores'}
              </h3>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Nome</th>
                      <th className="text-left px-4 py-3 font-medium">Apartamento</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">WhatsApp</th>
                      <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Foto</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {moradoresPorAndar[andar]
                      .sort((a, b) => a.apartamento.numero.localeCompare(b.apartamento.numero, 'pt-BR', { numeric: true }))
                      .map((m) => (
                        <tr key={m.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium">{m.nome}</td>
                          <td className="px-4 py-3 text-muted-foreground">{formatApt(m.apartamento)}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{m.whatsapp ?? '—'}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            {m.fotoUrl ? (
                              <img
                                src={`http://localhost:3001${m.fotoUrl}`}
                                alt={m.nome}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-muted-foreground text-xs">Sem foto</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemover(m.id, m.nome)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal novo morador */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => { if (etapa === 'dados') setModalAberto(false); }}
          />
          <div className="relative bg-background rounded-xl border shadow-lg p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">

            {etapa === 'dados' && (
              <>
                <h2 className="text-lg font-semibold">Novo morador</h2>
                <form onSubmit={handleSalvarDados} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Nome</Label>
                    <Input
                      placeholder="Nome completo"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>WhatsApp (opcional)</Label>
                    <Input
                      placeholder="(11) 91234-5678"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Apartamento</Label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={apartamentoId}
                      onChange={(e) => setApartamentoId(e.target.value)}
                      required
                    >
                      <option value="">Selecione...</option>
                      {apartamentos.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.bloco ? `Bl. ${a.bloco} - ` : ''}{a.numero}
                        </option>
                      ))}
                    </select>
                  </div>
                  {erroForm && <p className="text-sm text-destructive">{erroForm}</p>}
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={salvando}>
                      {salvando ? 'Salvando...' : 'Próximo'}
                    </Button>
                  </div>
                </form>
              </>
            )}

            {etapa === 'foto' && moradorCriado && (
              <>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Camera className="h-5 w-5" /> Foto de {moradorCriado.nome}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Tire ou envie uma foto para o reconhecimento facial.
                  </p>
                </div>

                <AdminFotoCaptura
                  pessoaId={moradorCriado.id}
                  tipo="MORADOR"
                  onSuccess={handleFotoSalva}
                />

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={handleFotoSalva}
                >
                  Pular por enquanto
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
