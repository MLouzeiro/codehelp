import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function SignPage() {
  const { token } = useParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [form, setForm] = useState({ assinanteNome: '', assinanteCpf: '', assinanteCargo: '' });

  useEffect(() => {
    loadSignature();
  }, [token]);

  const loadSignature = async () => {
    try {
      const { data: res } = await axios.get(`/api/orders/sign/${token}`);
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar dados da assinatura');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    let drawing = false;
    let lastX = 0, lastY = 0;

    const start = (e: any) => {
      drawing = true;
      const rect = canvas.getBoundingClientRect();
      lastX = (e.clientX || e.touches[0].clientX) - rect.left;
      lastY = (e.clientY || e.touches[0].clientY) - rect.top;
    };

    const draw = (e: any) => {
      if (!drawing) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX || e.touches[0].clientX) - rect.left;
      const y = (e.clientY || e.touches[0].clientY) - rect.top;

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();

      lastX = x;
      lastY = y;
    };

    const stop = () => { drawing = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stop);
    canvas.addEventListener('mouseleave', stop);
    canvas.addEventListener('touchstart', start);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stop);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stop);
      canvas.removeEventListener('mouseleave', stop);
    };
  }, [data]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const getSignatureBase64 = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imageData.data.some((pixel) => pixel !== 0);
    if (!hasContent) return null;

    return canvas.toDataURL('image/png');
  };

  const submitSignature = async () => {
    if (!form.assinanteNome || !form.assinanteCpf || !form.assinanteCargo) {
      alert('Preencha todos os campos');
      return;
    }

    const assinaturaBase64 = getSignatureBase64();
    if (!assinaturaBase64) {
      alert('Desenhe sua assinatura no campo acima');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`/api/orders/sign/${token}`, {
        ...form,
        assinaturaBase64,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao processar assinatura');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-codemed-50 to-green-50">
        <Loader size={32} className="animate-spin text-green-600" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-codemed-50 to-green-50 p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-md text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link Inválido</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-codemed-50 to-green-50 p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-md text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">OS Assinada com Sucesso!</h2>
          <p className="text-gray-500">A Ordem de Serviço {data?.order?.numeroOs} foi assinada eletronicamente.</p>
          <p className="text-sm text-gray-400 mt-4">Você receberá uma cópia por email.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-codemed-50 to-green-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Assinatura de Ordem de Serviço</h1>
          <p className="text-gray-500">Codemed — Desenvolvimento de Software Laboratorial</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Resumo da OS</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-gray-500">Número</p><p className="font-medium">{data?.order?.numeroOs}</p></div>
            <div><p className="text-gray-500">Tipo de Serviço</p><p className="font-medium">{data?.order?.tipoServico}</p></div>
            <div className="col-span-2"><p className="text-gray-500">Cliente</p><p className="font-medium">{data?.client?.razaoSocial}</p></div>
            {data?.order?.valorServico && <div><p className="text-gray-500">Valor</p><p className="font-medium">R$ {data.order.valorServico}</p></div>}
            <div><p className="text-gray-500">Técnico</p><p className="font-medium">{data?.tecnico}</p></div>
          </div>
          {data?.order?.descricaoServico && (
            <div><p className="text-xs text-gray-500">Descrição</p><p className="text-sm text-gray-700 bg-gray-50 p-2 rounded mt-1">{data.order.descricaoServico}</p></div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Dados do Assinante</h2>
          <div className="space-y-3">
            <input type="text" placeholder="Nome completo" value={form.assinanteNome}
              onChange={(e) => setForm({ ...form, assinanteNome: e.target.value })} className="input" />
            <input type="text" placeholder="CPF" value={form.assinanteCpf}
              onChange={(e) => setForm({ ...form, assinanteCpf: e.target.value })} className="input" />
            <input type="text" placeholder="Cargo / Função" value={form.assinanteCargo}
              onChange={(e) => setForm({ ...form, assinanteCargo: e.target.value })} className="input" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Assinatura</h2>
            <button onClick={clearCanvas} className="text-sm text-gray-500 hover:text-gray-700">Limpar</button>
          </div>
          <canvas ref={canvasRef} width={500} height={150}
            className="w-full border-2 border-gray-300 rounded-lg bg-white cursor-crosshair"
            style={{ touchAction: 'none' }} />
          <p className="text-xs text-gray-400">Desenhe sua assinatura no campo acima usando o mouse ou touch</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

        <button onClick={submitSignature} disabled={loading}
          className="btn-primary w-full py-3 text-lg">
          {loading ? 'Processando...' : 'Assinar OS'}
        </button>

        <p className="text-center text-xs text-gray-400">
          Ao assinar, você concorda com os termos do serviço. Esta assinatura tem validade jurídica.
        </p>
      </div>
    </div>
  );
}
