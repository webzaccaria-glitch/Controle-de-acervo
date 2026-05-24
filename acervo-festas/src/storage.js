// Salva e carrega dados do localStorage (persiste no navegador do usuário)
export const save = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.error('Erro ao salvar:', e); }
};

export const load = (key, fallback) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error('Erro ao carregar:', e);
    return fallback;
  }
};

export const remove = (key) => {
  try { localStorage.removeItem(key); } catch (e) {}
};
