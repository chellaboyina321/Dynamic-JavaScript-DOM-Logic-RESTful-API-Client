const API_URL = "https://dummyjson.com/products?limit=0";

export async function fetchProducts() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const data = await response.json();

  return data.products;
}
