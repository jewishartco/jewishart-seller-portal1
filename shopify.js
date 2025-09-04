import axios from 'axios';

const SHOP = process.env.SHOPIFY_SHOP;
const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const API_VERSION = process.env.API_VERSION || '2024-10';

if (!SHOP || !TOKEN) {
  console.warn('Missing SHOPIFY_SHOP or SHOPIFY_ADMIN_ACCESS_TOKEN');
}

function adminUrl(path) {
  return `https://${SHOP}/admin/api/${API_VERSION}${path}`;
}

export async function createDraftProduct({ vendorId, title, description = '', price, images = [], attributes = {} }) {
  const vendorTag = `vendor:${vendorId}`;
  const body = {
    product: {
      title,
      body_html: description,
      status: 'draft',
      tags: [vendorTag].join(','),
      vendor: `Seller ${vendorId}`,
      variants: [
        { price: String(price), inventory_management: null }
      ],
      images: images.map(img => ({ src: img.url })),
      metafields: [
        { namespace: 'seller', key: 'vendor_id', type: 'single_line_text_field', value: String(vendorId) },
        ...(attributes.dimensions ? [{ namespace: 'seller', key: 'dimensions', type: 'single_line_text_field', value: String(attributes.dimensions) }] : []),
        ...(attributes.medium ? [{ namespace: 'seller', key: 'medium', type: 'single_line_text_field', value: String(attributes.medium) }] : []),
        ...(attributes.year ? [{ namespace: 'seller', key: 'year', type: 'single_line_text_field', value: String(attributes.year) }] : []),
      ]
    }
  };
  const res = await axios.post(adminUrl('/products.json'), body, {
    headers: {
      'X-Shopify-Access-Token': TOKEN,
      'Content-Type': 'application/json'
    }
  });
  return res.data?.product;
}

export async function getOrdersForVendor(vendorId) {
  const ordersRes = await axios.get(adminUrl('/orders.json'), {
    headers: { 'X-Shopify-Access-Token': TOKEN },
    params: { status: 'any', limit: 100, fields: 'id,order_number,created_at,line_items,name' }
  });
  const orders = ordersRes.data?.orders || [];
  const productIds = new Set();
  for (const o of orders) for (const li of o.line_items || []) if (li.product_id) productIds.add(li.product_id);
  if (!productIds.size) return [];

  const ids = Array.from(productIds).slice(0, 250);
  const productsRes = await axios.get(adminUrl('/products.json'), {
    headers: { 'X-Shopify-Access-Token': TOKEN },
    params: { ids: ids.join(','), fields: 'id,title,tags,handle' }
  });
  const prodMap = new Map();
  for (const p of productsRes.data?.products || []) prodMap.set(p.id, p);

  const vendorTag = `vendor:${vendorId}`;
  const filtered = [];
  for (const o of orders) {
    const items = [];
    for (const li of o.line_items || []) {
      const p = prodMap.get(li.product_id);
      if (!p) continue;
      const tags = (p.tags || '').split(',').map(s => s.trim());
      if (tags.includes(vendorTag)) {
        items.push({ title: li.title, quantity: li.quantity, product_id: li.product_id, order_number: o.order_number || o.name });
      }
    }
    if (items.length) filtered.push({ order_number: o.order_number || o.name, created_at: o.created_at, items });
  }
  return filtered;
}
