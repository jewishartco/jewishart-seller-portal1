(function(){
  const MAX_FILES = 5;
  const cfg = window.vendorPortalConfig || {};
  const vendorId = cfg.vendorId;
  const base = cfg.appProxyPath || '/apps/vendor-portal';

  const statusEl = document.getElementById('status');
  const fileInput = document.getElementById('files');
  const fileList = document.getElementById('fileList');
  const ordersEl = document.getElementById('orders');
  const form = document.getElementById('workForm');

  if (!form) return;

  let uploadedFiles = []; // {name,url}

  async function getCloudinaryConfig() {
    const res = await fetch(`${base}/presign`, { credentials:'include' });
    if (!res.ok) throw new Error('Cloudinary config failed');
    return res.json(); // { uploadUrl, cloudName, uploadPreset, folder }
  }

  async function cloudinaryUpload(file) {
    const cfg = await getCloudinaryConfig();
    const url = cfg.uploadUrl;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', cfg.uploadPreset);
    if (cfg.folder) fd.append('folder', cfg.folder);
    // Let Cloudinary auto-detect resource_type via /auto/upload
    const res = await fetch(url, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('upload failed');
    const data = await res.json();
    // Prefer secure_url
    return data.secure_url || data.url;
  }

  fileInput.addEventListener('change', async (e) => {
    statusEl.textContent = '';
    fileList.innerHTML = '';
    uploadedFiles = [];

    const files = Array.from(e.target.files).slice(0, MAX_FILES);
    for (const f of files) {
      try {
        const url = await cloudinaryUpload(f);
        uploadedFiles.push({ name: f.name, url });
        const li = document.createElement('li');
        li.textContent = f.name + ' ✓';
        fileList.appendChild(li);
      } catch (err) {
        statusEl.textContent = 'Upload error: ' + err.message;
        break;
      }
    }
    if (uploadedFiles.length) statusEl.textContent = uploadedFiles.length + ' file(s) uploaded.';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = 'Sending…';

    const data = {
      vendorId,
      title: e.target.title.value.trim(),
      description: e.target.description.value.trim(),
      price: e.target.price.value,
      images: uploadedFiles,
      attributes: {
        medium: e.target.medium.value.trim(),
        dimensions: e.target.dimensions.value.trim(),
        year: e.target.year.value.trim()
      }
    };

    const res = await fetch(`${base}/submit`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    if (res.ok) {
      statusEl.textContent = 'Submitted for review!';
      e.target.reset();
      fileList.innerHTML = '';
      uploadedFiles = [];
      await loadOrders();
    } else {
      const msg = await res.text();
      statusEl.textContent = 'Error: ' + msg;
    }
  });

  async function loadOrders() {
    ordersEl.innerHTML = 'Loading orders…';
    const url = `${base}/my-orders?vendorId=${encodeURIComponent(vendorId)}`;
    const res = await fetch(url, { credentials:'include' });
    if (!res.ok) { ordersEl.textContent = 'Could not load orders'; return; }
    const data = await res.json();
    const orders = data.orders || [];
    if (!orders.length) { ordersEl.textContent = 'No orders yet.'; return; }

    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Order</th><th>Date</th><th>Items</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const o of orders) {
      const tr = document.createElement('tr');
      const items = o.items.map(i => `${i.title} × ${i.quantity}`).join(', ');
      tr.innerHTML = `<td>#${o.order_number}</td><td>${new Date(o.created_at).toLocaleString()}</td><td>${items}</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    ordersEl.innerHTML = '';
    ordersEl.appendChild(table);
  }

  loadOrders().catch(()=>{});
})();
