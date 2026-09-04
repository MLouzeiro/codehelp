import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { getSignatureConfig, updateSignatureConfig, testSignatureUrl } from './os-signature-config.service';

export async function getSignatureConfigHandler(req: AuthRequest, res: Response) {
  try {
    const config = await getSignatureConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao buscar configuracao de endereco publico.' });
  }
}

export async function updateSignatureConfigHandler(req: AuthRequest, res: Response) {
  try {
    const { baseUrl, tipo } = req.body;

    if (!baseUrl || typeof baseUrl !== 'string') {
      return res.status(400).json({ error: 'Campo baseUrl e obrigatorio.' });
    }

    if (!tipo || typeof tipo !== 'string') {
      return res.status(400).json({ error: 'Campo tipo e obrigatorio.' });
    }

    const result = await updateSignatureConfig(
      { baseUrl, tipo: tipo as any },
      req.user!.id,
      req.user!.name,
    );

    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ ok: true, config: result.config, baseUrl: result.baseUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao salvar configuracao de endereco publico.' });
  }
}

export async function testSignatureUrlHandler(req: AuthRequest, res: Response) {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Campo url e obrigatorio.' });
    }

    const result = await testSignatureUrl(url);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao testar endereco.' });
  }
}
