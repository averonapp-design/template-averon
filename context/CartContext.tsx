import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface Product {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  categoria: string;
  destaque?: boolean;
  tags?: string[];
}

export interface CartItem {
  product: Product;
  quantidade: number;
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  totalValor: number;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantidade: (productId: string, quantidade: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = "averon_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(CART_KEY).then((raw) => {
      if (raw) {
        try {
          setItems(JSON.parse(raw));
        } catch {}
      }
    });
  }, []);

  function persist(nextItems: CartItem[]) {
    setItems(nextItems);
    AsyncStorage.setItem(CART_KEY, JSON.stringify(nextItems));
  }

  const addItem = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      const next = existing
        ? prev.map((i) =>
            i.product.id === product.id
              ? { ...i, quantidade: i.quantidade + 1 }
              : i
          )
        : [...prev, { product, quantidade: 1 }];
      AsyncStorage.setItem(CART_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.product.id !== productId);
      AsyncStorage.setItem(CART_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateQuantidade = useCallback(
    (productId: string, quantidade: number) => {
      setItems((prev) => {
        const next =
          quantidade <= 0
            ? prev.filter((i) => i.product.id !== productId)
            : prev.map((i) =>
                i.product.id === productId ? { ...i, quantidade } : i
              );
        AsyncStorage.setItem(CART_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const clearCart = useCallback(() => {
    setItems([]);
    AsyncStorage.removeItem(CART_KEY);
  }, []);

  const totalItems = items.reduce((s, i) => s + i.quantidade, 0);
  const totalValor = items.reduce(
    (s, i) => s + i.product.valor * i.quantidade,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        totalValor,
        addItem,
        removeItem,
        updateQuantidade,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
