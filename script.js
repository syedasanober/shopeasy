// ShopEasy: paginated products, search, category filters, persistent cart and demo checkout.
const API_URL = "http://localhost:8080/api/products";
const CART_KEY = "shopeasy-cart";
const ORDERS_KEY = "shopeasy-orders";
const productList = document.getElementById("product-list");
const searchInput = document.getElementById("search-input");
const resultCount = document.getElementById("result-count");
const categoryList = document.getElementById("category-list");
const cartCount = document.getElementById("cart-count");
const overlay = document.getElementById("overlay");
const cartPanel = document.getElementById("cart-panel");
const checkoutModal = document.getElementById("checkout-modal");
const ordersModal = document.getElementById("orders-modal");
let allProducts = [];
let activeCategory = "All";
let toastTimer;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? "₹" + n.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2}) : "Price unavailable";
}
function getImageURL(product) {
  const name = String(product.name || "").toLowerCase();
  // The current database row uses a placeholder for these headphones; use a product photo instead.
  if (name.includes("wireless headphone") || name === "headphones") return "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=85";
  const url = typeof product.imageUrl === "string" ? product.imageUrl.trim() : "";
  return /^https?:\/\//i.test(url) ? url : "https://placehold.co/500x400/f7f7fa/667085?text=ShopEasy";
}
function getCart() {
  try { const value = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function saveCart(cart) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); renderCart(); }
function getOrders() {
  try { const value = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}
async function loadProducts() {
  productList.innerHTML = '<p class="status-message">Loading products…</p>';
  try {
    const firstResponse = await fetch(`${API_URL}?page=0&size=24`);
    if (!firstResponse.ok) throw new Error(`Server error: ${firstResponse.status}`);
    const firstData = await firstResponse.json();
    if (Array.isArray(firstData)) allProducts = firstData;
    else if (Array.isArray(firstData.content)) {
      allProducts = [...firstData.content];
      const totalPages = Number(firstData.totalPages) || 1;
      for (let page=1; page<totalPages; page++) {
        const response = await fetch(`${API_URL}?page=${page}&size=24`);
        if (!response.ok) throw new Error(`Unable to load product page ${page}`);
        const data = await response.json();
        if (Array.isArray(data.content)) allProducts.push(...data.content);
      }
    } else if (Array.isArray(firstData.products)) allProducts = firstData.products;
    else throw new Error("Products were not found in the API response.");
    buildCategories(); renderProducts();
  } catch (error) {
    console.error("ShopEasy product loading error:", error);
    productList.innerHTML = '<p class="status-message">Could not load products. Make sure the Java backend is running on port 8080, then refresh.</p>';
    resultCount.textContent = "Products unavailable";
  }
}
function buildCategories() {
  const categories = [...new Set(allProducts.map(p => String(p.category || "Other").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  categoryList.innerHTML = categories.map(category=>`<button class="category-chip" type="button" data-category="${escapeHTML(category)}">${escapeHTML(category)}</button>`).join("");
}
function filteredProducts() {
  const q = searchInput.value.trim().toLowerCase();
  return allProducts.filter(p => {
    const category = String(p.category || "Other");
    return (activeCategory === "All" || category.toLowerCase() === activeCategory.toLowerCase()) &&
      [p.name,p.brand,p.category,p.description].join(" ").toLowerCase().includes(q);
  });
}
function renderProducts() {
  const products = filteredProducts();
  resultCount.textContent = `${products.length} product${products.length===1?"":"s"}`;
  document.getElementById("empty-search").classList.toggle("hidden", products.length>0);
  productList.classList.toggle("hidden", products.length===0);
  document.querySelectorAll(".category-chip").forEach(b=>b.classList.toggle("active",b.dataset.category.toLowerCase()===activeCategory.toLowerCase()));
  productList.innerHTML = products.map(p => {
    const id = Number(p.id), name = escapeHTML(p.name || "Unnamed Product");
    const image = escapeHTML(getImageURL(p)), category = escapeHTML(p.category || "Other");
    const description = escapeHTML(p.description || "Everyday product from ShopEasy.");
    const rating = Number(p.rating);
    return `<article class="product-card">
      <div class="product-image-wrap"><img class="product-image" src="${image}" alt="${name}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/500x400/f7f7fa/667085?text=Image+unavailable';"></div>
      <div class="product-details"><p class="product-category">${category}</p><h3>${name}</h3>
      <p class="product-description">${description}</p><p class="product-rating">${Number.isFinite(rating)&&rating>0?`★ ${rating.toFixed(1)} / 5`:"ShopEasy pick"}</p>
      <div class="product-bottom"><p class="product-price">${money(p.price)}</p><button class="add-to-cart-btn" type="button" data-add-id="${id}">Add to Cart</button></div></div></article>`;
  }).join("");
}
function addToCart(productId) {
  const product = allProducts.find(p=>Number(p.id)===Number(productId));
  if (!product) { showToast("Sorry, this product could not be found."); return; }
  const cart = getCart(), existing = cart.find(p=>Number(p.id)===Number(productId));
  if (existing) existing.quantity = Math.min(99,(Number(existing.quantity)||1)+1);
  else cart.push({id:Number(product.id),name:product.name||"Product",price:Number(product.price)||0,imageUrl:getImageURL(product),category:product.category||"",quantity:1});
  saveCart(cart); showToast(`${product.name||"Product"} added to your cart`);
}
function changeQuantity(id, delta) {
  const cart=getCart(), item=cart.find(p=>Number(p.id)===Number(id));
  if (!item) return; item.quantity=(Number(item.quantity)||1)+delta; saveCart(cart.filter(p=>p.quantity>0));
}
function removeFromCart(id) { saveCart(getCart().filter(p=>Number(p.id)!==Number(id))); showToast("Item removed from cart"); }
function renderCart() {
  const cart=getCart(), count=cart.reduce((s,p)=>s+(Number(p.quantity)||1),0);
  cartCount.textContent=count; document.getElementById("panel-cart-count").textContent=`(${count})`;
  document.getElementById("cart-subtotal").textContent=money(cart.reduce((s,p)=>s+(Number(p.price)||0)*(Number(p.quantity)||1),0));
  const box=document.getElementById("cart-items");
  if (!cart.length) { box.innerHTML='<div class="empty-state"><div class="empty-icon">🛒</div><h3>Your cart is empty</h3><p>Add something you love and it will appear here.</p></div>'; return; }
  box.innerHTML=cart.map(p=>`<div class="cart-item"><img src="${escapeHTML(p.imageUrl||"https://placehold.co/150x150?text=ShopEasy")}" alt="${escapeHTML(p.name)}" onerror="this.onerror=null;this.src='https://placehold.co/150x150?text=ShopEasy';"><div><h3>${escapeHTML(p.name)}</h3><p class="cart-item-price">${money(p.price)}</p><div class="quantity-controls"><button type="button" data-quantity-id="${Number(p.id)}" data-delta="-1" aria-label="Decrease quantity">−</button><span>${Number(p.quantity)||1}</span><button type="button" data-quantity-id="${Number(p.id)}" data-delta="1" aria-label="Increase quantity">+</button></div></div><button class="remove-item" type="button" data-remove-id="${Number(p.id)}">Remove</button></div>`).join("");
}
function openCart() { renderCart(); overlay.classList.remove("hidden"); cartPanel.classList.remove("hidden"); document.body.style.overflow="hidden"; }
function closePanels() { overlay.classList.add("hidden"); cartPanel.classList.add("hidden"); checkoutModal.classList.add("hidden"); ordersModal.classList.add("hidden"); document.body.style.overflow=""; }
function openModal(modal) { overlay.classList.remove("hidden"); modal.classList.remove("hidden"); document.body.style.overflow="hidden"; }
function renderOrders() {
  const orders=getOrders(), box=document.getElementById("orders-list");
  if (!orders.length) { box.innerHTML='<div class="empty-state"><div class="empty-icon">📦</div><h3>No orders yet</h3><p>Your demo orders will show here after checkout.</p></div>'; return; }
  box.innerHTML=orders.map(o=>`<article class="order-card"><h3>Order ${escapeHTML(o.number)}</h3><p>${escapeHTML(o.date)} · ${o.items.length} item type(s)</p><p><strong>Total: ${money(o.total)}</strong></p><p class="order-status">✓ Demo order placed</p></article>`).join("");
}
document.getElementById("search-form").addEventListener("submit",e=>{e.preventDefault();renderProducts();document.getElementById("product-section").scrollIntoView({behavior:"smooth"});});
searchInput.addEventListener("input",renderProducts);
document.getElementById("clear-filters").addEventListener("click",()=>{searchInput.value="";activeCategory="All";renderProducts();});
document.querySelector(".category-nav").addEventListener("click",e=>{const b=e.target.closest("[data-category]");if(!b)return;activeCategory=b.dataset.category;renderProducts();});
productList.addEventListener("click",e=>{const b=e.target.closest("[data-add-id]");if(b)addToCart(Number(b.dataset.addId));});
document.getElementById("cart-button").addEventListener("click",openCart);
document.getElementById("close-cart").addEventListener("click",closePanels);
document.getElementById("continue-shopping").addEventListener("click",closePanels);
overlay.addEventListener("click",closePanels);
document.getElementById("cart-items").addEventListener("click",e=>{const q=e.target.closest("[data-quantity-id]"),r=e.target.closest("[data-remove-id]");if(q)changeQuantity(Number(q.dataset.quantityId),Number(q.dataset.delta));if(r)removeFromCart(Number(r.dataset.removeId));});
document.getElementById("checkout-button").addEventListener("click",()=>{if(!getCart().length){showToast("Your cart is empty.");return;}cartPanel.classList.add("hidden");openModal(checkoutModal);});
document.getElementById("close-checkout").addEventListener("click",closePanels);
document.getElementById("checkout-form").addEventListener("submit",e=>{
  e.preventDefault();const cart=getCart();if(!cart.length){closePanels();showToast("Your cart is empty.");return;}
  const form=new FormData(e.currentTarget), total=cart.reduce((s,p)=>s+(Number(p.price)||0)*(Number(p.quantity)||1),0), orders=getOrders();
  const order={number:"SE"+Date.now().toString().slice(-8),date:new Date().toLocaleString("en-IN"),customer:{name:form.get("name"),phone:form.get("phone"),address:form.get("address")},items:cart,total};
  orders.unshift(order);localStorage.setItem(ORDERS_KEY,JSON.stringify(orders));localStorage.setItem(CART_KEY,"[]");e.currentTarget.reset();closePanels();renderCart();showToast(`Demo order ${order.number} placed successfully`);
});
document.getElementById("orders-button").addEventListener("click",()=>{renderOrders();openModal(ordersModal);});
document.getElementById("close-orders").addEventListener("click",closePanels);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closePanels();});
renderCart();
document.addEventListener("DOMContentLoaded",loadProducts);
