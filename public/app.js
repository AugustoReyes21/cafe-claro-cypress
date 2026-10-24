const $ = selector => document.querySelector(selector);
const money = cents => `Q ${(cents / 100).toFixed(2)}`;
let products = [];
let cart = new Map();
let submitting = false;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function illustration(type) {
  const bread = '<path d="M13 60 Q7 25 30 39 Q42 16 54 32 Q76 20 77 42 Q105 35 90 67 L76 60 Q52 76 28 60Z" fill="#bd783d"/><path d="M30 39L28 60M54 32L48 66M77 42L69 64" stroke="#edb774" stroke-width="5"/><path d="M18 48L25 51M80 50L90 48" stroke="#f3d49c" stroke-width="4"/>';
  const drink = `<ellipse cx="49" cy="80" rx="40" ry="11" fill="#d1cbb5"/><path d="M74 38h10c18 0 16 26-3 26H74" fill="none" stroke="#fffaf0" stroke-width="8"/><path d="M18 34h59v29q-3 20-29 20T18 63Z" fill="#fffaf0"/><ellipse cx="47" cy="35" rx="30" ry="11" fill="#e6dcca"/><ellipse cx="47" cy="35" rx="26" ry="8" fill="${type === 'latte' ? '#b07d4e' : '#5d3928'}"/>${type === 'latte' ? '<path d="M35 34q12-14 24 0q-12 14-24 0" fill="#f1dfb5"/>' : ''}<path d="M40 18q-7-6 0-12M53 18q-7-6 0-12" fill="none" stroke="#b3b5a1" stroke-width="2" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 105 100" aria-hidden="true">${type === 'croissant' ? bread : drink}</svg>`;
}

async function loadProducts() {
  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error();
    products = await response.json();
    $('#catalog-error').hidden = true;
    $('#reload').hidden = true;
    renderProducts();
    return true;
  } catch {
    $('#catalog-error').textContent = 'No pudimos cargar el menú. Vuelve a intentarlo.';
    $('#catalog-error').hidden = false;
    $('#reload').hidden = false;
    if (!products.length) $('#products').innerHTML = '';
    return false;
  }
}

function renderProducts() {
  $('#products').innerHTML = products.map(p => `<article class="product-card" aria-label="${escapeHtml(p.name)}"><div class="product-art ${p.art}">${illustration(p.art)}</div><div class="product-info"><span class="category">${escapeHtml(p.category)}</span><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description)}</p><span class="stock ${p.stock ? '' : 'empty'}">${p.stock ? `${p.stock} disponibles` : 'Agotado por hoy'}</span><div class="product-bottom"><span class="price">${money(p.priceCents)}</span><button class="add-button" data-product="${p.id}" aria-label="Agregar ${escapeHtml(p.name)}" ${!p.stock || submitting ? 'disabled' : ''}>${p.stock ? 'Agregar +' : 'Agotado'}</button></div></div></article>`).join('');
}

function showError(message) {
  $('#cart-error').textContent = message;
  $('#cart-error').hidden = !message;
}

function renderCart() {
  const lines = [...cart.entries()].map(([id, quantity]) => ({ ...products.find(p => p.id === id), quantity }));
  $('#cart-items').innerHTML = lines.length ? lines.map(p => `<div class="cart-line"><div class="line-heading"><strong>${escapeHtml(p.name)}</strong><span>${money(p.priceCents * (Number(p.quantity) || 0))}</span></div><div class="line-controls"><label>Cantidad<input class="quantity" type="number" min="1" max="10" step="1" value="${escapeHtml(p.quantity)}" data-quantity="${p.id}" aria-label="Cantidad de ${escapeHtml(p.name)}" ${submitting ? 'disabled' : ''}></label><button class="remove" data-remove="${p.id}" aria-label="Quitar ${escapeHtml(p.name)}" ${submitting ? 'disabled' : ''}>Quitar</button></div></div>`).join('') : '<div class="empty-cart"><span aria-hidden="true">♧</span>Tu próxima pausa está en el menú.<br>Agrega algo que te guste.</div>';
  updateTotal();
  $('#checkout').disabled = submitting;
  $('#checkout').innerHTML = submitting ? 'Confirmando…' : 'Confirmar pedido <span aria-hidden="true">↗</span>';
}

function updateTotal() {
  let total = 0, count = 0;
  for (const [id, quantity] of cart) { const n = Number(quantity) || 0; total += products.find(p => p.id === id).priceCents * n; count += n; }
  $('#total').textContent = money(total);
  $('#cart-count').textContent = count;
}

function showOrder(order) {
  $('#confirmation').innerHTML = `<h2>¡Tu pedido está confirmado!</h2><p>Gracias por elegir Café Claro. Te esperamos para recogerlo.</p><p>Identificador: <code data-cy="order-id">${escapeHtml(order.id)}</code></p><p class="receipt-total">Total confirmado: <span data-cy="confirmed-total">${money(order.totalCents)}</span></p><a class="receipt-link" href="/?order=${encodeURIComponent(order.id)}">Consultar este pedido</a>`;
  $('#confirmation').hidden = false;
  $('#confirmation').focus();
}

$('#products').addEventListener('click', event => {
  const button = event.target.closest('[data-product]');
  if (!button || submitting) return;
  const p = products.find(p => p.id === button.dataset.product);
  const quantity = Number(cart.get(p.id) || 0) + 1;
  if (quantity > Math.min(10, p.stock)) return showError('No puedes agregar más unidades de este producto.');
  cart.set(p.id, quantity);
  showError('');
  $('#confirmation').hidden = true;
  history.replaceState(null, '', '/');
  renderCart();
});
$('#cart-items').addEventListener('input', event => {
  if (!event.target.matches('[data-quantity]') || submitting) return;
  cart.set(event.target.dataset.quantity, event.target.value);
  showError('');
  updateTotal();
});
$('#cart-items').addEventListener('change', event => {
  if (event.target.matches('[data-quantity]')) renderCart();
});
$('#cart-items').addEventListener('click', event => {
  const button = event.target.closest('[data-remove]');
  if (!button || submitting) return;
  cart.delete(button.dataset.remove);
  showError('');
  renderCart();
});
$('#reload').addEventListener('click', loadProducts);
$('#checkout').addEventListener('click', async () => {
  if (submitting) return;
  if (!cart.size) return showError('Tu pedido está vacío. Agrega al menos un producto.');
  const items = [...cart].map(([productId, quantity]) => ({ productId, quantity: Number(quantity) }));
  if (items.some(item => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10)) return showError('Usa cantidades enteras entre 1 y 10.');
  showError('');
  submitting = true;
  renderCart();
  renderProducts();
  try {
    const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
    const order = await response.json();
    if (!response.ok) {
      showError(order.message || 'No pudimos confirmar tu pedido. Inténtalo de nuevo.');
      if (response.status === 409) await loadProducts();
      return;
    }
    cart.clear();
    history.replaceState(null, '', `/?order=${encodeURIComponent(order.id)}`);
    showOrder(order);
    await loadProducts();
  } catch {
    showError('No pudimos conectar con la cafetería. Revisa tu conexión e inténtalo de nuevo.');
  } finally {
    submitting = false;
    renderCart();
    renderProducts();
  }
});

await loadProducts();
renderCart();
const orderId = new URLSearchParams(location.search).get('order');
if (orderId) {
  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`);
    if (!response.ok) throw new Error();
    showOrder(await response.json());
  } catch { showError('No pudimos recuperar el pedido. Revisa el identificador e inténtalo de nuevo.'); }
}
