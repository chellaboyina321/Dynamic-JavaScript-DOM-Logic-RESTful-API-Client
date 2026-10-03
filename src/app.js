import "./style.css";
import { fetchProducts } from "./api.js";

const state = {
  products: [],
  search: "",
  category: "all",
  sort: "default",
  loading: true,
};

const cachedProductsKey = "dynamic-products-cache";
const preferencesKey = "dynamic-products-preferences";

const app = document.querySelector("#app");

app.innerHTML = `
  <header class="app-header">
    <div>
      <p class="eyebrow">REST API Client</p>
      <h1>Dynamic Product Explorer</h1>
      <p class="subtitle">Live data, instant filtering, sorting, and cached preferences.</p>
    </div>
    <button id="themeToggle" class="theme-button" type="button">🌙 Dark</button>
  </header>

  <main>
    <section class="controls" aria-label="Product controls">
      <input
        id="searchInput"
        type="search"
        placeholder="Search products..."
        aria-label="Search products"
      />

      <select id="categorySelect" aria-label="Filter by category">
        <option value="all">All categories</option>
      </select>

      <select id="sortSelect" aria-label="Sort products">
        <option value="default">Default order</option>
        <option value="price-low">Price: Low to High</option>
        <option value="price-high">Price: High to Low</option>
        <option value="rating-high">Rating: High to Low</option>
        <option value="title">Title: A to Z</option>
      </select>
    </section>

    <div id="errorBanner" class="error-banner" role="alert" hidden></div>
    <div id="loading" class="loading-grid" aria-label="Loading products"></div>
    <section id="productGrid" class="product-grid" aria-live="polite"></section>
  </main>
`;

const searchInput = document.querySelector("#searchInput");
const categorySelect = document.querySelector("#categorySelect");
const sortSelect = document.querySelector("#sortSelect");
const productGrid = document.querySelector("#productGrid");
const loading = document.querySelector("#loading");
const errorBanner = document.querySelector("#errorBanner");
const themeToggle = document.querySelector("#themeToggle");

function showLoading() {
  loading.hidden = false;
  productGrid.hidden = true;
  loading.innerHTML = Array.from({ length: 6 }, () => `
    <article class="skeleton-card">
      <div class="skeleton skeleton-image"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line short"></div>
      <div class="skeleton skeleton-button"></div>
    </article>
  `).join("");
}

function hideLoading() {
  loading.hidden = true;
  productGrid.hidden = false;
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
}

function hideError() {
  errorBanner.hidden = true;
  errorBanner.textContent = "";
}

function savePreferences() {
  localStorage.setItem(
    preferencesKey,
    JSON.stringify({
      search: state.search,
      category: state.category,
      sort: state.sort,
      theme: document.body.dataset.theme || "light",
    }),
  );
}

function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(preferencesKey) || "null");

    if (!saved) return;

    state.search = saved.search || "";
    state.category = saved.category || "all";
    state.sort = saved.sort || "default";

    searchInput.value = state.search;
    categorySelect.value = state.category;
    sortSelect.value = state.sort;

    if (saved.theme === "dark") {
      document.body.dataset.theme = "dark";
      themeToggle.textContent = "☀️ Light";
    }
  } catch {
    localStorage.removeItem(preferencesKey);
  }
}

function saveProductsToCache(products) {
  localStorage.setItem(
    cachedProductsKey,
    JSON.stringify({
      timestamp: Date.now(),
      products,
    }),
  );
}

function loadProductsFromCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(cachedProductsKey) || "null");

    if (!cached?.products?.length) return null;

    const maxAge = 1000 * 60 * 30;

    if (Date.now() - cached.timestamp > maxAge) {
      localStorage.removeItem(cachedProductsKey);
      return null;
    }

    return cached.products;
  } catch {
    localStorage.removeItem(cachedProductsKey);
    return null;
  }
}

function populateCategories() {
  const categories = [...new Set(state.products.map((product) => product.category))].sort();

  categorySelect.innerHTML = `
    <option value="all">All categories</option>
    ${categories.map(
      (category) => `<option value="${category}">${category}</option>`,
    ).join("")}
  `;

  categorySelect.value = state.category;
}

function getFilteredProducts() {
  const query = state.search.trim().toLowerCase();

  const filtered = state.products.filter((product) => {
    const matchesSearch =
      !query ||
      product.title.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query);

    const matchesCategory =
      state.category === "all" || product.category === state.category;

    return matchesSearch && matchesCategory;
  });

  switch (state.sort) {
    case "price-low":
      return [...filtered].sort((a, b) => a.price - b.price);
    case "price-high":
      return [...filtered].sort((a, b) => b.price - a.price);
    case "rating-high":
      return [...filtered].sort(
        (a, b) => (b.rating?.rate || 0) - (a.rating?.rate || 0),
      );
    case "title":
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    default:
      return filtered;
  }
}

function renderProducts() {
  const products = getFilteredProducts();

  if (!products.length) {
    productGrid.innerHTML = `
      <div class="empty-state">
        <h2>No products found</h2>
        <p>Try a different search term or category.</p>
      </div>
    `;
    return;
  }

  productGrid.innerHTML = products.map((product) => `
    <article class="product-card">
      <img
        src="${product.image}"
        alt="${product.title}"
        loading="lazy"
      />

      <div class="product-content">
        <span class="category">${product.category}</span>
        <h2>${product.title}</h2>
        <p>${product.description}</p>

        <div class="product-meta">
          <strong>$${product.price.toFixed(2)}</strong>
          <span>⭐ ${product.rating?.rate ?? "N/A"}</span>
        </div>

        <button class="cart-button" type="button" data-product-id="${product.id}">
          Add to Cart
        </button>
      </div>
    </article>
  `).join("");

  document.querySelectorAll(".cart-button").forEach((button) => {
    button.addEventListener("click", () => {
      addToCart(Number(button.dataset.productId));
      button.textContent = "Added ✓";
    });
  });
}

function addToCart(productId) {
  const cart = JSON.parse(localStorage.getItem("dynamic-cart") || "[]");

  if (!cart.includes(productId)) {
    cart.push(productId);
    localStorage.setItem("dynamic-cart", JSON.stringify(cart));
  }
}

async function loadProducts() {
  showLoading();
  hideError();

  const cached = loadProductsFromCache();

  if (cached) {
    state.products = cached;
    populateCategories();
    hideLoading();
    renderProducts();
    return;
  }

  try {
    state.products = await fetchProducts();
    saveProductsToCache(state.products);
    populateCategories();
    hideLoading();
    renderProducts();
  } catch (error) {
    hideLoading();
    showError(
      "Unable to load products right now. Please check your connection and try again.",
    );
    console.error(error);
  }
}

searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  savePreferences();
  renderProducts();
});

categorySelect.addEventListener("change", (event) => {
  state.category = event.target.value;
  savePreferences();
  renderProducts();
});

sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  savePreferences();
  renderProducts();
});

themeToggle.addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  document.body.dataset.theme = nextTheme;
  themeToggle.textContent = nextTheme === "dark" ? "☀️ Light" : "🌙 Dark";
  savePreferences();
});

loadPreferences();
loadProducts();