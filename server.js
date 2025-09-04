import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import { createDraftProduct, getOrdersForVendor } from './src/lib/shopify.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '20mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const APP_PROXY_SUBPATH = process.env.APP_PROXY_SUBPATH || 'vendor-portal';
const VERIFY_PROXY = String(process.env.APP_PROXY_VERIFY || 'true').toLowerCase() === 'true';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
const cloudFolder = process.env.CLOUDINARY_FOLDER || '';

function verifyAppProxySignature(req, res, next) {
  if (!VERIFY_PROXY) return next();
  try {
    const secret = process.env.SHOPIFY_APP_SECRET;
    if (!secret) return res.status(500).send('Missing SHOPIFY_APP_SECRET');

    const url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
    const provided = url.searchParams.get('signature');
    if (!provided) return res.status(401).send('Missing signature');

    const qp = new URLSearchParams(url.searchParams);
    qp.delete('signature');
    const sorted = new URLSearchParams();
    [...qp.keys()].sort().forEach(k => sorted.append(k, qp.get(k)));
    const qs = sorted.toString();
    const path = url.pathname;
    const pathAndQuery = qs ? `${path}?${qs}` : path;

    const hmac = crypto.createHmac('sha256', secret).update(pathAndQuery).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(hmac, 'utf8'), Buffer.from(provided, 'utf8'))) {
      return next();
    }
    return res.status(401).send('Bad signature');
  } catch (e) {
    return res.status(401).send('Signature verification failed');
  }
}

app.get('/health', (_req, res) => res.json({ ok: true }));

const basePath = `/apps/${APP_PROXY_SUBPATH}`;

// Cloudinary config endpoint (no secrets; returns public info for unsigned uploads)
app.get(`${basePath}/presign`, verifyAppProxySignature, (req, res) => {
  if (!cloudName || !uploadPreset) {
    return res.status(500).json({ error: 'Cloudinary not configured' });
  }
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
  res.json({ uploadUrl, cloudName, uploadPreset, folder: cloudFolder });
});

// Submit product for review (create draft product with image URLs)
app.post(`${basePath}/submit`, verifyAppProxySignature, async (req, res) => {
  try {
    const payload = req.body || {};
    const { vendorId, title, description, price, images = [], attributes = {} } = payload;
    if (!vendorId || !title || !price) {
      return res.status(400).json({ error: 'vendorId, title, price are required' });
    }
    const result = await createDraftProduct({
      vendorId,
      title,
      description,
      price,
      images,
      attributes,
    });
    return res.json({ ok: true, productId: result?.id });
  } catch (e) {
    console.error('submit error', e?.response?.data || e);
    return res.status(500).json({ error: 'submit failed' });
  }
});

// Vendor orders (filtered by product tag vendor:<id>)
app.get(`${basePath}/my-orders`, verifyAppProxySignature, async (req, res) => {
  try {
    const vendorId = String(req.query.vendorId || '');
    if (!vendorId) return res.status(400).json({ error: 'vendorId required' });
    const orders = await getOrdersForVendor(vendorId);
    return res.json({ orders });
  } catch (e) {
    console.error('orders error', e?.response?.data || e);
    return res.status(500).json({ error: 'orders failed' });
  }
});

app.listen(PORT, () => console.log(`Seller portal app (Cloudinary) on ${PORT}`));
